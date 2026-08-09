import {
  Banknote,
  Box,
  Building2,
  CheckCheck,
  Clock,
  MapPin,
  Milestone,
  Navigation,
  PackageSearch,
  RotateCcw,
  Search,
  ShieldAlert,
  Weight,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { showDialog } from '@/components/ui/dialog';
import { useAuthGate } from '@/hooks/use-auth-gate';
import { Badge, RoutePill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dropdown } from '@/components/ui/dropdown';
import { EmptyState, screenPadding, ScreenHeader, SectionLabel } from '@/components/ui/screen';
import { formatDistance, routeDistanceKm } from '@/constants/hub-coordinates';
import { Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNotifications } from '@/store/notifications';
import { useSession } from '@/store/session';
import {
  bookingsOnRoute,
  CITIES,
  cityHubLabel,
  DEFAULT_CITY,
  formatNaira,
  pickupWindow,
  routeLabel,
  sizeBand,
  useBookings,
  type Booking,
  type City,
} from '@/store/bookings';

/**
 * One size per icon role, so tags, metadata lines and the two legs each read as
 * a set. These were 11/12/13/14/15 scattered across the card.
 */
const PILL_ICON = 12;
const META_ICON = 13;
const LEG_ICON = 15;

type CityFilter = City | 'all';

const CITY_OPTIONS: readonly CityFilter[] = ['all', ...CITIES];
const cityFilterLabel = (value: CityFilter) => (value === 'all' ? 'Any city' : cityHubLabel(value));

export default function AvailablePackagesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { bookings, acceptBooking } = useBookings();
  const { notifyJobAccepted } = useNotifications();
  const { user, role, setRole, driver } = useSession();
  const { requireAuth } = useAuthGate();
  const { width } = useWindowDimensions();
  // Below this the two dropdowns already stack, so a compact button would sit
  // alone on its own line — full width is the better tap target there.
  const wideSearch = width >= 560;

  /**
   * Where this driver's feed starts, in priority order:
   *
   *   1. A city deep-linked from the home screen — an explicit request wins.
   *   2. The city they registered in on "Be a Driver", so the feed opens on
   *      work they can actually reach.
   *   3. The app default, for anyone who hasn't applied yet.
   *
   * Deliberately a *default*, not a lock. A driver on a run to Abuja, or one who
   * has moved, can still widen the origin — pinning it would make relocating
   * mean re-applying.
   */
  const params = useLocalSearchParams<{ origin?: string }>();
  const registeredCity = driver?.baseCity ?? null;
  const initialOrigin: CityFilter = (CITIES as readonly string[]).includes(params.origin ?? '')
    ? (params.origin as City)
    : (registeredCity ?? DEFAULT_CITY);

  // Draft values live in the form; `route` is what the feed actually filters on,
  // so results only change when the driver presses Search Route.
  const [draftOrigin, setDraftOrigin] = useState<CityFilter>(initialOrigin);
  const [draftDestination, setDraftDestination] = useState<CityFilter>('all');
  const [route, setRoute] = useState<{ origin: CityFilter; destination: CityFilter }>({
    origin: initialOrigin,
    destination: 'all',
  });

  const results = useMemo(
    () => bookingsOnRoute(bookings, route.origin, route.destination),
    [bookings, route],
  );

  const totalOpen = useMemo(() => bookingsOnRoute(bookings, 'all', 'all').length, [bookings]);
  const isDirty = draftOrigin !== route.origin || draftDestination !== route.destination;
  const isShowingEverything = route.origin === 'all' && route.destination === 'all';

  /** Clears both filters and applies it in one press — no second tap on Search. */
  const resetRoute = () => {
    setDraftOrigin('all');
    setDraftDestination('all');
    setRoute({ origin: 'all', destination: 'all' });
  };

  /**
   * Accepting is a commitment, so it keeps the confirm step — but the outcome
   * is now a screen rather than a dialog that vanishes, and the driver's
   * confirmation messages are queued at the same moment.
   */
  const confirmAccept = (booking: Booking) => {
    showDialog(
      'Accept this order?',
      `${booking.itemDescription}\n${routeLabel(booking)}\n${formatNaira(booking.estimatedFee)} payout`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept Order',
          onPress: () => void claim(booking),
        },
      ],
    );
  };

  /**
   * Accepting a job assigns it to this account *as the driver*, so doing it from
   * Sender mode leaves the app contradicting itself: the confirmation and My
   * Jobs are both driver screens, and the accepted job would disappear from the
   * view the user is standing in. Rather than silently flipping the role behind
   * their back — or blocking the button with no explanation — ask, then switch
   * and carry the same order straight into the confirm step.
   */
  const handleAccept = (booking: Booking) => {
    /*
     * Accepting writes this person's name and id onto someone else's parcel and
     * commits them to collecting it, so it needs a real account — not the
     * anonymous browsing identity. The role prompt below is a *separate*
     * question and only makes sense once we know who is asking.
     */
    const proceed = requireAuth(() => acceptAsDriver(booking), {
      title: 'Sign in to accept jobs',
      reason: `Accepting puts this delivery on your account, and the sender needs to know who is collecting it.\n\n${booking.itemDescription} · ${formatNaira(booking.estimatedFee)} payout`,
      next: '/available-packages',
    });

    if (!proceed) return;
  };

  /**
   * The claim itself. Conditional on the server, so a second driver tapping
   * Accept a moment later is told the job has gone rather than both being shown
   * a success screen for the same parcel.
   */
  const claim = async (booking: Booking) => {
    // Guarded by `handleAccept`, which won't reach here signed out.
    if (!user) return;

    const outcome = await acceptBooking(booking.id);

    if (outcome === 'taken') {
      showDialog(
        'Another driver got there first',
        `${booking.itemDescription} has already been accepted. The feed has been refreshed.`,
      );
      return;
    }

    if (outcome === 'error') {
      showDialog('Could not accept the job', 'Check your connection and try again.');
      return;
    }

    notifyJobAccepted(booking, { name: user.name, email: user.email, phone: user.phone });
    router.push({ pathname: '/job-accepted', params: { trackingId: booking.trackingId } });
  };

  const acceptAsDriver = (booking: Booking) => {
    if (role === 'driver') {
      confirmAccept(booking);
      return;
    }

    showDialog(
      'Switch to Driver to accept',
      `You're browsing as a Sender. Jobs are accepted as a driver, and this one goes to My Jobs under your account.\n\n${booking.itemDescription} · ${formatNaira(booking.estimatedFee)} payout`,
      [
        { text: 'Stay as Sender', style: 'cancel' },
        {
          text: 'Switch to Driver',
          onPress: () => {
            setRole('driver');
            // Keeps the job in hand across the switch, so the driver doesn't
            // have to find the card again in a feed that just re-rendered.
            confirmAccept(booking);
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.container, screenPadding]}>
      <View style={styles.content}>
        <ScreenHeader
          brand={false}
          title="Available Packages"
          subtitle="Search a route and pick up the jobs that fit your run."
        />

        {/*
          Why this feed looks the way it does. Without it a driver in Kano who
          opens Find Jobs and sees Kano-only results can't tell whether that's a
          filter or the whole marketplace.
        */}
        {registeredCity ? (
          <View style={[styles.notice, { backgroundColor: theme.primarySoft }]}>
            <MapPin color={theme.primaryOnSoft} size={16} />
            <Text style={[styles.noticeText, { color: theme.primaryOnSoft }]}>
              Matched to <Text style={styles.noticeStrong}>{cityHubLabel(registeredCity)}</Text>,
              the state on your driver application.{' '}
              {route.origin === registeredCity
                ? 'Change the origin city to look further afield.'
                : 'You are currently looking outside it.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.notice, { backgroundColor: theme.warningSoft }]}>
            <MapPin color={theme.warningOnSoft} size={16} />
            <View style={styles.noticeBody}>
              <Text style={[styles.noticeText, { color: theme.warningOnSoft }]}>
                You&apos;re seeing jobs from every city. Register as a driver and we&apos;ll match
                the feed to where you work.
              </Text>
              <Button
                label="Become a driver"
                variant="secondary"
                size="md"
                style={styles.noticeAction}
                onPress={() => router.push('/driver-signup')}
              />
            </View>
          </View>
        )}

        {/* ---------- Route search ---------- */}
        <Card style={styles.searchCard}>
          <SectionLabel>Find a route</SectionLabel>

          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <Dropdown
                label="Origin city"
                options={CITY_OPTIONS}
                searchable
                searchPlaceholder="Search city or state"
                selected={draftOrigin}
                onSelect={setDraftOrigin}
                renderLabel={cityFilterLabel}
                icon={(color, size) => <Building2 color={color} size={size} />}
              />
            </View>
            <View style={styles.searchField}>
              <Dropdown
                label="Destination city"
                options={CITY_OPTIONS}
                searchable
                searchPlaceholder="Search city or state"
                selected={draftDestination}
                onSelect={setDraftDestination}
                renderLabel={cityFilterLabel}
                icon={(color, size) => <Navigation color={color} size={size} />}
              />
            </View>
          </View>

          {/*
            Right-aligned and only as wide as its label once there's room for
            it — a full-bleed primary button across a 1280px card reads as the
            page's main action rather than "apply these two filters".
            Below the breakpoint it goes full width, where a small floating
            button is just a harder tap target.
          */}
          <View style={[styles.searchActions, wideSearch && styles.searchActionsWide]}>
            {isDirty && (
              <Text style={[styles.dirtyHint, { color: theme.textMuted }]}>
                Press Search Route to apply your new selection.
              </Text>
            )}
            <Button
              label="Search Route"
              size="md"
              style={wideSearch ? styles.searchButtonCompact : undefined}
              icon={(color, size) => <Search color={color} size={size} />}
              onPress={() => setRoute({ origin: draftOrigin, destination: draftDestination })}
            />
          </View>
        </Card>

        <View style={styles.resultHeader}>
          <Text style={[styles.resultCount, { color: theme.textSecondary }]}>
            {results.length} {results.length === 1 ? 'package' : 'packages'} on{' '}
            <Text style={[styles.resultRoute, { color: theme.text }]}>
              {route.origin === 'all' ? 'any city' : route.origin} →{' '}
              {route.destination === 'all' ? 'anywhere' : route.destination}
            </Text>
          </Text>
        </View>

        {results.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              icon={(color, size) => <PackageSearch color={color} size={size} />}
              title="Nothing on this route"
              message={
                totalOpen === 0
                  ? 'No packages currently available on this route. Every open job has been accepted.'
                  : `No packages currently available on this route. There ${
                      totalOpen === 1 ? 'is 1 job' : `are ${totalOpen} jobs`
                    } open elsewhere — widen the search to see them.`
              }
            />

            {/*
              Only offered when clearing the filter would actually help. With
              nothing open anywhere, a reset button just returns another empty
              list — a dead end dressed up as an action.
            */}
            {totalOpen > 0 && !isShowingEverything && (
              <Button
                label="Show jobs on every route"
                size="md"
                style={styles.emptyCta}
                icon={(color, size) => <RotateCcw color={color} size={size} />}
                onPress={resetRoute}
              />
            )}
          </Card>
        ) : (
          <View style={styles.list}>
            {results.map((booking) => (
              <JobCard key={booking.id} booking={booking} onAccept={() => handleAccept(booking)} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function JobCard({ booking, onAccept }: { booking: Booking; onAccept: () => void }) {
  const theme = useTheme();
  const isLocal = booking.deliveryType === 'local';
  const distance = routeDistanceKm(booking.originCity, booking.destinationCity);

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
            {booking.itemDescription}
          </Text>
          <Text style={[styles.trackingId, { color: theme.textMuted }]}>#{booking.trackingId}</Text>
        </View>

        {/*
          Payout is the number a driver scans for, so it leads — with the
          distance immediately under it, because the decision is the two
          together, not the fee alone.
        */}
        <View style={styles.payoutBlock}>
          <View style={[styles.payout, { backgroundColor: theme.primarySoft }]}>
            <Banknote color={theme.primaryOnSoft} size={META_ICON} />
            <Text style={[styles.payoutValue, { color: theme.primaryOnSoft }]}>
              {formatNaira(booking.estimatedFee)}
            </Text>
            <Text style={[styles.payoutLabel, { color: theme.primaryOnSoft }]}>Payout</Text>
          </View>

          {/*
            Straight-line distance between the two hub cities, scaled for road
            detour — an estimate, not a routed distance, which is why it's
            prefixed "~". Local jobs show nothing: both ends share a hub, and
            the real distance depends on areas we have no coordinates for.
          */}
          <View style={styles.distanceRow}>
            <Milestone color={theme.textMuted} size={META_ICON} />
            <Text style={[styles.distanceText, { color: theme.textSecondary }]}>
              {distance === null ? 'Same city' : formatDistance(distance)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.pillRow}>
        {/*
          Both route tags share one neutral container; local and inter-state
          differ only by accent border and label colour, so they read as two
          states of one component rather than two components.
        */}
        <RoutePill
          variant="outline"
          label={routeLabel(booking)}
          tone={isLocal ? 'success' : 'primary'}
          icon={(color) =>
            isLocal ? (
              <MapPin color={color} size={PILL_ICON} />
            ) : (
              <Milestone color={color} size={PILL_ICON} />
            )
          }
        />
        {booking.fragile && (
          <Badge
            label="Fragile"
            tone="warning"
            icon={(color) => <ShieldAlert color={color} size={PILL_ICON} />}
          />
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Both legs, with route indicators. */}
      <View style={styles.legs}>
        <Leg
          icon={<MapPin color={theme.primary} size={LEG_ICON} />}
          label="Pickup"
          value={`${booking.pickupAddress}, ${booking.pickupArea}, ${booking.originCity}`}
        />
        <View style={[styles.legConnector, { backgroundColor: theme.border }]} />
        <Leg
          icon={<Navigation color={theme.success} size={LEG_ICON} />}
          label="Drop-off"
          value={`${booking.dropoffAddress}, ${booking.dropoffArea}, ${booking.destinationCity}`}
        />
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.metrics}>
        <Metric
          icon={<Weight color={theme.textMuted} size={META_ICON} />}
          value={`${booking.weight} kg`}
        />
        <Metric icon={<Box color={theme.textMuted} size={META_ICON} />} value={sizeBand(booking)} />
        <Metric
          icon={<PackageSearch color={theme.textMuted} size={META_ICON} />}
          value={booking.category}
        />
      </View>

      <View
        style={[
          styles.window,
          { backgroundColor: theme.warningSoft, borderLeftColor: theme.warningOnSoft },
        ]}>
        <Clock color={theme.warningOnSoft} size={META_ICON} />
        <Text style={[styles.windowText, { color: theme.warningOnSoft }]}>
          {pickupWindow(booking)}
        </Text>
      </View>

      {/*
        A footer rather than a bare button: the rule and the inset padding stop
        the action reading as the card's own bottom edge. `alignSelf: center`
        sizes it to its label instead of the card width.
      */}
      <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
        <Button
          label="Accept Order"
          size="md"
          style={styles.acceptButton}
          icon={(color, size) => <CheckCheck color={color} size={size} />}
          onPress={onAccept}
        />
      </View>
    </Card>
  );
}

function Leg({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.leg}>
      <View style={styles.legIcon}>{icon}</View>
      <View style={styles.legText}>
        <Text style={[styles.legLabel, { color: theme.textMuted }]}>{label}</Text>
        <Text style={[styles.legValue, { color: theme.text }]}>{value}</Text>
      </View>
    </View>
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
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.three - 4,
    borderRadius: Radius.md,
    marginBottom: Spacing.three - 2,
  },
  noticeBody: {
    flex: 1,
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  noticeText: {
    ...Typography.meta,
    flex: 1,
    lineHeight: 19,
  },
  noticeStrong: {
    ...font(700),
  },
  noticeAction: {
    alignSelf: 'flex-start',
  },
  searchCard: {
    gap: Spacing.three - 2,
  },
  searchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three - 4,
  },
  searchField: {
    flexGrow: 1,
    flexBasis: 170,
    minWidth: 150,
  },
  dirtyHint: {
    ...Typography.meta,
    flexShrink: 1,
  },
  /** Stacked and full width on narrow screens. */
  searchActions: {
    gap: Spacing.two,
  },
  /** Wide: hint on the left, compact button hugging the right edge. */
  searchActionsWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
  searchButtonCompact: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.four,
  },
  /**
   * Fixed-width right column. The metadata line runs from 57px ("~8 km") to
   * 84px ("Same city"); without a floor the header title would reflow every
   * time a card's distance changed length. 92px clears the widest variant.
   */
  payoutBlock: {
    alignItems: 'flex-end',
    minWidth: 92,
    gap: Spacing.one,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Matches the pill gap, so icon-to-label spacing is identical everywhere.
    gap: Spacing.one + 2,
  },
  distanceText: {
    ...Typography.caption,
    ...font(600),
  },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three - 4,
    marginTop: Spacing.one,
  },
  acceptButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.six,
  },
  emptyCard: {
    gap: Spacing.three,
  },
  emptyCta: {
    alignSelf: 'center',
  },
  resultHeader: {
    marginTop: Spacing.four,
    marginBottom: Spacing.three - 2,
  },
  resultCount: {
    ...Typography.meta,
  },
  resultRoute: {
    ...font(700),
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
    gap: Spacing.two + 2,
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
  payout: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.three - 4,
    paddingVertical: Spacing.two - 2,
    borderRadius: Radius.md,
    flexShrink: 0,
  },
  payoutValue: {
    fontSize: 16,
    ...font(700),
  },
  payoutLabel: {
    fontSize: 9,
    ...font(600),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  legs: {
    gap: Spacing.two - 2,
  },
  leg: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + 2,
  },
  legIcon: {
    width: 18,
    alignItems: 'center',
    paddingTop: 1,
  },
  legText: {
    flex: 1,
    gap: Spacing.half,
  },
  legLabel: {
    ...Typography.caption,
  },
  legValue: {
    ...Typography.meta,
    ...font(600),
    lineHeight: 19,
  },
  /** Short rule linking the two legs, echoing the route direction. */
  legConnector: {
    width: StyleSheet.hairlineWidth,
    height: Spacing.three,
    marginLeft: 9,
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
  /**
   * The soft amber fill is only 1.11:1 against the white card, so on its own
   * the banner reads as part of the card rather than a rule about it. The left
   * edge does the separating — 5.02:1, and squared off on that side so it reads
   * as an accent bar rather than a rounded chip.
   */
  window: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two - 2,
    paddingHorizontal: Spacing.three - 4,
    paddingVertical: Spacing.two,
    borderRadius: Radius.sm,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftWidth: 3,
  },
  windowText: {
    ...Typography.meta,
    ...font(600),
  },
});
