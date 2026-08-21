import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * The Supabase client.
 *
 * Credentials come from the environment, never from source. Only `EXPO_PUBLIC_`
 * variables reach the app bundle, which is correct here: the anon key is a
 * publishable key and is *designed* to ship to clients. What protects your data
 * is Row Level Security on the tables, not the secrecy of this key. The service
 * role key is a different thing entirely and must never appear in this project.
 *
 * Set both in `.env.local` (already git-ignored) — see `.env.example`.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * True once both values are present. Screens check this so a missing `.env.local`
 * produces a clear "auth isn't configured" message instead of an opaque network
 * failure on the first sign-in attempt.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * The REST root and its key, for the one thing the client cannot answer.
 *
 * PostgREST publishes an OpenAPI document at the root of `/rest/v1/`, listing
 * every function it currently exposes. Reading it is how the app can tell
 * whether a migration has actually been applied to the project it is talking
 * to — a question `supabase-js` has no method for, and one that has now cost
 * three rounds of "the fix is in, it still does not work".
 *
 * ⚠ Exported for `store/deployment.ts` and nothing else. Anything that wants
 *   data should go through `supabase` above, which handles auth and retries.
 */
export const restEndpoint = { url: supabaseUrl, anonKey: supabaseAnonKey };

/**
 * True only in a real browser — false on native, and false during the Node
 * pre-render pass.
 *
 * This project sets `web.output: "static"` in app.json, so Expo Router renders
 * every route in Node before it ever reaches a browser. There is no `window`
 * there. That matters because `createClient` doesn't wait to be asked: GoTrue
 * calls `__loadSession()` during construction, which reads storage, and
 * AsyncStorage's web build reaches straight for `window.localStorage`. The
 * result was `ReferenceError: window is not defined` thrown inside the static
 * render — which takes the whole dev server down, so the app doesn't fail to
 * sign in so much as fail to serve.
 */
const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

/** The Node pre-render pass: web platform, no browser globals. */
const isServerRender = Platform.OS === 'web' && !isBrowser;

/**
 * Storage stub for that pass. Returning "no stored session" is the truthful
 * answer on a server — the pre-render belongs to no one, and any HTML it
 * produced for a signed-in user would be wrong for the next visitor anyway.
 */
const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'http://localhost',
  supabaseAnonKey || 'public-anon-key-not-set',
  {
    auth: {
      // Sessions survive an app restart, and the access token refreshes itself —
      // but only where there is somewhere to persist them.
      storage: isServerRender ? noopStorage : AsyncStorage,
      persistSession: !isServerRender,
      autoRefreshToken: !isServerRender,
      /*
       * Reading a session out of the URL needs `window.location`, so it is tied
       * to `isBrowser` rather than to the web platform. On native there is no
       * URL bar to read; during the static render there is no window at all.
       */
      detectSessionInUrl: isBrowser,
      flowType: 'pkce',
    },
  },
);

/**
 * Codes that mean "this email is already registered".
 *
 * Supabase returns one of these when it isn't hiding the fact. See
 * `signUp` for the other case, where it deliberately does hide it.
 */
export const EMAIL_TAKEN_CODES = ['email_exists', 'user_already_exists'] as const;

export function isEmailTakenCode(code: string | undefined): boolean {
  return code !== undefined && (EMAIL_TAKEN_CODES as readonly string[]).includes(code);
}

/**
 * Turns a Supabase auth error into something a person can act on.
 *
 * Keyed on `error.code`, not the message — Supabase's own guidance is
 * "always use error.code and error.name to identify errors, not string matching
 * on error messages", because the prose changes between releases. The message
 * is kept only as the fallback for codes we don't recognise.
 *
 * Note `invalid_credentials` stays deliberately vague about *which* half was
 * wrong: telling the user "no account with that email" turns the sign-in form
 * into a way of discovering who has an account here.
 */
export function authErrorMessage(code: string | undefined, message: string): string {
  switch (code) {
    case 'invalid_credentials':
      return "That email and password don't match an account.";

    case 'email_not_confirmed':
      return 'Check your inbox and confirm your email address before signing in.';

    case 'email_exists':
    case 'user_already_exists':
      return 'An account already exists with that email. Sign in instead.';

    /*
     * Supabase rejects example and test domains outright — example.com,
     * test.com and similar. It can also reject an address its validator
     * considers undeliverable.
     */
    case 'email_address_invalid':
      return `Supabase rejected "${message.match(/"([^"]+)"/)?.[1] ?? 'that address'}". Example and test domains aren't accepted — use a real mailbox you can open.`;

    /*
     * The one people hit on a fresh project: with no custom SMTP configured,
     * Supabase will only send auth email to members of your own organisation.
     */
    case 'email_address_not_authorized':
      return 'This project can only email members of your Supabase organisation until you configure a custom SMTP provider. Add SMTP under Authentication → Emails, or sign up with the address on your Supabase account.';

    case 'signup_disabled':
      return 'New sign-ups are turned off for this project. Enable them under Authentication → Sign In / Providers.';

    case 'email_provider_disabled':
      return 'Email and password sign-up is disabled for this project. Enable the Email provider in your Supabase dashboard.';

    case 'weak_password':
      return message;

    /*
     * Not a per-minute limit, and not per-user: Supabase's built-in email
     * provider allows 2 emails per HOUR across the whole project, and the only
     * way to raise it is to configure custom SMTP. Saying "wait a minute" here
     * sends people back to a button that cannot work yet.
     */
    case 'over_email_send_rate_limit':
      return 'Sign-up email limit reached. The built-in Supabase mailer allows only 2 emails per hour for the whole project. Configure custom SMTP under Authentication → Emails, or turn off "Confirm email" while developing.';

    /* This one really is short-lived — it's per IP address. */
    case 'over_request_rate_limit':
      return 'Too many requests from this device. Wait a minute and try again.';

    case 'validation_failed':
      return message;

    default:
      if (/network|fetch|timeout/i.test(message)) {
        return "Couldn't reach the server. Check your connection and try again.";
      }
      return message;
  }
}
