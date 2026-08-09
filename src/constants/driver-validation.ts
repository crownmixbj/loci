export { isValidEmail, EMAIL_ERROR_MESSAGE } from '@/utils/validation';

/**
 * Field rules for the driver application. Dependency-free so the screen and
 * tests share exactly one definition of "valid".
 */

/** Exactly 12 alphanumeric characters, case-insensitive. */
export const LICENCE_LENGTH = 12;

export function isValidLicenceId(value: string): boolean {
  return new RegExp(`^[A-Za-z0-9]{${LICENCE_LENGTH}}$`).test(value.trim());
}

/**
 * Nigerian plates run 6–10 characters once separators are dropped, e.g.
 * "ABC-123DE". Deliberately loose — plate formats vary by state and vehicle
 * class, and rejecting a real plate is worse than accepting an odd one.
 */
export function isValidPlateNumber(value: string): boolean {
  const compact = value.replace(/[\s-]/g, '');
  return /^[A-Za-z0-9]{6,10}$/.test(compact);
}

/** NIN is optional; when given it must be exactly 11 digits. */
export const NIN_LENGTH = 11;

export function isValidNin(value: string): boolean {
  const compact = value.replace(/\s/g, '');
  return compact.length === 0 || new RegExp(`^\\d{${NIN_LENGTH}}$`).test(compact);
}

/** NUBAN account numbers are exactly 10 digits. */
export const NUBAN_LENGTH = 10;

export function isValidNuban(value: string): boolean {
  return new RegExp(`^\\d{${NUBAN_LENGTH}}$`).test(value.replace(/\s/g, ''));
}

/** Relationships offered for a guarantor and for next of kin. */
export const GUARANTOR_RELATIONSHIPS = [
  'Employer',
  'Clergy',
  'Family member',
  'Landlord',
  'Community leader',
  'Colleague',
] as const;

export const NEXT_OF_KIN_RELATIONSHIPS = [
  'Spouse',
  'Parent',
  'Sibling',
  'Child',
  'Other relative',
  'Friend',
] as const;

/**
 * Commercial banks licensed by the CBN, plus the larger mobile-money and
 * merchant banks drivers are likely to be paid into. Names change with mergers
 * and licence upgrades — worth checking against the CBN register before launch.
 */
export const NIGERIAN_BANKS = [
  'Access Bank',
  'Citibank Nigeria',
  'Ecobank Nigeria',
  'Fidelity Bank',
  'First Bank of Nigeria',
  'First City Monument Bank (FCMB)',
  'Globus Bank',
  'Guaranty Trust Bank (GTBank)',
  'Heritage Bank',
  'Keystone Bank',
  'Kuda Microfinance Bank',
  'Moniepoint MFB',
  'Opay Digital Services',
  'Optimus Bank',
  'Palmpay',
  'Parallex Bank',
  'Polaris Bank',
  'PremiumTrust Bank',
  'Providus Bank',
  'Stanbic IBTC Bank',
  'Standard Chartered Bank',
  'Sterling Bank',
  'SunTrust Bank',
  'Titan Trust Bank',
  'Union Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Unity Bank',
  'Wema Bank',
  'Zenith Bank',
] as const;
