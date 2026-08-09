import { StyleSheet, View, type ViewProps } from 'react-native';

import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CardProps = ViewProps & {
  /** `flat` drops the shadow — use for nested or full-bleed containers. */
  variant?: 'elevated' | 'flat';
  padded?: boolean;
};

export function Card({ style, variant = 'elevated', padded = true, ...rest }: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.base,
        padded && styles.padded,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
        variant === 'elevated' && Elevation.card,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  padded: {
    padding: Spacing.three,
  },
});
