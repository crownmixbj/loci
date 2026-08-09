import { useRouter } from 'expo-router';
import { PackageSearch } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RoutePill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { EmptyState, screenPadding, ScreenHeader, SectionLabel } from '@/components/ui/screen';
import { Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  formatNaira,
  isCarrier,
  parcelsForUser,
  sortByPickupUrgency,
  routeLabel,
  stageProgress,
  statusLabel,
  statusTone,
  useBookings,
  type Booking,
} from '@/store/bookings';
import { SignedOutState } from '@/components/ui/signed-out-state';
import { useSession } from '@/store/session';

/**
 * Full history for the signed-in user — everything the home screen's preview
 * links out to. Same ownership rule as the home section: parcels you posted,
 * plus ones you're driving.
 */
export default function MyPackagesScreen() {
  const router = useRouter();
  const { bookings } = useBookings();
  const { viewerId } = useSession();

  // Null viewer = signed out. `parcelsForUser` would match nothing anyway, but
  // an empty list reads as "you have no parcels" rather than "sign in first".
  const mine = useMemo(
    () => (viewerId ? parcelsForUser(bookings, viewerId) : []),
    [bookings, viewerId],
  );

  const active = useMemo(
    () => sortByPickupUrgency(mine.filter((b) => b.status !== 'Delivered')),
    [mine],
  );
  const delivered = useMemo(() => mine.filter((b) => b.status === 'Delivered'), [mine]);

  if (!viewerId) {
    return (
      <ScrollView contentContainerStyle={screenPadding} showsVerticalScrollIndicator={false}>
        <SignedOutState
          title="Sign in to see your parcels"
          message="Your sent parcels and the jobs you're carrying live on your account, so they follow you to any device."
          next="/my-packages"
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={screenPadding} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        title="My Packages"
        subtitle={`${mine.length} parcel${mine.length === 1 ? '' : 's'} in your history`}
      />

      {mine.length === 0 ? (
        <Card style={styles.emptyCard}>
          <EmptyState
            icon={(color, size) => <PackageSearch color={color} size={size} />}
            title="Nothing here yet"
            message="Parcels you send — and jobs you claim as a driver — collect here."
          />
          <Button
            label="Book a Shipment"
            size="md"
            style={styles.emptyCta}
            onPress={() => router.navigate('/book')}
          />
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <SectionLabel>On the move</SectionLabel>
              <View style={styles.list}>
                {active.map((booking) => (
                  <ParcelRow
                    key={booking.id}
                    booking={booking}
                    userId={viewerId}
                    onPress={() =>
                      router.push({ pathname: '/parcel/[id]', params: { id: booking.id } })
                    }
                  />
                ))}
              </View>
            </>
          )}

          {delivered.length > 0 && (
            <>
              <SectionLabel>Delivered</SectionLabel>
              <View style={styles.list}>
                {delivered.map((booking) => (
                  <ParcelRow
                    key={booking.id}
                    booking={booking}
                    userId={viewerId}
                    onPress={() =>
                      router.push({ pathname: '/parcel/[id]', params: { id: booking.id } })
                    }
                  />
                ))}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function ParcelRow({
  booking,
  userId,
  onPress,
}: {
  booking: Booking;
  userId: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const progress = stageProgress(booking.status);
  const carrying = isCarrier(booking, userId);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${booking.itemDescription}, ${booking.trackingId}. View details`}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
              {booking.itemDescription}
            </Text>
            <Text style={[styles.trackingId, { color: theme.textMuted }]}>
              #{booking.trackingId} · {carrying ? 'You are driving' : 'You sent this'}
            </Text>
          </View>
          <Text style={[styles.fee, { color: theme.text }]}>
            {formatNaira(booking.estimatedFee)}
          </Text>
        </View>

        <RoutePill label={routeLabel(booking)} tone={statusTone(booking)} />

        <ProgressBar
          fraction={progress.fraction}
          label={statusLabel(booking)}
          tone={statusTone(booking)}
        />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three - 4,
    marginBottom: Spacing.four,
  },
  card: {
    gap: Spacing.two + 2,
    borderRadius: Radius.lg,
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
  fee: {
    ...Typography.body,
    ...font(700),
  },
  emptyCard: {
    gap: Spacing.three,
  },
  emptyCta: {
    alignSelf: 'center',
    minWidth: 220,
  },
  pressed: {
    opacity: 0.85,
  },
});
