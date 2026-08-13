/**
 * Assertions for the type scale.
 *
 * The bug this pins: seven of the twelve tokens were all 14px — `body`,
 * `caption`, `meta`, `label`, `badge`, `button` and `screenSubtitle` rendered
 * identically. The names described a hierarchy the values did not have, so a
 * footnote was the same size as the sentence it footnoted.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FontSize, Typography, lineHeightFor } from '../src/constants/theme';

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL — ${name}${detail ? `\n       ${detail}` : ''}`);
  }
}

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

// ------------------------------------------------------------ the ramp -----

const steps = Object.entries(FontSize) as [string, number][];

const descending = steps.every(([, size], i) => i === 0 || size < steps[i - 1][1]);

check(
  'the ramp is strictly descending',
  descending,
  steps.map(([name, size]) => `${name}=${size}`).join(', '),
);

check('body is 16', FontSize.body === 16, 'the accessibility floor for mobile body text');
check(
  'nothing is smaller than 11',
  steps.every(([, size]) => size >= 11),
  'this app had 9px and 10px text, which is unreadable on a phone in daylight',
);
check(
  'every step is a whole number',
  steps.every(([, size]) => Number.isInteger(size)),
  'a fractional size renders sub-pixel and blurs',
);

// ------------------------------------------------- the order the names imply

const size = (token: keyof typeof Typography): number => {
  const value = Typography[token] as { fontSize?: number };
  return value.fontSize ?? 0;
};

/*
 * The heart of it. Each pair is a name that promises a relationship, checked
 * against the value that has to deliver it.
 */
const ORDER: [keyof typeof Typography, keyof typeof Typography][] = [
  ['screenTitle', 'sectionHeading'],
  ['sectionHeading', 'sectionTitle'],
  ['sectionTitle', 'body'],
  ['body', 'meta'],
  ['meta', 'caption'],
  ['caption', 'micro'],
];

for (const [bigger, smaller] of ORDER) {
  check(
    `${bigger} is larger than ${smaller}`,
    size(bigger) > size(smaller),
    `${bigger}=${size(bigger)} vs ${smaller}=${size(smaller)}`,
  );
}

check(
  'a subtitle is smaller than the body it introduces',
  size('screenSubtitle') < size('body'),
  'at the same size it competed with the content beneath it',
);
check(
  'caption is genuinely smaller than meta',
  size('caption') < size('meta'),
  'this is the pair that was identical, and the reason footnotes read as body copy',
);
check('cardTitle matches sectionTitle', size('cardTitle') === size('sectionTitle'));

/*
 * How many distinct sizes the tokens use. Twelve tokens sharing four sizes was
 * the old state at the small end; the point is that they now spread across the
 * ramp rather than piling on one step.
 */
const distinct = new Set(
  (Object.keys(Typography) as (keyof typeof Typography)[]).map(size).filter((n) => n > 0),
);
check(
  'the tokens use at least six distinct sizes',
  distinct.size >= 6,
  `uses ${distinct.size}: ${[...distinct].sort((a, b) => b - a).join(', ')}`,
);

// --------------------------------------------------------- line heights ----

check('large text gets tighter leading', lineHeightFor(32) / 32 < lineHeightFor(12) / 12);
check('a 16px body line is 24', lineHeightFor(16) === 24);
check('leading is always a whole number', [11, 12, 14, 16, 17, 22, 28, 32].every((n) => Number.isInteger(lineHeightFor(n))));
check(
  'every sized token that wraps declares a line height',
  (['body', 'meta', 'caption', 'screenSubtitle', 'sectionTitle', 'cardTitle'] as const).every(
    (token) => 'lineHeight' in (Typography[token] as object),
  ),
  'without one, RN falls back to the platform default and lines sit unevenly',
);

// ------------------------------------------------- no raw sizes in screens --

const FILES = [
  'src/app/(tabs)/about.tsx',
  'src/app/(tabs)/admin.tsx',
  'src/app/(tabs)/admin-ops.tsx',
  'src/app/(tabs)/admin-users.tsx',
  'src/app/(tabs)/available-packages.tsx',
  'src/app/(tabs)/book.tsx',
  'src/app/(tabs)/driver.tsx',
  'src/app/(tabs)/driver-signup.tsx',
  'src/app/(tabs)/index.tsx',
  'src/app/(tabs)/legal.tsx',
  'src/app/(tabs)/locations.tsx',
  'src/app/(tabs)/support.tsx',
  'src/app/(tabs)/tracking.tsx',
  'src/app/parcel/[id].tsx',
  'src/app/rate-calculator.tsx',
  'src/app/corporate.tsx',
  'src/components/ui/app-nav-bar.tsx',
  'src/components/ui/admin-shell.tsx',
  'src/components/ui/dialog.tsx',
  'src/components/ui/hub-editor.tsx',
  'src/components/ui/moderation-dialog.tsx',
  'src/components/ui/top-status-bar.tsx',
  'src/components/themed-text.tsx',
];

for (const file of FILES) {
  const source = read(file);
  const raw = source.match(/fontSize: \d/g) ?? [];
  check(
    `${file.replace('src/', '')} sets no raw font size`,
    raw.length === 0,
    `${raw.length} left — every size belongs on the ramp in theme.ts`,
  );
}

/*
 * The one deliberate exception, and it lives in the theme where it can be seen.
 * A logotype is a drawn mark that happens to be set in type; snapping it to the
 * ramp shrank the brand below a card title.
 */
const theme = read('src/constants/theme.ts');
check(
  'the wordmark is off-ramp on purpose, and says so',
  theme.includes('wordmark:') && theme.includes('Deliberately off the ramp'),
);
check(
  'and the nav uses that token rather than a number',
  read('src/components/ui/app-nav-bar.tsx').includes('...Typography.wordmark'),
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS — the ramp descends without ties, body is 16, nothing is below 11 or fractional,\n' +
    '       every token name matches its size order (caption really is smaller than meta),\n' +
    '       leading tightens as size grows, and no screen sets a raw font size.',
);
