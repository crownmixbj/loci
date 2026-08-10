import { MapPin, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MapView } from '@/components/ui/map-view';
import { Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Optional map pin for a pickup or drop-off point.
 *
 * Collapsed by default. A map is expensive — it loads Leaflet and a screenful
 * of tiles — and most of a booking form is typing, so it opens on request
 * rather than on mount.
 *
 * Deliberately optional. Making a pin mandatory would block anyone on a poor
 * connection, and the text address remains the authoritative instruction; the
 * pin is what turns "22 Lagos Bypass" into something a driver can navigate to.
 */
export type LocationPickerProps = {
  label: string;
  hint?: string;
  lat: number | null;
  lng: number | null;
  onChange: (position: { lat: number; lng: number } | null) => void;
  /** Where to open the map when nothing is pinned yet. */
  center?: { lat: number; lng: number };
  tone?: 'pickup' | 'dropoff';
};

export function LocationPicker({
  label,
  hint,
  lat,
  lng,
  onChange,
  center,
  tone = 'pickup',
}: LocationPickerProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const hasPin = lat !== null && lng !== null;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <MapPin color={hasPin ? theme.success : theme.textSecondary} size={16} />
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
        <View style={styles.spacer} />

        {hasPin && (
          <Pressable
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel={`Remove the ${label} pin`}
            hitSlop={8}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}>
            <X color={theme.textMuted} size={14} />
          </Pressable>
        )}
      </View>

      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [
          styles.toggle,
          {
            backgroundColor: theme.surface,
            borderColor: hasPin ? theme.success : theme.borderStrong,
          },
          pressed && styles.pressed,
        ]}>
        <Text
          style={[styles.toggleText, { color: hasPin ? theme.text : theme.textMuted }]}
          numberOfLines={1}>
          {hasPin
            ? // 5 decimal places is about a metre — more digits imply an accuracy
              // a finger tap on a phone map does not have.
              `Pinned at ${lat.toFixed(5)}, ${lng.toFixed(5)}`
            : open
              ? 'Tap the map to drop a pin'
              : 'Add a map pin (optional)'}
        </Text>
        <Text style={[styles.toggleAction, { color: theme.primary }]}>
          {open ? 'Hide map' : hasPin ? 'Move pin' : 'Open map'}
        </Text>
      </Pressable>

      {open && (
        <MapView
          height={220}
          center={center}
          markers={hasPin ? [{ lat, lng, label, tone }] : []}
          onPick={(position) => onChange(position)}
        />
      )}

      {!!hint && <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text>}
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
  clear: {
    padding: Spacing.half,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 50,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleText: {
    ...Typography.body,
    flexShrink: 1,
  },
  toggleAction: {
    ...Typography.meta,
    ...font(700),
  },
  hint: {
    ...Typography.meta,
  },
  pressed: {
    opacity: 0.7,
  },
});
