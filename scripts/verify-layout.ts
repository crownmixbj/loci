/**
 * Assertions for screen chrome: safe areas, and what stays put when you scroll.
 *
 * Both of these are invisible in a simulator with no notch and on every web
 * browser, which is exactly why they reached a tester's phone. A title drawn
 * under the dynamic island is not a crash and produces no warning — it just
 * looks broken, and only on hardware.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL — ${name}${detail ? `\n       ${detail}` : ''}`);
  }
}

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

/** Comments stripped: these files explain the rules they enforce. */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** Collapses the line breaks Prettier introduces inside JSX. */
const flat = (source: string) => source.replace(/\s+/g, ' ');

const book = read('src/app/(tabs)/book.tsx');
const bookCode = code(book);
const tabsLayout = code(read('src/app/(tabs)/_layout.tsx'));
const stickyHeader = code(read('src/components/ui/sticky-header.tsx'));
const banner = code(read('src/components/ui/build-banner.tsx'));
const topInset = read('src/hooks/use-top-inset.ts');

// -------------------------------------------------------------- safe areas ---

check(
  'the tabs layout reserves the status bar',
  flat(tabsLayout).includes('paddingTop: topInset'),
  'without it every tab screen draws its title under the notch — a native stack with headerShown:false owns the whole window',
);

check(
  'screens outside the tabs group reserve it too',
  flat(stickyHeader).includes('paddingTop: topInset'),
  'parcel detail and the auth screens sit outside (tabs) and inherit nothing from it',
);

/*
 * Exactly one wrapper per route, or the gap is applied twice.
 *
 * `StickyHeaderScreen` is for routes outside the tabs group. If a screen inside
 * (tabs) ever adopted it, that screen would be padded by both.
 */
const tabScreens = [
  'book',
  'my-packages',
  'available-packages',
  'driver',
  'locations',
  'about',
  'tracking',
  'admin',
];

for (const screen of tabScreens) {
  let source: string;
  try {
    source = read(`src/app/(tabs)/${screen}.tsx`);
  } catch {
    continue;
  }

  check(
    `${screen} does not stack a second safe-area wrapper`,
    !code(source).includes('StickyHeaderScreen'),
    'the tabs layout already reserves the inset for it, so this would double the gap',
  );
}

/*
 * The banner and the layouts must not both claim the strip.
 *
 * When the build banner renders it is the topmost thing in the tree, so it
 * takes the inset and the layouts give theirs up. This is the coupling that
 * makes a disconnected build look right rather than showing the gap twice.
 */
check(
  'the build banner carries the inset itself',
  flat(banner).includes('paddingTop: insets.top'),
  'it is the topmost element when it renders',
);
check(
  'and the shared hook yields to it',
  flat(topInset).includes('return backendConfigured ? insets.top : 0;'),
  'otherwise a disconnected build reserves the status bar twice',
);
check(
  'the yield is driven by a build-time constant, not state',
  topInset.includes("from '@/lib/build-info'") && !/useState|useEffect/.test(topInset),
  'a runtime toggle here would re-layout every screen mid-session',
);

// ---------------------------------------------------- Post a Parcel chrome ---

/*
 * The title and delivery type are siblings of the ScrollView, not children.
 *
 * React Native has no `position: sticky`. The only arrangement that keeps a
 * block still while content moves under it is to put it outside the scroll
 * container — the same thing `StickyHeaderScreen` does.
 *
 * The split is anchored on the ref rather than on `<ScrollView`, because
 * `useRef<ScrollView>(null)` appears four hundred lines above the render as a
 * type argument: searching for the tag finds the annotation first and slices an
 * empty string, which failed every assertion below for the wrong reason.
 */
const scrollStart = bookCode.indexOf('ref={scrollRef}');

const pinnedBlock = bookCode.slice(bookCode.indexOf('<KeyboardAvoidingView'), scrollStart);

check(
  'the screen title is outside the ScrollView',
  pinnedBlock.includes('<ScreenHeader'),
  'inside it, the title scrolls away under the status bar — the reported bug',
);
check(
  'the delivery type selector is outside the ScrollView',
  pinnedBlock.includes('<SegmentedControl'),
  'it decides the price line and which fields appear, so it cannot scroll out of sight',
);
check(
  'the price hint travels with the selector',
  pinnedBlock.includes('PRICING.base.local'),
  'a selector pinned away from the rate it sets is worse than neither being pinned',
);

