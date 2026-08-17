import Constants from 'expo-constants';

import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * What build this is, in one place.
 *
 * Two jobs, both of which only matter once the app leaves this machine:
 *
 *   1. A tester's bug report needs to say *which* build. "It crashes" is
 *      unactionable when four builds are in circulation; "preview 1.0.0 (14)"
 *      is a specific artefact you can re-download.
 *
 *   2. A build made without the Supabase environment variables silently falls
 *      back to seed data — see `BookingsProvider`. Nothing persists, every
 *      account is fictional, and the app *looks* fine. A tester can lose an
 *      afternoon to that before anyone works out the build was never connected
 *      to anything. `backendConfigured` exists so the app can say so.
 */

/**
 * Set per profile in `eas.json`. Absent in local development, which is itself
 * informative — 'local' means a Metro bundle, not something distributed.
 */
export const buildChannel = process.env.EXPO_PUBLIC_BUILD_CHANNEL ?? 'local';

/** The user-facing version from app.json, e.g. "1.0.0". */
export const appVersion = Constants.expoConfig?.version ?? '0.0.0';

/**
 * The build number EAS stamped on this artefact.
 *
 * With `appVersionSource: "remote"` in eas.json, EAS increments this on the
 * server for every preview and production build, so two builds of version
 * 1.0.0 are still distinguishable. iOS calls it buildNumber, Android calls it
 * versionCode; testers do not care which platform they are on.
 */
export const buildNumber = String(
  Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? '—',
);

/** True when the app has a Supabase project to talk to. */
export const backendConfigured = isSupabaseConfigured;

/** One line for a bug report, e.g. "preview · 1.0.0 (14)". */
export function buildLabel(): string {
  return `${buildChannel} · ${appVersion} (${buildNumber})`;
}
