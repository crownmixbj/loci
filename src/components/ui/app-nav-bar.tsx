import { usePathname, useRouter } from 'expo-router';
import {
  House,
  ClipboardList,
  Info,
  MapPinned,
  Menu,
  PackagePlus,
  PackageSearch,
  Truck,
  LogOut,
  Smartphone,
  UserRound,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Elevation, Radius, Spacing, Typography, font } from '@/constants/theme';
import { AppStoreModal, detectStorePlatform, openStore } from '@/components/ui/app-store-modal';
import { useTheme } from '@/hooks/use-theme';
import { showDialog } from '@/components/ui/dialog';
import { showToast } from '@/components/ui/toast';
import { SESSION_ROLES, useSession } from '@/store/session';

/** Deep navy for nav links at rest — 11.2:1 on the white capsule. */
const NavLinkColor = '#0B3C5D';

/**
 * Up to two letters for the avatar. A signed-in person seeing their own
 * initials is the clearest possible signal that the session is real — a generic
 * silhouette looks identical whether you're signed in or not.
 */
function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Layout tiers, measured rather than guessed.
 *
 * Rendering the type in Plus Jakarta Sans and adding up the capsule gives a
 * minimum width for each arrangement:
 *
 *   labelled links   997px   LOCI + seven words + role pill + avatar + menu
 *   icon-only links  671px   the same links as 34px circles
 *   drawer only      335px   logo and actions; the hamburger carries the links
 *
 * Measured against the *widest* role variant — "My Parcels" is 21px longer than
 * "My Jobs", so sizing to the driver label would overflow for senders.
 *
 * These move whenever a link is added. Adding "My Jobs" pushed the labelled row
 * from 877px to 997px, which silently invalidated the previous 900 breakpoint
 * and would have put the avatar back on the capsule's rounded edge between 900
 * and 997. Re-measure after any change to `NAV_LINKS`.
 */
const LABEL_BREAKPOINT = 1020;
const ICON_LINK_BREAKPOINT = 690;
/** Below this the capsule tightens its padding to survive a 320px phone. */
const TIGHT_BREAKPOINT = 400;

/**
 * `/corporate` and `/driver` exist and are routable but aren't nav links —
 * `/driver` is reached via the profile icon and from the Drivers screens.
 */
type NavHref =
  | '/'
  | '/about'
  | '/available-packages'
  | '/book'
  | '/driver'
  | '/driver-signup'
  | '/locations'
  | '/my-packages';

