/**
 * Matches a driver applicant's live selfie against the photo NIMC holds for
 * their NIN.
 *
 * ⚠ Sensitive personal data. Unlike the sender liveness check, this processes a
 *   face *to establish who someone is* — the NDPA's definition of biometric
 *   data as sensitive personal data, with explicit-consent and impact-assessment
 *   obligations. See `docs/PRIVACY-NOTES.md`. LEGAL_REVIEW_REQUIRED.
 *
 * ⚠ A mismatch is a flag, not a rejection. NIMC photos can be a decade old. This
 *   function records what Dojah said and nothing else decides anything — the
 *   application still reaches a human, which is the whole point of choosing to
 *   flag rather than block.
 *
 * Shape follows `verify-liveness`: the client sends a capture session id, the
 * server fetches the image itself, and the Dojah secret never leaves here.
 *
 * Deploy:
 *
 *   supabase functions deploy verify-identity
 *
 * It reuses the same DOJAH_* secrets as `verify-liveness`.
 */

import { readCredentials, verifyNinSelfie } from '../verify-liveness/dojah.ts';

const env = (key: string) => Deno.env.get(key) ?? null;

const SUPABASE_URL = env('SUPABASE_URL') ?? '';
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function callerId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: SERVICE_KEY },
  });
  if (!response.ok) return null;
  const user = (await response.json()) as { id?: string };
  return typeof user.id === 'string' ? user.id : null;
}

async function db(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const userId = await callerId(request.headers.get('Authorization'));
  if (!userId) return json({ error: 'Not signed in' }, 401);

  let sessionId = '';
  let nin = '';
  try {
    const body = (await request.json()) as { session_id?: unknown; nin?: unknown };
    sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    nin = typeof body.nin === 'string' ? body.nin.replace(/\D/g, '') : '';
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  if (!sessionId) return json({ error: 'session_id is required' }, 400);

  /*
   * A NIN is eleven digits. Checked here so a typo costs nothing rather than a
   * paid call that comes back as a mismatch and puts a flag on an honest
   * applicant's file.
   */
  if (nin.length !== 11) {
    return json({ status: 'unavailable', message: 'A NIN is 11 digits.' });
  }

  const lookup = await db(
    `photo_capture_sessions?id=eq.${encodeURIComponent(sessionId)}&owner_id=eq.${encodeURIComponent(userId)}&select=id,photo_path`,
  );
  if (!lookup.ok) return json({ error: 'Could not read the session' }, 500);

  const rows = (await lookup.json()) as { id: string; photo_path: string | null }[];
  const session = rows[0];
  if (!session) return json({ error: 'No such session' }, 404);
  if (!session.photo_path) return json({ error: 'No photo on that session yet' }, 409);

  const credentials = readCredentials({
    DOJAH_APP_ID: env('DOJAH_APP_ID') ?? undefined,
    DOJAH_SECRET_KEY: env('DOJAH_SECRET_KEY') ?? undefined,
    DOJAH_ENVIRONMENT: env('DOJAH_ENVIRONMENT') ?? undefined,
  });

  /*
   * Not configured is 'unavailable', and the application still goes through.
   *
   * The alternative — refusing every driver application on an instance with no
   * Dojah account — would break the preview builds testers are using and every
   * deployment that has not bought one yet.
   */
  if (!credentials) {
    await record(userId, { status: 'unavailable', confidence: null, environment: null });
    return json({
      status: 'unavailable',
      message: 'Identity checking is not configured on this environment.',
    });
  }

  const download = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sender-photo/${session.photo_path}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!download.ok) return json({ error: 'Could not read the photo' }, 500);

  const selfie = toBase64(new Uint8Array(await download.arrayBuffer()));
  const result = await verifyNinSelfie(nin, selfie, credentials);

  await record(userId, {
    status:
      result.verdict === 'matched'
        ? 'matched'
        : result.verdict === 'mismatch'
          ? 'mismatch'
          : 'unavailable',
    confidence: result.confidence,
    environment: result.environment,
  });

  /*
   * The identity record Dojah returns — name, date of birth, gender, and the
   * NIMC photo itself — is deliberately not stored and not returned.
   *
   * LOCI already has the applicant's name from the form. Keeping a second copy
   * pulled from a government database, plus their photograph, would be
   * collecting sensitive data for no purpose anyone could state.
   */
  return json({
    status: result.verdict,
    confidence: result.confidence,
    environment: result.environment,
    message: result.message,
  });

  async function record(
    driverId: string,
    verdict: { status: string; confidence: number | null; environment: string | null },
  ): Promise<void> {
    /*
     * Written against the applicant's most recent pending application.
     *
     * Scoped by user id as well as status: the service role bypasses RLS, so
     * without the filter this would happily stamp a verdict on somebody else's
     * file.
     */
    await db(`driver_applications?user_id=eq.${encodeURIComponent(driverId)}&status=eq.pending`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        identity_status: verdict.status,
        identity_confidence: verdict.confidence,
        identity_environment: verdict.environment,
        identity_checked_at: new Date().toISOString(),
      }),
    });
  }
});
