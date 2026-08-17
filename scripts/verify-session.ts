/**
 * Assertions for the session greeting.
 *
 * The bug this pins: "Welcome back" fired every time a browser tab regained
 * focus, because Supabase re-emits `SIGNED_IN` when it re-validates a stored
 * session on visibility change. Filtering by event name was not enough — the
 * event genuinely is `SIGNED_IN`.
 *
 * The logic is transcribed rather than imported: it lives inside a React
 * provider's effect and cannot be called from node. The transcription is
 * checked against the real file below, so the two cannot drift silently.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL — ${name}${detail ? `\n       ${detail}` : ''}`);
  }
}

const source = readFileSync(join(process.cwd(), 'src/store/session.tsx'), 'utf8');

// ------------------------------------------------- the transcribed rule -----

type AuthEvent =
  'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';

/** Mirrors the listener in `SessionProvider`. Returns whether it greeted. */
function makeGreeter() {
  let greetedUserId: string | null = null;

  return (event: AuthEvent, userId: string | null): boolean => {
    if (event === 'SIGNED_OUT') {
      greetedUserId = null;
      return false;
    }

    if (event === 'SIGNED_IN' && userId && greetedUserId !== userId) {
      greetedUserId = userId;
      return true;
    }

    return false;
  };
}

// --------------------------------------------------------------- the bug ----

const greet = makeGreeter();

check('a real sign-in greets', greet('SIGNED_IN', 'user-a'));

/*
 * The reported bug, three times over. Each of these is a genuine `SIGNED_IN`
 * from Supabase after the tab regained focus.
 */
check('switching tabs and back does not greet again', !greet('SIGNED_IN', 'user-a'));
check('nor the second time', !greet('SIGNED_IN', 'user-a'));
check('nor the tenth', !greet('SIGNED_IN', 'user-a'));

check('a token refresh does not greet', !greet('TOKEN_REFRESHED', 'user-a'));
check('a profile update does not greet', !greet('USER_UPDATED', 'user-a'));
check(
  'restoring a stored session at launch does not greet',
  !greet('INITIAL_SESSION', 'user-a'),
  'this fires on every cold start',
);

// ----------------------------------------------- when it *should* greet -----

check('signing out does not greet', !greet('SIGNED_OUT', null));
check(
  'signing back in afterwards does greet',
  greet('SIGNED_IN', 'user-a'),
  'a deliberate return is exactly when the message is warranted',
);

/*
 * A different person on the same device — a shared laptop, or someone testing
 * two accounts. Keying on the id rather than a single boolean is what makes
 * this work without a sign-out in between.
 */
const shared = makeGreeter();
check('first account greets', shared('SIGNED_IN', 'user-a'));
check('a different account also greets', shared('SIGNED_IN', 'user-b'));
check('and the second is then quiet on refocus', !shared('SIGNED_IN', 'user-b'));

check(
  'a SIGNED_IN with no user is ignored',
  !makeGreeter()('SIGNED_IN', null),
  'never greet nobody',
);

// ------------------------------------------- the transcription is honest ----

check(
  'the real listener remembers who it greeted',
  source.includes('greetedUserId.current !== next.user.id') &&
    source.includes('greetedUserId.current = next.user.id'),
  'filtering on the event name alone is what caused the bug',
);
check(
  'and clears it on sign-out',
  source.includes("if (event === 'SIGNED_OUT')") && source.includes('greetedUserId.current = null'),
  'otherwise signing back in would be silent',
);
check(
  'the ref is a ref, not state',
  source.includes('const greetedUserId = useRef<string | null>(null)'),
  'nothing renders from it; state would re-render every consumer on sign-in',
);

// ------------------------------------ the related flag this fix exposed -----

/*
 * `driverStatusLoaded` was never reset. Left true across a sign-out, a
 * returning applicant would be shown the blank Be a Driver form for the moment
 * before their row loaded — the exact case that flag exists to prevent.
 */
check(
  'driverStatusLoaded resets on sign-out',
  /setDriver\(null\);[\s\S]{0,200}setDriverStatusLoaded\(false\)/.test(source),
);
check(
  'and when the signed-in person changes',
  source.includes('loadedForUserId') && source.includes('[user?.id, refreshDriverStatus]'),
);
check(
  'but not on every token refresh',
  source.includes('user?.id') && !source.includes('}, [user, refreshDriverStatus]);'),
  '`user` gets a new identity hourly; keying on it would flash a spinner mid-read',
);

