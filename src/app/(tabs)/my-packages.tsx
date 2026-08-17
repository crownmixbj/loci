import { useLocalSearchParams, useRouter } from 'expo-router';
import { PackageSearch } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Footer } from '@/components/Footer';
import { RoutePill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip';
import { ProgressBar } from '@/components/ui/progress-bar';
import { EmptyState, screenPadding, ScreenHeader } from '@/components/ui/screen';
import { MaxContentWidth, Radius, Spacing, Typography, font } from '@/constants/theme';
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
 * Two of the four Shipments views: Active / In-Transit, and History / Archives.
 *
 * One screen rather than two routes — they are the same list under one
 * ownership rule (parcels you posted, plus ones you are driving) split by a
 * single predicate. Two screens would mean two copies of that rule, and an
 * ownership rule that exists twice is one that will eventually disagree with
 * itself about who may see a recipient's phone number.
 *
 * `?section=` chooses which, so the nav can open either directly.
 */
type Section = 'active' | 'history';

const SECTIONS: readonly Section[] = ['active', 'history'] as const;

const SECTION_LABELS: Record<Section, string> = {
  active: 'Active / In-Transit',
  history: 'History / Archives',
};

/** Anything unrecognised falls back to what is still moving. */
function parseSection(value: unknown): Section {
  return SECTIONS.includes(value as Section) ? (value as Section) : 'active';
}

export default function MyPackagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const { bookings } = useBookings();
  const { viewerId } = useSession();

  const [section, setSection] = useState<Section>(() => parseSection(params.section));

  // The URL leads: picking a section from the nav while already on this screen
  // changes the query string without remounting.
  useEffect(() => setSection(parseSection(params.section)), [params.section]);

  const choose = (next: Section) => {
    setSection(next);
    router.setParams({ section: next });
  };

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
  /*
   * Newest first, unlike the active list.
   *
   * `sortByPickupUrgency` answers "what needs attention next", which is
   * meaningless for something already delivered — there, the question is "what
   * did I send recently", and that is reverse chronological.
   */
  const delivered = useMemo(
    () =>
      mine
        .filter((b) => b.status === 'Delivered')
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [mine],
  );

  if (!viewerId) {
    return (
      <ScrollView
        contentContainerStyle={[styles.container, screenPadding]}
        showsVerticalScrollIndicator={false}>
        <SignedOutState
          title="Sign in to see your parcels"
          message="Your sent parcels and the jobs you're carrying live on your account, so they follow you to any device."
          next="/my-packages"
        />
        <Footer />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, screenPadding]}
      showsVerticalScrollIndicator={false}>
      <ScreenHeader
        title={SECTION_LABELS[section]}
        subtitle={
          section === 'active'
            ? `${active.length} parcel${active.length === 1 ? '' : 's'} still on the move`
            : `${delivered.length} delivered parcel${delivered.length === 1 ? '' : 's'}`
        }
      />

      <View style={styles.sectionTabs}>
        <ChipGroup
          options={SECTIONS as unknown as string[]}
          selected={section}
          onSelect={(value) => choose(value as Section)}
          renderLabel={(value) =>
            value === 'active' ? `Active (${active.length})` : `History (${delivered.length})`
          }
          scrollable
        />
      </View>

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
          {(section === 'active' ? active : delivered).length === 0 ? (
            <Card style={styles.emptyCard}>
              <EmptyState
                icon={(color, size) => <PackageSearch color={color} size={size} />}
                title={section === 'active' ? 'Nothing in transit' : 'Nothing delivered yet'}
                message={
                  section === 'active'
                    ? 'Everything you have sent has arrived. Book another and it will show here while it travels.'
                    : 'Parcels move here once they are delivered, so you keep a record of what you sent and what it cost.'
                }
              />
              <Button
                label={section === 'active' ? 'Book a Shipment' : 'See what is in transit'}
                size="md"
                style={styles.emptyCta}
                onPress={() => (section === 'active' ? router.navigate('/book') : choose('active'))}
              />
            </Card>
          ) : (
            <View style={styles.list}>
              {(section === 'active' ? active : delivered).map((booking) => (
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
          )}
        </>
      )}
      <Footer />
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
  /*
    The house container. Every full-page route centres at `MaxContentWidth`;
    this one had no constraint at all, so a desktop stretched a list of parcel
    cards edge to edge.
  */
  container: {
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
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
  sectionTabs: {
    marginBottom: Spacing.three,
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
