import { CalendarClock, CircleCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Field } from '@/components/ui/field';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { maskExpiryInput, parseExpiry } from '@/lib/expiry';

/**
 * The expiry date under a document upload.
 *
 * ⚠ It echoes the parsed date back in long form, and that is the whole reason
 *   this is a component rather than a `Field` with a mask.
 *
 *   Nigeria writes dates day-first, so `03/04/2029` is 3 April. Somebody used
 *   to the American order types the same eight digits meaning 4 March, and
 *   nothing errors — the date is valid, it is just eleven months wrong. It
 *   would then fire renewal reminders on the wrong day and, for a licence or
 *   insurance, block dispatch while the document in the driver's wallet is
 *   perfectly current.
 *
 *   "3 April 2029" under the field is unambiguous in a way neither ordering is,
 *   and the driver is holding the document while they read it.
 */
export function ExpiryField({
  label,
  value,
  onChange,
  required,
  error,
}: {
  /** The document's own name, so the field reads "Licence expiry date". */
  label: string;
  /** Raw `DD/MM/YYYY` text. Masking happens here; the caller holds the string. */
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  /** A server refusal, which outranks anything parsed locally. */
  error?: string;
}) {
  const theme = useTheme();
  const parsed = parseExpiry(value);

  /*
   * Local parse errors are suppressed until the entry is complete.
   *
   * `parseExpiry` returns `{ ok: null }` for a partial date precisely so a
   * field cannot turn red on the third keystroke, at somebody who is still
   * typing.
   */
  const localError = parsed.ok === false ? parsed.error : undefined;

  return (
    <View style={styles.wrap}>
      <Field
        label={`${label} expiry date${required ? '' : ' (optional)'}`}
        placeholder="DD/MM/YYYY"
        value={value}
        onChangeText={(next) => onChange(maskExpiryInput(next))}
        keyboardType="numeric"
        error={error ?? localError}
        icon={(color, size) => <CalendarClock color={color} size={size} />}
      />

      {parsed.ok === true && !error && (
        <View style={styles.confirm}>
          <CircleCheck color={theme.success} size={14} />
          <Text style={[styles.confirmText, { color: theme.textSecondary }]}>
            {parsed.pretty} — check this matches the document.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  confirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  confirmText: { ...Typography.caption, flex: 1 },
});
