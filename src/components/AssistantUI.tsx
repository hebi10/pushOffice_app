import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
export function AssistantCard({ title, children }: {
    title?: string;
    children: React.ReactNode;
}) {
    const { colors } = useTheme();
    return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.divider }]}>{title && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}{children}</View>;
}
export function AssistantButton({ label, onPress, secondary = false, busy = false, icon = 'add' }: {
    label: string;
    onPress: () => void;
    secondary?: boolean;
    busy?: boolean;
    icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
    const { colors } = useTheme();
    const color = secondary ? colors.primary : '#fff';
    return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={onPress} style={[styles.button, { backgroundColor: secondary ? colors.background : colors.primary, borderColor: colors.primary }]}>{busy ? <ActivityIndicator color={color}/> : <Ionicons name={icon} size={19} color={color}/>}<Text style={{ color, fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </TouchableOpacity>;
}
export const assistantStyles = StyleSheet.create({
    content: { padding: 20, paddingBottom: 48, gap: 16 }, heading: { fontSize: 28, fontWeight: '800', letterSpacing: -.7 }, subtitle: { fontSize: 14, lineHeight: 22 }, body: { fontSize: 15, lineHeight: 24 }, caption: { fontSize: 12, lineHeight: 19 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, input: { borderWidth: 1, borderRadius: 12, padding: 13, fontSize: 16 },
});
const styles = StyleSheet.create({ card: { padding: 18, borderWidth: 1, borderRadius: 20, gap: 12 }, title: { fontSize: 17, fontWeight: '700' }, button: { minHeight: 49, padding: 12, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 } });
