import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Elevation, Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Cross-platform replacement for React Native's `Alert`.
 *
 * `Alert.alert` is a NO-OP on react-native-web — the implementation is literally
 * `static alert() {}`. Every confirm and error dialog in this app was therefore
 * silently dead in the browser: pressing "Accept Order" ran nothing at all.
 *
 * This renders a real modal instead, so the same call works on web, iOS and
 * Android. The signature deliberately mirrors `Alert.alert(title, message,
 * buttons)` so call sites only change their import.
 *
 * The queue is module-level rather than a context so it can be called from
 * plain functions and async handlers without threading a hook through them —
 * which is how `Alert.alert` was already being used.
 */
export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export type DialogButton = {
  text: string;
  onPress?: () => void;
  style?: DialogButtonStyle;
};

export type DialogRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
};

type Listener = (request: DialogRequest | null) => void;

let current: DialogRequest | null = null;
let nextId = 0;
const listeners = new Set<Listener>();

function publish(request: DialogRequest | null) {
  current = request;
  listeners.forEach((listener) => listener(request));
}

/**
 * Shows a modal dialog. With no buttons it renders a single "OK" — matching
 * `Alert.alert`'s behaviour, so informational calls need no extra argument.
 */
export function showDialog(title: string, message?: string, buttons?: DialogButton[]): void {
  nextId += 1;
  publish({
    id: nextId,
    title,
    message,
    buttons: buttons?.length ? buttons : [{ text: 'OK' }],
  });
}

/** Test seam: what is on screen right now, or null. */
export function currentDialog(): DialogRequest | null {
  return current;
}

/**
 * Mounted once at the root. Without this, `showDialog` is as silent as the
 * `Alert` it replaces — so it lives next to the providers in `_layout.tsx`.
 */
export function DialogHost() {
  const theme = useTheme();
  const [request, setRequest] = useState<DialogRequest | null>(current);

  useEffect(() => {
    listeners.add(setRequest);
    return () => {
      listeners.delete(setRequest);
    };
  }, []);

  if (!request) return null;

  const dismiss = () => publish(null);

  const press = (button: DialogButton) => {
    // Close first: the handler usually navigates, and a modal still mounted
    // over the new screen traps every tap behind it.
    dismiss();
    button.onPress?.();
  };

  /** Escape or a backdrop tap means "cancel", so run that button if there is one. */
  const requestClose = () => {
    const cancel = request.buttons.find((button) => button.style === 'cancel');
    dismiss();
    cancel?.onPress?.();
  };

  // Two short buttons sit side by side; anything longer wraps to a column so
  // labels are never truncated.
  const stacked =
    request.buttons.length > 2 ||
    request.buttons.some((button) => button.text.length > 14) ||
    request.buttons.length === 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={requestClose}>
      <Pressable style={styles.backdrop} onPress={requestClose} accessibilityLabel="Dismiss">
        <Pressable
          onPress={(event) => event.stopPropagation()}
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
            Elevation.raised,
          ]}>
          <Text style={[styles.title, { color: theme.text }]}>{request.title}</Text>
          {!!request.message && (
            <Text style={[styles.message, { color: theme.textSecondary }]}>{request.message}</Text>
          )}

          <View style={[styles.actions, stacked ? styles.actionsColumn : styles.actionsRow]}>
            {request.buttons.map((button, index) => (
              <DialogAction
                key={`${button.text}-${index}`}
                button={button}
                stacked={stacked}
                onPress={() => press(button)}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DialogAction({
  button,
  stacked,
  onPress,
}: {
  button: DialogButton;
  stacked: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const style = button.style ?? 'default';

  const background =
    style === 'destructive' ? theme.danger : style === 'cancel' ? theme.surface : theme.primary;
  const label = style === 'cancel' ? theme.text : theme.primaryText;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [
        styles.action,
        stacked ? styles.actionFull : styles.actionFlex,
        {
          backgroundColor: background,
          borderColor: style === 'cancel' ? theme.borderStrong : 'transparent',
        },
        state.pressed && styles.pressed,
      ]}>
      <Text style={[styles.actionLabel, { color: label }]} numberOfLines={1}>
        {button.text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    ...Typography.sectionTitle,
    fontSize: 19,
  },
  message: {
    ...Typography.body,
    lineHeight: 22,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionsColumn: {
    flexDirection: 'column',
  },
  action: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionFlex: {
    flex: 1,
  },
  actionFull: {
    width: '100%',
  },
  pressed: {
    opacity: 0.8,
  },
  actionLabel: {
    ...Typography.button,
    ...font(700),
  },
});
