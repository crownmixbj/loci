import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SectionHeaderProps = {
  title: string;
  /** Right-hand link. Omit both and the header renders as a title alone. */
  actionLabel?: string;
  onAction?: () => void;
  accessibilityLabel?: string;
  /** Overrides for sections with their own background. */
  titleColor?: string;
  actionColor?: string;
};

/**
 * Centred section title with a link pinned to the right edge. The link is
 * absolutely positioned so its width can't pull the title off centre; below
 * 480px there isn't room for both on one line, so it drops underneath.
 */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  accessibilityLabel,
  titleColor,
  actionColor,
}: SectionHeaderProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const linkBelowTitle = width < 480;

  const showAction = Boolean(actionLabel && onAction);

  return (
    <View style={[styles.row, showAction && linkBelowTitle && styles.rowStacked]}>
      <Text style={[styles.title, { color: titleColor ?? theme.text }]}>{title}</Text>

      {showAction && (
        // `hovered` is web-only; on native the callback just never sets it.
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={accessibilityLabel ?? actionLabel}
          style={({ pressed }) => [
            linkBelowTitle ? styles.actionBelow : styles.actionAnchor,
            pressed && styles.pressed,
          ]}>
          {({ hovered }: { hovered?: boolean }) => (
            <Text
              style={[
                styles.action,
                { color: actionColor ?? theme.primary },
                Platform.OS === 'web' && hovered && styles.actionHovered,
              ]}>
              {actionLabel}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    // Relative anchor for the absolutely-placed link.
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    // Reserves the link's line height so the title doesn't shift when it wraps.
    minHeight: 28,
    // 12 — tighter than the 32 section rhythm so the header binds to its cards.
    marginBottom: Spacing.two + 4,
  },
  rowStacked: {
    gap: Spacing.one,
  },
  title: {
    ...Typography.sectionHeading,
    textAlign: 'center',
  },
  actionAnchor: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  actionBelow: {
    alignSelf: 'center',
  },
  action: {
    ...Typography.button,
  },
  actionHovered: {
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.7,
  },
});
