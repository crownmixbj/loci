import { Signpost } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Dropdown } from '@/components/ui/dropdown';
import { Field } from '@/components/ui/field';
import { Spacing } from '@/constants/theme';
import { areasForCity, OTHER_AREA, type City } from '@/store/bookings';

export type AreaPickerProps = {
  label: string;
  city: City;
  /** The chosen preset, or OTHER_AREA when the sender is typing a custom area. */
  selection: string;
  onSelectionChange: (value: string) => void;
  /** Free-text area, only used while `selection === OTHER_AREA`. */
  customValue: string;
  onCustomChange: (value: string) => void;
  error?: string;
  placeholder?: string;
};

/**
 * Area dropdown scoped to a city, with an "Other…" option that reveals a text
 * input — so an unlisted neighbourhood never blocks a booking.
 */
export function AreaPicker({
  label,
  city,
  selection,
  onSelectionChange,
  customValue,
  onCustomChange,
  error,
  placeholder,
}: AreaPickerProps) {
  const isOther = selection === OTHER_AREA;

  return (
    <View style={styles.group}>
      <Dropdown
        label={label}
        options={areasForCity(city)}
        selected={selection}
        onSelect={onSelectionChange}
        icon={(color, size) => <Signpost color={color} size={size} />}
        placeholder={`Select an area in ${city}`}
        error={isOther ? undefined : error}
      />

      {isOther && (
        <Field
          label={`${label} — name it`}
          placeholder={placeholder ?? 'e.g. Akobo'}
          value={customValue}
          onChangeText={onCustomChange}
          error={error}
          autoCapitalize="words"
        />
      )}
    </View>
  );
}

/** Resolves what actually gets stored on the booking. */
export function resolveArea(selection: string, customValue: string): string {
  return selection === OTHER_AREA ? customValue.trim() : selection;
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.three - 4,
  },
});
