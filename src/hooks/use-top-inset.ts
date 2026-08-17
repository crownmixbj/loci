import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { backendConfigured } from '@/lib/build-info';

/**
 * How much room a layout must leave for the status bar and dynamic island.
 *
 * A native stack with `headerShown: false` hands the screen the entire window,
 * notch included, so anything drawn at y=0 lands under the clock. Every screen
 * in this app starts with a title, so every one of them needs this.
 *
 * Returns 0 when the build banner is on screen. That banner is the topmost
 * element in the tree and takes the strip itself; if the layout below also
 * reserved it, a disconnected build would show the gap twice. `backendConfigured`
 * is a build-time constant, not state — this cannot change while the app runs,
 * so there is no flicker and no re-layout.
 *
 * On web and on Android with an opaque status bar `insets.top` is already 0, so
 * this is a no-op there.
 */
export function useTopInset(): number {
  const insets = useSafeAreaInsets();
  return backendConfigured ? insets.top : 0;
}
