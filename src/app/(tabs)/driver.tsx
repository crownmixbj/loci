import { useRouter } from 'expo-router';
import {
  Banknote,
  Box,
  ClipboardList,
  MapPin,
  Milestone,
  Navigation,
  PackageSearch,
  Phone,
  Route,
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
import { useSession } from '@/store/session';

/**
 * The driver's own workload. Browsing and accepting new jobs lives on
 * /available-packages — this screen is only what's already been taken on.
 */
export default function DriverScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { bookings } = useBookings();
  const { viewerId } = useSession();

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
            title="My Jobs"
            subtitle="Everything you've accepted, and what it adds up to."
          />
          <SignedOutState
            title="Sign in to see your jobs"
            message="Accepted deliveries and your earnings are tied to your account. Browsing open jobs needs no account — claiming one does."
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
          title="My Jobs"
          subtitle="Everything you've accepted, and what it adds up to."
        />

        {myJobs.length > 0 && (
          <Card style={styles.summary}>
            <Stat label="Active" value={String(active.length)} />
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <Stat label="Delivered" value={String(completed.length)} />
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <Stat label="Total earnings" value={formatNaira(earnings)} accent />
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