// -------------------------------- the load that never ran when signed out ---

/*
 * The bug: Be a Driver / Updates spun forever for anyone not signed in.
 *
 * That screen waits for `driverStatusLoaded` before it can choose between the
 * application form and the timeline. The flag is set by `refreshDriverStatus`,
 * which an effect calls whenever the person changes — guarded by a ref so an
 * hourly token refresh does not re-run it. The ref started at `null`. So did
 * the id of a signed-out visitor. First render, the guard compared them, found
 * them equal, and returned; the load never happened and never got a second
 * chance, because `getSession()` resolving to no session sets the same `null`
 * React bails out on.
 *
 * Signed-in people never saw it — a real id is a string, which differs from
 * null. The one page that exists for people who have not applied was the one
 * page they could not open.
 *
 * Transcribed rather than imported, like the greeter above: this lives inside a
 * provider's effect and cannot be called from node. The transcription is
 * checked against the real file below.
 */
function makeLoader(initial: string | null | undefined) {
  let loadedFor = initial;
  let loads = 0;

  /** One run of the effect, for a given signed-in id. */
  return (id: string | null): number => {
    if (loadedFor === id) return loads;
    loadedFor = id;
    loads += 1;
    return loads;
  };
}

const signedOut = makeLoader(undefined);
check(
  'a signed-out visitor triggers the lookup',
  signedOut(null) === 1,
  'without it driverStatusLoaded stays false and Be a Driver spins forever',
);
check(
  'and a second render does not repeat it',
  signedOut(null) === 1,
  'the guard still has to stop an hourly token refresh re-running the load',
);

const signingIn = makeLoader(undefined);
signingIn(null);
check('signing in triggers it again', signingIn('user-1') === 2);
check('and staying signed in does not', signingIn('user-1') === 2);
check('but a different account does', signingIn('user-2') === 3);
check(
  'and signing out does too',
  signingIn(null) === 4,
  'the previous person’s application must not be left on screen',
);

/*
 * The same simulation with the old starting value, to show it is the sentinel
 * doing the work and not the shape of the function.
 */
check(
  'starting at null is what broke it',
  makeLoader(null)(null) === 0,
  'this is the assertion that would have failed before the fix',
);

check(
  'the ref cannot hold a value an account could have',
  source.includes('useRef<string | null | undefined>(undefined)'),
  'null is a real identity here — it means signed out',
);

/*
 * ⚠ Named one at a time, not "does the sentinel appear anywhere in the file".
 *
 *   The check above stays green with the bug put back, because the *other* ref
 *   still has the sentinel. It is kept as a cheap tripwire, but these are the
 *   ones that bind: an assertion satisfied by a line it is not about is not an
 *   assertion, and this file has been bitten by that shape before.
 */
for (const ref of ['loadedForUserId', 'restoredViewFor']) {
  check(
    `${ref} starts at a value no account can have`,
    new RegExp(`const ${ref} = useRef<string \\| null \\| undefined>\\(undefined\\)`).test(source),
    'starting at null means the first render mistakes "signed out" for "already loaded"',
  );
}

/*
 * And the lookup itself cannot hang.
 *
 * Both calls already swallowed rejections, but neither was bounded, so a phone
 * on one bar produced the same permanent spinner by a different route.
 */
check(
  'the application lookup is time-boxed',
  /withTimeout\(fetchMyApplication\(user\.id\), STATUS_TIMEOUT_MS\)/.test(source) &&
    /withTimeout\(fetchIsAdmin\(user\.id\), STATUS_TIMEOUT_MS\)/.test(source),
  'a promise that never settles is a screen that never renders',
);
check(
  'and gives up sooner than a sign-in does',
  /const STATUS_TIMEOUT_MS = 8_000/.test(source) && /const AUTH_TIMEOUT_MS = 20_000/.test(source),
  'nobody is watching this one; it runs unprompted at launch',
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS — the greeting fires once per person: not on tab refocus, token refresh, profile\n' +
    '       update or app launch, but again after a real sign-out and for a different\n' +
    '       account on the same device. driverStatusLoaded resets with the person, not\n' +
    '       with every token refresh, the lookup runs for a signed-out visitor as well as a\n' +
    '       signed-in one, and it cannot hang.',
);
