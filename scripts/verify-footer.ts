/**
 * Assertions for the global footer.
 *
 * "Consistent across every page" is the kind of requirement that is true on the
 * day it ships and false a month later, because the way it breaks is by
 * *omission* — somebody adds a screen and does not know there is a rule. So the
 * page list here is read from the filesystem rather than written down: a new
 * route with no footer fails this file without anyone having to remember to
 * come back and add it.
 *
 * The second thing guarded is the links. Four of the six were dead for months —
 * "Privacy Policy" rendered as plain text, because the screen behind it did not
 * exist when the footer was written. A footer that lists a privacy policy and
 * refuses to open one is worse than one that never mentions it, and legal links
 * are exactly the ones somebody hunts for at the moment they have stopped
 * trusting you.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
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

/** Comments stripped: these files explain the rules they follow. */
const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const footer = read('src/components/Footer.tsx');

// ------------------------------------------------------- every page has one --

/** Every screen file under `src/app`, found rather than listed. */
function screens(dir = 'src/app'): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...screens(path));
      continue;
    }
    // `_layout` is chrome, not a page. `+html` is the document shell.
    if (!entry.name.endsWith('.tsx')) continue;
    if (entry.name === '_layout.tsx' || entry.name.startsWith('+')) continue;
    found.push(path);
  }

  return found;
}

/*
 * The two deliberate exemptions, named here so the list is a decision rather
 * than an accident.
 *
 *   admin*   an internal console. A brand strip inviting the person running
 *            dispatch to become a driver is noise on a tool, not navigation.
 *   capture  one full-screen camera step, opened by scanning a QR from another
 *            device. There is nothing to navigate to and no page to be at the
 *            bottom of.
 */
const EXEMPT = /\/(admin[^/]*|capture)\b/;

const pages = screens().filter((path) => !EXEMPT.test(path));

check(
  'the page list was actually found',
  pages.length >= 20,
  `${pages.length} pages — a broken walk would pass every check below by having nothing to check`,
);

/*
 * A page that hands its whole layout to `AuthShell` is covered by it.
 *
 * ⚠ Named by what a page *does*, not by a list of file paths.
 *
 *   This was a map of the four auth screens that existed at the time. Adding a
 *   fifth — `confirm.tsx`, where email links land — failed this file for a
 *   footer it does in fact have, because the map had not been updated. A rule
 *   maintained by hand is a rule that fails the next person to follow it
 *   correctly.
 */
const DELEGATE = 'AuthShell';

for (const path of pages) {
  const source = code(read(path));

  check(
    `${path.replace('src/app/', '')} renders the footer`,
    /<Footer\b/.test(source) || new RegExp(`<${DELEGATE}\\b`).test(source),
    `expected <Footer /> or <${DELEGATE}> — a page without either is how "every page" quietly stops being true`,
  );
}

check(
  'AuthShell carries it for every auth screen',
  /<Footer\b/.test(code(read('src/components/ui/auth-shell.tsx'))),
  'five screens are covered by this one file; without it they are all bare',
);

/*
 * ⚠ Last child of the scroller, not merely present.
 *
 *   A footer above the content it belongs under is not a footer, and the
 *   difference does not show up in a "does the file contain <Footer />" check.
 *   Every occurrence must be immediately before a `</ScrollView>`.
 */
for (const path of [...pages, 'src/components/ui/auth-shell.tsx']) {
  const source = code(read(path));
  const occurrences = (source.match(/<Footer\b[^/]*\/>/g) ?? []).length;
  if (occurrences === 0) continue;

  const atTheEnd = (source.match(/<Footer\b[^/]*\/>\s*<\/ScrollView>/g) ?? []).length;
  check(
    `${path.replace('src/app/', '')} puts it at the bottom of the page`,
    atTheEnd === occurrences,
    `${occurrences} footer(s), ${atTheEnd} of them last inside a scroll container`,
  );
}

/*
 * And the exemptions really are exempt — an assertion in both directions, so
 * "every page" cannot be satisfied by quietly adding it everywhere including
 * the places it was decided against.
 */
for (const path of screens().filter((p) => EXEMPT.test(p))) {
  check(
    `${path.replace('src/app/', '')} has none, as decided`,
    !/<Footer\b/.test(code(read(path))),
    'an internal console and a camera step are not pages with a bottom',
  );
}

// ----------------------------------------------------- and no dead links ----

/*
 * Parsed out of the component rather than transcribed, so this cannot pass by
 * my writing the same wrong thing twice.
 */
const links = [...footer.matchAll(/\{ label: '([^']+)'(?:, href: '([^']+)')? \}/g)].map((m) => ({
  label: m[1],
  href: m[2],
}));

check('the links parsed', links.length === 6, `${links.length} links found`);

for (const link of links) {
  check(
    `"${link.label}" goes somewhere`,
    Boolean(link.href),
    'it renders as plain text — a label that looks like a link and refuses to open is worse than no label',
  );

  if (!link.href) continue;

  /*
   * The route has to exist as a file. Expo Router is filesystem-routed, so a
   * typo'd href is a silent no-op rather than an error anyone sees.
   */
  const name = link.href.replace(/^\//, '');
  const candidates = [
    `src/app/${name}.tsx`,
    `src/app/(tabs)/${name}.tsx`,
    `src/app/(auth)/${name}.tsx`,
  ];
  check(
    `"${link.label}" resolves to a screen`,
    candidates.some((candidate) => existsSync(join(ROOT, candidate))),
    `${link.href} matches none of: ${candidates.join(', ')}`,
  );
}

check(
  'the legal links are among them',
  links.some((l) => l.label === 'Terms of Service' && l.href === '/legal') &&
    links.some((l) => l.label === 'Privacy Policy' && l.href === '/legal'),
  'these two were plain text for months, which is the failure this file exists for',
);

// --------------------------------------------------------- and it is web ----

check(
  'the footer renders nothing on a phone',
  /experience && experience !== 'web'/.test(footer),
  'a phone has the bottom tab bar; a footer above it repeats links and crowds the targets',
);
check(
  'and that is decided once, not at every call site',
  !/Platform\.OS === 'web' && <Footer/.test(read('src/app/(tabs)/about.tsx')),
  'a rule repeated at twenty call sites survives exactly as long as everyone remembers it',
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS — every page outside the admin console and the capture step ends in the footer,\n' +
    '       each one as the last thing inside its scroller, every link resolves to a screen\n' +
    '       that exists, and the whole strip renders nothing on a phone.',
);
