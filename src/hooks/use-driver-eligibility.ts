import { useSession } from '@/store/session';
import { REVIEW_WORKING_DAYS } from '@/store/driver-applications';

/**
 * Whether this account may accept delivery jobs, and if not, why.
 *
 * One source of truth for both accept surfaces — the Find Jobs feed and the
 * home widget — so they can't disagree about who is allowed to carry a parcel.
 *
 * Browsing is deliberately untouched. An unapproved user can read the whole
 * feed, open every job and see the payouts; the only thing they cannot do is
 * take one. Hiding the jobs would remove the reason to apply in the first place.
 */
export type DriverEligibility = {
  canAccept: boolean;
  /** Short enough to sit under a button. Null when they can accept. */
  reason: string | null;
  /** A next step, when there is one. */
  action: { label: string; href: '/sign-in' | '/driver-signup' } | null;
};

export function useDriverEligibility(): DriverEligibility {
  const { isAuthenticated, isApprovedDriver, application } = useSession();

  if (isApprovedDriver) {
    return { canAccept: true, reason: null, action: null };
  }

  /*
   * Signed out is not the same as unapproved — we don't know who they are yet,
   * so the honest next step is to sign in rather than to apply.
   */
  if (!isAuthenticated) {
    return {
      canAccept: false,
      reason: 'Sign in to accept jobs',
      action: { label: 'Sign in', href: '/sign-in' },
    };
  }

  if (!application) {
    return {
      canAccept: false,
      reason: 'Approved drivers only',
      action: { label: 'Apply to drive', href: '/driver-signup' },
    };
  }

  if (application.status === 'rejected') {
    return {
      canAccept: false,
      reason: 'Your driver application was not approved',
      action: null,
    };
  }

  /*
   * Two waiting states, two messages. The dashboard distinguishes "nobody has
   * opened this yet" from "someone is reading it now", and so should the
   * applicant — the second means their wait is nearly over, which is worth
   * knowing when the promise is a number of days.
   */
  if (application.status === 'under_review') {
    return {
      canAccept: false,
      reason: 'Your application is being reviewed now',
      action: { label: 'Check status', href: '/driver-signup' },
    };
  }

  return {
    canAccept: false,
    reason: `Awaiting review — up to ${REVIEW_WORKING_DAYS} working days`,
    action: { label: 'Check status', href: '/driver-signup' },
  };
}
