import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { uiRadii, uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';

export function SchedulePickerDialog({
  title,
  description,
  visible,
  onDismiss,
  children,
}: {
  title: string;
  description?: string;
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="선택 창 닫기"
          onPress={onDismiss}
        />
        <View
          accessibilityViewIsModal
          style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
        >
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              {description ? (
                <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={onDismiss}
              style={styles.close}
            >
              <Ionicons name="close-outline" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.58)',
    justifyContent: 'center',
    padding: uiSpacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: uiSizes.dialogMaxWidth,
    maxHeight: '88%',
    alignSelf: 'center',
    borderWidth: uiSizes.borderWidth,
    borderRadius: uiRadii.dialog,
    padding: uiSpacing.md,
    gap: uiSpacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: uiSpacing.xs },
  heading: { flex: 1, minWidth: 0, gap: uiSpacing.xxs },
  title: uiTypography.dialogTitle,
  description: { ...uiTypography.caption, lineHeight: 19 },
  close: {
    width: uiSizes.touchMinHeight,
    height: uiSizes.touchMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { gap: uiSpacing.sm, paddingBottom: uiSpacing.xs },
});
