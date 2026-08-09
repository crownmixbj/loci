import { useRouter } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shown where a personal feed would be, when nobody is signed in.
 *
 * Both doors, every time. Someone landing here is as likely to be new as
 * returning, and a screen offering only "Sign in" makes a first-time visitor
 * hunt for the sign-up link. `next` carries them back here afterwards.
 */
export function SignedOutState({
  title,
  message,
  next,
}: {
  title: string;
  message: string;
  next: string;
}) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Card style={styles.card}>
      <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
        <LockKeyhole color={theme.primaryOnSoft} size={24} />
      </View>

      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>

      <View style={styles.actions}>
        <Button
          label="Sign in"
          size="md"
          style={styles.action}
          onPress={() => router.push({ pathname: '/sign-in', params: { next } })}
        />
        <Button
          label="Create an account"
          variant="secondary"
          size="md"
          style={styles.action}
          onPress={() => router.push({ pathname: '/sign-up', params: { next } })}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingVertical: Spacing.five,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  title: {
    ...Typography.sectionTitle,
    textAlign: 'center',
  },
  message: {
    ...Typography.body,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 420,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  action: {
    flexGrow: 1,
    flexBasis: 150,
  },
});
