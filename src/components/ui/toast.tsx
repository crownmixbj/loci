import { CircleCheckBig, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Elevation, MaxContentWidth, Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Brief, non-blocking messages.
 *
 * Deliberately not a dialog: a greeting that has to be dismissed is friction on
 * every sign-in, and a modal steals focus from whatever the person came here to
 * do. This announces itself and gets out of the way.
 *
 * Same module-level queue as `dialog.tsx`, for the same reason — it's called
 * from stores and plain functions that have no hooks available.
 */
export type ToastTone = 'success' | 'info';

export type ToastRequest = {
  id: number;
  title: string;
  message?: string;
  tone: ToastTone;
  /** Milliseconds on screen. */
  duration: number;
};

type Listener = (request: ToastRequest | null) => void;

let current: ToastRequest | null = null;
let nextId = 0;
const listeners = new Set<Listener>();

function publish(request: ToastRequest | null) {
  current = request;
  listeners.forEach((listener) => listener(request));
}

export function showToast(
  title: string,
  options: { message?: string; tone?: ToastTone; duration?: number } = {},
): void {
  nextId += 1;
  publish({
    id: nextId,
    title,
    message: options.message,
    tone: options.tone ?? 'success',
    // Long enough to read a name and a sentence without hurrying, short enough
    // that it never becomes furniture. WCAG 2.2.2 wants anything auto-hiding to
    // be dismissible, which the close button covers.
    duration: options.duration ?? 4000,
  });
}

export function hideToast(): void {
  publish(null);
}

/** Test seam. */
export function currentToast(): ToastRequest | null {
  return current;
}

/** Mounted once at the root, beside `DialogHost`. */
export function ToastHost() {
  const theme = useTheme();
  const [request, setRequest] = useState<ToastRequest | null>(current);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    listeners.add(setRequest);
    return () => {
      listeners.delete(setRequest);
    };
  }, []);

  useEffect(() => {
    if (!request) return;

    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    const timer = setTimeout(() => publish(null), request.duration);
    return () => clearTimeout(timer);
  }, [request, slide]);

  if (!request) return null;

  const accent = request.tone === 'success' ? theme.success : theme.primary;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          opacity: slide,
          transform: [
            { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
          ],
        },
      ]}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow },
          Elevation.raised,
        ]}>
        <View style={[styles.icon, { backgroundColor: theme.successSoft }]}>
          <CircleCheckBig color={accent} size={18} />
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {request.title}
          </Text>
          {!!request.message && (
            <Text style={[styles.message, { color: theme.textSecondary }]} numberOfLines={2}>
              {request.message}
            </Text>
          )}
        </View>

        <Pressable
          onPress={hideToast}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={10}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <X color={theme.textMuted} size={16} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /*
   * `position: 'absolute'` rather than 'fixed': on web RN maps absolute onto the
   * root view, which is what we want, and 'fixed' isn't a valid RN value.
   */
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Clear of the floating nav capsule so it never lands on top of it.
    paddingTop: 96,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    zIndex: 50,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    width: '100%',
    maxWidth: Math.min(MaxContentWidth, 460),
    padding: Spacing.three - 4,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.body,
    ...font(700),
  },
  message: {
    ...Typography.meta,
    lineHeight: 18,
  },
  close: {
    padding: Spacing.one,
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.6,
  },
});