/** Home matches exactly; the rest match their prefix. */
function isActive(pathname: string, href: NavHref): boolean {
  if (href === '/') return pathname === '/' || pathname === '/index';
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavLink = {
  key: string;
  label: string;
  href: NavHref;
  icon: (color: string, size: number) => React.ReactNode;
  description: string;
};

/**
 * Labels follow the landing-page naming; each maps onto a screen that actually
 * exists rather than a dead link.
 */
const NAV_LINKS: NavLink[] = [
  {
    key: 'home',
    label: 'Home',
    href: '/',
    icon: (color, size) => <House color={color} size={size} />,
    description: 'Track parcels and browse services',
  },
  {
    // Public-facing driver entry point — /driver is the signed-in driver's feed.
    key: 'drivers',
    label: 'Drivers',
    href: '/driver-signup',
    icon: (color, size) => <Truck color={color} size={size} />,
    description: 'Apply to deliver with LOCI',
  },
  {
    key: 'book',
    label: 'Send Parcel',
    href: '/book',
    icon: (color, size) => <PackagePlus color={color} size={size} />,
    description: 'Post a new delivery request',
  },
  {
    key: 'available',
    label: 'Find Jobs',
    href: '/available-packages',
    icon: (color, size) => <PackageSearch color={color} size={size} />,
    description: 'Browse open jobs by route',
  },
  {
    /*
      Role-aware, and the reason a claimed job used to vanish: /driver had no
      nav entry at all, so after accepting one the only routes back were the
      confirmation screen and the avatar menu. Navigate away and the job was
      effectively lost.
    */
    key: 'mine',
    label: 'My Jobs',
    href: '/driver',
    icon: (color, size) => <ClipboardList color={color} size={size} />,
    description: "Deliveries you've accepted",
  },
  {
    key: 'locations',
    label: 'Hubs',
    href: '/locations',
    icon: (color, size) => <MapPinned color={color} size={size} />,
    description: 'Drop-off and collection points',
  },
  {
    key: 'about',
    label: 'About Us',
    href: '/about',
    icon: (color, size) => <Info color={color} size={size} />,
    description: 'Our mission and what sets us apart',
  },
];

export function AppNavBar() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const { role, setRole, user, isAuthenticated, signOut } = useSession();
  // Labels need room; below that the links drop to icons, and below *that* they
  // leave the capsule entirely — the drawer already lists every one of them, so
  // nothing becomes unreachable.
  /*
   * The personal entry follows the role: a sender wants their parcels, a driver
   * wants the jobs they're carrying. Same slot, so the bar doesn't reflow.
   */
  const navLinks = NAV_LINKS.map((link) =>
    link.key === 'mine' && role === 'sender'
      ? {
          ...link,
          label: 'My Parcels',
          href: '/my-packages' as NavHref,
          description: "Parcels you've sent",
        }
      : link,
  );

  const showLabels = width >= LABEL_BREAKPOINT;
  const showInlineLinks = width >= ICON_LINK_BREAKPOINT;
  const tight = width < TIGHT_BREAKPOINT;

  /**
   * On a phone we already know the store, so skip the picker. Desktop web
   * can't be detected reliably, so ask.
   */
  const handleGetApp = () => {
    setMenuOpen(false);
    const detected = detectStorePlatform();
    if (detected) {
      openStore(detected);
      return;
    }
    setStoreModalOpen(true);
  };

  /**
   * Now that the header renders on the auth screens too, "go to sign in" has to
   * cope with already being there — otherwise tapping the avatar on /sign-in
   * pushes a second copy onto the stack and the back gesture walks through
   * duplicates.
   */
  const goToSignIn = () => {
    if (pathname === '/sign-in') return;
    router.push('/sign-in');
  };

  /** Auth lives outside the tab group, so it closes the drawer on the way. */
  const openAuth = () => {
    setMenuOpen(false);
    goToSignIn();
  };

  /**
   * Signing out is worth confirming: it clears the driver registration and
   * drops back to Sender, so an accidental tap costs more than a re-login.
   */
  const handleSignOut = () => {
    setMenuOpen(false);
    showDialog(
      'Sign out of LOCI?',
      `You are signed in as ${user?.email ?? user?.name ?? 'this account'}. You'll need your password to sign back in.`,
      [
        { text: 'Stay signed in', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            void signOut();
            showToast('Signed out', { message: 'You can browse LOCI without an account.' });
            router.replace('/');
          },
        },
      ],
    );
  };

  /**
   * Tapping the avatar. Names the account first — on a shared device, "which
   * account am I in?" is the question people actually have — then offers the
   * two things they came for.
   */
  const openAccountMenu = () => {
    showDialog(
      user?.name ? `Signed in as ${user.name}` : 'Your account',
      user?.email ?? undefined,
      [
        { text: 'Close', style: 'cancel' },
        {
          text: role === 'driver' ? 'My Jobs' : 'My Packages',
          onPress: () => router.push(role === 'driver' ? '/driver' : '/my-packages'),
        },
        { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
      ],
    );
  };

  const go = (href: NavHref) => {
    setMenuOpen(false);
    router.push(href);
  };

  return (
    <>
      <View
        style={[
          styles.wrapper,
          tight && styles.wrapperTight,
          { paddingTop: insets.top + Spacing.two + 4 },
        ]}>
        <View
          style={[
            styles.capsule,
            tight && styles.capsuleTight,
            {
              backgroundColor: theme.navBackground,
              borderColor: theme.navBorder,
              shadowColor: theme.shadow,
            },
            Elevation.raised,
          ]}>
          {/* Logo */}
          <Pressable
            onPress={() => router.push('/')}
            accessibilityRole="button"
            accessibilityLabel="LOCI, go to home"
            style={({ pressed }) => [styles.logo, pressed && styles.pressed]}>
            <Text style={[styles.logoText, { color: theme.primary }]}>LOCI</Text>
          </Pressable>

          {/*
            Dropped entirely on a phone. Six 34px circles plus the logo and the
            actions need 617px; forcing them into 360px is what shoved the
            avatar and hamburger off the end of the capsule.
          */}
          <View
            style={[
              styles.links,
              !showLabels && styles.linksCompact,
              !showInlineLinks && styles.linksHidden,
            ]}>
            {showInlineLinks &&
              navLinks.map((link) => {
                const active = isActive(pathname, link.href);
                // Deep navy at rest, brand blue when active — both clear AA on
                // the white capsule, and navy reads far better than slate on a
                // large display.
                //
                // The colour shift alone is NOT the indicator: navy and brand
                // blue sit 2.37:1 apart, under the 3:1 needed to read as two
                // different colours, and colour on its own fails WCAG 1.4.1
                // regardless. The underline below is what actually marks state.
                const color = active ? theme.primary : NavLinkColor;

                return (
                  <Pressable
                    key={link.key}
                    onPress={() => go(link.href)}
                    accessibilityRole="link"
                    accessibilityLabel={link.label}
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.link,
                      !showLabels && styles.linkIconOnly,
                      // Compact mode: the soft fill is 1.15:1 on white — all but
                      // invisible on its own — so the ring carries the state.
                      active &&
                        !showLabels && {
                          backgroundColor: theme.primarySoft,
                          borderColor: theme.primary,
                        },
                      pressed && styles.pressed,
                    ]}>
                    {!showLabels && link.icon(color, 19)}
                    {showLabels && (
                      <View style={styles.linkLabel}>
                        <Text style={[styles.linkText, { color }]}>{link.label}</Text>
                        {/*
                        Always rendered, transparent when inactive, so switching
                        pages never nudges the row by 2px.
                      */}
                        <View
                          style={[
                            styles.underline,
                            { backgroundColor: active ? theme.primary : 'transparent' },
                          ]}
                        />
                      </View>
                    )}
                  </Pressable>
                );
              })}
          </View>

          <View style={[styles.actions, tight && styles.actionsTight]}>
            {/*
              Stands in for real auth: flips which sections the home screen
              shows. Remove once sign-in exists.
            */}
            <View style={[styles.segmented, { backgroundColor: theme.surfaceMuted }]}>
              {SESSION_ROLES.map((option) => {
                const active = role === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setRole(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`View as ${option.label}`}
                    style={({ pressed }) => [
                      styles.segment,
                      tight && styles.segmentTight,
                      active && { backgroundColor: theme.primary },
                      pressed && styles.pressed,
                    ]}>
                    {({ hovered }: { hovered?: boolean }) => (
                      <Text
                        style={[
                          styles.segmentText,
                          {
                            color: active
                              ? theme.primaryText
                              : // `hovered` is web-only; on native it never sets.
                                hovered && Platform.OS === 'web'
                                ? theme.text
                                : theme.textSecondary,
                          },
                        ]}>
                        {option.label}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/*
              The account control. It used to push /sign-in unconditionally,
              which meant a signed-in person tapping their own avatar was handed
              a login form — and left the only way out of the app buried in the
              drawer. Now it shows who you are and offers the way out.
            */}
            <Pressable
              onPress={isAuthenticated ? openAccountMenu : goToSignIn}
              accessibilityRole="button"
              accessibilityLabel={
                isAuthenticated
                  ? `Account: ${user?.email ?? user?.name}. Open account options`
                  : 'Sign in or create an account'
              }
              hitSlop={6}
              style={({ pressed }) => [
                styles.iconCircle,
                {
                  backgroundColor: isAuthenticated ? theme.primary : theme.surfaceMuted,
                },
                pressed && styles.pressed,
              ]}>
              {isAuthenticated ? (
                <Text style={[styles.avatarInitials, { color: theme.primaryText }]}>
                  {initials(user?.name)}
                </Text>
              ) : (
                <UserRound color={theme.text} size={16} />
              )}
            </Pressable>

            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              hitSlop={8}
              style={({ pressed }) => [styles.actionIcon, pressed && styles.pressed]}>
              <Menu color={theme.text} size={20} />
            </Pressable>
          </View>
        </View>
      </View>

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={go}
        onGetApp={handleGetApp}
        onAuth={openAuth}
        onSignOut={handleSignOut}
        user={user}
        isAuthenticated={isAuthenticated}
        links={navLinks}
      />

      <AppStoreModal
        visible={storeModalOpen}
        onClose={() => setStoreModalOpen(false)}
        detected={detectStorePlatform()}
      />
    </>
  );
}

function SideMenu({
  open,
  onClose,
  onNavigate,
  onGetApp,
  onAuth,
  onSignOut,
  user,
  isAuthenticated,
  links,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (href: NavHref) => void;
  onGetApp: () => void;
  onAuth: () => void;
  onSignOut: () => void;
  user: { name: string; email: string | null } | null;
  isAuthenticated: boolean;
  /** Passed in so the drawer and the capsule can never list different links. */
  links: NavLink[];
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Read here rather than passed down, so the drawer and the capsule can never
  // disagree about which page is current.
  const pathname = usePathname();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.drawer,
            {
              backgroundColor: theme.navBackground,
              borderLeftColor: theme.navBorder,
              paddingTop: insets.top + Spacing.four,
              paddingBottom: insets.bottom + Spacing.four,
              shadowColor: theme.shadow,
            },
            Elevation.raised,
          ]}>
          <View style={styles.drawerHeader}>
            <Text style={[styles.logoText, { color: theme.primary }]}>LOCI</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Close"
              style={[styles.iconCircle, { backgroundColor: theme.surfaceMuted }]}>
              <X color={theme.textSecondary} size={18} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.drawerScroll}>
            {links.map((link) => {
              const active = isActive(pathname, link.href);

              return (
                <Pressable
                  key={link.key}
                  onPress={() => onNavigate(link.href)}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.drawerItem,
                    { borderBottomColor: theme.navBorder },
                    active && { backgroundColor: theme.primarySoft },
                    pressed && { backgroundColor: theme.surfaceMuted },
                  ]}>
                  {/*
                    Left rule marking the current page. The tinted row alone is
                    1.15:1 against the drawer — the bar is what's actually
                    visible, and it means the state isn't carried by colour
                    alone.
                  */}
                  <View
                    style={[
                      styles.drawerActiveBar,
                      { backgroundColor: active ? theme.primary : 'transparent' },
                    ]}
                  />
                  <View style={[styles.drawerIcon, { backgroundColor: theme.primarySoft }]}>
                    {link.icon(theme.primaryOnSoft, 18)}
                  </View>
                  <View style={styles.drawerItemText}>
                    <Text
                      style={[
                        styles.drawerLabel,
                        { color: active ? theme.primary : theme.text },
                        active && font(700),
                      ]}>
                      {link.label}
                    </Text>
                    <Text style={[styles.drawerDescription, { color: theme.textMuted }]}>
                      {link.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {/*
              One row, two states. Showing "Sign In / Sign Up" to someone who is
              already signed in is the classic tell that a session isn't really
              wired up — so when it is, this names the account instead.
            */}
            <Pressable
              onPress={isAuthenticated ? onSignOut : onAuth}
              accessibilityRole="button"
              accessibilityLabel={
                isAuthenticated
                  ? `Signed in as ${user?.email ?? user?.name}. Sign out`
                  : 'Sign in or create an account'
              }
              style={({ pressed }) => [
                styles.drawerItem,
                { borderBottomColor: theme.navBorder },
                pressed && { backgroundColor: theme.surfaceMuted },
              ]}>
              <View
                style={[
                  styles.drawerIcon,
                  { backgroundColor: isAuthenticated ? theme.successSoft : theme.primarySoft },
                ]}>
                {isAuthenticated ? (
                  <LogOut color={theme.successOnSoft} size={18} />
                ) : (
                  <UserRound color={theme.primaryOnSoft} size={18} />
                )}
              </View>
              <View style={styles.drawerItemText}>
                <Text style={[styles.drawerLabel, { color: theme.text }]}>
                  {isAuthenticated ? 'Sign out' : 'Sign In / Sign Up'}
                </Text>
                <Text
                  style={[styles.drawerDescription, { color: theme.textMuted }]}
                  numberOfLines={1}>
                  {isAuthenticated
                    ? (user?.email ?? user?.name ?? 'Signed in')
                    : 'Access your parcels from any device'}
                </Text>
              </View>
            </Pressable>

            {/*
              Moved out of the announcement bar: the store picker is an
              occasional action, so it belongs in the menu rather than
              competing with the live ticker on every page load.
            */}
            <Pressable
              onPress={onGetApp}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.drawerItem,
                { borderBottomColor: theme.navBorder },
                pressed && { backgroundColor: theme.surfaceMuted },
              ]}>
              <View style={[styles.drawerIcon, { backgroundColor: theme.primarySoft }]}>
                <Smartphone color={theme.primaryOnSoft} size={18} />
              </View>
              <View style={styles.drawerItemText}>
                <Text style={[styles.drawerLabel, { color: theme.text }]}>Get the App</Text>
                <Text style={[styles.drawerDescription, { color: theme.textMuted }]}>
                  25% off your first booking in the LOCI app
                </Text>
              </View>
            </Pressable>
          </ScrollView>

          <View style={[styles.drawerFooter, { borderTopColor: theme.navBorder }]}>
            <View style={[styles.flagBadge, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={styles.flag}>🇳🇬</Text>
              <Text style={[styles.flagText, { color: theme.textSecondary }]}>Nigeria · NGN</Text>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // Side margins only — the capsule stretches to fill the rest of the width.
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  wrapperTight: {
    paddingHorizontal: Spacing.three,
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: 50,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three - 4,
    paddingHorizontal: Spacing.four,
    width: '100%',
    // No `overflow: 'hidden'` here, tempting as it is as a safety net: it crops
    // the capsule's own shadow on iOS. The breakpoints above are what keep the
    // row inside its bounds.
  },
  capsuleTight: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
  logo: {
    paddingVertical: Spacing.half,
  },
  logoText: {
    fontSize: 20,
    ...font(800),
    letterSpacing: 1.6,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    // Uniform 24px between every item.
    gap: Spacing.four,
    flexShrink: 1,
  },
  linksCompact: {
    gap: Spacing.one + 2,
  },
  /** Phone widths: the drawer carries navigation, so the row takes no space. */
  linksHidden: {
    display: 'none',
  },
  link: {
    paddingVertical: Spacing.one,
  },
  linkIconOnly: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    // Reserved on every icon link so the active ring doesn't resize the row.
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  /** Stacks the label over its underline and sizes the rule to the word. */
  linkLabel: {
    alignItems: 'stretch',
    gap: 5,
  },
  linkText: {
    fontSize: 16,
    // Semi-bold on every link, active or not — only the colour changes.
    ...font(600),
    textAlign: 'center',
  },
  /**
   * 2.5px rather than a hairline: at 1px this renders sub-pixel on a 2x/3x
   * screen and turns into a pale grey smear instead of a sharp brand-blue rule.
   * Square ends, full label width — reads as an underline, not a dash.
   */
  underline: {
    height: 2.5,
    borderRadius: 1.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    /*
     * Never compress. Under flexbox an <svg> in a squeezed row gets scaled on
     * its main axis, which is why the avatar came out as an oval and the
     * hamburger's rules collapsed together. The links shrink; these do not.
     */
    flexShrink: 0,
  },
  actionsTight: {
    gap: Spacing.one + 2,
  },
  /** Same reason: a fixed box the icon can't be squashed inside. */
  actionIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  /** Both roles visible at once; the active one is filled. */
  segmented: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.pill,
    padding: 2,
    flexShrink: 0,
  },
  /**
   * 8px instead of 12px each side, reclaiming 16px across the pair. On a 320px
   * phone that is the difference between fitting and overflowing. The tap
   * target stays above 44px tall, so only the visual padding tightens.
   */
  segmentTight: {
    paddingHorizontal: Spacing.two,
  },
  segment: {
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.one + 1,
    borderRadius: Radius.pill,
    ...Platform.select({ web: { transitionDuration: '150ms', cursor: 'pointer' }, default: {} }),
  },
  segmentText: {
    fontSize: 12,
    ...font(700),
  },
  avatarInitials: {
    fontSize: 12,
    ...font(700),
    letterSpacing: 0.3,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Drawer
  backdrop: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  drawer: {
    width: '82%',
    maxWidth: 340,
    height: '100%',
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  drawerScroll: {
    flex: 1,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 2,
    paddingVertical: Spacing.three - 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
  },
  /** Always present, transparent when inactive, so rows never shift. */
  drawerActiveBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    // Cancels the row's own gap so the bar sits flush against the edge.
    marginRight: -(Spacing.three - 2) + Spacing.two,
  },
  drawerIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerItemText: {
    flex: 1,
    gap: Spacing.half,
  },
  drawerLabel: {
    ...Typography.body,
    ...font(700),
  },
  drawerDescription: {
    ...Typography.meta,
  },
  drawerFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  flagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  flag: {
    fontSize: 13,
  },
  flagText: {
    fontSize: 11,
    ...font(700),
  },
});
