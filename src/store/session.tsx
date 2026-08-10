import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { showToast } from '@/components/ui/toast';
import { clearAllDrafts } from '@/hooks/use-form-draft';
import {
  fetchIsAdmin,
  fetchMyApplication,
  statusChangeMessage,
  subscribeToMyApplication,
  type ApplicationStatus,
  type DriverApplication,
} from '@/store/driver-applications';
import { authErrorMessage, isEmailTakenCode, isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { City } from '@/store/bookings';

/**
 * The signed-in session, backed by Supabase auth.
 *
 * Passwords are never handled here beyond passing them straight to Supabase,
 * which hashes and stores them server-side. Nothing about a password is kept on
 * the device; what persists is a refresh token in AsyncStorage, managed by the
 * client.
 */
export type SessionRole = 'sender' | 'driver';

/** Both options, in the order the segmented control renders them. */
export const SESSION_ROLES: readonly { value: SessionRole; label: string }[] = [
  { value: 'sender', label: 'Sender' },
  { value: 'driver', label: 'Driver' },
];

export type SessionUser = {
  id: string;
  /** Display name. Also what `Booking.driver` stores when this user claims a job. */
  name: string;
  phone: string;
  /** Where transactional mail goes. Always set for a Supabase account. */
  email: string | null;
};

/**
 * Owner of the seeded demo parcels.
 *
 * The sample bookings were stamped with this id long before accounts existed.
 * Nothing shows them to a signed-out visitor any more — this exists only so the
 * seed rows in `bookings.tsx` have an owner. Delete both the day the seed data
 * goes.
 */
export const DEMO_USER_ID = 'user-you';

/** Kept for the seed rows in `bookings.tsx`, which reference it directly. */
export const SESSION_USER: SessionUser = {
  id: DEMO_USER_ID,
  name: 'You',
  phone: '+2348012345678',
  email: null,
};

/**
 * What a submitted driver application leaves behind.
 *
 * `baseCity` is derived from `state` at submit rather than stored twice — see
 * `cityForState`. It is null when the state has no LOCI city, which cannot
 * happen today but would the moment the two lists drift apart.
 */
export type DriverRegistration = {
  /** As picked in "State of operation". */
  state: string;
  /** The LOCI city that state operates out of. Null when unmapped. */
  baseCity: City | null;
  /** Residential or office address, from "Your details". */
  address: string;
  reference: string;
  submittedAt: string;
};

/** `loading` covers the moment at launch before a stored session is restored. */
export type SessionStatus = 'loading' | 'signedIn' | 'signedOut';

export type SignUpParams = {
  email: string;
  password: string;
  name: string;
  phone: string;
};

export type AuthResult = {
  /** Null on success; a human-readable message otherwise. */
  error: string | null;
  /**
   * True when the email is already registered. Separate from `error` because
   * the screen answers it with a dialog offering to sign in, not a red banner.
   */
  emailTaken?: boolean;
  /**
   * True when the account was created but Supabase is holding it until the
   * emailed link is clicked. The screen must say so rather than claiming
   * success and dropping the user at a signed-out home screen.
   */
  needsEmailConfirmation?: boolean;
};

export type SessionContextValue = {
  status: SessionStatus;
  /** Null while signed out. Browsing is allowed; actions are not. */
  user: SessionUser | null;
  isAuthenticated: boolean;
  /**
   * Whose parcels the personal feeds should show, or null when signed out.
   *
   * It used to fall back to the demo identity so the app looked populated on
   * first run. That was a privacy bug waiting to happen: a stranger saw seeded
   * parcels presented as *theirs*, complete with recipient names and phone
   * numbers. Signed out now means no personal data — the screens prompt to sign
   * in instead.
   */
  viewerId: string | null;
  role: SessionRole;
  setRole: (role: SessionRole) => void;
  toggleRole: () => void;
  /** Null until a driver application is submitted on this device. */
  driver: DriverRegistration | null;
  registerDriver: (registration: DriverRegistration) => void;
  /** The signed-in user's own application, once loaded. Null if they have none. */
  application: DriverApplication | null;
  /** True only once an admin has approved. Gates accepting jobs. */
  isApprovedDriver: boolean;
  /** Whether this account can open the review dashboard. */
  isAdmin: boolean;
  /** Re-reads the application and admin flag, e.g. after submitting. */
  refreshDriverStatus: () => Promise<void>;
  signUp: (params: SignUpParams) => Promise<AuthResult>;
  signIn: (params: { email: string; password: string }) => Promise<AuthResult>;
  /** Re-sends the sign-up confirmation email. */
  resendConfirmation: (email: string) => Promise<AuthResult>;
  /** Emails a password-reset link. Never reveals whether the account exists. */
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Supabase's user shape into ours. Name and phone live in `user_metadata`
 * because they were collected at sign-up; `email` is a first-class column.
 */
function toSessionUser(user: User): SessionUser {
  const meta = user.user_metadata ?? {};

  return {
    id: user.id,
    name: typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : 'You',
    phone: typeof meta.phone === 'string' ? meta.phone : '',
    email: user.email ?? null,
  };
}

/**
 * Auth requests must not be able to hang forever.
 *
 * `supabase-js` has no built-in timeout: on a phone that has switched networks,
 * or against a URL that resolves but never answers, the promise simply never
 * settles. The screen is left on "Creating account…" with the button disabled
 * and nothing to read — the worst possible failure, because it looks like the
 * app is working. A rejection the UI can render beats silence.
 */
const AUTH_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: PromiseLike<T>, ms = AUTH_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out after ${Math.round(ms / 1000)}s`)),
      ms,
    );

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Supabase reports most problems by *returning* an error, but a few — DNS
 * failures, a malformed URL, storage errors — are thrown. Those were escaping
 * uncaught, which is what stranded the button.
 */
function thrownMessage(thrown: unknown): string {
  const raw = thrown instanceof Error ? thrown.message : String(thrown);

  if (raw.toLowerCase().includes('timed out')) {
    return `The server didn't respond. Check your connection, and that EXPO_PUBLIC_SUPABASE_URL points at your project.`;
  }

  return authErrorMessage(undefined, raw);
}

