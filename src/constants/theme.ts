/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Base surfaces
    text: '#0F172A',
    background: '#F8FAFC',
    backgroundElement: '#F1F5F9',
    backgroundSelected: '#E2E8F0',
    textSecondary: '#334155',

    /** Elevated card / input surface sitting on `background`. */
    surface: '#FFFFFF',
    /** Recessed strip inside a card, e.g. a read-only value row. */
    surfaceMuted: '#F1F5F9',
    /** Top navigation bar. */
    navBackground: '#FFFFFF',
    navBorder: '#E2E8F0',
    /** Hairline card and input border. */
    border: '#E2E8F0',
    /** Slightly stronger border for inputs at rest. */
    borderStrong: '#CBD5E1',
    /** Tertiary text: tracking IDs, placeholders, disabled labels. */
    textMuted: '#64748B',
    shadow: '#0F172A',

    /**
     * Brand blue. The bright #00A8E8 measures only 2.70:1 on white — it fails
     * as a text colour, as a fill behind white text, and even as a 3:1 icon or
     * border. So the deeper #0077B6 (4.87:1) carries anything that means
     * something, and #00A8E8 is kept for decorative tints via `primaryAccent`.
     */
    primary: '#0077B6',
    primaryPressed: '#005E92',
    primaryText: '#FFFFFF',
    /** Decorative only — never behind text or as a lone indicator. */
    primaryAccent: '#00A8E8',
    /** Tinted fill behind primary-toned pills and icon chips. */
    primarySoft: '#E0F2FE',
    primaryOnSoft: '#0369A1',

    // Status tones
    successSoft: '#DCFCE7',
    successOnSoft: '#15803D',
    success: '#16A34A',

    warningSoft: '#FEF3C7',
    warningOnSoft: '#B45309',
    warning: '#D97706',

    dangerSoft: '#FEE2E2',
    dangerOnSoft: '#B91C1C',
    danger: '#DC2626',

    neutralSoft: '#F1F5F9',
    neutralOnSoft: '#475569',
    neutral: '#94A3B8',
  },
  dark: {
    // Base surfaces
    text: '#f8fafc',
    background: '#0A111E',
    backgroundElement: '#1a2436',
    backgroundSelected: '#243044',
    textSecondary: '#94a3b8',

    surface: '#131c2b',
    surfaceMuted: '#1b2536',
    /** Floating capsule navigation bar. */
    navBackground: '#1E232A',
    navBorder: '#2f3540',
    border: '#243146',
    borderStrong: '#33455f',
    textMuted: '#64748b',
    shadow: '#000000',

    /**
     * LOCI brand cyan. `primaryText` is deep navy rather than white: white on
     * #19A7CE measures 2.81:1, below the 4.5:1 WCAG AA floor. Navy gives 5.81:1
     * and keeps the fill exactly on-brand.
     */
    primary: '#19A7CE',
    // Pressed lightens rather than darkens: the label is navy, so a darker
    // fill would drop below AA (#1490b2 measures only 4.41:1).
    primaryPressed: '#3fb8da',
    primaryText: '#04232E',
    primaryAccent: '#19A7CE',
    primarySoft: '#0b3d4e',
    primaryOnSoft: '#7dd8f0',

    // Status tones — success is green so it reads apart from the cyan brand
    successSoft: '#14532d',
    successOnSoft: '#bbf7d0',
    success: '#22c55e',

    warningSoft: '#4a2f0a',
    warningOnSoft: '#fde68a',
    warning: '#fbbf24',

    dangerSoft: '#4c1d1d',
    dangerOnSoft: '#fecaca',
    danger: '#ef4444',

    neutralSoft: '#1e2637',
    neutralOnSoft: '#cbd5e1',
    neutral: '#64748b',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Soft cyan behind every screen in the app. */
export const PageCanvas = '#E0F7FA';

/** Warm hero block behind the headline. */
export const HeroSurface = '#FDF6F0';

/** Semantic tones used by badges and pills. Each maps to a `<tone>Soft` / `<tone>OnSoft` pair. */
export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export const toneColors = (
  theme: (typeof Colors)['light'] | (typeof Colors)['dark'],
  tone: Tone,
): { background: string; foreground: string; solid: string } => {
  switch (tone) {
    case 'success':
      return {
        background: theme.successSoft,
        foreground: theme.successOnSoft,
        solid: theme.success,
      };
    case 'warning':
      return {
        background: theme.warningSoft,
        foreground: theme.warningOnSoft,
        solid: theme.warning,
      };
    case 'danger':
      return { background: theme.dangerSoft, foreground: theme.dangerOnSoft, solid: theme.danger };
    case 'neutral':
      return {
        background: theme.neutralSoft,
        foreground: theme.neutralOnSoft,
        solid: theme.neutral,
      };
    case 'primary':
    default:
      return {
        background: theme.primarySoft,
        foreground: theme.primaryOnSoft,
        solid: theme.primary,
      };
  }
};

/**
 * Only two families ship: the app face (see `AppFontFamily`) and a monospace
 * for code samples. The serif and rounded overrides are gone — nothing used
 * them, and a second display face works against a single type system.
 */
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Plus Jakarta Sans, one file per weight. React Native doesn't synthesise
 * weights from a single family on Android, so the family name has to change
 * with the weight — setting `fontWeight` alone would silently render Regular
 * everywhere. There's no CSS-style fallback list here either: `fontFamily`
 * takes one name, so the loader in _layout.tsx is what guarantees these exist.
 */
export const AppFontFamily = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
} as const;