const scrollBlock = bookCode.slice(scrollStart);

check(
  'the form fields are still inside the ScrollView',
  scrollBlock.includes('Item details') && scrollBlock.includes('<PhotoPicker'),
  'the whole point is that the form scrolls',
);
check(
  'the pinned block is not repeated inside the scroll area',
  !scrollBlock.includes('<ScreenHeader') && !scrollBlock.includes('<SegmentedControl'),
  'two delivery type selectors would disagree the moment one was tapped',
);

check(
  'the ScrollView is bounded',
  flat(bookCode).includes('<ScrollView ref={scrollRef} style={styles.flex}'),
  'without flex:1 it sizes to its content and pushes the pinned block off screen',
);

/*
 * The pinned block sets its own padding rather than reusing `screenPadding`.
 *
 * That constant carries `paddingBottom: Spacing.six` — 64px meant for the end
 * of a scrolling page. Under a pinned header it is dead space that pushes the
 * form off a small screen.
 */
check(
  'the pinned block does not reuse screenPadding',
  !bookCode.includes('screenPadding'),
  'its bottom padding is sized for the end of a page, not the top of one',
);
check(
  'the pinned block is opaque',
  flat(bookCode).includes('backgroundColor: theme.background, borderBottomColor: theme.border'),
  'content scrolling under a transparent header is unreadable',
);

/*
 * Scroll-to-first-error still has something to scroll.
 *
 * The offset is measured with onLayout relative to the ScrollView's content, so
 * moving two blocks out of it changes the number — but it is measured at
 * runtime, so it re-derives itself. What would break it is the ref or the
 * measurement being dropped in the refactor.
 */
check(
  'the error scroll still targets a card inside the ScrollView',
  scrollBlock.includes('itemCardY.current = event.nativeEvent.layout.y'),
  'the measured card has to be inside the container being scrolled',
);
check(
  'and the ScrollView still holds the ref it scrolls',
  scrollBlock.includes('ref={scrollRef}') && bookCode.includes('scrollRef.current?.scrollTo'),
);

// --------------------------------------------- the header that stays put ---

const hub = read('src/components/ui/driver-hub.tsx');
const sticky = read('src/components/ui/sticky-header.tsx');
const hubCode = code(hub);

