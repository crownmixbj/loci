import { useRouter } from 'expo-router';
import {
  Banknote,
  BellRing,
  Box,
  CalendarDays,
  Car,
  ClipboardList,
  FileText,
  IdCard,
  Mail,
  MapPin,
  Milestone,
  Navigation,
  PackageSearch,
  Phone,
  Route,
  ShieldAlert,
  Truck,
  Weight,
} from 'lucide-react-native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, RoutePill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, screenPadding, ScreenHeader, SectionLabel } from '@/components/ui/screen';
import { Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  formatNaira,
  isCarrier,
  pickupWindow,
  routeLabel,
  handoverLabel,
  sizeBand,
  statusLabel,
  statusTone,
  useBookings,
  type Booking,
} from '@/store/bookings';
import { SignedOutState } from '@/components/ui/signed-out-state';
import {
  REVIEW_WORKING_DAYS,
  STATUS_LABELS,
  type DriverApplication,
} from '@/store/driver-applications';
import { useSession } from '@/store/session';

/**
 * The Driver Portal.
 *
 * Everything a driver needs about themselves in one place: who we have them
 * down as, where their application stands, and the deliveries they are
 * carrying. Browsing and claiming new jobs stays on /available-packages — that
 * screen is open to anyone, and this one is not.
 *
 * The order is deliberate. Identity and application status sit above the job
 * list because for most people opening this screen the answer they want is
 * "am I approved yet?", and an unapproved driver has no jobs to show at all.
 */
export default function DriverScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { bookings } = useBookings();
  const { viewerId, application, isApprovedDriver } = useSession();

  const myJobs = useMemo(
    () => (viewerId ? bookings.filter((booking) => isCarrier(booking, viewerId)) : []),
    [bookings, viewerId],
  );

  const active = useMemo(() => myJobs.filter((b) => b.status !== 'Delivered'), [myJobs]);
  const completed = useMemo(() => myJobs.filter((b) => b.status === 'Delivered'), [myJobs]);

  const earnings = useMemo(
    () => myJobs.reduce((total, booking) => total + booking.estimatedFee, 0),
    [myJobs],
  );

  if (!viewerId) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.container, screenPadding]}>
        <View style={styles.content}>
          <ScreenHeader
            brand={false}
            title="Driver Portal"
            subtitle="Your details, your application, and the deliveries you're carrying."
          />
          <SignedOutState
            title="Sign in to open your portal"
            message="Your application and accepted deliveries are tied to your account. Browsing open jobs needs no account — claiming one does."
            next="/driver"
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.container, screenPadding]}>
      <View style={styles.content}>
        <ScreenHeader
          brand={false}
          title="Driver Portal"
          subtitle={
            application
              ? `${STATUS_LABELS[application.status]} · ${application.reference}`
              : "You haven't applied to drive yet."
          }
        />

        {/* ---------- Who we have you down as ---------- */}
        {application ? (
          <DriverIdentity application={application} />
        ) : (
          <ApplyPrompt onApply={() => router.navigate('/driver-signup')} />
        )}

        {/*
          The approval gate, stated once and plainly.

          An unapproved driver browsing Find Jobs meets a greyed-out Accept
          button with no explanation on that screen — this is where the reason
          lives, next to the status it depends on.
        */}
        {application && !isApprovedDriver && (
          <View style={[styles.gateNotice, { backgroundColor: theme.warningSoft }]}>
            <ShieldAlert color={theme.warningOnSoft} size={16} />
            <View style={styles.gateText}>
              <Text style={[styles.gateTitle, { color: theme.warningOnSoft }]}>
                You can&apos;t accept jobs yet
              </Text>
              <Text style={[styles.gateBody, { color: theme.warningOnSoft }]}>
                Claiming a delivery unlocks when an admin approves your application. You can browse
                open jobs in the meantime.
              </Text>
            </View>
          </View>
        )}

        {application && (
          <Button
            label="Application status & updates"
            variant="secondary"
            size="md"
            icon={(color, size) => <BellRing color={color} size={size} />}
            onPress={() => router.navigate('/driver-updates')}
            style={styles.updatesCta}
          />
        )}

        {/* ---------- What you're carrying ---------- */}
        <SectionLabel>Your deliveries</SectionLabel>

        {myJobs.length > 0 && (
          <Card style={styles.summary}>
            <Stat label="Active" value={String(active.length)} />
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <Stat label="Delivered" value={String(completed.length)} />
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            {/*
              "Expected" rather than "Total earnings": these are the quoted
              fares on jobs, not money that has been paid out. There is no
              payout ledger in this app yet, and a number labelled as earnings
              is a number someone will expect to see in their bank.
            */}
            <Stat label="Expected payout" value={formatNaira(earnings)} accent />
          </Card>
        )}

        {myJobs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={(color, size) => <ClipboardList color={color} size={size} />}
              title="No jobs yet"
              message="You haven't accepted any deliveries. Browse open packages by route to pick up your first."
            />
            <Button
              label="Find available packages"
              icon={(color, size) => <PackageSearch color={color} size={size} />}
              onPress={() => router.navigate('/available-packages')}
            />
          </View>
        ) : (
          <>
            {active.length > 0 && (
              <View style={styles.section}>
                <SectionLabel>{`In progress (${active.length})`}</SectionLabel>
                <View style={styles.list}>
                  {active.map((booking) => (
                    <JobCard key={booking.id} booking={booking} />
                  ))}
                </View>
              </View>
            )}

            {completed.length > 0 && (
              <View style={styles.section}>
                <SectionLabel>{`Delivered (${completed.length})`}</SectionLabel>
                <View style={styles.list}>
                  {completed.map((booking) => (
                    <JobCard key={booking.id} booking={booking} />
                  ))}
                </View>
              </View>
            )}

            <Button
              label="Find more packages"
              variant="secondary"
              icon={(color, size) => <PackageSearch color={color} size={size} />}
              onPress={() => router.navigate('/available-packages')}
              style={styles.cta}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

/**
 * The details on file, read back to the driver.
 *
 * Read-only on purpose. These fields were verified during review — a licence
 * number or a plate that could be edited after approval would make the review
 * meaningless. Changing them has to go back through a human.
 */
function DriverIdentity({ application }: { application: DriverApplication }) {
  const theme = useTheme();

  const tone =
    application.status === 'approved'
      ? 'success'
      : application.status === 'rejected'
        ? 'danger'
        : application.status === 'under_review'
          ? 'primary'
          : 'warning';

  return (
    <Card style={styles.identity}>
      <View style={styles.identityHeader}>
        <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
          <Text style={[styles.avatarText, { color: theme.primaryOnSoft }]}>
            {application.fullName
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join('')
              .toUpperCase()}
          </Text>
        </View>
        <View style={styles.identityHeaderText}>
          <Text style={[styles.identityName, { color: theme.text }]}>{application.fullName}</Text>
          <Text style={[styles.identityMeta, { color: theme.textMuted }]}>
            {application.baseCity ?? application.state} · {application.reference}
          </Text>
        </View>
        <Badge label={STATUS_LABELS[application.status]} tone={tone} />
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.identityGrid}>
        <Field icon={<Phone color={theme.textMuted} size={14} />} label="Phone">
          {application.phone}
        </Field>
        <Field icon={<Mail color={theme.textMuted} size={14} />} label="Email">
          {application.email}
        </Field>
        <Field icon={<Car color={theme.textMuted} size={14} />} label="Vehicle">
          {application.vehicleType} · {application.plateNumber}
        </Field>
        <Field icon={<IdCard color={theme.textMuted} size={14} />} label="Licence">
          {application.licenseId}
        </Field>
        <Field icon={<MapPin color={theme.textMuted} size={14} />} label="Operating in">
          {application.baseCity ?? application.state}
        </Field>
        <Field icon={<CalendarDays color={theme.textMuted} size={14} />} label="Applied">
          {new Date(application.submittedAt).toLocaleDateString()}
        </Field>
      </View>

      {/*
        Named rather than implied. Someone who has moved city or changed their
        plate needs to know this screen will not let them fix it themselves,
        and who to tell instead.
      */}
      <Text style={[styles.identityFootnote, { color: theme.textMuted }]}>
        These details were checked during review, so they can&apos;t be edited here. Email support
        if anything has changed — especially your vehicle or licence.
      </Text>
    </Card>
  );
}

