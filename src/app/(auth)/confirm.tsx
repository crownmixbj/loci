import { useRouter } from 'expo-router';
import { CircleAlert, MailWarning, UserRoundX } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/ui/auth-shell';
import { Button } from '@/components/ui/button';
import { ResendVerification } from '@/components/ui/resend-verification';
import { showToast } from '@/components/ui/toast';
import { Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  parseConfirmationParams,
  resolveConfirmation,
  type ConfirmOutcome,
} from '@/lib/email-confirmation';
import { useSession } from '@/store/session';

/**
 * Where every confirmation email lands.
 *
 * ⚠ One route for all of it, rather than a branch bolted to the home page.
 *
 *   These links used to arrive at the project's Site URL — the marketing home —
 *   which reads no parameters at all. An expired token therefore produced a
 *   perfectly normal home page, and the person was left believing the link had
 *   worked. Silence is the worst possible answer to "did that do anything".
 *
 * The decision itself is in `lib/email-confirmation.ts` and is pure. This screen
 * only renders the outcome and, in one case, performs the exchange.
 */
export default function ConfirmScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { status, user, signOut } = useSession();

  const [outcome, setOutcome] = useState<ConfirmOutcome | null>(null);
  const [leaving, setLeaving] = useState(false);

  /*
   * Read once, from the URL the browser was opened with.
   *
   * On native there is no URL bar; a deep link arrives through the router,
   * which puts the same parameters on the route. Reading `window.location`
   * first covers the web case including the hash, which the router drops.
   */
  const params = useMemo(() => {
    const href = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : '';
    return parseConfirmationParams(href);
  }, []);

  useEffect(() => {
    /*
     * Wait for the session to settle first.
     *
     * Half of the branches depend on who is signed in, and at launch that is
     * not yet known — resolving early would call every arrival "signed out" and
     * skip the mismatch check entirely.
     */
    if (status === 'loading') return;

    setOutcome(resolveConfirmation({ params, sessionEmail: user?.email ?? null }));
  }, [params, status, user?.email]);

  /*
   * The happy paths leave immediately.
   *
   * `supabase-js` exchanges the code itself — `detectSessionInUrl` is on — so by
   * the time a session exists there is nothing for this screen to do but say so
   * and get out of the way.
   */
  useEffect(() => {
    if (!outcome) return;

    if (outcome.kind === 'already-signed-in' || outcome.kind === 'exchange') {
      showToast('Email confirmed', {
        message: 'Your account is active. Welcome to LOCI.',
        tone: 'success',
      });
      router.replace('/');
    }

    if (outcome.kind === 'nothing') router.replace('/sign-in');
  }, [outcome, router]);

  /*
    `nothing` is in here rather than falling through to the panel below.

    The effect above has already sent them to sign-in, but a render happens
    first — and without this it would be the "that link has expired" screen,
    shown for a frame to somebody who never clicked a link at all.
  */
  if (
    !outcome ||
    outcome.kind === 'nothing' ||
    outcome.kind === 'already-signed-in' ||
    outcome.kind === 'exchange'
  ) {
    return (
      <AuthShell title="Confirming your email" subtitle="One moment.">
        <ActivityIndicator color={theme.primary} style={styles.loading} />
      </AuthShell>
    );
  }

  /* ---------- signed in as somebody else ---------- */
  if (outcome.kind === 'wrong-account') {
    return (
      <AuthShell
        title="This link is for another account"
        subtitle="Nothing has been changed. Sign out first so the confirmation lands on the right account.">
        <View style={styles.form}>
          <View style={[styles.icon, { backgroundColor: theme.warningSoft }]}>
            <UserRoundX color={theme.warningOnSoft} size={28} />
          </View>

          {/*
            Both addresses, side by side.

            On a shared laptop this is somebody discovering they are logged in
            as a family member. Naming only one of the two leaves them guessing
            which is which.
          */}
          <View style={[styles.compare, { backgroundColor: theme.surfaceMuted }]}>
            <Row label="Signed in as" value={outcome.signedInAs} />
            <Row label="Link is for" value={outcome.linkFor} />
          </View>

          <Button
            label={leaving ? 'Signing out…' : 'Sign out and confirm'}
            disabled={leaving}
            onPress={async () => {
              setLeaving(true);
              await signOut();
              /*
                Straight back here, with the link intact.

                The parameters are still on the URL, so re-resolving after the
                sign-out lands on whichever branch is now correct — usually the
                exchange. Sending them to sign-in instead would make them find
                the email again.
              */
              setOutcome(resolveConfirmation({ params, sessionEmail: null }));
              setLeaving(false);
            }}
          />

          <Button label="Stay signed in" variant="secondary" onPress={() => router.replace('/')} />
        </View>
      </AuthShell>
    );
  }

  /* ---------- expired, spent, or refused ---------- */
  const expired = outcome.kind === 'expired';

  return (
    <AuthShell
      title={expired ? 'That link has expired' : 'That link did not work'}
      subtitle={
        expired
          ? 'Confirmation links are good for one hour, and can only be used once. Send yourself a fresh one below.'
          : outcome.message
      }>
      <View style={styles.form}>
        <View style={[styles.icon, { backgroundColor: theme.warningSoft }]}>
          {expired ? (
            <MailWarning color={theme.warningOnSoft} size={28} />
          ) : (
            <CircleAlert color={theme.warningOnSoft} size={28} />
          )}
        </View>

        <ResendVerification
          email={outcome.email}
          onAlreadyConfirmed={(address) => {
            /*
              The resend refused because the account is already confirmed, which
              is the only trustworthy way to learn it — Supabase reports a spent
              token and an expired one identically. Good news, so it is said as
              good news and they are sent where they can act on it.
            */
            showToast('Already confirmed', {
              message: 'This account is active. Sign in with your password.',
              tone: 'success',
            });
            router.replace({ pathname: '/sign-in', params: { email: address } });
          }}
        />

        <Button
          label="Back to sign in"
          variant="secondary"
          onPress={() => router.replace('/sign-in')}
        />
      </View>
    </AuthShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: Spacing.six,
  },
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
  compare: {
    gap: Spacing.two,
    padding: Spacing.three - 4,
    borderRadius: Spacing.two,
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    ...Typography.caption,
  },
  rowValue: {
    ...Typography.body,
    ...font(700),
  },
});
