import { RefreshCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isAlreadyConfirmed } from '@/lib/email-confirmation';
import { errorMessage } from '@/lib/errors';
import { useSession } from '@/store/session';
import { isValidEmail } from '@/utils/validation';

/** Long enough to stop double-taps hitting Supabase's own rate limit. */
const RESEND_COOLDOWN_SECONDS = 45;

/**
 * Sends a fresh confirmation email, to an address it may have to ask for.
 *
 * ⚠ The field is not decoration: an expired link often arrives with no email.
 *
 *   Supabase's error redirect carries `error` and `error_code` and nothing
 *   else. `signUp` puts the address on the link so most arrivals do know who
 *   they are — but somebody who signed up before that shipped, or who edited
 *   the URL, or whose mail client mangled it, lands here anonymous. Without a
 *   field they would be told to request a new link and given no way to do it.
 *
 * ⚠ A refusal is sometimes the good news.
 *
 *   `auth.resend` fails for an address that is already confirmed, and that
 *   refusal is the only reliable way to tell an expired token from a spent one
 *   — Supabase reports both as `otp_expired`. So it is caught and turned into
 *   "you are already confirmed, go and sign in" rather than shown as an error.
 */
export function ResendVerification({
  email: initialEmail,
  onAlreadyConfirmed,
}: {
  /** From the link, when it carried one. */
  email?: string | null;
  /** Called when the resend reveals the account needs no confirming. */
  onAlreadyConfirmed: (email: string) => void;
}) {
  const theme = useTheme();
  const { resendConfirmation } = useSession();

  const [email, setEmail] = useState(initialEmail ?? '');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async () => {
    const address = email.trim().toLowerCase();

    if (!isValidEmail(address)) {
      setError('Enter the email address you signed up with.');
      return;
    }

    setPending(true);
    setError('');
    setSent(false);

    let result;
    try {
      result = await resendConfirmation(address);
    } catch (thrown) {
      result = { error: errorMessage(thrown, 'Something went wrong.') };
    } finally {
      setPending(false);
    }

    if (result.error) {
      if (isAlreadyConfirmed(undefined, result.error)) {
        onAlreadyConfirmed(address);
        return;
      }
      setError(result.error);
      return;
    }

    setSent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  return (
    <View style={styles.block}>
      <Field
        label="Email address"
        placeholder="you@example.com"
        value={email}
        onChangeText={(next) => {
          setEmail(next);
          setError('');
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={error || undefined}
      />

      {sent && (
        <View style={[styles.banner, { backgroundColor: theme.successSoft }]}>
          <Text style={[styles.bannerText, { color: theme.successOnSoft }]}>
            A new link is on its way to {email.trim().toLowerCase()}. It is good for one hour —
            check your spam folder if it does not arrive.
          </Text>
        </View>
      )}

      <Button
        label={pending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send a new link'}
        icon={(color, size) => <RefreshCw color={color} size={size} />}
        onPress={send}
        disabled={pending || cooldown > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two + 2,
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
