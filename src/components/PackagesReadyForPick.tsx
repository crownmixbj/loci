import { Box, HandGrab, MapPin, Milestone, Weight } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { showDialog } from '@/components/ui/dialog';
import { useAuthGate } from '@/hooks/use-auth-gate';
import { useSession } from '@/store/session';
import { useDriverEligibility, type DriverEligibility } from '@/hooks/use-driver-eligibility';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  bookingsOnRoute,
  formatNaira,
  routeLabel,
  sizeBand,
  useBookings,
  type Booking,
} from '@/store/bookings';

export type PackagesReadyForPickProps = {
  /** Opens the full browse-by-route screen. */
  onSeeAll: () => void;
  /** How many claimable cards to show before deferring to the full screen. */
  limit?: number;
};

/**
 * Claimable parcels, surfaced inline. Backed by the real store rather than
 * static mock data, so claiming here and accepting on /available-packages both
 * go through `acceptBooking` and can't disagree.
 */
export function PackagesReadyForPick({ onSeeAll, limit = 4 }: PackagesReadyForPickProps) {
  const theme = useTheme();
  const { bookings, acceptBooking } = useBookings();
  const { requireAuth } = useAuthGate();
  const { isApprovedDriver } = useSession();
  const eligibility = useDriverEligibility();

  // md breakpoint: two across needs room, below this the grid drops to one column.
  const { width } = useWindowDimensions();
  const twoUp = width >= 720;

  const claimable = useMemo(() => bookingsOnRoute(bookings, 'all', 'all'), [bookings]);

  const results = useMemo(() => claimable.slice(0, limit), [claimable, limit]);

  const handleClaim = (booking: Booking) => {
    // Same rule as the Find Jobs feed: claiming writes to someone else's parcel.
    requireAuth(
      () => {
        // Same rule as Find Jobs; the server refuses either way.
        if (!isApprovedDriver) {
          showDialog(
            'Approved drivers only',
            'Claiming a parcel needs an approved driver application. Apply on the Drivers page — reviews take up to 7 working days.',
          );
          return;
        }
        confirmClaim(booking);
      },
      {
        title: 'Sign in to claim jobs',
        reason: `Claiming puts this delivery on your account, and the sender needs to know who is collecting it.\n\n${booking.itemDescription} · ${formatNaira(booking.estimatedFee)} payout`,
        next: '/',
      },
    );
  };

  const confirmClaim = (booking: Booking) => {
    showDialog(
      'Claim this package?',
      `${booking.itemDescription}\n${routeLabel(booking)}\n${formatNaira(booking.estimatedFee)} payout`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim Now',
          onPress: () => acceptBooking(booking.id),
        },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Available Jobs"
        actionLabel="See all →"
        onAction={onSeeAll}
        accessibilityLabel="See all available jobs"
      />

      <View style={styles.stack}>
        {results.length === 0 ? (
          <Card>
            <EmptyState
              icon={(color, size) => <Box color={color} size={size} />}
              title="Nothing to claim"
              message="Every open package has been claimed. New ones appear here as they are posted."
            />
          </Card>
        ) : (
          /*
            Two columns from 720px up, one below. Cells stretch to the tallest
            card on their row, and each card fills its cell, so heights stay
            uniform whatever the description length.
          */
          <View style={styles.grid}>
            {results.map((booking) => (
              <View
                key={booking.id}
                style={[styles.gridCell, twoUp ? styles.gridCellHalf : styles.gridCellFull]}>
                <ClaimCard
                  booking={booking}
                  eligibility={eligibility}
                  onClaim={() => handleClaim(booking)}
                />
              </View>
            ))}
          </View>
        )}

        {claimable.length > results.length && (
          <Pressable onPress={onSeeAll} accessibilityRole="button" style={styles.moreRow}>
            <Text style={[styles.moreText, { color: theme.primary }]}>
              {claimable.length - results.length} more waiting — browse by route
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ClaimCard({
  booking,
  eligibility,
  onClaim,
}: {
  booking: Booking;
  eligibility: DriverEligibility;
  onClaim: () => void;
}) {
  const theme = useTheme();
  const isLocal = booking.deliveryType === 'local';

  return (
    <Card style={styles.card}>
      {/* Everything above the CTA flexes, pinning the button to the card's base. */}
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
              {sizeBand(booking)}
            </Text>
            <Text style={[styles.trackingId, { color: theme.textMuted }]}>
              #{booking.trackingId}
            </Text>
          </View>
          <Badge label={formatNaira(booking.estimatedFee)} tone="primary" uppercase={false} />
        </View>

        <View
          style={[
            styles.routePill,
            {
              backgroundColor: isLocal ? theme.successSoft : theme.primarySoft,
            },
          ]}>
          {isLocal ? (
            <MapPin color={theme.successOnSoft} size={12} />
          ) : (
            <Milestone color={theme.primaryOnSoft} size={12} />
          )}
          <Text
            style={[
              styles.routeText,
              { color: isLocal ? theme.successOnSoft : theme.primaryOnSoft },
            ]}>
            {booking.originCity} → {booking.destinationCity}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Weight color={theme.textMuted} size={13} />
          <Text style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
            {booking.weight} kg · {booking.category} · {booking.itemDescription}
          </Text>
        </View>
      </View>

      <Button
        label="CLAIM NOW"
        size="md"
        disabled={!eligibility.canAccept}
        icon={(color, size) => <HandGrab color={color} size={size} />}
        onPress={onClaim}
        accessibilityLabel={
          eligibility.canAccept ? 'Claim now' : `Claim now, unavailable. ${eligibility.reason}`
        }
      />

      {/* The button can't be tapped, so the reason is stated rather than hidden. */}
      {!eligibility.canAccept && !!eligibility.reason && (
        <Text style={[styles.blockedText, { color: theme.textMuted }]}>{eligibility.reason}</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  blockedText: {
    ...Typography.caption,
    textAlign: 'center',
  },
  section: {
    marginBottom: Spacing.five,
  },
  stack: {
    gap: Spacing.three - 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: Spacing.three,
  },
  gridCell: {
    flexGrow: 1,
  },
  /** 47% not 50% so the 16px gap can't push the second card onto a new line. */
  gridCellHalf: {
    flexBasis: '47%',
  },
  gridCellFull: {
    flexBasis: '100%',
  },
  card: {
    flex: 1,
    padding: 20,
    gap: Spacing.two + 2,
  },
  cardBody: {
    flex: 1,
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
  routePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
  },
  routeText: {
    ...Typography.caption,
    ...font(700),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two - 2,
  },
  metaText: {
    flex: 1,
    ...Typography.meta,
  },
  moreRow: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  moreText: {
    ...Typography.meta,
    ...font(600),
  },
});
