import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function Chip({ label, selected, onPress }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected
            ? theme.primary
            : pressed
              ? theme.backgroundSelected
              : theme.surface,
          borderColor: selected ? theme.primary : theme.borderStrong,
        },
      ]}>
      <Text
        style={[styles.chipText, { color: selected ? theme.primaryText : theme.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export type ChipGroupProps<T extends string> = {
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  /** Render labels differently from the raw value, e.g. 'all' → 'All cities'. */
  renderLabel?: (value: T) => string;
  /** Horizontal scroll instead of wrapping — better for long lists like cities. */
  scrollable?: boolean;
};

export function ChipGroup<T extends string>({
  options,
  selected,
  onSelect,
  renderLabel,
  scrollable = false,
}: ChipGroupProps<T>) {
  const chips = options.map((option) => (
    <Chip
      key={option}
      label={renderLabel ? renderLabel(option) : option}
      selected={option === selected}
      onPress={() => onSelect(option)}
    />
  ));

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollRow}>
        {chips}
      </ScrollView>
    );
  }

  return <View style={styles.wrapRow}>{chips}</View>;
}

/** iOS-style segmented control for two-to-three mutually exclusive modes. */
export function SegmentedControl<T extends string>({
  options,
  selected,
  onSelect,
  renderLabel,
}: Omit<ChipGroupProps<T>, 'scrollable'>) {
  const theme = useTheme();

  return (
    <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
      {options.map((option) => {
        const isSelected = option === selected;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.segmentItem,
              isSelected && { backgroundColor: theme.primary, shadowColor: theme.shadow },
            ]}>
            <Text
              style={[
                styles.segmentText,
                { color: isSelected ? theme.primaryText : theme.textSecondary },
              ]}>
              {renderLabel ? renderLabel(option) : option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.three - 2,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    ...Typography.caption,
    ...font(600),
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  scrollRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: Spacing.half + 2,
    gap: Spacing.half + 2,
  },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: Radius.sm + 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentText: {
    ...Typography.body,
    ...font(600),
  },
});
