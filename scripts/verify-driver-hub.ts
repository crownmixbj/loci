/**
 * Assertions for the Jobs & Drivers group.
 *
 * The timeline is the part worth testing hardest: it is the screen that tells
 * someone what we sent them, so a row that overstates a delivery is worse than
 * no row at all.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONDUCT, FAQS, REQUIREMENTS } from '../src/constants/driver-guidelines';
import {
  DECISION_EMAILS_ENABLED,
  notificationTimeline,
  reviewTimeline,
} from '../src/store/application-timeline';
import { REVIEW_WORKING_DAYS, type DriverApplication } from '../src/store/driver-applications';

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL — ${name}${detail ? `\n       ${detail}` : ''}`);
  }
}

/*
 * The repo root, from the working directory rather than `__dirname`: the script
 * is bundled before it runs, so `__dirname` is wherever the bundle landed.
 */
const ROOT = process.cwd();

// --------------------------------------------------------- route coverage ---

/*
 * Every destination in the dropdown must resolve to a screen that exists.
 * A nav entry pointing at a missing route renders an "Unmatched Route" page —
 * the kind of thing that ships because nobody clicked the fourth item.
 */
const navSource = readFileSync(join(ROOT, 'src/components/ui/app-nav-bar.tsx'), 'utf8');

const DROPDOWN_ROUTES: Record<string, string> = {
  'Find Open Jobs': 'available-packages',
  'Driver Portal / Dashboard': 'driver',
  'Be a Driver / Updates': 'driver-updates',
  'Driver Guidelines & FAQs': 'driver-guidelines',
};

for (const [label, route] of Object.entries(DROPDOWN_ROUTES)) {
  check(`the nav offers "${label}"`, navSource.includes(label), 'label changed or entry removed');

  let exists = true;
  try {
    readFileSync(join(ROOT, `src/app/(tabs)/${route}.tsx`), 'utf8');
  } catch {
    exists = false;
  }
  check(`"${label}" resolves to a real screen`, exists, `src/app/(tabs)/${route}.tsx is missing`);
}

check(
  'the merged label replaced both old entries',
  navSource.includes("label: 'Jobs & Drivers'") &&
    !navSource.includes("label: 'Drivers'") &&
    !navSource.includes("label: 'Find Jobs'"),
  'a leftover Drivers or Find Jobs entry would put the same page in the nav twice',
);

check(
  'the group claims all four of its routes for the active state',
  ['/driver', '/driver-signup', '/driver-updates', '/driver-guidelines'].every((href) =>
    navSource.includes(`'${href}'`),
  ),
  'without `also`, the nav shows nothing selected on four of five destinations',
);

check(
  'the role-aware My Jobs variant is gone',
  !navSource.includes("label: 'My Jobs'"),
  'it pointed at /driver, which is now Driver Portal — the same page twice in the nav',
);

// -------------------------------------------------------------- timeline ----

const base: DriverApplication = {
  id: 'a1',
  userId: 'u1',
  reference: 'LOCI-DRV-0001',
  fullName: 'Chinedu Okafor',
  phone: '+2348030000000',
  email: 'chinedu@example.com',
  nin: '12345678901',
  address: '1 Somewhere',
  state: 'Oyo',
  baseCity: 'Ibadan',
  vehicleType: 'Car',
  plateNumber: 'ABC-123',
  licenseId: 'LIC1',
  guarantorName: 'G',
  guarantorPhone: '+234',
  guarantorRelationship: 'Friend',
  guarantorAddress: 'X',
  guarantorNin: '2',
  bankName: 'Bank',
  accountNumber: '0000000000',
  accountName: 'Chinedu Okafor',
  kinName: 'K',
  kinPhone: '+234',
  kinRelationship: 'Sibling',
  documents: {},
  status: 'pending',
  reviewNote: null,
  reviewedBy: null,
  reviewedAt: null,
  submittedAt: '2026-08-03T09:00:00Z',
  confirmationEmailSentAt: null,
  confirmationEmailError: null,
};

const NOW = new Date('2026-08-10T09:00:00Z');

// --- the review steps ---

const pending = reviewTimeline(base, NOW);
check('a pending application shows three steps', pending.length === 3, String(pending.length));
check('submission is complete', pending[0].tone === 'done');
check('the decision is pending, not claimed', pending[2].tone === 'pending');
check(
  'the decision row has no timestamp',
  pending[2].at === null,
  'a date on an event that has not happened is a fabrication',
);

const approved = reviewTimeline(
  { ...base, status: 'approved', reviewedAt: '2026-08-06T10:00:00Z' },
  NOW,
);
check('an approval is marked done', approved[2].tone === 'done');
check('an approval carries its timestamp', approved[2].at === '2026-08-06T10:00:00Z');

