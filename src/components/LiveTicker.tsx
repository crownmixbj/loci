import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { TopStatusBar } from '@/components/ui/top-status-bar';
import { activeMovements, useBookings } from '@/store/bookings';
import { useSession } from '@/store/session';

/**
 * Live parcel ticker, self-contained so it can live in the layout rather than
 * a screen: it reads the store and session itself instead of being handed
 * movements from whatever page happens to render it.
 */
export function LiveTicker() {
  const router = useRouter();
  const { bookings } = useBookings();
  const { viewerId, role } = useSession();

  /**
   * Only what's live for the role you're viewing as — the parcels you're
   * carrying as a driver, or the ones you sent.
   */
  const movements = useMemo(
    () => (viewerId ? activeMovements(bookings, viewerId).filter((m) => m.role === role) : []),
    [bookings, viewerId, role],
  );

  /** Tapping opens the first moving parcel; with none, the home list. */
  const openActiveTracking = () => {
    const first = movements[0];
    if (first) {
      router.push({ pathname: '/parcel/[id]', params: { id: first.id } });
      return;
    }
    router.navigate('/');
  };

  return <TopStatusBar movements={movements} role={role} onPressTicker={openActiveTracking} />;
}
