import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type FieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Leading icon in the label row; receives a color that reflects focus/error state. */
  icon?: (color: string, size: number) => React.ReactNode;
  error?: string;
  hint?: string;
  inputStyle?: TextInputProps['style'];
  /** Shorter input for dense cards. Leaves the tap target at 38px. */
  compact?: boolean;
  /** Escape hatch for imperative focus, e.g. deep-linking into a specific field. */
  inputRef?: React.Ref<TextInput>;
};

export function Field({
  label,
  icon,
  error,
  hint,
  multiline,
  inputStyle,
  compact = false,
  inputRef,
  onFocus,
  onBlur,
  ...rest
}: FieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const hasError = !!error;
  const accentColor = hasError ? theme.danger : focused ? theme.primary : theme.textSecondary;
  const borderColor = hasError ? theme.danger : focused ? theme.primary : theme.borderStrong;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        {icon?.(accentColor, 16)}
        <Text style={[styles.label, { color: hasError ? theme.danger : theme.textSecondary }]}>
          {label}
        </Text>
      </View>

      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          compact && styles.inputCompact,
          {
            backgroundColor: theme.surface,
            borderColor,
            color: theme.text,
            // A focus ring rather than a thicker border, so the field doesn't shift.
            shadowColor: theme.primary,
            shadowOpacity: focused && !hasError ? 0.18 : 0,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 0 },
          },
          multiline && styles.multiline,
          inputStyle,
        ]}
        placeholderTextColor={theme.textMuted}
        multiline={multiline}
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
  input: {
    /*
      The hairline border below is the field's only outline. On web the input
      would otherwise also paint the browser's focus ring inside it, doubling up
      with the blue focus border into a thick inner edge.

      `outlineWidth: 0` rather than `outlineStyle: 'none'` — RN 0.86 types the
      latter as solid | dotted | dashed only, and this is a no-op on native.
    */
    outlineWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    minHeight: 50,
    ...Typography.body,
  },
  inputCompact: {
    minHeight: 38,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three - 4,
    ...Typography.body,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  helper: {
    ...Typography.meta,
  },
});
