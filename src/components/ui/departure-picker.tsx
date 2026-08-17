import { CalendarClock, Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/screen';
import { Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  combineDeparture,
  dayOptions,
  dayValueOf,
  departureLabel,
  minutesOf,
  nextDepartureSlot,
  timeOptions,
} from '@/lib/departure';

/**
 * Departure Date & Time — a modal selector, not a native picker.
 *
 * See the header of `src/lib/departure.ts` for why this is not `@expo/ui`'s
 * `DatePicker`: unstable API, separate per-platform imports, no web build, and
 * nothing here can run a build to check any of that. This is assembled from
 * `BottomSheet` and `Pressable`, both already working on both platforms.
 *
 * ⚠ No `ScrollView` inside the sheet. `BottomSheet` scrolls its own children,
 *   and nesting a second vertical scroller collapses the inner one on
 *   react-native-web — the bug that shipped twice already, in the admin drawer
 *   and the sender photo sheet.
 */
export function DeparturePicker({
  value,
  onChange,
  error,
}: {
  value: Date | null;
  onChange: (next: Date) => void;
  error?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  /*
   * The sheet edits a draft and commits on Done.
   *
   * Writing straight through would mean scrolling past 14:00 on the way to
   * 18:00 left the form briefly holding a departure the driver did not choose —
   * and if they dismissed the sheet at that moment, kept it.
   */
  const seed = value ?? nextDepartureSlot();
  const [draftDay, setDraftDay] = useState(dayValueOf(seed));
  const [draftMinutes, setDraftMinutes] = useState(minutesOf(seed));

  const days = dayOptions();
  const times = timeOptions();

  const openSheet = () => {
    const from = value ?? nextDepartureSlot();
    setDraftDay(dayValueOf(from));
    setDraftMinutes(minutesOf(from));
    setOpen(true);
  };

  const commit = () => {
    onChange(combineDeparture(draftDay, draftMinutes));
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      {/*
        Label row built like `Field`'s, icon included.

        This rendered as a bare bold caption with no icon while every input
        beside it had one, so it read as a caption belonging to the box rather
        than as a field label like the others.
      */}
      <View style={styles.labelRow}>
        <CalendarClock color={error ? theme.danger : theme.textSecondary} size={16} />
        <Text style={[styles.label, { color: error ? theme.danger : theme.textSecondary }]}>
          Departure Date &amp; Time
        </Text>
      </View>

      <Pressable
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={`Departure date and time, ${departureLabel(value)}. Change it.`}
        /*
          ⚠ `theme.surface` and `borderStrong`, matching `Field`.

            This used `surfaceMuted` with the softer `border`, which next to the
            white inputs above it read as a disabled control — a driver looking
            at the form saw two live fields and one greyed-out one. A control
            that can be tapped has to look like the other controls that can be
            tapped.
        */
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : theme.borderStrong,
          },
          styles.tappable,
          pressed && styles.pressed,
        ]}>
        <Text
          style={[styles.fieldText, { color: value ? theme.text : theme.textMuted }]}
          numberOfLines={1}>
          {departureLabel(value)}
        </Text>
        <ChevronDown color={theme.textMuted} size={18} />
      </Pressable>

      {!!error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={[styles.sheetTitle, { color: theme.text }]}>When are you leaving?</Text>
        <Text style={[styles.sheetNote, { color: theme.textMuted }]}>
          Parcels on your route are offered to you until this moment, then the route stops
          listening.
        </Text>

        <SectionLabel>Day</SectionLabel>
        <View style={styles.chips}>
          {days.map((day) => {
            const selected = day.value === draftDay;
            return (
              <Pressable
                key={day.value}
                onPress={() => setDraftDay(day.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.chip,
                  styles.tappable,
                  {
                    backgroundColor: selected ? theme.primarySoft : theme.surfaceMuted,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? theme.primaryOnSoft : theme.textSecondary },
                  ]}>
                  {day.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <SectionLabel>Time</SectionLabel>
        <View style={styles.chips}>
          {times.map((slot) => {
            const selected = slot.value === draftMinutes;
            return (
              <Pressable
                key={slot.value}
                onPress={() => setDraftMinutes(slot.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.timeChip,
                  styles.tappable,
                  {
                    backgroundColor: selected ? theme.primarySoft : theme.surfaceMuted,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? theme.primaryOnSoft : theme.textSecondary },
                  ]}>
                  {slot.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button
          label={`Use ${departureLabel(combineDeparture(draftDay, draftMinutes))}`}
          icon={(color, size) => <Check color={color} size={size} />}
          onPress={commit}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  // Spacing, label and box all copied from `Field` so the two sit level.
  wrap: { gap: Spacing.one + 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  label: { ...Typography.label },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    minHeight: 50,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fieldText: { ...Typography.body, flex: 1 },
  error: { ...Typography.caption },
  // react-native-web renders Pressable as a plain div, which shows a text caret
  // rather than a pointer unless it is asked.
  tappable: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
  sheetTitle: { ...Typography.sectionTitle },
  sheetNote: { ...Typography.caption, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timeChip: {
    // Fixed width so 96 slots form a readable grid rather than a ragged wrap.
    width: 64,
    alignItems: 'center',
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { ...Typography.caption, ...font(600) },
});
