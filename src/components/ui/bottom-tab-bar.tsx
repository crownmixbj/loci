import { usePathname, useRouter } from 'expo-router';
import {
  ClipboardList,
  PackagePlus,
  PackageSearch,
  Settings,
  Truck,
  UserRound,
  Wallet,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsMenu } from '@/components/ui/settings-menu';
import { Elevation, Radius, Spacing, font } from '@/constants/theme';
import { useExperience } from '@/hooks/use-experience';
import { routeAllowed, type Experience } from '@/lib/experience';
import { useTheme } from '@/hooks/use-theme';

/**
 * The native tab bar.
 *
 * Phones navigate from the bottom. The floating capsule works on a desktop
 * where there is horizontal room for seven labels, but on a phone it collapses
 * to a hamburger — which buries every destination one tap deeper than it needs
 * to be, on the device where taps are most expensive.
 *
 * Web keeps the capsule. This renders only in the native experiences.
 */
type Tab = {
  key: string;
  label: string;
  href: string;
  icon: (color: string, size: number) => React.ReactNode;
  /** Opens the settings sheet instead of navigating. */
  sheet?: boolean;
  /** Prefixes that should light this tab up, beyond `href` itself. */
  also?: string[];
};

const SENDER_TABS: Tab[] = [
  {
    key: 'new',
    label: 'New Shipment',
    href: '/book',
    icon: (color, size) => <PackagePlus color={color} size={size} />,
  },
  {
    key: 'shipments',
    label: 'My Shipments',
    href: '/my-packages',
    icon: (color, size) => <ClipboardList color={color} size={size} />,
    // The parcel detail screen and the tracking lookup both belong here.
    also: ['/parcel', '/tracking'],
  },
  {
    key: 'account',
    label: 'Account',
    href: '/settings',
    sheet: true,
    icon: (color, size) => <UserRound color={color} size={size} />,
  },
];

/**
 * The driver's four.
 *
 * Same shape, different work: what they are carrying, what they could pick up,
 * what they are owed, and themselves. A driver has no New Shipment tab — the
 * booking form is not in their experience at all.
 *
 * The mockup's middle tab is "My Inventory". What a driver is carrying now
 * lives on the Hub, under "In your hands", because it is the same list as the
 * current job seen from a different angle — and the second tab has to be the
 * job board. That is where the work comes from, and a driver with an empty bike
 * should reach it in one tap, not two.
 *
 * ⚠ Wallet is a tab because on a phone there is nothing else.
 *
 *   The capsule and its Jobs & Drivers dropdown are web-only — a native driver
 *   build has this bar and nothing else. So adding the wallet to the dropdown
 *   alone would have shipped a screen that exists, is allowed, and is
 *   unreachable on the one device the people it is for actually use. That is
 *   the orphan-route failure `verify-navigation` was written for, and it would
 *   have caught this; adding the tab is the fix, not the workaround.
 */
const DRIVER_TABS: Tab[] = [
  {
    key: 'jobs',
    label: 'Assigned Trip',
    href: '/driver',
    icon: (color, size) => <Truck color={color} size={size} />,
  },
  {
    key: 'find',
    label: 'Setup Trip',
    href: '/available-packages',
    icon: (color, size) => <PackageSearch color={color} size={size} />,
  },
  {
    key: 'wallet',
    label: 'Wallet',
    href: '/driver-wallet',
    icon: (color, size) => <Wallet color={color} size={size} />,
  },
  {
    key: 'account',
    label: 'Settings',
    href: '/settings',
    sheet: true,
    // The gear from the mockup. This sheet is also where a dual-role account
    // switches between Sender and Driver, which is a setting, not a profile.
    icon: (color, size) => <Settings color={color} size={size} />,
  },
];

export function tabsFor(experience: Experience): Tab[] {
  if (experience === 'driver') return DRIVER_TABS;
  if (experience === 'sender') return SENDER_TABS;
  // Web navigates from the capsule; there is no tab bar to build.
  return [];
}

export function BottomTabBar() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const experience = useExperience();

  const [settingsOpen, setSettingsOpen] = useState(false);

  const tabs = experience ? tabsFor(experience) : [];
  if (tabs.length === 0) return null;

  const isActive = (tab: Tab) => {
    const prefixes = [tab.href, ...(tab.also ?? [])];
    return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  };

  return (
    <>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.navBackground,
            borderTopColor: theme.navBorder,
            shadowColor: theme.shadow,
            // The home indicator on a modern iPhone sits under the bar; without
            // this the labels are half-covered by it.
            paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.two,
          },
          Elevation.raised,
        ]}>
        {tabs.map((tab) => {
          const active = isActive(tab);
          const color = active ? theme.primary : theme.textMuted;

          return (
            <Pressable
              key={tab.key}
              onPress={() => (tab.sheet ? setSettingsOpen(true) : router.navigate(tab.href as '/'))}
              accessibilityRole={tab.sheet ? 'button' : 'link'}
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
              {/*
                The tinted pill behind the active icon is 1.15:1 on the bar —
                near invisible on its own. The icon and label colour shift do
                the work, and the label is always visible so the state is never
                carried by colour alone.
              */}
              <View style={[styles.iconWrap, active && { backgroundColor: theme.primarySoft }]}>
                {tab.icon(color, 22)}
              </View>
              <Text style={[styles.label, { color }, active && font(700)]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SettingsMenu open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

/**
 * Every route a tab points at must exist in the experience showing that tab.
 *
 * Exported so the verification script can assert it rather than trusting the
 * two lists above to stay in step with `ROUTE_EXPERIENCES`.
 */
export function tabsAreRoutable(experience: Experience): boolean {
  return tabsFor(experience).every((tab) => tab.sheet || routeAllowed(tab.href, experience));
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
    // 44px minimum target, before the label. A tab bar is the most-tapped
    // control in the app and the easiest one to make too small.
    paddingVertical: Spacing.one,
  },
  iconWrap: {
    width: 56,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    ...font(600),
  },
  pressed: {
    opacity: 0.6,
  },
});
