import { Ban, Undo2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/lib/errors';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { showDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { showToast } from '@/components/ui/toast';
import { Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  cancelActionLabel,
  cancelBooking,
  cancelClosedReason,
  cancelConfirmBody,
  cancelConfirmTitle,
  cancelRoleFor,
  cancellationAllowed,
} from '@/store/cancellation';
import { useBookings, type Booking } from '@/store/bookings';
import { useSession } from '@/store/session';

/**
 * One control, two meanings.
 *
 * A sender cancelling ends the shipment. A driver "cancelling" ends only their
 * own assignment — the parcel returns to the open board and the sender keeps
 * it. Sharing a component keeps the permission rule in one place; the wording
 * comes from `store/cancellation.ts` so the two never blur into each other.
 *
 * Renders a short explanation instead of a button once the window has closed.
 * A sender who cannot find the control assumes the app is broken, not that they
 * are too late.
 */
export function CancelAction({ booking }: { booking: Booking }) {
  const theme = useTheme();
  const { viewerId } = useSession();
  const { refresh } = useBookings();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const role = cancelRoleFor(booking, viewerId);
  if (!role) return null;

  const allowed = cancellationAllowed(booking.status, role);

  if (!allowed) {
    const why = cancelClosedReason(booking, role);
    if (!why) return null;

    /*
     * A finished parcel gets no note at all.
     *
     * "This parcel has been delivered" under a card already badged Delivered is
     * noise. The note exists for the case that surprises someone — the window
     * closing while they were deciding.
     */
    if (booking.status === 'Delivered' || booking.status === 'Cancelled') return null;

    return (
      <View style={[styles.note, { backgroundColor: theme.surfaceMuted }]}>
        <Text style={[styles.noteText, { color: theme.textMuted }]}>{why}</Text>
      </View>
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      await cancelBooking(booking.id, reason);
      await refresh();

      showToast(
        role === 'sender' ? `#${booking.trackingId} cancelled` : `#${booking.trackingId} released`,
        {
          message:
            role === 'sender' ? 'No driver will collect it.' : 'It is back on the open jobs board.',
          tone: 'info',
        },
      );

      setReason('');
      setOpen(false);
    } catch (thrown) {
      /*
       * The server refuses on the same rule this component checks, and it can
       * refuse even when the button was legitimately shown — a driver may have
       * claimed the parcel in the seconds since the screen last loaded. The
       * message comes from the server so it describes what actually happened.
       */
      showDialog('That did not go through', errorMessage(thrown, 'Try again in a moment.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        label={cancelActionLabel(role)}
        variant="secondary"
        size="md"
        icon={(color, size) =>
          role === 'sender' ? (
            <Ban color={color} size={size} />
          ) : (
            <Undo2 color={color} size={size} />
          )
        }
        onPress={() => setOpen(true)}
      />

      <BottomSheet visible={open} onClose={() => setOpen(false)} maxHeight="60%">
        <View style={styles.sheet}>
          <Text style={[styles.title, { color: theme.text }]}>{cancelConfirmTitle(role)}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            {cancelConfirmBody(role)}
          </Text>

          <Field
            label={role === 'sender' ? 'Reason (optional)' : 'Why are you releasing it? (optional)'}
            placeholder={
              role === 'sender' ? 'Wrong address, changed my mind…' : 'Vehicle trouble, too far…'
            }
            value={reason}
            onChangeText={setReason}
            multiline
          />

          <Button
            label={busy ? 'Working…' : cancelActionLabel(role)}
            onPress={submit}
            disabled={busy}
          />
          <Button
            label="Keep it"
            variant="secondary"
            onPress={() => setOpen(false)}
            disabled={busy}
          />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: Spacing.three,
  },
  title: {
    ...Typography.sectionTitle,
  },
  body: {
    ...Typography.meta,
    lineHeight: 20,
  },
  note: {
    padding: Spacing.three - 4,
    borderRadius: Radius.md,
  },
  noteText: {
    ...Typography.caption,
    lineHeight: 18,
    ...font(500),
  },
});
