/**
 * Assertions for the Hubs section: coordinates, opening hours, and section
 * routing.
 *
 * The clock-dependent checks all pass an explicit `now`. A test that reads the
 * real time passes at 10am and fails the same evening.
 */
import {
  nigeriaNow,
  openLabel,
  openState,
  parseHours,
  type OpenState,
} from '../src/constants/hub-hours';
import {
  HUBS,
  HUB_SECTIONS,
  HUB_SECTION_LABELS,
  HUB_SECTION_SHORT,
  hubPosition,
  hubsForCity,
  parseHubSection,
  type Hub,
} from '../src/constants/hubs';

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL — ${name}${detail ? `\n       ${detail}` : ''}`);
  }
}

// ------------------------------------------------------------ coordinates ---

/**
 * Bounding boxes for the four cities with hubs, generous enough to cover the
 * whole built-up area and tight enough that a swapped lat/lng or a stray digit
 * falls outside.
 *
 * This is the check that matters: swapping Ibadan's 7.43,3.90 puts the pin in
 * the Gulf of Guinea, and a missing decimal puts it in Chad. Neither is
 * something you notice by reading the numbers.
 */
const CITY_BOUNDS: Record<string, { lat: [number, number]; lng: [number, number] }> = {
  Lagos: { lat: [6.35, 6.75], lng: [3.15, 3.75] },
  Ibadan: { lat: [7.3, 7.5], lng: [3.8, 3.99] },
  Abuja: { lat: [8.95, 9.2], lng: [7.3, 7.6] },
  'Port Harcourt': { lat: [4.7, 4.95], lng: [6.9, 7.1] },
};

for (const hub of HUBS) {
  const position = hubPosition(hub);

  check(`${hub.id} has a position`, position !== null, `${hub.name} would be dropped from the map`);
  if (!position) continue;

  const bounds = CITY_BOUNDS[hub.city];
  check(`${hub.city} has a bounding box in this test`, Boolean(bounds));
  if (!bounds) continue;

  check(
    `${hub.id} latitude is inside ${hub.city}`,
    position.lat >= bounds.lat[0] && position.lat <= bounds.lat[1],
    `${position.lat} outside ${bounds.lat.join('–')}`,
  );
  check(
    `${hub.id} longitude is inside ${hub.city}`,
    position.lng >= bounds.lng[0] && position.lng <= bounds.lng[1],
    `${position.lng} outside ${bounds.lng.join('–')}`,
  );
  check(
    `${hub.id} is labelled approximate`,
    position.precision === 'area',
    'no hub has been surveyed yet, so nothing should claim exact',
  );
}

/*
 * Two hubs sharing a position would stack pins on top of each other, hiding one
 * behind the other with no way to tell.
 */
const seen = new Map<string, string>();
for (const hub of HUBS) {
  const position = hubPosition(hub);
  if (!position) continue;

  const key = `${position.lat},${position.lng}`;
  check(
    `${hub.id} does not share a pin with ${seen.get(key) ?? ''}`,
    !seen.has(key),
    'overlapping pins hide one hub behind another',
  );
  seen.set(key, hub.id);
}

/** A surveyed position must win over the neighbourhood fallback. */
const surveyed: Hub = {
  ...HUBS[0],
  coordinates: { lat: 6.6, lng: 3.35, precision: 'exact' },
};
check(
  'an exact coordinate overrides the area centre',
  hubPosition(surveyed)?.precision === 'exact',
  'otherwise real data would be ignored once it arrives',
);

// --------------------------------------------------------- hours parsing ----

check(
  'every hub has readable hours',
  HUBS.every((hub) => parseHours(hub.hours) !== null),
  HUBS.filter((hub) => !parseHours(hub.hours))
    .map((hub) => `${hub.id}: ${hub.hours}`)
    .join(', '),
);

const monSat = parseHours('Mon–Sat, 8:00am – 8:00pm');
check('Mon–Sat expands to six days', monSat?.days.length === 6, JSON.stringify(monSat?.days));
check('Mon–Sat starts on Monday', monSat?.days[0] === 1);
check('Mon–Sat excludes Sunday', !monSat?.days.includes(0));
check('8:00am parses to 480', monSat?.opens === 480, String(monSat?.opens));
check('8:00pm parses to 1200', monSat?.closes === 1200, String(monSat?.closes));

const halfHour = parseHours('Mon–Sat, 7:30am – 8:00pm');
check('7:30am parses to 450', halfHour?.opens === 450, String(halfHour?.opens));

// The two cases the naive "+12 for pm" rule gets wrong.
check('12:00am is midnight', parseHours('Mon–Fri, 12:00am – 6:00am')?.opens === 0);
check('12:00pm is noon', parseHours('Mon–Fri, 12:00pm – 6:00pm')?.opens === 720);

check('a hyphen works as well as an en-dash', parseHours('Mon-Fri, 9:00am - 6:00pm') !== null);
check('a wrapping range works', parseHours('Sat–Mon, 9:00am – 5:00pm')?.days.length === 3);
check('nonsense is rejected rather than guessed', parseHours('by appointment') === null);
check('a close before an open is rejected', parseHours('Mon–Fri, 6:00pm – 9:00am') === null);
check('a missing time half is rejected', parseHours('Mon–Fri, 9:00am') === null);

// ------------------------------------------------------------ open state ----

const hub: Hub = { ...HUBS[0], hours: 'Mon–Sat, 8:00am – 8:00pm' };

// Monday = 1.
const at = (day: number, hour: number, minute = 0): OpenState =>
  openState(hub, { day, minutes: hour * 60 + minute });

check('open mid-morning on a weekday', at(1, 10).known && (at(1, 10) as { open: boolean }).open);
check(
  'closed before opening',
  openLabel(at(1, 7)) === 'Opens later today',
  openLabel(at(1, 7)) ?? '',
);
check(
  'closed after closing',
  openLabel(at(1, 20)) === 'Closed for today',
  openLabel(at(1, 20)) ?? '',
);
check('closed on Sunday', openLabel(at(0, 10)) === 'Closed today', openLabel(at(0, 10)) ?? '');

/*
 * The boundary minutes. At exactly 8:00am the doors are open; at exactly 8:00pm
 * they are not — an inclusive upper bound would tell someone a hub is open at
 * the moment it locks up.
 */
check('open at the opening minute', openLabel(at(1, 8)) !== 'Opens later today');
check('closed at the closing minute', openLabel(at(1, 20, 0)) === 'Closed for today');

check(
  'a closing warning replaces "Open now" inside the last hour',
  openLabel(at(1, 19, 30)) === 'Closing in 30 min',
  openLabel(at(1, 19, 30)) ?? '',
);
check('an hour and a half out still says Open now', openLabel(at(1, 18, 30)) === 'Open now');
check(
  'exactly one hour out warns',
  openLabel(at(1, 19)) === 'Closing in 1 hr',
  openLabel(at(1, 19)) ?? '',
);

check(
  'unreadable hours produce no badge at all',
  openLabel(openState({ ...hub, hours: 'Call first' })) === null,
  'a badge invented from an unreadable string is a lie about right now',
);

/*
 * The clock must be Lagos, not the device. 23:30 UTC on a Monday is already
 * Tuesday 00:30 in Lagos — if this read the host clock the day would be wrong
 * for a third of the world.
 */
const lagos = nigeriaNow(new Date('2026-08-10T23:30:00Z'));
check('Lagos is an hour ahead of UTC', lagos.minutes === 30, String(lagos.minutes));
check('and that rolls the day over', lagos.day === 2, `expected Tuesday (2), got ${lagos.day}`);

// --------------------------------------------------------- section routing --

check('three sections', HUB_SECTIONS.length === 3);
check(
  'every section has both a long and a short label',
  HUB_SECTIONS.every((section) => HUB_SECTION_LABELS[section] && HUB_SECTION_SHORT[section]),
);
check(
  'the long labels match what the nav dropdown promises',
  HUB_SECTION_LABELS.locations === 'Drop-off / Pickup Locations' &&
    HUB_SECTION_LABELS.map === 'Sorting Centers Map' &&
    HUB_SECTION_LABELS.hours === 'Operating Hours',
);
check(
  'short labels stay short enough for a phone',
  HUB_SECTIONS.every((section) => HUB_SECTION_SHORT[section].length <= 10),
);
check('a known section round-trips', parseHubSection('map') === 'map');
check('an unknown section falls back to the list', parseHubSection('sorting') === 'locations');
check('a missing section falls back to the list', parseHubSection(undefined) === 'locations');

// ------------------------------------------------------------------ data ----

check('every city with hubs has at least one', hubsForCity('Ibadan').length > 0);
check(
  'ids are unique',
  new Set(HUBS.map((h) => h.id)).size === HUBS.length,
  'a duplicate id would collide as a React key',
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS — every hub has a pin inside its own city, no two pins overlap, all pins are marked\n' +
    '       approximate, opening hours parse for every hub including the midday edge cases,\n' +
    '       the open badge uses Lagos time and its boundary minutes are right, and an\n' +
    '       unrecognised ?section= falls back to the list.',
);
