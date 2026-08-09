import { useRouter } from 'expo-router';
import {
  Clock,
  MapPin,
  Info,
  MapPinned,
  Navigation,
  PackagePlus,
  Phone,
  Store,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { showDialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip';
import { EmptyState, screenPadding, ScreenHeader, SectionLabel } from '@/components/ui/screen';
import { HUBS, citiesWithHubs, hubsForCity, type Hub } from '@/constants/hubs';
import { MaxContentWidth, Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CITIES, cityHubLabel, DEFAULT_CITY, type City } from '@/store/bookings';

/** Pretty-print a stored E.164-ish number: +234 803 000 1101 */
function formatPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  const match = digits.match(/^(\+\d{3})(\d{3})(\d{3})(\d{4})$/);
  return match ? `${match[1]} ${match[2]} ${match[3]} ${match[4]}` : phone;
}

/**
 * Opens the address in whichever map app the person uses. A search query, not
 * coordinates — we don't hold per-hub lat/lon, and a query on a full street
 * address resolves reliably on all three platforms.
 */
function openDirections(hub: Hub) {
  const query = encodeURIComponent(`${hub.name}, ${hub.address}`);
  const url = Platform.select({
    ios: `http://maps.apple.com/?q=${query}`,
    android: `geo:0,0?q=${query}`,
    default: `https://www.google.com/maps/search/?api=1&query=${query}`,
  });
  Linking.openURL(url).catch(() =>
    showDialog('Could not open maps', 'No map application is available on this device.'),
  );
}

/**
 * What the Flagship badge actually means, stated from the data rather than
 * invented: every flagship carries three services including packaging, while
 * the other hubs carry one or two.
 */
const FLAGSHIP_NOTE =
  'Flagship hubs carry the full service list, including packaging. Smaller counters handle drop-off and collection only.';

export default function LocationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [city, setCity] = useState<City>(DEFAULT_CITY);

  const cities = useMemo(() => citiesWithHubs(CITIES), []);
  const hubs = useMemo(() => hubsForCity(city), [city]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.container, screenPadding]}>
      <View style={styles.content}>
        <ScreenHeader
          brand={false}
          title="Partner Hub Locations"
          subtitle="Drop a parcel off yourself, or have it held for collection."
        />

        <View style={[styles.filterBlock, { borderBottomColor: theme.border }]}>
          <SectionLabel>Select a city</SectionLabel>
          <ChipGroup
            options={cities}
            selected={city}
            onSelect={setCity}
            renderLabel={(c) => `${c} (${HUBS.filter((h) => h.city === c).length})`}
            scrollable
          />
        </View>

        <Text style={[styles.cityLine, { color: theme.textMuted }]}>
          {cityHubLabel(city)} · {hubs.length} {hubs.length === 1 ? 'hub' : 'hubs'}
        </Text>

        {hubs.length === 0 ? (
          <EmptyState
            icon={(color, size) => <MapPinned color={color} size={size} />}
            title="No hubs yet"
            message={`We haven't opened a partner hub in ${city}. Doorstep pickup still covers the whole city.`}
          />
        ) : (
          <View style={styles.list}>
            {hubs.map((hub) => (
              <View key={hub.id} style={styles.gridItem}>
                <HubCard
                  hub={hub}
                  onSelect={() =>
                    router.navigate({
                      pathname: '/book',
                      params: { originCity: hub.city, pickupArea: hub.area },
                    })
                  }
                />
              </View>
            ))}
          </View>
        )}

        <Button
          label="Book a doorstep pickup instead"
          icon={(color, size) => <Navigation color={color} size={size} />}
          onPress={() => router.navigate('/book')}
          style={styles.cta}
        />
      </View>
    </ScrollView>
  );
}

