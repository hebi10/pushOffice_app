/**
 * 뉴스 카드 – 최대 5건, 제목 + 출처
 */
import { useTheme } from '@/src/contexts/ThemeContext';
import { APP_FONT_FAMILY } from '@/src/lib/typography';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { Card } from '../Card';
import { isSafeNewsLink } from '@/src/features/digest/externalBriefingRequest';
import { showError } from '@/src/components/ui/toast';

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
            pressed && isSafeNewsLink(item.url) ? { opacity: 0.6 } : undefined,
            idx < items.length - 1
              ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }
              : undefined,
          ]}
          onPress={() => { if (item.url && isSafeNewsLink(item.url)) void Linking.openURL(item.url).catch(() => showError(new Error('뉴스 링크를 열 수 없습니다.'))); }}
          disabled={!isSafeNewsLink(item.url)}
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
  label: { fontFamily: APP_FONT_FAMILY, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  row: { paddingVertical: 8 },
  title: { fontFamily: APP_FONT_FAMILY, fontSize: 14, lineHeight: 20 },
  source: { fontFamily: APP_FONT_FAMILY, fontSize: 11, marginTop: 2 },
});
