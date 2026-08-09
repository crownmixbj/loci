import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { Elevation, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  /** Leading icon; receives the resolved label color so it always matches. */
  icon?: (color: string, size: number) => React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'lg';
  style?: PressableProps['style'];
};

export function Button({
  label,
  icon,
  variant = 'primary',
  size = 'lg',
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const theme = useTheme();

  const isPrimary = variant === 'primary';
  const labelColor = isPrimary ? theme.primaryText : theme.primary;
  const iconSize = size === 'lg' ? 20 : 18;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        {
          backgroundColor: isPrimary
            ? state.pressed
              ? theme.primaryPressed
              : theme.primary
            : state.pressed
              ? theme.backgroundSelected
              : theme.surface,
          borderColor: isPrimary ? 'transparent' : theme.borderStrong,
          shadowColor: theme.shadow,
        },
        isPrimary && Elevation.card,
        disabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {icon?.(labelColor, iconSize)}
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lg: {
    height: 54,
    paddingHorizontal: Spacing.four,
  },
  md: {
    height: 44,
    paddingHorizontal: Spacing.three,
  },
  label: {
    ...Typography.button,
  },
  disabled: {
    opacity: 0.5,
  },
});