const rejected = reviewTimeline(
  {
    ...base,
    status: 'rejected',
    reviewedAt: '2026-08-06T10:00:00Z',
    reviewNote: 'Blurry licence.',
  },
  NOW,
);
check('a rejection is not shown as success', rejected[2].tone === 'failed');
check(
  "the reviewer's note is shown rather than a generic line",
  rejected[2].detail === 'Blurry licence.',
  rejected[2].detail,
);

/*
 * Overdue. Aug 3 2026 is a Monday and Aug 10 is the following Monday, so five
 * working days have passed — inside the promise. Pushing the submission back to
 * Jul 20 puts it well outside.
 */
const onTime = reviewTimeline(base, NOW)[1];
check(
  'an in-window application does not cry overdue',
  !onTime.detail.includes('past the'),
  onTime.detail,
);

const late = reviewTimeline({ ...base, submittedAt: '2026-07-20T09:00:00Z' }, NOW)[1];
check(
  'an overdue application says so and says to chase',
  late.detail.includes(`past the ${REVIEW_WORKING_DAYS}`) && late.detail.includes('Chase'),
  late.detail,
);

// --- the notifications ---

const never = notificationTimeline(base)[0];
check(
  'an unattempted email is not shown as sent',
  never.tone === 'pending' && never.title.includes('not sent'),
  never.title,
);
check('and it is not shown as a failure either', never.tone !== 'failed', never.tone);

const sent = notificationTimeline({
  ...base,
  confirmationEmailSentAt: '2026-08-03T09:00:05Z',
})[0];
check('a sent email is marked done', sent.tone === 'done');
check('it names the address it went to', sent.detail.includes('chinedu@example.com'));
check('it carries the send time', sent.at === '2026-08-03T09:00:05Z');
check('it mentions spam, which is where it usually is', sent.detail.toLowerCase().includes('spam'));

const failed = notificationTimeline({
  ...base,
  confirmationEmailError: 'provider 401',
})[0];
check('a failed email is marked failed', failed.tone === 'failed');
check(
  'and it reassures that the application survived',
  failed.detail.includes('application is safe'),
  failed.detail,
);
check(
  'the provider error is not shown to the applicant',
  !failed.detail.includes('401'),
  'a raw provider error means nothing to a driver and may leak internals',
);

/*
 * An error and a timestamp together should not happen — the Edge Function
 * clears one when it writes the other — but if the row is ever inconsistent,
 * the failure must win. Claiming delivery for a message that errored is the
 * one direction that leaves someone waiting.
 */
const conflicted = notificationTimeline({
  ...base,
  confirmationEmailSentAt: '2026-08-03T09:00:05Z',
  confirmationEmailError: 'provider 401',
})[0];
check(
  'a contradictory row resolves to the failure',
  conflicted.tone === 'failed',
  'the safe direction is to under-promise',
);

// --- the gap this screen has to disclose ---

check(
  'decision emails are still off',
  DECISION_EMAILS_ENABLED === false,
  'flip this only when something actually sends them — the screen reads it',
);

const updatesSource = readFileSync(join(ROOT, 'src/app/(tabs)/driver-updates.tsx'), 'utf8');
check(
  'the Updates screen discloses that decision emails are off',
  updatesSource.includes('DECISION_EMAILS_ENABLED'),
  'the confirmation email promises one; without this the promise stands unanswered',
);

// ------------------------------------------------------------ guidelines ----

check('there are guidelines to read', REQUIREMENTS.length >= 3 && CONDUCT.length >= 4);
check('there are FAQs', FAQS.length >= 8, String(FAQS.length));
check(
  'FAQ keys are unique',
  new Set(FAQS.map((f) => f.key)).size === FAQS.length,
  'duplicate keys collide as React keys',
);
check(
  'every FAQ actually answers something',
  FAQS.every((f) => f.answer.length > 40 && f.question.endsWith('?') === f.question.includes('?')),
);

/*
 * The FAQs quote the review window and the decision-email gap. Both are facts
 * that live in code, so they can drift. These two assertions are what stop the
 * help page from confidently contradicting the app.
 */
const reviewFaq = FAQS.find((f) => f.key === 'how-long');
check(
  'the FAQ quotes the real review window',
  reviewFaq?.answer.includes(`${REVIEW_WORKING_DAYS} working days`) ?? false,
  reviewFaq?.answer ?? 'missing',
);

const notifyFaq = FAQS.find((f) => f.key === 'notified');
check(
  'the FAQ does not promise a decision email',
  (notifyFaq?.answer.includes('not switched on') ?? false) === !DECISION_EMAILS_ENABLED,
  notifyFaq?.answer ?? 'missing',
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS — all four dropdown items resolve to real screens, the old duplicate entries are gone,\n' +
    '       the timeline never dates an event that has not happened, an unsent email reads as\n' +
    '       unsent rather than delivered, a contradictory row resolves to the failure, and the\n' +
    '       FAQs quote the real review window without promising a decision email.',
);
