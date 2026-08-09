import { StyleSheet, Text, View } from 'react-native';

import { MaxContentWidth, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shared content padding so all three tabs line up exactly. Navigation sits at
 * the top now, so the bottom only needs breathing room, not tab-bar clearance.
 */
export const screenPadding = {
  paddingHorizontal: Spacing.four,
  paddingTop: Spacing.four,
  paddingBottom: Spacing.six,
};

export function ScreenHeader({
  title,
  subtitle,
  /** Shows the LOCI wordmark above the title. */
  brand = true,
}: {
  title: string;
  subtitle?: string;
  brand?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.header}>
      {brand && <Text style={[styles.brand, { color: theme.primary }]}>LOCI</Text>}
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {!!subtitle && (
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      )}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const theme = useTheme();
  return <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{children}</Text>;
}

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon?: (color: string, size: number) => React.ReactNode;
  title: string;
  message: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.empty}>
      {icon?.(theme.textMuted, 40)}
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one + 2,
    marginBottom: Spacing.four,
    maxWidth: MaxContentWidth,
  },
  brand: {
    ...Typography.label,
    ...font(800),
    letterSpacing: 2.4,
    marginBottom: Spacing.half,
  },
  title: {
    ...Typography.screenTitle,
  },
  subtitle: {
    ...Typography.screenSubtitle,
  },
  sectionLabel: {
    ...Typography.label,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.two,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.three,
  },
  emptyTitle: {
    ...Typography.sectionTitle,
    marginTop: Spacing.one,
  },
  emptyMessage: {
    ...Typography.body,
    textAlign: 'center',
  },
});
