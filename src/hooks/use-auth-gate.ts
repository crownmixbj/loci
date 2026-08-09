import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { showDialog } from '@/components/ui/dialog';
import { useSession } from '@/store/session';

/**
 * Guards the actions that attach data to a person.
 *
 * Browsing stays open — Home, Hubs, About and the jobs feed need no account.
 * What needs one is anything that *writes*: posting a parcel, applying to
 * drive, accepting a job. Those are the points where "who is this?" stops being
 * rhetorical.
 *
 * Two rules the prompts follow:
 *
 * 1. Offer **both** doors. Someone hitting this wall is as likely to be new as
 *    returning, and a prompt that only says "Sign in" makes a first-time user
 *    hunt for the sign-up link on the next screen.
 * 2. Always carry a `next` route, so signing in returns them to the thing they
 *    were doing instead of dumping them on the home screen.
 */
export function useAuthGate() {
  const { isAuthenticated, status } = useSession();
  const router = useRouter();

  /**
   * Runs `action` when signed in. Otherwise prompts, and on confirmation opens
   * sign-in or sign-up with `next` set.
   *
   * Returns true when the action ran, so callers can skip their own follow-up.
   */
  const requireAuth = useCallback(
    (
      action: () => void,
      options: { reason: string; next?: string; title?: string } = { reason: '' },
    ): boolean => {
      // Still restoring a stored session: acting now could bounce someone who
      // is in fact signed in.
      if (status === 'loading') return false;

      if (isAuthenticated) {
        action();
        return true;
      }

      const params = options.next ? { next: options.next } : {};

      showDialog(options.title ?? 'Sign in to continue', options.reason, [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Create an account',
          onPress: () => router.push({ pathname: '/sign-up', params }),
        },
        {
          text: 'Sign in',
          onPress: () => router.push({ pathname: '/sign-in', params }),
        },
      ]);

      return false;
    },
    [isAuthenticated, status, router],
  );

  return { requireAuth, isAuthenticated, status };
}
