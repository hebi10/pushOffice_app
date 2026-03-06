/**
 * 날씨 카드 – 기온, 체감, 최저/최고, 한줄 코멘트
 */
import { useTheme } from '@/src/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../Card';

interface Props {
  temp: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  description: string;
  city: string;
  comment?: string;
}

export function BriefingWeatherCard({
  temp,
  feelsLike,
  tempMin,
  tempMax,
  description,
  city,
  comment,
}: Props) {
  const { colors } = useTheme();

  return (
    <Card>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>날씨</Text>
        <Text style={[styles.city, { color: colors.textTertiary }]}>{city}</Text>
      </View>

      <View style={styles.tempRow}>
        <Text style={[styles.temp, { color: colors.text }]}>{temp}°</Text>
        <View style={styles.tempDetail}>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            체감 {feelsLike}° · {description}
          </Text>
          <Text style={[styles.sub, { color: colors.textTertiary }]}>
            최저 {tempMin}° / 최고 {tempMax}°
          </Text>
        </View>
      </View>

      {comment ? (
        <Text style={[styles.comment, { color: colors.primary }]}>{comment}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: '600' },
  city: { fontSize: 12 },
  tempRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  temp: { fontSize: 36, fontWeight: '700', lineHeight: 42 },
  tempDetail: { flex: 1, gap: 2 },
  sub: { fontSize: 13 },
  comment: { fontSize: 13, fontWeight: '500', marginTop: 8 },
});
