import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Bike,
  CircleCheckBig,
  ClipboardList,
  House,
  MapPin,
  Milestone,
  Navigation,
  PackageCheck,
  PackageSearch,
  Phone,
  Receipt,
  ShieldAlert,
  Truck,
  UserCheck,
  UserRound,
  X,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, RoutePill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/screen';
import { StickyHeaderScreen } from '@/components/ui/sticky-header';
import { MaxContentWidth, Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  BOOKING_STAGES,
  estimateFee,
  formatBookingDate,
  formatNaira,
  routeLabel,
  stageIndex,
  statusLabel,
  statusTone,
  useBookings,
  type BookingStage,
} from '@/store/bookings';

const STAGE_ICONS: Record<BookingStage, typeof Truck> = {
  Booked: ClipboardList,
  Assigned: UserCheck,
  'Picked Up': PackageCheck,
  'In Transit': Truck,
  'Out for Delivery': Bike,
  Delivered: House,
};

export default function ParcelDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bookings } = useBookings();

  const booking = bookings.find((b) => b.id === id);

  if (!booking) {
    return (
      <StickyHeaderScreen>
        <ScrollView
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.container}>
          <View style={styles.content}>
            <EmptyState
              icon={(color, size) => <PackageSearch color={color} size={size} />}
              title="Parcel not found"
              message="This parcel may have been removed. Go back and pick another from the list."
            />
            <Button label="Go back" variant="secondary" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </StickyHeaderScreen>
    );
  }

  const isLocal = booking.deliveryType === 'local';
  const currentIndex = stageIndex(booking.status);
  const fee = estimateFee(booking);

  return (
    <StickyHeaderScreen>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Badge label={statusLabel(booking)} tone={statusTone(booking)} />
              <Text style={[styles.title, { color: theme.text }]}>{booking.itemDescription}</Text>
              <Text style={[styles.trackingId, { color: theme.textMuted }]}>
                #{booking.trackingId} · {formatBookingDate(booking.createdAt)}
              </Text>
            </View>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              accessibilityLabel="Close"
              style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
              <X color={theme.textSecondary} size={18} />
            </Pressable>
          </View>

          <View style={styles.pillRow}>
            <RoutePill
              label={routeLabel(booking)}
              tone={isLocal ? 'success' : 'primary'}
              icon={(color) =>
                isLocal ? <MapPin color={color} size={13} /> : <Milestone color={color} size={13} />
              }
            />
            {booking.fragile && (
              <Badge
                label="Fragile"
                tone="warning"
                icon={(color) => <ShieldAlert color={color} size={11} />}
              />
            )}
          </View>

          {/* Journey */}
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Journey</Text>
            <View style={styles.timeline}>
              {BOOKING_STAGES.map((stage, index) => {
                const isDone = index < currentIndex;
                const isActive = index === currentIndex;
                const Icon = isDone ? CircleCheckBig : STAGE_ICONS[stage];
                const color = isDone ? theme.success : isActive ? theme.primary : theme.textMuted;

                return (
                  <View key={stage} style={styles.timelineItem}>
                    <Icon color={color} size={18} />
                    <Text
                      style={[
                        styles.timelineText,
                        {
                          color: isActive
                            ? theme.text
                            : isDone
                              ? theme.textSecondary
                              : theme.textMuted,
                        },
                        isActive && styles.timelineTextActive,
                      ]}>
                      {stage}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* Route */}
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Route</Text>
            <Leg
              icon={<MapPin color={theme.primary} size={16} />}
              label="Pickup"
              value={`${booking.pickupAddress}, ${booking.pickupArea}, ${booking.originCity}`}
            />
            <Leg
              icon={<Navigation color={theme.success} size={16} />}
              label="Dropoff"
              value={`${booking.dropoffAddress}, ${booking.dropoffArea}, ${booking.destinationCity}`}
            />
          </Card>

          {/* People */}
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Contacts</Text>
            <Leg
              icon={<UserRound color={theme.textMuted} size={16} />}
              label="Recipient"
              value={booking.recipientName}
            />
            <Leg
              icon={<Phone color={theme.textMuted} size={16} />}
              label="Recipient phone"
              value={booking.recipientPhone}
            />
            <Leg
              icon={<Phone color={theme.textMuted} size={16} />}
              label="Sender phone"
              value={booking.senderPhone}
            />
            <Leg
              icon={<Truck color={theme.textMuted} size={16} />}
              label="Driver"
              value={booking.driver ?? 'Not yet assigned'}
            />
          </Card>

          {/* Parcel and fee */}
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Parcel</Text>
            <Leg label="Category" value={booking.category} />
            <Leg label="Weight" value={`${booking.weight} kg`} />
            <Leg
              label="Declared value"
              value={booking.declaredValue ? formatNaira(booking.declaredValue) : 'Not declared'}
            />
            {!!booking.notes && <Leg label="Notes" value={booking.notes} />}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <CostRow label="Base fare" value={fee.base} />
            <CostRow label="Weight" value={fee.weight} />
            <CostRow label="Insurance" value={fee.insurance} />
            {fee.doorstep > 0 && (
              <CostRow
                label={`Doorstep · ${fee.doorstepLegs === 2 ? 'pickup and delivery' : 'one leg'}`}
                value={fee.doorstep}
              />
            )}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.totalRow}>
              <View style={styles.totalLabelRow}>
                <Receipt color={theme.primary} size={16} />
                <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
              </View>
              <Text style={[styles.totalValue, { color: theme.primary }]}>
                {formatNaira(booking.estimatedFee)}
              </Text>
            </View>
          </Card>

          <Button label="Close" variant="secondary" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </StickyHeaderScreen>
  );
}

function Leg({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.leg}>
      <View style={styles.legLabelRow}>
        {icon}
        <Text style={[styles.legLabel, { color: theme.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.legValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  return (
    <View style={styles.costRow}>
      <Text style={[styles.costLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.costValue, { color: theme.text }]}>{formatNaira(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: Spacing.two - 2,
  },
  title: {
    ...Typography.screenTitle,
    fontSize: 24,
  },
  trackingId: {
    ...Typography.meta,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.three - 4,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
    marginBottom: Spacing.one,
  },
  timeline: {
    gap: Spacing.two + 2,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  timelineText: {
    ...Typography.body,
  },
  timelineTextActive: {
    ...font(600),
  },
  leg: {
    gap: Spacing.half,
  },
  legLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  legLabel: {
    ...Typography.caption,
  },
  legValue: {
    ...Typography.body,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two - 2,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  costLabel: {
    ...Typography.meta,
  },
  costValue: {
    ...Typography.meta,
    ...font(600),
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two - 2,
  },
  totalLabel: {
    ...Typography.sectionTitle,
  },
  totalValue: {
    fontSize: 22,
    ...font(700),
  },
});
