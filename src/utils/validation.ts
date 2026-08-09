/**
 * Shared field validators. Anything used by more than one screen belongs here
 * rather than beside a form, so there is exactly one definition of "valid".
 */

/**
 * Stricter than the loose `x@y.z` check: rejects consecutive dots, a leading or
 * trailing dot in either half, a hyphen at the edge of a domain label, and a
 * TLD under two characters or containing digits.
 */
export function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (!email || email.length > 254) return false;
  if (email.includes('..')) return false;

  const [local, domain, ...rest] = email.split('@');
  if (rest.length > 0 || !local || !domain) return false;

  // Local part: letters, digits and . _ % + - but never at either end.
  if (local.length > 64) return false;
  if (!/^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*$/.test(local)) return false;

  // Domain: dot-separated labels, each alphanumeric with inner hyphens only.
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  if (!labels.every((label) => /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label))) {
    return false;
  }

  // TLD: letters only, at least two.
  return /^[A-Za-z]{2,}$/.test(labels[labels.length - 1]);
}

/** Copy shown whenever an email fails the check. */
export const EMAIL_ERROR_MESSAGE = 'Please enter a valid email address';

/* ------------------------------------------------------------------ *
 * Nigerian phone numbers
 * ------------------------------------------------------------------ */

/** `+234` plus 10 national digits — 14 characters including the `+`. */
export const NG_DIAL_CODE = '+234';
export const NG_PHONE_LENGTH = 14;
export const NG_NATIONAL_DIGITS = 10;

/** Mobile numbers start 70, 80, 81, 90 or 91 once the trunk 0 is dropped. */
const NG_MOBILE_START = /^[789]/;

/**
 * Real-time mask. Accepts whatever the user types — `080…`, `2348…`, `+234 80…`
 * or bare digits — and always renders it as `+234` followed by up to 10 digits.
 *
 * The trunk `0` is dropped rather than kept: `08012345678` and `+2348012345678`
 * are the same number, and storing both shapes makes every later comparison a
 * special case.
 */
export function formatNigerianPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, '');

  // Peel off whichever prefix they typed, leaving the national part.
  if (digits.startsWith('234')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);

  return NG_DIAL_CODE + digits.slice(0, NG_NATIONAL_DIGITS);
}

/** Exactly `+234` + 10 digits, starting 7, 8 or 9. */
export function isValidNigerianPhone(value: string): boolean {
  const compact = value.replace(/\s/g, '');
  if (compact.length !== NG_PHONE_LENGTH) return false;
  if (!compact.startsWith(NG_DIAL_CODE)) return false;

  const national = compact.slice(NG_DIAL_CODE.length);
  return /^\d{10}$/.test(national) && NG_MOBILE_START.test(national);
}

/** Distinguishes "too short" from "wrong network code" for the inline error. */
export function nigerianPhoneError(value: string): string | undefined {
  const compact = value.replace(/\s/g, '');
  if (compact === NG_DIAL_CODE || compact === '') return 'Phone number is required';
  if (!compact.startsWith(NG_DIAL_CODE)) return 'Numbers must start with +234';

  const national = compact.slice(NG_DIAL_CODE.length);
  if (national.length < NG_NATIONAL_DIGITS) {
    return `${NG_NATIONAL_DIGITS - national.length} more digit${
      NG_NATIONAL_DIGITS - national.length === 1 ? '' : 's'
    } needed`;
  }
  if (national.length > NG_NATIONAL_DIGITS)
    return `Too long — ${NG_NATIONAL_DIGITS} digits after +234`;
  if (!NG_MOBILE_START.test(national)) return 'Nigerian mobile numbers start 70, 80, 81, 90 or 91';
  return undefined;
}
