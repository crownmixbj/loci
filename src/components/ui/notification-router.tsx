import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Takes a driver to the trip they tapped.
 *
 * Renders nothing. It exists because a push notification that opens the app on
 * whatever screen it was last on is a notification people learn not to tap —
 * and a dispatch offer is held for five minutes, so the extra navigation is a
 * meaningful share of the time available to answer it.
 *
 * Two entry points, and both are needed:
 *
 *   cold start   the app was closed. `getLastNotificationResponseAsync` is the
 *                only way to learn what opened it.
 *   warm         the app was backgrounded. The listener fires instead.
 */
export function NotificationRouter() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;

    const open = (response: Notifications.NotificationResponse | null) => {
      if (cancelled || !response) return;

      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.type !== 'dispatch_offer') return;

      /*
       * To Assigned Trip, not to the parcel and not to the planner.
       *
       * ⚠ This said `/available-packages` until the offer card moved. That was
       *   correct when offers lived on the scheduling tab and quietly wrong the
       *   moment they did not — a tap would open a screen with nothing on it to
       *   answer, seconds into a five-minute window.
       *
       * Not the parcel detail either: by the time a driver taps, the offer may
       * have gone to somebody else, and landing on "not yours" is worse than
       * landing on the screen that shows what is actually waiting.
       */
      router.navigate('/driver');
    };

    void Notifications.getLastNotificationResponseAsync().then(open);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [router]);

  return null;
}