function Field({
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
    <View style={styles.field}>
      <View style={styles.fieldLabel}>
        {icon}
        <Text style={[styles.fieldLabelText, { color: theme.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.fieldValue, { color: theme.text }]}>{children}</Text>
    </View>
  );
}

/** No application on file: the portal's only useful job is to start one. */
function ApplyPrompt({ onApply }: { onApply: () => void }) {
  const theme = useTheme();

  return (
    <Card style={styles.applyCard}>
      <View style={[styles.applyIcon, { backgroundColor: theme.primarySoft }]}>
        <Truck color={theme.primaryOnSoft} size={22} />
      </View>
      <Text style={[styles.applyTitle, { color: theme.text }]}>Drive with LOCI</Text>
      <Text style={[styles.applyBody, { color: theme.textSecondary }]}>
        Anyone with an account can send a parcel. Carrying one needs an approved driver application
        — vehicle, licence, guarantor and payout details, reviewed within {REVIEW_WORKING_DAYS}{' '}
        working days.
      </Text>
      <Button
        label="Start your driver application"
        icon={(color, size) => <FileText color={color} size={size} />}
        onPress={onApply}
      />
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: accent ? theme.primary : theme.text }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

function JobCard({ booking }: { booking: Booking }) {
  const theme = useTheme();
  const isLocal = booking.deliveryType === 'local';
  const isDelivered = booking.status === 'Delivered';

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
            {booking.itemDescription}
          </Text>
          <Text style={[styles.trackingId, { color: theme.textMuted }]}>#{booking.trackingId}</Text>
        </View>
        <Badge label={statusLabel(booking)} tone={statusTone(booking)} />
      </View>

      <RoutePill
        label={routeLabel(booking)}
        tone={isLocal ? 'success' : 'primary'}
        icon={(color) =>
          isLocal ? <MapPin color={color} size={11} /> : <Milestone color={color} size={11} />
        }
      />

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.legs}>
        <View style={styles.leg}>
          <MapPin color={theme.primary} size={15} />
          <Text style={[styles.legText, { color: theme.textSecondary }]}>
            {booking.pickupAddress}, {booking.pickupArea}, {booking.originCity}
          </Text>
        </View>
        <View style={styles.leg}>
          <Navigation color={theme.success} size={15} />
          <Text style={[styles.legText, { color: theme.textSecondary }]}>
            {booking.dropoffAddress}, {booking.dropoffArea}, {booking.destinationCity}
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric
          icon={<Weight color={theme.textMuted} size={13} />}
          value={`${booking.weight} kg`}
        />
        <Metric icon={<Box color={theme.textMuted} size={13} />} value={sizeBand(booking)} />
        <Metric icon={<Route color={theme.textMuted} size={13} />} value={handoverLabel(booking)} />
        <Metric icon={<Phone color={theme.textMuted} size={13} />} value={booking.recipientPhone} />
      </View>

      {!isDelivered && (
        <Text style={[styles.window, { color: theme.warningOnSoft }]}>{pickupWindow(booking)}</Text>
      )}

      <View style={[styles.payoutRow, { backgroundColor: theme.surfaceMuted }]}>
        <View style={styles.metric}>
          <Banknote color={theme.textMuted} size={15} />
          <Text style={[styles.payoutLabel, { color: theme.textSecondary }]}>
            {isDelivered ? 'Earned' : 'Payout on delivery'}
          </Text>
        </View>
        <Text style={[styles.payoutValue, { color: isDelivered ? theme.success : theme.primary }]}>
          {formatNaira(booking.estimatedFee)}
        </Text>
      </View>
    </Card>
  );
}

