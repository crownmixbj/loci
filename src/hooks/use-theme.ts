/**
 * The app is pinned to the light palette regardless of the device colour
 * scheme. The dark tokens are still defined in constants/theme.ts — to follow
 * the device instead, swap the body for `Colors[useColorScheme() ?? 'light']`.
 */

import { Colors } from '@/constants/theme';

export const FORCED_SCHEME = 'light' as const;

export function useTheme() {
  return Colors[FORCED_SCHEME];
}
