import { Phone } from 'lucide-react-native';
import { useState } from 'react';

import { Field, type FieldProps } from '@/components/ui/field';
import {
  formatNigerianPhoneInput,
  isValidNigerianPhone,
  NG_PHONE_LENGTH,
  nigerianPhoneError,
} from '@/utils/validation';

export type ValidatedPhoneInputProps = Omit<
  FieldProps,
  'value' | 'onChangeText' | 'error' | 'label'
> & {
  /** Defaults to "Phone number". */
  label?: string;
  /** Always stored in `+234…` form — the mask guarantees it. */
  value: string;
  onChangeText: (value: string) => void;
  /** Forces the error open from the parent's submit handler. */
  showError?: boolean;
};

/**
 * Nigerian phone field. The mask rewrites every keystroke to `+234` plus up to
 * ten national digits, so someone can type `08012345678` the way they'd say it
 * and the stored value is still E.164.
 *
 * Like the email input, the error waits for the first blur — but the mask runs
 * live, so the `+234` appears as soon as they start typing.
 */
export function ValidatedPhoneInput({
  label = 'Phone number',
  value,
  onChangeText,
  showError = false,
  onBlur,
  ...rest
}: ValidatedPhoneInputProps) {
  const [touched, setTouched] = useState(false);

  const error = nigerianPhoneError(value);
  const visible = (touched || showError) && !isValidNigerianPhone(value);

  return (
    <Field
      label={label}
      icon={(color, size) => <Phone color={color} size={size} />}
      placeholder="08012345678"
      value={value}
      onChangeText={(text) => onChangeText(formatNigerianPhoneInput(text))}
      onBlur={(event) => {
        setTouched(true);
        onBlur?.(event);
      }}
      error={visible ? error : undefined}
      hint={visible ? undefined : 'Type your local number — we add +234'}
      keyboardType="phone-pad"
      maxLength={NG_PHONE_LENGTH}
      autoComplete="tel"
      {...rest}
    />
  );
}