function HubCard({ hub, onSelect }: { hub: Hub; onSelect: () => void }) {
  const theme = useTheme();
  const [showFlagshipNote, setShowFlagshipNote] = useState(false);

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBubble, { backgroundColor: theme.primarySoft }]}>
          <Store color={theme.primaryOnSoft} size={18} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.hubName, { color: theme.text }]}>{hub.name}</Text>
          <Text style={[styles.hubArea, { color: theme.textMuted }]}>
            {hub.area}, {hub.city}
          </Text>
        </View>
        {hub.flagship && (
          <Pressable
            onPress={() => setShowFlagshipNote((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showFlagshipNote }}
            accessibilityLabel="Flagship hub. What this means"
            hitSlop={6}>
            <Badge
              label="Flagship"
              tone="primary"
              icon={(color) => <Info color={color} size={11} />}
            />
          </Pressable>
        )}
      </View>

      {hub.flagship && showFlagshipNote && (
        <Text style={[styles.flagshipNote, { color: theme.textSecondary }]}>{FLAGSHIP_NOTE}</Text>
      )}

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <DetailRow
        icon={<MapPin color={theme.primary} size={15} />}
        label="Address"
        value={hub.address}
      />
      <DetailRow
        icon={<Clock color={theme.textMuted} size={15} />}
        label="Opening hours"
        value={hub.hours}
      />
      <DetailRow
        icon={<Phone color={theme.textMuted} size={15} />}
        label="Phone"
        value={formatPhone(hub.phone)}
        onPress={() => Linking.openURL(`tel:${hub.phone}`)}
      />

      <View style={styles.serviceRow}>
        {hub.services.map((service) => (
          <Badge key={service} label={service} tone="neutral" uppercase={false} />
        ))}
      </View>

      {/*
        Two actions, because a hub page has two jobs: getting there, and
        starting a booking that lands there. Directions opens the OS map with
        the address as a search query — no map SDK, no API key, and it works on
        whichever map app the person actually uses.
      */}
      <View style={[styles.actions, { borderTopColor: theme.border }]}>
        <Button
          label="Get Directions"
          size="md"
          variant="secondary"
          style={styles.action}
          icon={(color, size) => <Navigation color={color} size={size} />}
          onPress={() => openDirections(hub)}
        />
        <Button
          label="Select Hub"
          size="md"
          style={styles.action}
          icon={(color, size) => <PackagePlus color={color} size={size} />}
          onPress={onSelect}
        />
      </View>
    </Card>
  );
}

function DetailRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const theme = useTheme();

  const body = (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>{icon}</View>
      <View style={styles.detailText}>
        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: onPress ? theme.primary : theme.text }]}>
          {value}
        </Text>
      </View>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Call ${value}`}
      style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  /**
   * The filter is its own step, not a continuation of the header. At the old
   * 8px it read as part of the subtitle.
   */
  filterBlock: {
    marginTop: Spacing.three,
    marginBottom: Spacing.four,
    paddingBottom: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cityLine: {
    ...Typography.meta,
    ...font(600),
    marginBottom: Spacing.three,
  },
  /**
   * Wraps into columns rather than one full-width stack. A hub card is a short
   * address, a time and a phone number — stretched across a 1280px monitor the
   * eye has to travel the whole width for three words of content.
   */
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three - 2,
  },
  /** ~360px is where the address stops wrapping awkwardly. */
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three - 4,
    marginTop: Spacing.one,
  },
  action: {
    flexGrow: 1,
    flexBasis: 140,
  },
  flagshipNote: {
    ...Typography.caption,
    lineHeight: 19,
  },
  gridItem: {
    flexGrow: 1,
    flexBasis: 340,
    maxWidth: 520,
  },
  card: {
    gap: Spacing.two + 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    gap: Spacing.half,
  },
  hubName: {
    ...Typography.body,
    ...font(700),
  },
  hubArea: {
    ...Typography.meta,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + 2,
  },
  detailIcon: {
    width: 18,
    alignItems: 'center',
    paddingTop: 2,
  },
  detailText: {
    flex: 1,
    gap: Spacing.half,
  },
  detailLabel: {
    ...Typography.caption,
  },
  detailValue: {
    ...Typography.meta,
    ...font(600),
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.7,
  },
  serviceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two - 2,
    marginTop: Spacing.half,
  },
  cta: {
    marginTop: Spacing.four,
  },
});
