/**
 * 뉴스 카드 – 최대 5건, 제목 + 출처
 */
import { useTheme } from '@/src/contexts/ThemeContext';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { Card } from '../Card';

interface NewsItem {
  title: string;
  description: string;
  source: string;
  url?: string;
}

interface Props {
  items: NewsItem[];
}

export function BriefingNewsCard({ items }: Props) {
  const { colors } = useTheme();

  if (!items.length) return null;

  return (
    <Card>
      <Text style={[styles.label, { color: colors.textSecondary }]}>주요 뉴스</Text>

      {items.slice(0, 5).map((item, idx) => (
        <Pressable
          key={idx}
          style={({ pressed }) => [
            styles.row,
            pressed && item.url ? { opacity: 0.6 } : undefined,
            idx < items.length - 1
              ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }
              : undefined,
          ]}
          onPress={() => item.url && Linking.openURL(item.url)}
          disabled={!item.url}
        >
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.source ? (
            <Text style={[styles.source, { color: colors.textTertiary }]}>
              {item.source}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  row: { paddingVertical: 8 },
  title: { fontSize: 14, lineHeight: 20 },
  source: { fontSize: 11, marginTop: 2 },
});