check(
  'there is one wrapper for a screen whose own header stays put',
  sticky.includes('export function PinnedHeaderScreen'),
  'book.tsx assembled this inline; a second screen doing it again is how three variants appear',
);
check(
  'it fills the screen in a column',
  /pinnedScreen:\s*\{[\s\S]{0,400}?flex: 1,[\s\S]{0,400}?flexDirection: 'column'/.test(sticky),
  'the arrangement is the whole implementation — React Native has no position: sticky',
);
check(
  'the body takes the remaining space as a fixed box',
  /pinnedBody: \{ flex: 1 \}/.test(sticky),
  'flexGrow instead would size the body to its content and push the header off the top',
);
check(
  'the header is layered above the body',
  /pinnedHeader: \{ zIndex: 10 \}/.test(sticky),
  'Android paints by elevation rather than document order, so content slides over an unlayered header',
);
check(
  'and it reserves no safe-area inset of its own',
  !/useTopInset/.test(sticky.slice(sticky.indexOf('PinnedHeaderScreen'))),
  'the (tabs) layout reserves the status bar once; a second inset pushes the header down by a notch',
);

check(
  'the driver header is built as a sibling, not as the first row of the scroller',
  hubCode.includes('const header = (') &&
    hubCode.indexOf('const header = (') < hubCode.indexOf('<PinnedHeaderScreen'),
);
check('and it is handed to the wrapper', hubCode.includes('<PinnedHeaderScreen header={header}>'));
check(
  'the identity, the location and the bell are all in the pinned block',
  (() => {
    const from = hubCode.indexOf('const header = (');
    const to = hubCode.indexOf('return (', from);
    const block = hubCode.slice(from, to);
    return (
      block.includes('styles.avatar') &&
      block.includes('application?.baseCity') &&
      block.includes('<Bell ')
    );
  })(),
  'the bell is the worst of the three to lose: it is the only sign that something needs attention',
);
check(
  'nothing scrollable is inside the pinned block',
  (() => {
    const from = hubCode.indexOf('const header = (');
    const to = hubCode.indexOf('return (', from);
    return !hubCode.slice(from, to).includes('ScrollView');
  })(),
);
check(
  'the hub scroller is a fixed box, not a growing one',
  hubCode.includes('style={[styles.flex, { backgroundColor: theme.background }]}') &&
    /flex: \{ flex: 1 \}/.test(hubCode),
);

/*
 * A sweep, so this cannot quietly come back.
 *
 * The failure mode is invisible in source: a header rendered as the first child
 * of a ScrollView looks identical to one rendered beside it, and the difference
 * only shows on a phone once there is enough content to scroll.
 */
const headerInsideScroller = ['src/components/ui/driver-hub.tsx', 'src/app/(tabs)/book.tsx'].filter(
  (path) => {
    const source = code(read(path));
    /*
     * The JSX element, not the type.
     *
     * `useRef<ScrollView>(null)` is declared near the top of book.tsx and
     * contains the literal `<ScrollView`, so a plain indexOf finds it hundreds
     * of lines above the real element and reports a screen as broken when it is
     * not. Requiring whitespace after the name excludes `<ScrollView>`.
     */
    const scroller = source.search(/<ScrollView[\s\n]/);
    if (scroller === -1) return false;
    // The identity/title block must be declared before the scroller opens.
    const pinned = Math.max(source.indexOf('const header = ('), source.indexOf('styles.pinned'));
    return pinned === -1 || pinned > scroller;
  },
);

check(
  'no screen with a pinned block renders it inside its scroller',
  headerInsideScroller.length === 0,
  `inside the scroller: ${headerInsideScroller.join(', ') || 'none'}`,
);

// ------------------------------------------ one reading width, everywhere --

/*
 * A form field the width of a desktop window is not a matter of taste.
 *
 * Line length and target size are the two things every desktop layout
 * convention agrees on, and an input that spans 1400px fails both. Every full
 * page in this app centres its content at `MaxContentWidth` — except when
 * somebody rewrites a screen and does not carry the container across, which is
 * exactly what happened to Schedule My Journey when the marketplace board was
 * stripped out of it.
 *
 * This sweeps the routes rather than naming them, so a new screen is covered
 * the day it is added rather than the day somebody notices.
 */
const DELIBERATE_FULL_BLEED: Record<string, string> = {
  '_layout.tsx': 'not a page — the route group shell',
  'index.tsx': 'the landing page, full-bleed by design at 1280 with its own inner widths',
  'about.tsx': 'marketing, with its own narrower measures per section',
};

const routes = readdirSync(join(ROOT, 'src/app/(tabs)'))
  .filter((name) => name.endsWith('.tsx'))
  .filter((name) => !(name in DELIBERATE_FULL_BLEED));

const unconstrained = routes.filter((name) => {
  const source = read(`src/app/(tabs)/${name}`);
  // Either the screen sets it, or it renders inside a shell that does.
  return !source.includes('MaxContentWidth') && !source.includes('AdminShell');
});

check(
  'every route constrains its content width',
  unconstrained.length === 0,
  `unconstrained: ${unconstrained.join(', ') || 'none'} — add the house container or list it as deliberate`,
);

check(
  'and centring is paired with a width to centre',
  routes.every((name) => {
    const source = read(`src/app/(tabs)/${name}`);
    if (!source.includes("alignItems: 'center'")) return true;
    return source.includes('maxWidth') || source.includes('AdminShell');
  }),
  'alignItems center on a full-width child does nothing, which is how two screens looked centred in the source and stretched in a browser',
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS — every native screen reserves the status bar exactly once, the build banner and\n' +
    '       the layouts never both claim it, on Post a Parcel the title, the delivery type\n' +
    '       and its rate stay pinned while only the form scrolls underneath, the driver\n' +
    '       identity and bell stay put while the hub scrolls under them, and no route\n' +
    '       stretches its content across a desktop viewport.',
);
