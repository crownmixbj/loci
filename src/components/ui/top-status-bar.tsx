import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Truck, UserRound } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Marquee, PulsingDot } from '@/components/ui/marquee';
import { FontSize, Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActiveMovement } from '@/store/bookings';
import type { SessionRole } from '@/store/session';

export type TopStatusBarProps = {
  movements: ActiveMovement[];
  /** Drives the wording: senders read who it's going to, drivers who to deliver to. */
  role: SessionRole;
  /** Opens the active parcel / tracking detail. */
  onPressTicker: () => void;
};

/**
 * A single live ticker. The promo and the app CTA used to share this pill;
 * both are gone — 'Get the App' now lives in the header menu, so the bar
 * carries one message instead of three competing ones.
 */
export function TopStatusBar({ movements, role, onPressTicker }: TopStatusBarProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[theme.primarySoft, theme.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.bar, { borderColor: theme.border }]}>
        {/* Middle — live ticker */}
        {movements.length > 0 ? (
          <Pressable
            onPress={onPressTicker}
            accessibilityRole="button"
            accessibilityLabel={`Live deliveries. ${movements
              .map((m) => movementLabel(m, role))
              .join('. ')}. Tap for details`}
            style={({ pressed }) => [styles.tickerArea, pressed && styles.pressed]}>
            <View style={styles.liveBadge}>
              <PulsingDot color={theme.primary} />
              <Text style={[styles.liveText, { color: theme.primary }]}>LIVE</Text>
            </View>

            <Marquee>
              <TickerContent movements={movements} role={role} />
            </Marquee>
          </Pressable>
        ) : (
          <View style={styles.tickerArea}>
            <Text style={[styles.idleText, { color: theme.textMuted }]} numberOfLines={1}>
              No parcels moving right now
            </Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

/** Plain-text version of a ticker item, reused for the accessibility label. */
function movementLabel(movement: ActiveMovement, role: SessionRole): string {
  if (role === 'driver') {
    return `Delivering to: ${movement.recipientName}`;
  }

  // A parcel nobody has claimed yet has no driver to name.
  const carrier = movement.driverName
    ? `Delivering by: ${movement.driverName}`
    : 'Awaiting a driver';

  return `On the way to: ${movement.recipientName} · ${carrier}`;
}

function TickerContent({ movements, role }: { movements: ActiveMovement[]; role: SessionRole }) {
  const theme = useTheme();

  return (
    <>
      {movements.map((movement, index) => (
        <View key={`${movement.id}-${index}`} style={styles.item}>
          {index > 0 && <PulsingDot color={theme.primary} style={styles.divider} />}

          {role === 'driver' ? (
            <>
              <MapPin color={theme.primary} size={12} />
              <Text style={[styles.itemText, { color: theme.textSecondary }]} numberOfLines={1}>
                {'Delivering to: '}
                <Text style={[styles.itemDestination, { color: theme.text }]}>
                  {movement.recipientName}
                </Text>
              </Text>
            </>
          ) : (
            <>
              <Truck color={theme.success} size={12} />
              <Text style={[styles.itemText, { color: theme.textSecondary }]} numberOfLines={1}>
                {'On the way to: '}
                <Text style={[styles.itemDestination, { color: theme.text }]}>
                  {movement.recipientName}
                </Text>
              </Text>

              <UserRound color={theme.primary} size={12} style={styles.carrierIcon} />
              <Text style={[styles.itemText, { color: theme.textSecondary }]} numberOfLines={1}>
                {movement.driverName ? (
                  <>
                    {'Delivering by: '}
                    <Text style={[styles.itemDestination, { color: theme.text }]}>
                      {movement.driverName}
                    </Text>
                  </>
                ) : (
                  'Awaiting a driver'
                )}
              </Text>
            </>
          )}
        </View>
      ))}
      {/* Trailing divider so the seam between copies matches internal spacing. */}
      <PulsingDot color={theme.primary} style={styles.divider} />
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.pill,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.05,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
    paddingHorizontal: Spacing.three - 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.7,
  },
  tickerArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    overflow: 'hidden',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexShrink: 0,
  },
  liveText: {
    fontSize: FontSize.micro,
    ...font(800),
    letterSpacing: 0.6,
  },
  idleText: {
    ...Typography.meta,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  itemText: {
    ...Typography.meta,
  },
  itemDestination: {
    ...font(700),
  },
  divider: {
    marginHorizontal: Spacing.two + 2,
  },
  /** Separates the recipient clause from the driver clause. */
  carrierIcon: {
    marginLeft: Spacing.two,
  },
});
