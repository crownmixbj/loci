import { useLocalSearchParams, useRouter } from 'expo-router';
import { MailCheck, RefreshCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { AuthFooterLink, AuthShell } from '@/components/ui/auth-shell';
import { Button } from '@/components/ui/button';
import { Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/store/session';

/** Long enough to stop double-taps hitting Supabase's own rate limit. */
const RESEND_COOLDOWN_SECONDS = 45;

/**
 * Where sign-up lands when the account exists but is waiting on the emailed
 * link.
 *
 * A real route rather than a flag on the sign-up screen: it survives a reload,
 * the back gesture behaves, and there is somewhere to come back to if the user
 * leaves for their inbox and returns.
 */
export default function VerifyEmailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { resendConfirmation, status } = useSession();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();

  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  /*
   * Confirming in a browser signs the session in on this device too, and
   * `onAuthStateChange` fires. Rather than make the user come back and tap
   * "Sign in", send them straight into the app.
   */
  useEffect(() => {
    if (status === 'signedIn') router.replace('/');
  }, [status, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (pending || cooldown > 0 || !email) return;

    setPending(true);
    setError(null);
    setMessage(null);

    let result;
    try {
      result = await resendConfirmation(email);
    } catch (thrown) {
      result = { error: thrown instanceof Error ? thrown.message : 'Something went wrong.' };
    } finally {
      setPending(false);
    }

    if (result.error) {
      setError(result.error);
      return;
    }

    setMessage('Sent. Check your inbox, and your spam folder.');
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  /** Opens the default mail client. Harmless if none is installed. */
  const openMail = () => {
    const url = Platform.select({ ios: 'message://', android: 'mailto:', default: 'mailto:' });
    Linking.openURL(url).catch(() => {
      setError('No mail app found on this device. Open your email in a browser instead.');
    });
  };

  return (
    <AuthShell
      title="Confirm your email"
      subtitle={`Your account is created. Open the link we sent to activate it, then sign in with the password you just chose.`}
      onBack={() => router.replace('/sign-up')}
      footer={
        <AuthFooterLink
          prompt="Wrong address?"
          action="Sign up again"
          onPress={() => router.replace('/sign-up')}
        />
      }>
      <View style={styles.form}>
        <View style={[styles.icon, { backgroundColor: theme.successSoft }]}>
          <MailCheck color={theme.success} size={28} />
        </View>

        {!!email && (
          <View style={[styles.address, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[styles.addressText, { color: theme.text }]} numberOfLines={1}>
              {email}
            </Text>
          </View>
        )}

        {!!message && (
          <View style={[styles.banner, { backgroundColor: theme.successSoft }]}>
            <Text style={[styles.bannerText, { color: theme.successOnSoft }]}>{message}</Text>
          </View>
        )}

        {!!error && (
          <View style={[styles.banner, { backgroundColor: theme.dangerSoft }]}>
            <Text style={[styles.bannerText, { color: theme.dangerOnSoft }]}>{error}</Text>
          </View>
        )}

        <Button label="Open mail app" onPress={openMail} />

        <Button
          label={
            pending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend the email'
          }
          variant="secondary"
          disabled={pending || cooldown > 0 || !email}
          icon={(color, size) => <RefreshCw color={color} size={size} />}
          onPress={handleResend}
        />

        <Button
          label="I've confirmed — sign in"
          variant="secondary"
          onPress={() => router.replace('/sign-in')}
        />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.two + 2,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  address: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three - 4,
    borderRadius: Spacing.two,
  },
  addressText: {
    ...Typography.body,
    ...font(700),
  },
  banner: {
    padding: Spacing.three - 4,
    borderRadius: Spacing.two,
  },
  bannerText: {
    ...Typography.meta,
    lineHeight: 19,
  },
});
