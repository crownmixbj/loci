import { Eye, EyeOff, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Password input with a reveal toggle.
 *
 * Masking exists to defeat shoulder-surfing, which is rarely the actual risk on
 * a personal phone — and typing a long password blind into a masked box is the
 * main reason people pick short, weak ones. Letting them look is now standard
 * on every major sign-in form, and NIST's own guidance recommends it.
 */
export type PasswordFieldProps = Omit<TextInputProps, 'style' | 'secureTextEntry'> & {
  label?: string;
  error?: string;
  hint?: string;
  /** Renders the strength meter. Sign-up only — pointless when signing in. */
  showStrength?: boolean;
  /** Right-hand slot on the label row, e.g. "Forgot password?". */
  accessory?: React.ReactNode;
};

/**
 * Deliberately not a checklist of symbol requirements.
 *
 * Composition rules push people towards `P@ssw0rd!` — predictable to a cracker,
 * hard for a human. Length is what actually matters, so length dominates the
 * score and variety only nudges it.
 */
export type PasswordStrength = { score: 0 | 1 | 2 | 3; label: string };

export function passwordStrength(password: string): PasswordStrength {
  const length = password.length;
  if (length === 0) return { score: 0, label: '' };
  if (length < 8) return { score: 0, label: 'Too short' };

  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;

  // A 16-character passphrase is strong even in all lowercase.
  if (length >= 16 || (length >= 12 && variety >= 3)) return { score: 3, label: 'Strong' };
  if (length >= 12 || variety >= 3) return { score: 2, label: 'Good' };
  return { score: 1, label: 'Weak' };
}

export function PasswordField({
  label = 'Password',
  error,
  hint,
  showStrength = false,
  accessory,
  value,
  onFocus,
  onBlur,
  ...rest
}: PasswordFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const hasError = !!error;
  const accentColor = hasError ? theme.danger : focused ? theme.primary : theme.textSecondary;
  const borderColor = hasError ? theme.danger : focused ? theme.primary : theme.borderStrong;

  const strength = passwordStrength(typeof value === 'string' ? value : '');

  /*
   * Two colours per state, not one. The bar is a non-text graphic and only
   * needs 3:1, but the same hues used as *text* fail AA badly on white —
   * measured, #16A34A is 3.30:1 and #D97706 is 3.19:1 against the 4.5:1 text
   * threshold. The darker "OnSoft" tones clear it at 5.02:1 while reading as
   * the same colour.
   */
  const barColor =
    strength.score >= 3 ? theme.success : strength.score === 2 ? theme.primary : theme.warning;
  const labelColor =
    strength.score >= 3
      ? theme.successOnSoft
      : strength.score === 2
        ? theme.primaryOnSoft
        : theme.warningOnSoft;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Lock color={accentColor} size={16} />
        <Text
          style={[styles.label, { color: hasError ? theme.danger : theme.textSecondary }]}
          // Takes the leftover space so the accessory sits hard right.
          numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.spacer} />
        {accessory}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          value={value}
          secureTextEntry={!revealed}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              borderColor,
              color: theme.text,
              shadowColor: theme.primary,
              shadowOpacity: focused && !hasError ? 0.18 : 0,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
            },
          ]}
          placeholderTextColor={theme.textMuted}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...rest}
        />

        <Pressable
          onPress={() => setRevealed((current) => !current)}
          accessibilityRole="button"
          // States the action, not the state — a screen reader user needs to
          // know what the button will do, not what it already did.
          accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          hitSlop={8}
          style={({ pressed }) => [styles.reveal, pressed && styles.pressed]}>
          {revealed ? (
            <EyeOff color={theme.textSecondary} size={18} />
          ) : (
            <Eye color={theme.textSecondary} size={18} />
          )}
        </Pressable>
      </View>

      {showStrength && strength.label !== '' && (
        <View style={styles.strength} accessibilityRole="progressbar">
          <View style={styles.strengthTrack}>
            {[1, 2, 3].map((step) => (
              <View
                key={step}
                style={[
                  styles.strengthSegment,
                  {
                    backgroundColor: strength.score >= step ? barColor : theme.backgroundSelected,
                  },
                ]}
              />
            ))}
          </View>
          {/* Colour alone can't carry this — WCAG 1.4.1 — so the word is the label. */}
          <Text style={[styles.strengthLabel, { color: labelColor }]}>{strength.label}</Text>
        </View>
      )}

      {hasError ? (
        <Text style={[styles.helper, { color: theme.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.helper, { color: theme.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two - 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  label: {
    ...Typography.label,
  },
  spacer: {
    flex: 1,
  },
  inputRow: {
    justifyContent: 'center',
  },
  input: {
    outlineWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingLeft: Spacing.three,
    // Room for the reveal button, so a long password never runs under it.
    paddingRight: 48,
    paddingVertical: Spacing.two + 4,
    minHeight: 50,
    ...Typography.body,
  },
  reveal: {
    position: 'absolute',
    right: Spacing.two + 2,
    padding: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
  strength: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: 2,
  },
  strengthTrack: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    ...Typography.meta,
    ...font(700),
  },
  helper: {
    ...Typography.meta,
  },
});
