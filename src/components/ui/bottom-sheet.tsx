import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Fraction of screen height the sheet may grow to. */
  maxHeight?: `${number}%`;
};

/*
 * ⚠ This component already scrolls its children.
 *
 *   Do not put a `ScrollView` inside it. Two vertical scroll containers nested
 *   with no bounded height between them collapse the inner one — on
 *   react-native-web the sheet then opens and appears empty, which reads to a
 *   user as the control that opened it not working.
 *
 *   Pass a plain `View`. `contentContainerStyle` below supplies the padding a
 *   caller would otherwise reach for a ScrollView to get.
 */

export function BottomSheet({ visible, onClose, children, maxHeight = '86%' }: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Backdrop: tapping outside the sheet dismisses it. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
              maxHeight,
              paddingBottom: insets.bottom + Spacing.four,
            },
            Elevation.raised,
          ]}
          // Swallow taps so pressing inside the sheet doesn't close it.
          onPress={(event) => event.stopPropagation()}>
          <View style={[styles.grabber, { backgroundColor: theme.borderStrong }]} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            bounces={false}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl + 4,
    borderTopRightRadius: Radius.xl + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginBottom: Spacing.three,
  },
  content: {
    paddingHorizontal: Spacing.four,
  },
});
