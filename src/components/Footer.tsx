import { useRouter } from 'expo-router';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography, font } from '@/constants/theme';

/**
 * Minimal brand-blue strip. Text is pure white throughout rather than the
 * white/90 and white/70 the reference uses — measured on #0077B6 those land at
 * 4.24:1 and 3.18:1, both under the 4.5:1 AA floor. Pure white is 4.87:1, and
 * size carries the hierarchy instead of opacity.
 *
 * The social chips darken rather than lighten for the same reason: a white/10
 * fill lifts the background and drops the white monogram to 4.09:1, where
 * black/12 reads 5.95:1 and looks near-identical.
 */
const FooterColors = {
  background: '#0077B6',
  text: '#FFFFFF',
  chip: 'rgba(0,0,0,0.12)',
  chipActive: 'rgba(0,0,0,0.22)',
  chipBorder: 'rgba(255,255,255,0.30)',
} as const;

/** Every route the footer can reach. Anything without one has no screen yet. */
type FooterRoute = '/driver-signup' | '/corporate';

type FooterLink = {
  label: string;
  /** Omitted when the destination doesn't exist — renders as plain text. */
  href?: FooterRoute;
};

const LINKS: FooterLink[] = [
  { label: 'Partner Sign-up', href: '/corporate' },
  { label: 'Become a Driver', href: '/driver-signup' },
  // No screens behind these four yet — see the note in the component docblock.
  { label: 'Terms of Service' },
  { label: 'Privacy Policy' },
  { label: 'Legal Info' },
  { label: 'FAQs' },
];

/**
 * lucide v1 ships no brand icons, so these are monograms rather than logos.
 * They only become pressable once real profile URLs are passed in.
 */
const SOCIALS = [
  { key: 'facebook', mark: 'f', label: 'Facebook' },
  { key: 'instagram', mark: 'ig', label: 'Instagram' },
  { key: 'youtube', mark: 'yt', label: 'YouTube' },
  { key: 'x', mark: '𝕏', label: 'X' },
  { key: 'linkedin', mark: 'in', label: 'LinkedIn' },
] as const;

export type SocialKey = (typeof SOCIALS)[number]['key'];

export type FooterProps = {
  /** Real profile URLs. Marks without one render as non-interactive. */
  socialUrls?: Partial<Record<SocialKey, string>>;
};

export function Footer({ socialUrls }: FooterProps) {
  const router = useRouter();

  return (
    <View style={styles.footer}>
      {/* Row 1 — links, wrapping and centred at any width. */}
      <View style={styles.links}>
        {LINKS.map((link) =>
          link.href ? (
            <Pressable
              key={link.label}
              onPress={() => router.navigate(link.href as FooterRoute)}
              accessibilityRole="link"
              hitSlop={6}
              style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
              {({ hovered }: { hovered?: boolean }) => (
                <Text style={[styles.link, Platform.OS === 'web' && hovered && styles.linkHovered]}>
                  {link.label}
                </Text>
              )}
            </Pressable>
          ) : (
            // No screen behind it yet — shown, but not a dead tap target.
            <Text key={link.label} style={styles.link}>
              {link.label}
            </Text>
          ),
        )}
      </View>

      {/* Row 2 — socials. */}
      <View style={styles.socials}>
        {SOCIALS.map((social) => {
          const url = socialUrls?.[social.key];

          return url ? (
            <Pressable
              key={social.key}
              onPress={() => Linking.openURL(url)}
              accessibilityRole="link"
              accessibilityLabel={`LOCI on ${social.label}`}>
              {({ pressed, hovered }: { pressed?: boolean; hovered?: boolean }) => (
                <View
                  style={[
                    styles.chip,
                    (pressed || (Platform.OS === 'web' && hovered)) && styles.chipActive,
                  ]}>
                  <Text style={styles.chipMark}>{social.mark}</Text>
                </View>
              )}
            </Pressable>
          ) : (
            <View key={social.key} accessibilityLabel={social.label} style={styles.chip}>
              <Text style={styles.chipMark}>{social.mark}</Text>
            </View>
          );
        })}
      </View>

      {/* Row 3 — copyright. */}
      <Text style={styles.copyright}>
        © 2026 LOCI Logistics Technologies Limited. All rights reserved.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: FooterColors.background,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: Spacing.four,
    rowGap: Spacing.two + 2,
  },
  link: {
    ...Typography.body,
    ...font(500),
    color: FooterColors.text,
  },
  linkHovered: {
    textDecorationLine: 'underline',
  },
  socials: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    borderWidth: 1,
    backgroundColor: FooterColors.chip,
    borderColor: FooterColors.chipBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: FooterColors.chipActive,
  },
  chipMark: {
    ...Typography.badge,
    ...font(700),
    color: FooterColors.text,
  },
  copyright: {
    ...Typography.caption,
    textAlign: 'center',
    color: FooterColors.text,
    marginTop: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
