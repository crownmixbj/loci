import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Elevation, Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The confirmation in front of banning or erasing someone.
 *
 * A plain yes/no dialog is not enough for either. Both need a reason recorded —
 * a ban nobody can explain six months later cannot be defended or lifted with
 * confidence — and erasure needs a deliberate act rather than a tap, because it
 * cannot be undone.
 *
 * `confirmWord` turns it into a typed confirmation. It is asked for only where
 * the action is irreversible; using it for everything trains people to type it
 * without reading, which defeats the purpose.
 */
export function ModerationDialog({
  title,
  body,
  consequences,
  confirmLabel,
  confirmWord,
  reasonRequired,
  reasonLabel,
  destructive,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  /** What will actually happen, itemised. Shown before the action, not after. */
  consequences: string[];
  confirmLabel: string;
  /** When set, the exact word that must be typed to enable the button. */
  confirmWord?: string;
  reasonRequired: boolean;
  reasonLabel: string;
  destructive?: boolean;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const theme = useTheme();

  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonOk = !reasonRequired || reason.trim().length >= 4;
  // Case-insensitive: the point is deliberate intent, not typing accuracy.
  const wordOk = !confirmWord || typed.trim().toUpperCase() === confirmWord.toUpperCase();

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (thrown) {
      /*
       * Verbatim. The server refuses several of these by name — "Give a reason
       * for the ban", "Remove this person's admin role first" — and each names
       * the next step. Paraphrasing them loses that.
       */
      setError(thrown instanceof Error ? thrown.message : 'The database refused the change.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cancel">
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, shadowColor: theme.shadow },
            Elevation.raised,
          ]}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>{body}</Text>

          {/*
            Itemised rather than prose. Someone about to do something
            irreversible skims — a list is read, a paragraph is not.
          */}
          <View
            style={[
              styles.consequences,
              { backgroundColor: destructive ? theme.dangerSoft : theme.warningSoft },
            ]}>
            {consequences.map((line) => (
              <Text
                key={line}
                style={[
                  styles.consequence,
                  { color: destructive ? theme.dangerOnSoft : theme.warningOnSoft },
                ]}>
                • {line}
              </Text>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.textSecondary }]}>
            {reasonLabel}
            {reasonRequired ? '' : ' (optional)'}
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            accessibilityLabel={reasonLabel}
            style={[
              styles.input,
              styles.reason,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text },
            ]}
          />

          {!!confirmWord && (
            <>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Type <Text style={font(700)}>{confirmWord}</Text> to confirm
              </Text>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel={`Type ${confirmWord} to confirm`}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />
            </>
          )}

          {!!error && (
            <View style={[styles.error, { backgroundColor: theme.dangerSoft }]}>
              <Text style={[styles.errorText, { color: theme.dangerOnSoft }]}>{error}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" size="md" onPress={onClose} />
            <Button
              label={busy ? 'Working…' : confirmLabel}
              size="md"
              disabled={busy || !reasonOk || !wordOk}
              onPress={() => void run()}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    width: '100%',
    maxWidth: 460,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    ...Typography.sectionTitle,
  },
  body: {
    ...Typography.meta,
    lineHeight: 21,
  },
  consequences: {
    gap: Spacing.one,
    padding: Spacing.three - 2,
    borderRadius: Radius.md,
    marginTop: Spacing.one,
  },
  consequence: {
    ...Typography.caption,
    ...font(600),
    lineHeight: 19,
  },
  label: {
    ...Typography.caption,
    ...font(700),
    marginTop: Spacing.two,
  },
  input: {
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three - 2,
    paddingVertical: Spacing.two,
    ...Typography.meta,
    // See `field.tsx`: RN types outlineStyle as solid/dotted/dashed only.
    outlineWidth: 0,
  },
  reason: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  error: {
    padding: Spacing.three - 2,
    borderRadius: Radius.md,
    marginTop: Spacing.two,
  },
  errorText: {
    ...Typography.caption,
    ...font(600),
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
});
