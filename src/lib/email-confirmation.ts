/**
 * What a confirmation link means when somebody actually clicks it.
 *
 * The happy path — click within the hour, on the device you signed up on, while
 * signed out — is the one case that needs no thought. Everything here is the
 * rest of them, and they are common enough that treating them as exceptions is
 * how an account gets stuck:
 *
 *   · the link sat in an inbox overnight and the token expired
 *   · the link was already used, so the token is spent
 *   · they are already signed in as that person
 *   · they are signed in as *somebody else* on a shared laptop
 *
 * ⚠ Kept pure and separate from the screen on purpose.
 *
 *   Every one of these arrives as a URL a person clicked once, in a state that
 *   is awkward to reproduce by hand. A rule that can only be exercised by
 *   waiting an hour for a token to rot is a rule that gets tested once, badly.
 *   `verify-auth` runs all of them.
 */

/** The parameters Supabase sends back, from either the query or the hash. */
export type ConfirmationParams = {
  /** `access_denied`, usually. */
  error?: string;
  /** `otp_expired` is the one worth naming; the rest are lumped together. */
  errorCode?: string;
  errorDescription?: string;
  /** Present on success under PKCE — the code to exchange for a session. */
  code?: string;
  /**
   * The address the link was issued for.
   *
   * ⚠ Not something Supabase provides. It is put there by `signUp`, on the
   *   `emailRedirectTo` URL, and it is what makes two of the branches below
   *   possible at all: an expired link carries no identity of its own, so
   *   without this there is nobody to offer a resend to and no way to notice
   *   that the signed-in account is a different person.
   */
  email?: string;
};

export type ConfirmOutcome =
  /** No auth parameters at all — somebody opened the page directly. */
  | { kind: 'nothing' }
  /** Signed in as the person the link is for. The link is redundant, not wrong. */
  | { kind: 'already-signed-in'; email: string }
  /**
   * Signed in as somebody else. Deliberately does *not* claim the link.
   *
   * On a shared or family laptop this is the case that quietly attaches one
   * person's confirmation to another person's session, and the damage is
   * invisible until somebody wonders why their parcels are in a stranger's
   * account.
   */
  | { kind: 'wrong-account'; signedInAs: string; linkFor: string }
  /** A code to exchange. The caller does the exchange; this only says it may. */
  | { kind: 'exchange'; code: string; email: string | null }
  /** Expired or already spent. Supabase reports both the same way — see below. */
  | { kind: 'expired'; email: string | null }
  /** Anything else the provider refused, with its own words. */
  | { kind: 'failed'; message: string; email: string | null };

/** Reads both shapes of parameter Supabase can use for a redirect. */
export function parseConfirmationParams(url: string): ConfirmationParams {
  const params: ConfirmationParams = {};

  /*
   * Query *and* fragment, because which one is used depends on the flow.
   *
   * PKCE puts `code` and any error in the query string; the implicit flow puts
   * tokens and errors after the `#`. A project can be switched between them in
   * a dashboard by somebody who has no idea this code exists, so both are read
   * rather than whichever one is in use today.
   */
  const queryStart = url.indexOf('?');
  const hashStart = url.indexOf('#');

  const search = new URLSearchParams(
    queryStart === -1 ? '' : url.slice(queryStart + 1, hashStart === -1 ? undefined : hashStart),
  );
  const hash = new URLSearchParams(hashStart === -1 ? '' : url.slice(hashStart + 1));

  const read = (key: string) => search.get(key) ?? hash.get(key) ?? undefined;

  params.error = read('error') ?? undefined;
  params.errorCode = read('error_code') ?? undefined;
  params.errorDescription = read('error_description')?.replace(/\+/g, ' ');
  params.code = read('code') ?? undefined;
  params.email = read('email')?.trim().toLowerCase() || undefined;

  return params;
}

/** True when the link carried anything worth acting on. */
export function hasConfirmationParams(params: ConfirmationParams): boolean {
  return Boolean(params.error || params.errorCode || params.code);
}

const sameAddress = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

export function resolveConfirmation(input: {
  params: ConfirmationParams;
  /** The address of the session already open on this device, if any. */
  sessionEmail: string | null;
}): ConfirmOutcome {
  const { params, sessionEmail } = input;
  const linkFor = params.email ?? null;

  if (!hasConfirmationParams(params)) return { kind: 'nothing' };

  /*
   * ⚠ The mismatch is checked before anything is claimed, and before the error
   *   branch below.
   *
   *   Order matters here. If the wrong-account case were checked after the
   *   expired one, a stale link belonging to somebody else would be answered
   *   with "here, resend yourself a fresh one" — handing a stranger a working
   *   route into an account on a machine they are already sitting at.
   */
  if (sessionEmail && linkFor && !sameAddress(sessionEmail, linkFor)) {
    return { kind: 'wrong-account', signedInAs: sessionEmail, linkFor };
  }

  /*
   * Signed in as the right person already.
   *
   * Reached by anyone who confirmed on their phone and then opened the same
   * email on a laptop, and by anyone who clicked twice. Both are ordinary, and
   * neither is an error: the account is confirmed, which is what the link was
   * for. Note this catches the *expired* case too — a token that rotted after
   * doing its job is not a problem worth a red banner.
   */
  if (sessionEmail && (sameAddress(sessionEmail, linkFor) || !linkFor)) {
    return { kind: 'already-signed-in', email: sessionEmail };
  }

  if (params.code) return { kind: 'exchange', code: params.code, email: linkFor };

  /*
   * ⚠ Expired and already-used are the same answer from Supabase.
   *
   *   A token that has been spent and a token that has aged out both come back
   *   as `otp_expired`, and there is no parameter that separates them. So this
   *   cannot tell somebody "you have already confirmed" from the URL alone —
   *   which is why the screen offers a resend and lets the *resend* say so.
   *   `supabase.auth.resend` refuses for an address that is already confirmed,
   *   and that refusal is the only trustworthy signal there is.
   */
  if (params.errorCode === 'otp_expired' || params.error === 'access_denied') {
    return { kind: 'expired', email: linkFor };
  }

  return {
    kind: 'failed',
    message: params.errorDescription || params.error || 'That link could not be used.',
    email: linkFor,
  };
}

/**
 * Whether a failed resend means the account is already confirmed.
 *
 * ⚠ Matched on the message as well as the code, and that is not laziness.
 *
 *   GoTrue has changed how it reports this more than once, and the shape
 *   differs between a hosted project and a self-hosted one. Getting it wrong
 *   in the safe direction shows somebody "we could not resend" when they could
 *   simply sign in — annoying but harmless. Getting it wrong the other way
 *   would tell an unconfirmed person to go and sign in, which will not work.
 */
export function isAlreadyConfirmed(code: string | undefined, message: string | undefined): boolean {
  if (code === 'email_address_already_confirmed' || code === 'user_already_confirmed') return true;
  return /already\s+(been\s+)?confirmed|already\s+registered|already\s+verified/i.test(
    message ?? '',
  );
}
