import { Mail } from 'lucide-react-native';
import { useState } from 'react';

import { Field, type FieldProps } from '@/components/ui/field';
import { EMAIL_ERROR_MESSAGE, isValidEmail } from '@/utils/validation';

export type ValidatedEmailInputProps = Omit<
  FieldProps,
  'value' | 'onChangeText' | 'error' | 'label'
> & {
  /** Defaults to "Email". */
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  /**
   * Forces the error open regardless of blur — set this from the parent's
   * submit handler so pressing Submit reveals errors on untouched fields.
   */
  showError?: boolean;
  /** Overrides the default message. */
  errorMessage?: string;
};

/**
 * Email field with the shared validator built in.
 *
 * The error appears after the first blur rather than on the first keystroke:
 * flagging "invalid" while someone is still typing `a` is noise, not feedback.
 * Once it has been shown, it clears live as soon as the value becomes valid.
 *
 * Parents own submit-button state — call `isValidEmail` (the same function this
 * uses) rather than mirroring the validity here, so there is one source of truth.
 */
export function ValidatedEmailInput({
  label = 'Email',
  value,
  onChangeText,
  showError = false,
  errorMessage = EMAIL_ERROR_MESSAGE,
  onBlur,
  ...rest
}: ValidatedEmailInputProps) {
  const [touched, setTouched] = useState(false);

  const invalid = !isValidEmail(value);
  const visible = (touched || showError) && invalid;

  return (
    <Field
      label={label}
      icon={(color, size) => <Mail color={color} size={size} />}
      placeholder="you@example.com"
      value={value}
      onChangeText={onChangeText}
      onBlur={(event) => {
        setTouched(true);
        onBlur?.(event);
      }}
      error={visible ? errorMessage : undefined}
      keyboardType="email-address"
      autoCapitalize="none"
      autoComplete="email"
      autoCorrect={false}
      {...rest}
    />
  );
}
