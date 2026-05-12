import React, { ReactNode } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/theme';
import { DesignTokens } from '../../design/tokens';

interface ModalSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function ModalSheet({ visible, onClose, children }: ModalSheetProps) {
  const theme = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  sheet: {
    padding: DesignTokens.space.lg,
    paddingTop: DesignTokens.space.md,
    borderTopLeftRadius: DesignTokens.radius['2xl'],
    borderTopRightRadius: DesignTokens.radius['2xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
    ...DesignTokens.shadow.lg,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: DesignTokens.space.lg,
  },
});


