import { StyleSheet, View } from 'react-native';

import { LiveTicker } from '@/components/LiveTicker';
import { Navbar } from '@/components/Navbar';
import { PageCanvas, Spacing } from '@/constants/theme';

/**
 * The fixed top of the app: brand capsule plus the live delivery ticker.
 *
 * Extracted from the tabs layout so screens outside that group can mount the
 * same header instead of losing the navigation entirely. It is deliberately a
 * *sibling* of the scrolling content rather than the first row inside it —
 * that's what keeps it put while a screen scrolls under it, on native and web
 * alike, without needing `position: sticky` (which React Native has no concept
 * of).
 */
export function StickyHeader() {
  return (
    <View style={styles.header}>
      <Navbar />
      <View style={styles.ticker}>
        <LiveTicker />
      </View>
    </View>
  );
}

/**
 * Convenience wrapper: the header above, the screen below, filling the rest.
 *
 * Anything passed as `children` must do its own scrolling — that's the point.
 * The header is outside the scroll container, so it can't scroll away.
 */
export function StickyHeaderScreen({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.screen}>
      <StickyHeader />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageCanvas,
  },
  /**
   * The high z-index keeps the drawer and dropdowns above screen content, and
   * the canvas fill stops anything showing through behind the ticker as content
   * passes underneath.
   */
  header: {
    zIndex: 50,
    backgroundColor: PageCanvas,
    paddingBottom: Spacing.two,
  },
  ticker: {
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.two,
  },
});
