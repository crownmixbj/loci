import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SelectableUpgradeCardProps = {
  label: string;
  description: string;
  /** Whether the card itself is chosen. Independent of `upgraded`. */
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  /** The paid upgrade within this card. Only meaningful while selected. */
  upgraded: boolean;
  onUpgradedChange: (upgraded: boolean) => void;
  upgradeLabel: string;
  upgradeHint?: string;
  /** Price of the upgrade, e.g. "+₦800". Shown only while `upgraded`. */
  badge?: string;
  icon?: (color: string, size: number) => React.ReactNode;
};

/**
 * A selectable option card with a paid upgrade switch nested inside it.
 *
 * The two are deliberately separate pieces of state. Selecting the card commits
 * to the free version of the option; the switch is what adds the charge. The
 * card's press handler is on its own row rather than wrapping the whole
 * container, because a Pressable ancestor would swallow taps aimed at the
 * switch and silently add a fee the user never asked for.
 *
 * Turning the switch on selects the card too — asking someone to tap twice to
 * reach an option they've already pointed at is just a trap. Deselecting the
 * card turns the upgrade off, so an unselected card can never carry a charge.
 */
export function SelectableUpgradeCard({
  label,
  description,
  selected,
  onSelectedChange,
  upgraded,
  onUpgradedChange,
  upgradeLabel,
  upgradeHint,
  badge,
  icon,
}: SelectableUpgradeCardProps) {
  const theme = useTheme();

  // Belt and braces: an unselected card must never look or behave as upgraded.
  const showUpgrade = selected && upgraded;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: selected ? theme.primarySoft : theme.surfaceMuted,
          borderColor: selected ? theme.primary : 'transparent',
        },
      ]}>
      <Pressable
        onPress={() => onSelectedChange(!selected)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${label}. ${description}`}
        style={({ pressed }) => [styles.selectRow, pressed && styles.pressed]}>
        {/* Drawn rather than imported, so it tracks the theme. */}
        <View style={[styles.box, { borderColor: selected ? theme.primary : theme.borderStrong }]}>
          {selected && <View style={[styles.boxTick, { backgroundColor: theme.primary }]} />}
        </View>

        {icon?.(selected ? theme.primaryOnSoft : theme.textMuted, 18)}

        <Text
          style={[styles.label, { color: selected ? theme.primaryOnSoft : theme.text }]}
          numberOfLines={2}>
          {label}
        </Text>
      </Pressable>

      <Text style={[styles.description, { color: theme.textMuted }]}>{description}</Text>

      {/* Only offered once the card is chosen — there is nothing to upgrade otherwise. */}
      {selected && (
        <View style={[styles.upgradeRow, { borderTopColor: theme.border }]}>
          <View style={styles.upgradeText}>
            <View style={styles.upgradeLabelRow}>
              <Text style={[styles.upgradeLabel, { color: theme.text }]}>{upgradeLabel}</Text>
              {!!badge && showUpgrade && (
                <View style={[styles.badge, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.badgeLabel, { color: theme.primaryOnSoft }]}>{badge}</Text>
                </View>
              )}
            </View>
            {!!upgradeHint && (
              <Text style={[styles.upgradeHint, { color: theme.textMuted }]}>{upgradeHint}</Text>
            )}
          </View>

          <Switch
            value={showUpgrade}
            onValueChange={(next) => {
              // Reaching for the switch is itself a choice of this option.
              if (next && !selected) onSelectedChange(true);
              onUpgradedChange(next);
            }}
            accessibilityLabel={
              badge ? `${upgradeLabel}. Adds ${badge.replace(/^\+/, '')}` : upgradeLabel
            }
            trackColor={{ false: theme.borderStrong, true: theme.primary }}
            thumbColor={theme.surface}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  box: {
    width: 18,
    height: 18,
    borderRadius: Radius.sm - 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxTick: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  label: {
    flex: 1,
    ...Typography.body,
    ...font(700),
  },
  description: {
    ...Typography.caption,
    // Clears the checkbox so the copy lines up under the label.
    paddingLeft: 18 + Spacing.two,
  },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.two,
    marginTop: Spacing.one,
    borderTopWidth: 1,
  },
  upgradeText: {
    flex: 1,
    gap: 2,
  },
  upgradeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  upgradeLabel: {
    ...Typography.body,
    ...font(600),
  },
  upgradeHint: {
    ...Typography.meta,
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
  pressed: {
    opacity: 0.7,
  },
});
