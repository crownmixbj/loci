/**
 * Which interface a given person gets, on a given device.
 *
 * LOCI runs three:
 *
 *   web           the full dashboard — everything, including admin
 *   sender        the phone app for someone posting parcels
 *   driver        the phone app for an approved driver carrying them
 *
 * The whole rule lives in `resolveExperience` below, as a pure function of four
 * inputs. Not scattered across screens: a routing rule expressed as `Platform.OS
 * === 'web' && ...` in nine files is nine chances to write the eighth one
 * differently, and the difference is invisible until someone is looking at the
 * wrong app.
 *
 * ⚠ None of this is a security boundary. A native build is a file an attacker
 *   controls, and hiding a screen does not stop a request. Every gate that
 *   matters — claiming a job, reading an application, writing a hub — is a Row
 *   Level Security policy or a `security definer` function, and stays that way.
 *   This decides what is *shown*, which is a usability question.
 */

export const EXPERIENCES = ['web', 'sender', 'driver'] as const;

export type Experience = (typeof EXPERIENCES)[number];

export type ExperienceInput = {
  /** `Platform.OS`. Anything other than 'web' is a native build. */
  platform: string;
  /** Still restoring a stored session. Nothing is decided yet. */
  authLoading: boolean;
  isAuthenticated: boolean;
  /**
   * An approved driver application — the same server-checked fact that gates
   * claiming a job.
   *
   * Deliberately *not* the Sender/Driver toggle. That toggle is a view
   * preference anyone can flip, so routing on it would hand the driver
   * interface to any sender who tapped it once. They still could not claim
   * anything (RLS refuses), but they would be looking at a set of screens built
   * for a job they cannot do.
   */
  isApprovedDriver: boolean;
  /**
   * The toggle. It only matters for someone who is *both* — an approved driver
   * who also sends parcels — and it lets them choose which app they are in.
   */
  role: 'sender' | 'driver';
};

export function resolveExperience(input: ExperienceInput): Experience | null {
  /*
   * Null while the session is restoring, rather than guessing.
   *
   * Guessing 'sender' here would put an approved driver through a visible
   * flick from the sender home to the driver home on every cold start, which
   * reads as the app being unsure who they are.
   */
  if (input.authLoading) return null;

  // The desktop dashboard is the same for everyone; what it *contains* still
  // depends on the account, which is what the RLS policies decide.
  if (input.platform === 'web') return 'web';

  // Signed out on a phone: the sender app, which is the one that works without
  // an account — browse hubs, get a quote, start a booking.
  if (!input.isAuthenticated) return 'sender';

  if (input.isApprovedDriver && input.role === 'driver') return 'driver';

  return 'sender';
}

/**
 * Where each interface starts.
 *
 * A driver's home is the portal — the deliveries they are carrying — not the
 * marketing home screen, which has nothing on it for someone mid-shift.
 */
export const EXPERIENCE_HOME: Record<Experience, string> = {
  web: '/',
  sender: '/',
  driver: '/driver',
};

/**
 * Which routes belong to which interface.
 *
 * `'*'` means every experience. Anything not listed is treated as shared, so
 * adding a screen does not silently make it unreachable — the failure mode of
 * an allowlist is a blank screen nobody can explain.
 */
const ROUTE_EXPERIENCES: { prefix: string; only: Experience[] }[] = [
  /*
   * Driver-side screens. Hidden from the sender app because a sender cannot use
   * them, not because they are secret — /driver on a sender's phone shows an
   * empty portal and a prompt to apply, which is noise rather than help.
   */
  { prefix: '/driver', only: ['web', 'driver'] },
  { prefix: '/available-packages', only: ['web', 'driver'] },

  /*
   * Sending. An approved driver mid-shift is not booking a parcel, and the
   * booking form is the longest screen in the app — it has no place in the
   * driver interface. They can switch to Sender and get it back.
   */
  { prefix: '/book', only: ['web', 'sender'] },
  { prefix: '/my-packages', only: ['web', 'sender'] },
  { prefix: '/rate-calculator', only: ['web', 'sender'] },

  /*
   * Admin stays on every device.
   *
   * Restricting it to web would mean nobody could approve a driver or lift a
   * ban without a laptop. Platform is not a security boundary — `is_admin()`
   * is — so blocking it on a phone costs real operational time and buys
   * nothing.
   */
];

/** Whether `pathname` should be reachable in `experience`. */
export function routeAllowed(pathname: string, experience: Experience): boolean {
  const rule = ROUTE_EXPERIENCES.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  );

  // Unlisted routes are shared. See the comment on ROUTE_EXPERIENCES.
  return rule ? rule.only.includes(experience) : true;
}

/**
 * Where to send someone who is on a route their interface does not have.
 *
 * Returns null when they are already somewhere valid, so a caller can treat a
 * non-null result as "navigate" without also having to ask "did anything
 * change?".
 */
export function redirectFor(pathname: string, experience: Experience | null): string | null {
  if (!experience) return null;
  if (routeAllowed(pathname, experience)) return null;
  return EXPERIENCE_HOME[experience];
}
