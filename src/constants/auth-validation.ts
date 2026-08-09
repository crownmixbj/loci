import { formatNigerianPhoneInput, isValidEmail, isValidNigerianPhone } from '@/utils/validation';

/**
 * Shape checks for the auth forms. Deliberately shallow — these catch typos
 * before a request is made; the authoritative rules belong to the backend.
 * Kept dependency-free so both screens (and tests) can import them.
 */

// Email lives in the shared validator so every form agrees on what's valid.
export { isValidEmail } from '@/utils/validation';

export const MIN_PASSWORD_LENGTH = 8;

/** Which credential the user typed. */
export type IdentifierChannel = 'email' | 'phone';

/**
 * Sign-in accepts either credential in one field. `null` means neither format
 * matched, which is what drives the inline error.
 */
export function classifyIdentifier(value: string): IdentifierChannel | null {
  if (isValidEmail(value)) return 'email';
  if (isValidNigerianPhone(formatNigerianPhoneInput(value))) return 'phone';
  return null;
}

/**
 * Normalises what the user typed into what a backend wants: emails lowercased
 * and trimmed, phones as E.164 (+234…) with the trunk 0 dropped and spacing
 * removed. Returns `null` when the input is neither.
 */
export function buildCredentials(
  identifier: string,
  password: string,
): { identifier: string; channel: IdentifierChannel; password: string } | null {
  const channel = classifyIdentifier(identifier);
  if (!channel) return null;

  const normalised =
    channel === 'email' ? identifier.trim().toLowerCase() : formatNigerianPhoneInput(identifier);

  return { identifier: normalised, channel, password };
}
