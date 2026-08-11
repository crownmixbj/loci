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

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS — the greeting fires once per person: not on tab refocus, token refresh, profile\n' +
    '       update or app launch, but again after a real sign-out and for a different\n' +
    '       account on the same device. driverStatusLoaded resets with the person, not\n' +
    '       with every token refresh.',
);
