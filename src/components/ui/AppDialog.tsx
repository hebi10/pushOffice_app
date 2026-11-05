import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { APP_FONT_FAMILY } from '@/src/lib/typography';

type AppDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  showCancel?: boolean;
};

export function AppDialog({
  visible,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive = false,
  onConfirm,
  onDismiss,
  showCancel = true,
}: AppDialogProps) {
  const { colors, isDark } = useTheme();
  const actionColor = destructive ? colors.danger : colors.primary;
  const actionTextColor = isDark ? colors.background : '#FFFFFF';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="대화상자 닫기"
          accessibilityRole="button"
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
        />
        <View
          accessibilityViewIsModal
          style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
        >
          <View style={[styles.iconWrap, { backgroundColor: destructive ? colors.inputBackground : colors.primaryLight }]}>
            <Ionicons
              name={destructive ? 'trash-outline' : 'information-circle-outline'}
              size={26}
              color={actionColor}
            />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          <View style={styles.actions}>
            {showCancel && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                onPress={onDismiss}
                style={[styles.action, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
              >
                <Text style={[styles.label, { color: colors.text }]}>{cancelLabel}</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              onPress={onConfirm}
              style={[styles.action, { backgroundColor: actionColor, borderColor: actionColor }]}
            >
              <Text style={[styles.label, { color: actionTextColor }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.58)',
    justifyContent: 'center',
    padding: 20,
  },
  panel: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: APP_FONT_FAMILY, fontSize: 20, fontWeight: '700', lineHeight: 28 },
  message: { fontFamily: APP_FONT_FAMILY, fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  action: {
    flex: 1, minHeight: 48, paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderRadius: 10,
  },
  label: { fontFamily: APP_FONT_FAMILY, fontSize: 15, fontWeight: '700' },
});
