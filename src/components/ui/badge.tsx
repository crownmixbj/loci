import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { Radius, Spacing, toneColors, Typography, type Tone, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BadgeProps = ViewProps & {
  label: string;
  tone?: Tone;
  /** Optional leading icon; receives the resolved foreground color. */
  icon?: (color: string) => React.ReactNode;
  uppercase?: boolean;
};

export function Badge({
  label,
  tone = 'neutral',
  icon,
  uppercase = true,
  style,
  ...rest
}: BadgeProps) {
  const theme = useTheme();
  const { background, foreground } = toneColors(theme, tone);

  return (
    <View style={[styles.badge, { backgroundColor: background }, style]} {...rest}>
      {icon?.(foreground)}
      <Text style={[styles.text, { color: foreground }, uppercase && styles.uppercase]}>
        {label}
      </Text>
    </View>
  );
}

export type RoutePillProps = BadgeProps & {
  /**
   * `outline` puts every pill on the same neutral fill and moves the tone to a
   * border and the label. Use it where several pills sit together and the
   * differing tone fills read as mismatched components rather than one system.
   */
  variant?: 'solid' | 'outline';
};

/**
 * A wider pill for route summaries, e.g. "Inter-State: Ibadan → Lagos".
 * Wraps rather than truncating, since routes can be long.
 */
export function RoutePill({
  label,
  tone = 'primary',
  icon,
  variant = 'solid',
  style,
  ...rest
}: RoutePillProps) {
  const theme = useTheme();
  const { background, foreground } = toneColors(theme, tone);
  const outlined = variant === 'outline';

  return (
    <View
      style={[
        styles.routePill,
        outlined
          ? { backgroundColor: theme.surfaceMuted, borderColor: foreground }
          : { backgroundColor: background },
        style,
      ]}
      {...rest}>
      {icon?.(foreground)}
      <Text style={[styles.routeText, { color: foreground }]}>{label}</Text>
    </View>
  );
}

/** One height for every pill, so a row of them never looks ragged. */
const PILL_HEIGHT = 26;

const styles = StyleSheet.create({
  /**
   * Badge and RoutePill share one geometry so they line up when they sit in the
   * same row. They used to differ — gap 4 vs 6, padding 8x5 vs 10x6 — which put
   * a route tag and a Fragile badge at visibly different heights side by side.
   * `minHeight` holds the height steady whether or not there's an icon.
   */
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: PILL_HEIGHT,
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 1,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  text: {
    ...Typography.badge,
  },
  uppercase: {
    textTransform: 'uppercase',
  },
  routePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: PILL_HEIGHT,
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 1,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  routeText: {
    ...Typography.caption,
    ...font(600),
    flexShrink: 1,
  },
});
