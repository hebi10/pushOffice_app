/**
 * AI 요약 카드 – 모닝 브리핑 한줄 요약
 */
import { useTheme } from '@/src/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Card } from '../Card';

interface Props {
  text: string;
}

export function BriefingAISummaryCard({ text }: Props) {
  const { colors } = useTheme();

  if (!text) return null;

  return (
    <Card style={{ backgroundColor: colors.primaryLight }}>
      <Text style={[styles.label, { color: colors.primary }]}>AI 브리핑</Text>
      <Text style={[styles.text, { color: colors.text }]}>{text}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  text: { fontSize: 14, lineHeight: 22 },
});
