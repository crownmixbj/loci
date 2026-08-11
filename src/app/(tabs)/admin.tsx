import { useRouter } from 'expo-router';
import {
  Banknote,
  CircleCheckBig,
  Clock,
  FileText,
  IdCard,
  Landmark,
  MailWarning,
  MapPin,
  PhoneCall,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip';
import { showDialog } from '@/components/ui/dialog';
import { EmptyState, screenPadding, ScreenHeader, SectionLabel } from '@/components/ui/screen';
import { SignedOutState } from '@/components/ui/signed-out-state';
import { showToast } from '@/components/ui/toast';
import { MaxContentWidth, Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchAllApplications,
  isOverdue,
  reviewApplication,
  REVIEW_WORKING_DAYS,
  STATUS_LABELS,
  workingDaysSince,
  type ApplicationStatus,
  type DriverApplication,
} from '@/store/driver-applications';
import { useSession } from '@/store/session';
import { signedDocumentUrl } from '@/store/driver-documents';

const FILTERS = ['pending', 'under_review', 'approved', 'rejected', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABELS: Record<Filter, string> = {
  pending: 'Pending',
  under_review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
  all: 'All',
};

/**
 * Driver application review.
 *
 * Only reachable, and only useful, for an account whose profile has `is_admin`.
 * The check below hides the screen; Row Level Security is what actually refuses
 * the data, so a non-admin who navigates here directly sees an empty list
 * rather than someone else's bank details.
 */
export default function AdminScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isAdmin, isAuthenticated } = useSession();

  const [applications, setApplications] = useState<DriverApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setApplications(await fetchAllApplications());
      setError(null);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'Could not load applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void load();
  }, [isAdmin, load]);

  const counts = useMemo(() => {
    const by = (status: ApplicationStatus) =>
      applications.filter((a) => a.status === status).length;
    return {
      pending: by('pending'),
      under_review: by('under_review'),
      approved: by('approved'),
      rejected: by('rejected'),
      overdue: applications.filter((a) => isOverdue(a)).length,
    };
  }, [applications]);

  const visible = useMemo(
    () => (filter === 'all' ? applications : applications.filter((a) => a.status === filter)),
    [applications, filter],
  );

  const decide = (application: DriverApplication, status: ApplicationStatus) => {
    if (!user) return;

    const approving = status === 'approved';

    showDialog(
      approving ? 'Approve this driver?' : 'Reject this application?',
      approving
        ? `${application.fullName} will be able to accept delivery jobs immediately. Check the documents and guarantor first — this is the only gate.`
        : `${application.fullName} will be told the application was unsuccessful. They cannot re-apply until this record is cleared.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approving ? 'Approve' : 'Reject',
          style: approving ? 'default' : 'destructive',
          onPress: () => void apply(application, status),
        },
      ],
    );
  };

  const apply = async (application: DriverApplication, status: ApplicationStatus) => {
    if (!user) return;

    setBusyId(application.id);
    try {
      const updated = await reviewApplication(application.id, { status, reviewerId: user.id });
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      showToast(status === 'approved' ? 'Driver approved' : 'Application rejected', {
        message: `${application.fullName} — ${application.reference}`,
      });
    } catch (thrown) {
      showDialog(
        'Could not save the decision',
        thrown instanceof Error ? thrown.message : 'Try again.',
      );
    } finally {
      setBusyId(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <ScrollView contentContainerStyle={[styles.container, screenPadding]}>
        <View style={styles.content}>
          <SignedOutState
            title="Sign in to review applications"
            message="The review dashboard is only available to LOCI administrators."
            next="/admin"
          />
        </View>
      </ScrollView>
    );
  }

  /*
   * Deliberately vague. Telling a signed-in non-admin "you are not an admin"
   * confirms the dashboard exists and that admin accounts are a thing worth
   * hunting for.
   */
  if (!isAdmin) {
    return (
      <ScrollView contentContainerStyle={[styles.container, screenPadding]}>
        <View style={styles.content}>
          <Card style={styles.emptyCard}>
            <EmptyState
              icon={(color, size) => <ShieldAlert color={color} size={size} />}
              title="Not available"
              message="This area isn't available on your account."
            />
            <Button label="Back to LOCI" size="md" onPress={() => router.replace('/')} />
          </Card>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, screenPadding]}>
      <View style={styles.content}>
        <ScreenHeader
          brand={false}
          title="Driver applications"
          subtitle={`Review within ${REVIEW_WORKING_DAYS} working days, as the Drivers page promises.`}
        />

        {/* ---------- Queue health ---------- */}
        <View style={styles.stats}>
          <Stat label="Awaiting review" value={counts.pending} tone="warning" />
          <Stat label="In review" value={counts.under_review} tone="primary" />
          <Stat label="Approved" value={counts.approved} tone="success" />
          <Stat
            label={`Past ${REVIEW_WORKING_DAYS} days`}
            value={counts.overdue}
            tone={counts.overdue > 0 ? 'danger' : 'neutral'}
          />
        </View>

        <ChipGroup
          options={FILTERS as unknown as string[]}
          selected={filter}
          onSelect={(value) => setFilter(value as Filter)}
          renderLabel={(value) => FILTER_LABELS[value as Filter]}
        />

        {!!error && (
          <View style={[styles.banner, { backgroundColor: theme.dangerSoft }]}>
            <Text style={[styles.bannerText, { color: theme.dangerOnSoft }]}>{error}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading applications…
            </Text>
          </View>
        ) : visible.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              icon={(color, size) => <CircleCheckBig color={color} size={size} />}
              title={filter === 'pending' ? 'Nothing waiting' : 'No applications here'}
              message={
                filter === 'pending'
                  ? 'Every application has been looked at. New ones appear here as they arrive.'
                  : 'Try another filter.'
              }
            />
          </Card>
        ) : (
          visible.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              busy={busyId === application.id}
              onApprove={() => decide(application, 'approved')}
              onReject={() => decide(application, 'rejected')}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const theme = useTheme();
  const color =
    tone === 'success'
      ? theme.successOnSoft
      : tone === 'warning'
        ? theme.warningOnSoft
        : tone === 'danger'
          ? theme.dangerOnSoft
          : tone === 'primary'
            ? theme.primaryOnSoft
            : theme.textSecondary;

  return (
    <View style={[styles.stat, { backgroundColor: theme.surfaceMuted }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function ApplicationCard({
  application,
  busy,
  onApprove,
  onReject,
}: {
  application: DriverApplication;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const waiting = workingDaysSince(application.submittedAt);
  const overdue = isOverdue(application);
  const decided = application.status === 'approved' || application.status === 'rejected';

  const attached = Object.entries(application.documents).filter(([, name]) => Boolean(name));

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeading}>
          <Text style={[styles.name, { color: theme.text }]}>{application.fullName}</Text>
          <Text style={[styles.reference, { color: theme.textMuted }]}>
            {application.reference} · {application.state}
          </Text>
        </View>

        <Badge
          label={STATUS_LABELS[application.status]}
          tone={
            application.status === 'approved'
              ? 'success'
              : application.status === 'rejected'
                ? 'danger'
                : application.status === 'under_review'
                  ? 'primary'
                  : 'warning'
          }
        />
      </View>

      {/* Time in queue, because the promise is a number of days. */}
      {!decided && (
        <View style={styles.waitRow}>
          <Clock color={overdue ? theme.dangerOnSoft : theme.textMuted} size={13} />
          <Text
            style={[
              styles.waitText,
              { color: overdue ? theme.dangerOnSoft : theme.textSecondary },
            ]}>
            {waiting === 0
              ? 'Submitted today'
              : `Waiting ${waiting} working day${waiting === 1 ? '' : 's'}`}
            {overdue ? ` — past the ${REVIEW_WORKING_DAYS}-day promise` : ''}
          </Text>
        </View>
      )}

      <Row icon={<PhoneCall color={theme.textMuted} size={15} />} label="Contact">
        {application.phone} · {application.email}
      </Row>
      <Row icon={<Truck color={theme.textMuted} size={15} />} label="Vehicle">
        {application.vehicleType} · {application.plateNumber} · Licence {application.licenseId}
      </Row>
      <Row icon={<MapPin color={theme.textMuted} size={15} />} label="Based">
        {application.baseCity ?? application.state}
      </Row>

      {/*
        Only shown when the confirmation email failed.
        The applicant was told on screen to check their inbox, so a failure here
        means someone is sitting in silence believing the application vanished.
        Whoever works this queue is the only person in a position to notice.
      */}
      {!!application.confirmationEmailError && (
        <View style={[styles.emailWarning, { backgroundColor: theme.dangerSoft }]}>
          <MailWarning color={theme.dangerOnSoft} size={15} />
          <Text style={[styles.emailWarningText, { color: theme.dangerOnSoft }]}>
            Confirmation email did not send — {application.email} was never told we received this.
            Contact them directly.
          </Text>
        </View>
      )}

      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        hitSlop={6}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
        <Text style={[styles.toggleText, { color: theme.primary }]}>
          {expanded ? 'Hide full application' : 'View full application'}
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.details}>
          <SectionLabel>Identity</SectionLabel>
          <Row icon={<IdCard color={theme.textMuted} size={15} />} label="NIN">
            {application.nin}
          </Row>
          <Row icon={<UserRound color={theme.textMuted} size={15} />} label="Address">
            {application.address}
          </Row>

          <SectionLabel>Guarantor</SectionLabel>
          <Row icon={<UserRound color={theme.textMuted} size={15} />} label="Name">
            {application.guarantorName} ({application.guarantorRelationship})
          </Row>
          <Row icon={<PhoneCall color={theme.textMuted} size={15} />} label="Phone">
            {application.guarantorPhone}
          </Row>
          <Row icon={<IdCard color={theme.textMuted} size={15} />} label="NIN">
            {application.guarantorNin}
          </Row>
          <Row icon={<MapPin color={theme.textMuted} size={15} />} label="Address">
            {application.guarantorAddress}
          </Row>

          <SectionLabel>Payout</SectionLabel>
          <Row icon={<Landmark color={theme.textMuted} size={15} />} label="Bank">
            {application.bankName}
          </Row>
          <Row icon={<Banknote color={theme.textMuted} size={15} />} label="Account">
            {application.accountNumber} · {application.accountName}
          </Row>

          <SectionLabel>Next of kin</SectionLabel>
          <Row icon={<HeartLike color={theme.textMuted} />} label="Contact">
            {application.kinName} ({application.kinRelationship}) · {application.kinPhone}
          </Row>

          <SectionLabel>Documents</SectionLabel>
          {attached.length === 0 ? (
            <Text style={[styles.value, { color: theme.textMuted }]}>Nothing attached.</Text>
          ) : (
            attached.map(([key, path]) => <DocumentRow key={key} label={key} path={String(path)} />)
          )}
        </View>
      )}

      {decided ? (
        <Text style={[styles.decided, { color: theme.textMuted }]}>
          {STATUS_LABELS[application.status]}
          {application.reviewedAt
            ? ` on ${new Date(application.reviewedAt).toLocaleDateString()}`
            : ''}
        </Text>
      ) : (
        <View style={styles.actions}>
          <Button
            label={busy ? 'Saving…' : 'Approve'}
            size="md"
            style={styles.action}
            disabled={busy}
            icon={(color, size) => <ShieldCheck color={color} size={size} />}
            onPress={onApprove}
          />
          <Button
            label="Reject"
            variant="secondary"
            size="md"
            style={styles.action}
            disabled={busy}
            onPress={onReject}
          />
        </View>
      )}
    </Card>
  );
}

/**
 * One document, opened through a short-lived signed URL.
 *
 * The URL is minted on tap rather than up front: generating one per document
 * for every card in the queue would issue dozens of live links a reviewer never
 * uses, and each is a working key to somebody's identity papers for its
 * lifetime.
 */
function DocumentRow({ label, path }: { label: string; path: string }) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      const url = await signedDocumentUrl(path);
      await Linking.openURL(url);
    } catch (thrown) {
      showDialog(
        'Could not open the document',
        thrown instanceof Error ? thrown.message : 'The file may have been removed.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={() => void open()}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowIcon}>
        <FileText color={theme.primary} size={15} />
      </View>
      <Text style={[styles.rowLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.primary }]}>
        {busy ? 'Opening…' : 'View document'}
      </Text>
    </Pressable>
  );
}

/** lucide has no "kin" glyph; a person icon reads better than a heart here. */
function HeartLike({ color }: { color: string }) {
  return <UserRound color={color} size={15} />;
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={[styles.rowLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 140,
    padding: Spacing.three - 4,
    borderRadius: Radius.md,
    gap: 2,
  },
  statValue: { fontSize: 24, ...font(800) },
  statLabel: { ...Typography.meta },
  banner: { padding: Spacing.three - 4, borderRadius: Radius.md },
  bannerText: { ...Typography.meta, lineHeight: 19 },
  loading: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  loadingText: { ...Typography.meta },
  emptyCard: { gap: Spacing.three, alignItems: 'center' },
  card: { gap: Spacing.two, marginBottom: Spacing.one },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardHeading: { flex: 1, gap: 2 },
  name: { ...Typography.sectionTitle },
  reference: { ...Typography.meta },
  emailWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one + 2,
    padding: Spacing.two,
    borderRadius: Radius.md,
  },
  emailWarningText: { ...Typography.meta, ...font(600), flex: 1, lineHeight: 18 },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  waitText: { ...Typography.meta, ...font(600) },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, paddingVertical: 3 },
  rowIcon: { width: 20, paddingTop: 1 },
  rowLabel: { ...Typography.meta, width: 84 },
  value: { ...Typography.meta, flex: 1, ...font(600) },
  toggle: { paddingVertical: Spacing.one },
  toggleText: { ...Typography.meta, ...font(700) },
  pressed: { opacity: 0.7 },
  details: { gap: Spacing.one, paddingTop: Spacing.one },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.md,
  },
  noticeText: { ...Typography.caption, flex: 1, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  action: { flexGrow: 1, flexBasis: 130 },
  decided: { ...Typography.meta, marginTop: Spacing.one },
});
