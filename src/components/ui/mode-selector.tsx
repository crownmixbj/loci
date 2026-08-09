import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ModeOption<T extends string> = {
  value: T;
  label: string;
  /** One line explaining what the choice means in practice. */
  description: string;
  /** Optional price consequence, e.g. "+₦800". Rendered as a chip. */
  badge?: string;
  icon?: (color: string, size: number) => React.ReactNode;
};

export type ModeSelectorProps<T extends string> = {
  label: string;
  value: T;
  options: readonly ModeOption<T>[];
  onChange: (value: T) => void;
};

/**
 * A short list of mutually exclusive choices, each with a line of explanation.
 *
 * Deliberately not a two-state switch: the options differ in what they cost and
 * where the parcel physically goes, and a switch gives no room to say so. Uses
 * `radio` roles so assistive tech announces "2 of 2 selected" rather than
 * reading two unrelated buttons.
 */
export function ModeSelector<T extends string>({
  label,
  value,
  options,
  onChange,
}: ModeSelectorProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>

      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={
                option.badge
                  ? `${option.label}. ${option.description}. ${option.badge}`
                  : `${option.label}. ${option.description}`
              }
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected ? theme.backgroundSelected : theme.surfaceMuted,
                  borderColor: selected ? theme.primary : 'transparent',
                },
                pressed && styles.pressed,
              ]}>
              <View style={styles.optionHeader}>
                {/* Radio mark, drawn rather than imported to stay theme-driven. */}
                <View
                  style={[styles.radio, { borderColor: selected ? theme.primary : theme.border }]}>
                  {selected && (
                    <View style={[styles.radioDot, { backgroundColor: theme.primary }]} />
                  )}
                </View>

                <Text
                  style={[styles.optionLabel, { color: selected ? theme.primary : theme.text }]}
                  numberOfLines={2}>
                  {option.label}
                </Text>

                {!!option.badge && (
                  <View style={[styles.badge, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.badgeLabel, { color: theme.textSecondary }]}>
                      {option.badge}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={[styles.optionDescription, { color: theme.textMuted }]}>
                {option.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two,
  },
  label: {
    ...Typography.label,
    ...font(600),
  },
  options: {
    gap: Spacing.two,
  },
  option: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  optionLabel: {
    flex: 1,
    ...Typography.body,
    ...font(700),
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
  },
  badgeLabel: {
    ...Typography.caption,
    ...font(700),
  },
  optionDescription: {
    ...Typography.caption,
    // Clears the radio so the description lines up with the label above it.
    paddingLeft: 18 + Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
});
