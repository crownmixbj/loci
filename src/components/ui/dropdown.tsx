import { Check, ChevronDown, Search, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Elevation, Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type DropdownProps<T extends string> = {
  label: string;
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  icon?: (color: string, size: number) => React.ReactNode;
  renderLabel?: (value: T) => string;
  error?: string;
  /** Options shown but not selectable, e.g. the origin city in a destination list. */
  disabledOptions?: readonly T[];
  /** Explains why a disabled option can't be picked. */
  disabledHint?: string;
  placeholder?: string;
  /** Shorter trigger for dense cards. Leaves the tap target at 38px. */
  compact?: boolean;
  /**
   * Adds a filter box above the list. Worth it past roughly a dozen options —
   * below that the search field costs more attention than the scrolling it
   * saves. Matching runs on the rendered label, so a search for "Oyo" finds
   * "Ibadan — Oyo".
   */
  searchable?: boolean;
  /** Placeholder for that filter box. */
  searchPlaceholder?: string;
};

export function Dropdown<T extends string>({
  label,
  options,
  selected,
  onSelect,
  icon,
  renderLabel,
  error,
  disabledOptions = [],
  disabledHint,
  placeholder,
  compact = false,
  searchable = false,
  searchPlaceholder,
}: DropdownProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  /**
   * With 37 states in the list, opening at the top means scrolling past two
   * dozen rows to see what's already chosen. Remember where the selected row
   * landed and jump to it — a little above, so it reads as "in a list" rather
   * than pinned to the edge.
   */
  const listRef = useRef<ScrollView>(null);
  const selectedY = useRef(0);

  const display = (value: T) => (renderLabel ? renderLabel(value) : value);

  const handleOpen = () => {
    // Always reopen on a clean list, so a filter from last time isn't hiding
    // options the user has forgotten they typed.
    setQuery('');
    setOpen(true);
    requestAnimationFrame(() =>
      listRef.current?.scrollTo({ y: Math.max(selectedY.current - 64, 0), animated: false }),
    );
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!searchable || !needle) return options;
    return options.filter((option) => display(option).toLowerCase().includes(needle));
    // `display` is derived from renderLabel, which callers define inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, query, searchable, renderLabel]);
  const accent = error ? theme.danger : theme.textSecondary;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        {icon?.(accent, 16)}
        <Text style={[styles.label, { color: accent }]}>{label}</Text>
      </View>

      <Pressable
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display(selected)}`}
        style={({ pressed }) => [
          styles.trigger,
          compact && styles.triggerCompact,
          {
            backgroundColor: pressed ? theme.backgroundSelected : theme.surface,
            borderColor: error ? theme.danger : theme.borderStrong,
          },
        ]}>
        <Text
          style={[styles.triggerText, { color: selected ? theme.text : theme.textMuted }]}
          numberOfLines={1}>
          {selected ? display(selected) : (placeholder ?? 'Select…')}
        </Text>
        <ChevronDown color={theme.textMuted} size={18} />
      </Pressable>

      {!!error && <Text style={[styles.helper, { color: theme.danger }]}>{error}</Text>}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: theme.surface, borderColor: theme.border },
              Elevation.raised,
            ]}
            onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: theme.textMuted }]}>{label}</Text>

            {searchable && (
              <View
                style={[
                  styles.searchRow,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}>
                <Search color={theme.textMuted} size={16} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
                  placeholderTextColor={theme.textMuted}
                  style={[styles.searchInput, { color: theme.text }]}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  accessibilityLabel={`Search ${label}`}
                  // Focus on open would raise the keyboard over a short list on
                  // a phone; the field is the first thing under the title.
                />
                {query.length > 0 && (
                  <Pressable
                    onPress={() => setQuery('')}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    hitSlop={8}>
                    <X color={theme.textMuted} size={16} />
                  </Pressable>
                )}
              </View>
            )}

            {searchable && visible.length === 0 && (
              <Text style={[styles.noResults, { color: theme.textMuted }]}>
                Nothing matches “{query.trim()}”.
              </Text>
            )}

            <ScrollView
              ref={listRef}
              bounces={false}
              showsVerticalScrollIndicator
              contentContainerStyle={styles.sheetContent}>
              {visible.map((option) => {
                const isSelected = option === selected;
                const isDisabled = disabledOptions.includes(option);

                return (
                  <Pressable
                    key={option}
                    onLayout={
                      isSelected
                        ? (event) => {
                            selectedY.current = event.nativeEvent.layout.y;
                          }
                        : undefined
                    }
                    disabled={isDisabled}
                    onPress={() => {
                      onSelect(option);
                      setOpen(false);
                    }}
                    accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                    style={({ pressed }) => [
                      styles.option,
                      pressed && !isDisabled && { backgroundColor: theme.backgroundSelected },
                    ]}>
                    <View style={styles.optionText}>
                      <Text
                        style={[
                          styles.optionLabel,
                          {
                            color: isDisabled
                              ? theme.textMuted
                              : isSelected
                                ? theme.primary
                                : theme.text,
                          },
                          isSelected && styles.optionLabelSelected,
                        ]}>
                        {display(option)}
                      </Text>
                      {isDisabled && !!disabledHint && (
                        <Text style={[styles.optionHint, { color: theme.textMuted }]}>
                          {disabledHint}
                        </Text>
                      )}
                    </View>
                    {isSelected && !isDisabled && <Check color={theme.primary} size={18} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export type ToggleRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: (color: string, size: number) => React.ReactNode;
  /**
   * Price consequence of switching this on, e.g. "+₦800". Shown only while the
   * toggle is on, because an unchecked option costs nothing and advertising a
   * charge against it reads as though it were already being applied.
   */
  badge?: string;
  /**
   * `warning` (default) is for handling flags like Fragile. `primary` is for
   * a paid extra, where amber would wrongly imply something is wrong.
   */
  tone?: 'warning' | 'primary';
};

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  icon,
  badge,
  tone = 'warning',
}: ToggleRowProps) {
  const theme = useTheme();

  const accent = tone === 'primary' ? theme.primary : theme.warning;
  const soft = tone === 'primary' ? theme.primarySoft : theme.warningSoft;
  const onSoft = tone === 'primary' ? theme.primaryOnSoft : theme.warningOnSoft;

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={
        // The badge appears and disappears, so state it rather than leaving a
        // screen-reader user to infer the cost from a chip they never see.
        [label, description, value && badge ? `Adds ${badge.replace(/^\+/, '')}` : null]
          .filter(Boolean)
          .join('. ')
      }
      style={[
        styles.toggleRow,
        {
          backgroundColor: value ? soft : theme.surfaceMuted,
          borderColor: value ? accent : 'transparent',
        },
      ]}>
      {icon?.(value ? onSoft : theme.textMuted, 18)}
      <View style={styles.toggleText}>
        <View style={styles.toggleLabelRow}>
          <Text style={[styles.toggleLabel, { color: value ? onSoft : theme.text }]}>{label}</Text>
          {!!badge && value && (
            <View style={[styles.toggleBadge, { backgroundColor: theme.surface }]}>
              <Text style={[styles.toggleBadgeLabel, { color: onSoft }]}>{badge}</Text>
            </View>
          )}
        </View>
        {!!description && (
          <Text style={[styles.toggleDescription, { color: theme.textMuted }]}>{description}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.borderStrong, true: accent }}
        thumbColor={theme.surface}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two - 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  label: {
    ...Typography.label,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  triggerCompact: {
    height: 38,
    paddingHorizontal: Spacing.three - 4,
  },
  triggerText: {
    ...Typography.body,
  },
  helper: {
    ...Typography.meta,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  /** Breathing room at the ends so the first and last rows aren't flush. */
  sheetContent: {
    paddingBottom: Spacing.two,
  },
  sheet: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    maxHeight: '60%',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three - 4,
    paddingVertical: Spacing.two - 2,
    marginBottom: Spacing.two,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    // Kills the web focus ring; the container already shows focus.
    outlineWidth: 0,
    paddingVertical: Spacing.one,
  },
  noResults: {
    ...Typography.caption,
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },
  sheetTitle: {
    ...Typography.label,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 2,
  },
  optionText: {
    flex: 1,
    gap: Spacing.half,
  },
  optionLabel: {
    ...Typography.body,
  },
  optionLabelSelected: {
    ...font(700),
  },
  optionHint: {
    ...Typography.meta,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    padding: Spacing.three - 2,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleText: {
    flex: 1,
    gap: Spacing.half,
  },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  toggleLabel: {
    ...Typography.body,
    ...font(600),
  },
  toggleBadge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
  },
  toggleBadgeLabel: {
    ...Typography.caption,
    ...font(700),
  },
  toggleDescription: {
    ...Typography.meta,
  },
});
