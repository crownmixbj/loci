import { PlugZap } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, Typography, font } from '@/constants/theme';
import { backendConfigured, buildLabel } from '@/lib/build-info';
import { useTheme } from '@/hooks/use-theme';

/**
 * A build with no backend says so, everywhere, permanently.
 *
 * `isSupabaseConfigured` is false whenever the EXPO_PUBLIC_SUPABASE_* variables
 * were missing at build time. The app does not crash in that state — it falls
 * back to in-memory seed data, so sign-up "works", parcels "save", and nothing
 * survives a restart. That is the worst kind of failure to hand a tester,
 * because everything they then report is about a fiction.
 *
 * Deliberately not dismissible. The condition is a property of the build, not a
 * notice: it cannot be acted on from inside the app and it cannot stop being
 * true until someone rebuilds. A dismissible version gets dismissed in the
 * first minute and the afternoon is lost anyway.
 *
 * Renders nothing on a correctly configured build, so a real release pays one
 * boolean for it.
 */
export function BuildBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (backendConfigured) return null;

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        {
          backgroundColor: theme.dangerSoft,
          borderBottomColor: theme.danger,
          /*
            When this renders it is the topmost thing in the app, so it takes
            the status bar strip. The layouts below give theirs up in exactly
            this case — see `topInset` in `hooks/use-top-inset.ts`.
          */
          paddingTop: insets.top + Spacing.two + 2,
        },
      ]}>
      <PlugZap color={theme.dangerOnSoft} size={16} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: theme.dangerOnSoft }]}>
          This build has no database
        </Text>
        <Text style={[styles.body, { color: theme.dangerOnSoft }]}>
          It is running on sample data. Accounts, parcels and photos are not saved and will vanish
          when you close the app — please don&apos;t report bugs against it. Build: {buildLabel()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    // Top padding is applied inline, because it carries the safe-area inset.
    paddingBottom: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    ...Typography.meta,
    ...font(700),
  },
  body: {
    ...Typography.caption,
    lineHeight: 17,
  },
});