function Metric({ icon, value }: { icon: React.ReactNode; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.metric}>
      {icon}
      <Text style={[styles.metricText, { color: theme.textSecondary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
  },
  content: {
    width: '100%',
  },
  identity: {
    gap: Spacing.three - 2,
    marginBottom: Spacing.three,
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    ...font(800),
    letterSpacing: 0.5,
  },
  identityHeaderText: {
    flex: 1,
    gap: Spacing.half,
  },
  identityName: {
    ...Typography.sectionTitle,
  },
  identityMeta: {
    ...Typography.meta,
  },
  /**
   * Two columns on anything wider than a phone. `flexBasis: 160` with
   * `flexGrow` means one column below ~340px and two above, without a
   * breakpoint to keep in sync.
   */
  identityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three - 2,
  },
  field: {
    flexGrow: 1,
    flexBasis: 160,
    gap: Spacing.half,
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  fieldLabelText: {
    ...Typography.caption,
  },
  fieldValue: {
    ...Typography.meta,
    ...font(600),
  },
  identityFootnote: {
    ...Typography.caption,
    lineHeight: 18,
  },
  applyCard: {
    gap: Spacing.two + 2,
    marginBottom: Spacing.three,
  },
  applyIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyTitle: {
    ...Typography.sectionTitle,
  },
  applyBody: {
    ...Typography.meta,
    lineHeight: 21,
  },
  gateNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.three - 2,
    borderRadius: Radius.md,
    marginBottom: Spacing.three,
  },
  gateText: {
    flex: 1,
    gap: Spacing.half,
  },
  gateTitle: {
    ...Typography.meta,
    ...font(700),
  },
  gateBody: {
    ...Typography.caption,
    lineHeight: 18,
  },
  updatesCta: {
    marginBottom: Spacing.four,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three - 2,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  statValue: {
    fontSize: 20,
    ...font(700),
  },
  statLabel: {
    ...Typography.caption,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  emptyWrap: {
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  section: {
    marginTop: Spacing.four,
  },
  list: {
    gap: Spacing.three - 2,
  },
  card: {
    gap: Spacing.two + 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardHeaderText: {
    flex: 1,
    gap: Spacing.half,
  },
  itemName: {
    ...Typography.cardTitle,
  },
  trackingId: {
    ...Typography.caption,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  legs: {
    gap: Spacing.two,
  },
  leg: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  legText: {
    flex: 1,
    ...Typography.meta,
    lineHeight: 19,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three - 4,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  metricText: {
    ...Typography.meta,
  },
  window: {
    ...Typography.meta,
    ...font(600),
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three - 2,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.sm,
  },
  payoutLabel: {
    ...Typography.meta,
  },
  payoutValue: {
    fontSize: 17,
    ...font(700),
  },
  cta: {
    marginTop: Spacing.four,
  },
});