export type AppFontWeight = keyof typeof AppFontFamily;

/**
 * Pairs the right file with its numeric weight. 900 clamps to 800, the heaviest
 * face bundled.
 */
export function font(weight: 400 | 500 | 600 | 700 | 800 | 900 = 400) {
  const resolved: AppFontWeight = weight >= 800 ? 800 : (weight as AppFontWeight);
  return {
    fontFamily: AppFontFamily[resolved],
    fontWeight: String(resolved) as `${AppFontWeight}`,
  };
}

/** Applied as the app-wide default via `Text` styles. */
export const BaseFont = font(400);

/**
 * Per-service palettes for the home cards.
 *
 * `accent` is the specified brand hue and carries the icon circle, arrow
 * button and pattern. `text` is a darkened variant used for the title and
 * subtitle, and `onAccent` is what sits on top of `accent` — several of the
 * specified hues are too light to carry white or their own text at AA:
 *
 *   #007FFF on its tint  3.53:1     white on #007FFF  3.83:1
 *   #DAA520 on its tint  2.07:1     white on #DAA520  2.24:1
 *   #4169E1 on its tint  4.34:1     white on #4169E1  4.85:1
 *
 * so the text variants are darkened to clear 4.5:1 while the fills keep the
 * exact hue asked for.
 */
export const ServiceTones = {
  teal: {
    accent: '#008080',
    text: '#008080',
    onAccent: '#FFFFFF',
    backgroundFrom: '#EDF7F5',
    backgroundTo: '#FFFDF6',
  },
  azure: {
    accent: '#007FFF',
    text: '#006EDE',
    onAccent: '#FFFFFF',
    backgroundFrom: '#E8F1FF',
    backgroundTo: '#F8FBFF',
  },
  gold: {
    accent: '#DAA520',
    text: '#8E6B15',
    onAccent: '#3D2E06',
    backgroundFrom: '#FBF1DC',
    backgroundTo: '#FFFCF4',
  },
  royal: {
    accent: '#4169E1',
    text: '#3F66DA',
    onAccent: '#FFFFFF',
    backgroundFrom: '#EAEFFC',
    backgroundTo: '#F8FAFE',
  },
} as const;

export type ServiceToneName = keyof typeof ServiceTones;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/** Corner radii. `pill` is deliberately huge so it always fully rounds. */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Type scale. Pair `title`/`sectionTitle` with muted `caption`/`meta` for hierarchy. */
/**
 * One scale for the whole app. Sizes follow the Tailwind steps the design
 * references — 4xl/5xl hero, 2xl section headers, base card titles, sm for
 * supporting text, buttons and badges — so nothing sets its own font size.
 */
export const Typography = {
  /** Hero. Pair with `heroTitleSize(width)` for the 4xl → 5xl step-up. */
  heroTitle: { ...font(800), letterSpacing: -1, lineHeight: 44 },
  /** Centred section headers: How LOCI Works, My Sent Packages, Available Jobs. */
  sectionHeading: { fontSize: 24, ...font(700), letterSpacing: -0.5 },
  screenTitle: { fontSize: 30, ...font(700), letterSpacing: -0.5 },
  screenSubtitle: { fontSize: 14, ...font(400), lineHeight: 21 },
  /** Sub-headers inside a section — smaller than `sectionHeading` by design. */
  sectionTitle: { fontSize: 16, ...font(600) },
  cardTitle: { fontSize: 16, ...font(600), lineHeight: 22 },
  body: { fontSize: 14, ...font(400), lineHeight: 21 },
  label: { fontSize: 14, ...font(600), letterSpacing: 0.1 },
  meta: { fontSize: 14, ...font(400), lineHeight: 20 },
  caption: { fontSize: 14, ...font(400), lineHeight: 20 },
  badge: { fontSize: 14, ...font(600), letterSpacing: 0.2 },
  button: { fontSize: 14, ...font(600) },
} as const;

/** text-4xl on phones, text-5xl from the md breakpoint up. */
export function heroTitleSize(width: number): number {
  return width >= 768 ? 48 : 36;
}

/**
 * Card elevation. iOS gets a soft ambient shadow; Android uses the native
 * elevation prop, which ignores shadowColor/Offset.
 */
export const Elevation = {
  card: Platform.select({
    ios: {
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  raised: Platform.select({
    ios: {
      shadowOpacity: 0.1,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 5 },
    default: {},
  }),
} as const;
