import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { uiRadii, uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';

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
  const { colors } = useTheme();
  const actionColor = destructive ? colors.danger : colors.primary;
  const actionTextColor = destructive ? colors.onDanger : colors.onPrimary;

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
          <View style={styles.heading}>
            <View style={[styles.iconWrap, { backgroundColor: colors.inputBackground }]}>
              <Ionicons
                name={destructive ? 'trash-outline' : 'information-circle-outline'}
                size={22}
                color={destructive ? colors.danger : colors.textSecondary}
              />
            </View>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
          </View>
          <ScrollView style={styles.messageScroll} showsVerticalScrollIndicator={false}>
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          </ScrollView>
          <View style={styles.actions}>
            {showCancel ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                onPress={onDismiss}
                style={[styles.action, { backgroundColor: colors.surface, borderColor: colors.inputBorder }]}
              >
                <Text style={[styles.label, { color: colors.text }]}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
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
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'center',
    padding: uiSpacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: uiSizes.dialogMaxWidth,
    maxHeight: '88%',
    alignSelf: 'center',
    padding: uiSpacing.md + 2,
    borderRadius: uiRadii.dialog,
    borderWidth: uiSizes.borderWidth,
    gap: uiSpacing.sm,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: uiSpacing.sm },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: uiRadii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...uiTypography.dialogTitle, flex: 1, minWidth: 0 },
  messageScroll: { flexShrink: 1 },
  message: { ...uiTypography.body, fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: uiSpacing.xs + 2, marginTop: uiSpacing.xs },
  action: {
    flex: 1,
    minHeight: uiSizes.touchMinHeight,
    paddingHorizontal: uiSpacing.xs + 2,
    paddingVertical: uiSpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: uiSizes.borderWidth,
    borderRadius: uiRadii.button,
  },
  label: { ...uiTypography.button, textAlign: 'center', flexShrink: 1 },
});