/**
 * An account created within this window is treated as brand new, so the first
 * greeting says "welcome to LOCI" rather than "welcome back".
 *
 * Five minutes rather than seconds: with email confirmation on, the account is
 * created when the form is submitted but the first sign-in happens whenever the
 * person gets round to opening their inbox. A tight window would greet a
 * genuinely new user as a returning one.
 */
const NEW_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

/** First name only — "Welcome back, Bolaji Noah" reads like a bank letter. */
function firstName(user: User): string {
  const full = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : '';
  const first = full.split(/\s+/)[0];
  return first || 'there';
}

function welcome(user: User) {
  const createdAt = user.created_at ? Date.parse(user.created_at) : Number.NaN;
  const isNew = Number.isFinite(createdAt) && Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS;

  if (isNew) {
    showToast(`Welcome to LOCI, ${firstName(user)}`, {
      message: 'Your account is ready. You can post a parcel or start carrying jobs.',
    });
    return;
  }

  showToast(`Welcome back, ${firstName(user)}`, {
    message: 'You are signed in.',
  });
}

const NOT_CONFIGURED: AuthResult = {
  error:
    'Accounts are not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the dev server.',
};

export function SessionProvider({
  children,
  initialRole = 'sender',
}: {
  children: ReactNode;
  initialRole?: SessionRole;
}) {
  const [role, setRole] = useState<SessionRole>(initialRole);
  const [driver, setDriver] = useState<DriverRegistration | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [application, setApplication] = useState<DriverApplication | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState<SessionStatus>(
    isSupabaseConfigured ? 'loading' : 'signedOut',
  );

  /**
   * Restore any stored session, then follow it. `onAuthStateChange` covers sign
   * in, sign out, token refresh and expiry, so no screen has to poll.
   */
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setStatus(data.session ? 'signedIn' : 'signedOut');
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setStatus(next ? 'signedIn' : 'signedOut');

      /*
       * Greet on a real sign-in only.
       *
       * Supabase fires this listener for several things. `INITIAL_SESSION` is
       * the stored session being restored at launch and `TOKEN_REFRESHED` fires
       * roughly hourly in the background — greeting on those would say "welcome
       * back" every time the app opened, and again while the person was
       * mid-task. `SIGNED_IN` is the one that means someone just arrived.
       */
      if (event === 'SIGNED_IN' && next?.user) {
        welcome(next.user);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const user = useMemo(() => (session?.user ? toSessionUser(session.user) : null), [session]);

  /**
   * Reads the application and the admin flag together.
   *
   * Both come from the server rather than being inferred locally: approval and
   * admin rights are decisions someone else made, and a client that decided
   * them for itself would be no gate at all.
   */
  const refreshDriverStatus = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setApplication(null);
      setIsAdmin(false);
      return;
    }

    const [nextApplication, nextIsAdmin] = await Promise.all([
      fetchMyApplication(user.id).catch(() => null),
      fetchIsAdmin(user.id).catch(() => false),
    ]);

    setApplication(nextApplication);
    setIsAdmin(nextIsAdmin);
  }, [user]);

  useEffect(() => {
    void refreshDriverStatus();
  }, [refreshDriverStatus]);

  /*
   * Live application status.
   *
   * An applicant waiting up to seven working days should not have to reload the
   * app to find out they've been approved. This listens to their own row and
   * announces the change the moment an admin saves it.
   *
   * The previous status is held in a ref rather than read from `application`:
   * the effect must not re-subscribe every time the row changes, or approving
   * would tear down and rebuild the channel mid-announcement.
   */
  const lastStatus = useRef<ApplicationStatus | null>(null);

  useEffect(() => {
    lastStatus.current = application?.status ?? null;
  }, [application?.status]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;

    return subscribeToMyApplication(user.id, (next) => {
      const announcement = statusChangeMessage(lastStatus.current, next.status);
      lastStatus.current = next.status;
      setApplication(next);

      if (announcement) {
        showToast(announcement.title, {
          message: announcement.message,
          tone: announcement.tone === 'success' ? 'success' : 'info',
          // Longer than a greeting: this is the outcome of a week's wait.
          duration: 7000,
        });
      }
    });
  }, [user?.id]);

  const toggleRole = useCallback(
    () => setRole((current) => (current === 'sender' ? 'driver' : 'sender')),
    [],
  );

  const registerDriver = useCallback((registration: DriverRegistration) => {
    setDriver(registration);
  }, []);

  const signUp = useCallback(async (params: SignUpParams): Promise<AuthResult> => {
    if (!isSupabaseConfigured) return NOT_CONFIGURED;

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email: params.email.trim().toLowerCase(),
          password: params.password,
          // Stored on the auth user, so it survives without a separate profile
          // table. Move to a `profiles` row once there's more than name and phone.
          options: { data: { name: params.name.trim(), phone: params.phone.trim() } },
        }),
      );

      if (error) {
        return {
          error: authErrorMessage(error.code, error.message),
          emailTaken: isEmailTakenCode(error.code),
        };
      }

      /*
       * The quiet duplicate.
       *
       * With email confirmation enabled, signing up with an address that is
       * already registered does NOT return an error — Supabase returns a
       * success with an obfuscated user so the form can't be used to discover
       * who has an account. The tell is an empty `identities` array. Without
       * this check the user is sent to "check your email" for a confirmation
       * that never arrives, which is the most confusing outcome available.
       */
      const identities = data.user?.identities;
      if (data.user && Array.isArray(identities) && identities.length === 0) {
        return { error: null, emailTaken: true };
      }

      // A confirmed-email project returns a user but no session until the link
      // is clicked. Reporting that honestly avoids "account created" followed
      // by a sign-in that refuses to work.
      return { error: null, needsEmailConfirmation: Boolean(data.user) && !data.session };
    } catch (thrown) {
      return { error: thrownMessage(thrown) };
    }
  }, []);

  const signIn = useCallback(
    async (params: { email: string; password: string }): Promise<AuthResult> => {
      if (!isSupabaseConfigured) return NOT_CONFIGURED;

      try {
        const { error } = await withTimeout(
          supabase.auth.signInWithPassword({
            email: params.email.trim().toLowerCase(),
            password: params.password,
          }),
        );

        return { error: error ? authErrorMessage(error.code, error.message) : null };
      } catch (thrown) {
        return { error: thrownMessage(thrown) };
      }
    },
    [],
  );

  /**
   * Starts a password reset.
   *
   * Always reports success, even for an address with no account: the response
   * must not tell a stranger whether an email is registered here. Supabase
   * behaves the same way for the same reason.
   */
  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) return NOT_CONFIGURED;

    try {
      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email.trim().toLowerCase()),
      );

      // Rate limits and outages are real failures worth surfacing. "No such
      // user" is not one Supabase returns here, by design.
      return { error: error ? authErrorMessage(error.code, error.message) : null };
    } catch (thrown) {
      return { error: thrownMessage(thrown) };
    }
  }, []);

  /** Re-sends the confirmation email. Supabase rate-limits this server-side. */
  const resendConfirmation = useCallback(async (email: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) return NOT_CONFIGURED;

    try {
      const { error } = await withTimeout(
        supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() }),
      );

      return { error: error ? authErrorMessage(error.code, error.message) : null };
    } catch (thrown) {
      return { error: thrownMessage(thrown) };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setSession(null);
    setStatus('signedOut');
    /*
     * Drafts hold a NIN, a bank account and a guarantor's details. Signing out
     * is the clearest "I'm finished on this device" signal there is, so they go
     * with the session rather than waiting for their 24-hour expiry.
     */
    await clearAllDrafts();

    // These belong to the person, not the device.
    setDriver(null);
    setApplication(null);
    setIsAdmin(false);
    setRole('sender');
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      isAuthenticated: Boolean(user),
      viewerId: user?.id ?? null,
      role,
      setRole,
      toggleRole,
      driver,
      registerDriver,
      application,
      isApprovedDriver: application?.status === 'approved',
      isAdmin,
      refreshDriverStatus,
      signUp,
      signIn,
      resendConfirmation,
      requestPasswordReset,
      signOut,
    }),
    [
      status,
      user,
      role,
      toggleRole,
      driver,
      registerDriver,
      application,
      isAdmin,
      refreshDriverStatus,
      signUp,
      signIn,
      resendConfirmation,
      requestPasswordReset,
      signOut,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }

  return context;
}
