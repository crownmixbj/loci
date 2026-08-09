import { StyleSheet, View } from 'react-native';

import { Radius, toneColors, type Tone } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ProgressBarProps = {
  /** 0 to 1. Values outside the range are clamped. */
  fraction: number;
  tone?: Tone;
  /** Announced to screen readers, e.g. "Step 3 of 6, In Transit". */
  label?: string;
};

export function ProgressBar({ fraction, tone = 'primary', label }: ProgressBarProps) {
  const theme = useTheme();
  const { solid } = toneColors(theme, tone);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
      <View
        style={[
          styles.fill,
          { backgroundColor: solid, width: `${clamped * 100}%` },
          // A zero-width bar reads as broken; show a nub at the start instead.
          clamped === 0 && styles.nub,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 5,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  nub: {
    width: 5,
  },
});
