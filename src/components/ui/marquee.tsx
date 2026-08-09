import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

export type MarqueeProps = {
  children: React.ReactNode;
  /** Pixels per second. Slower reads better for addresses. */
  speed?: number;
};

/**
 * Seamless horizontal marquee. The content renders twice and translates by
 * exactly one copy's width, so the second copy is already in place when the
 * first scrolls out — no snap-back.
 */
export function Marquee({ children, speed = 45 }: MarqueeProps) {
  const [contentWidth, setContentWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (contentWidth <= 0) return;

    translateX.setValue(0);
    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: -contentWidth,
        duration: (contentWidth / speed) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [contentWidth, speed, translateX]);

  return (
    <View style={styles.viewport}>
      <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
        <View style={styles.copy} onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}>
          {children}
        </View>
        <View style={styles.copy} aria-hidden>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Slowly pulsing dot, used as a divider and as the LIVE indicator.
 *
 * Holds steady when the OS reports Reduce Motion. This loops indefinitely, and
 * WCAG 2.2.2 covers anything that moves for more than five seconds — for a
 * vestibular-sensitive user an endlessly breathing dot in the corner of the
 * screen is exactly the sort of thing that setting exists to stop. The dot
 * still renders, fully opaque, so it never stops carrying its meaning.
 */
export function PulsingDot({ color, style }: { color: string; style?: object }) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);

  return <Animated.View style={[styles.dot, { backgroundColor: color, opacity }, style]} />;
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
  track: {
    flexDirection: 'row',
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
