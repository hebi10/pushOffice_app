/**
 * 주식 카드 – 종목별 가격 + 등락률
 */
import { useTheme } from '@/src/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../Card';

interface StockItem {
  symbol: string;
  price: string;
  changePercent: string;
}

interface Props {
  items: StockItem[];
}

function parseChange(raw: string): { value: number; display: string } {
  const cleaned = raw.replace('%', '').trim();
  const value = parseFloat(cleaned) || 0;
  const sign = value > 0 ? '+' : '';
  return { value, display: `${sign}${value.toFixed(2)}%` };
}

export function BriefingStockCard({ items }: Props) {
  const { colors } = useTheme();

  if (!items.length) return null;

  return (
    <Card>
      <Text style={[styles.label, { color: colors.textSecondary }]}>주식</Text>

      {items.map((item, idx) => {
        const change = parseChange(item.changePercent);
        const changeColor =
          change.value > 0 ? colors.danger : change.value < 0 ? '#2196F3' : colors.textSecondary;

        return (
          <View
            key={idx}
            style={[
              styles.row,
              idx < items.length - 1
                ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }
                : undefined,
            ]}
          >
            <Text style={[styles.symbol, { color: colors.text }]}>{item.symbol}</Text>
            <View style={styles.right}>
              <Text style={[styles.price, { color: colors.text }]}>${item.price}</Text>
              <Text style={[styles.change, { color: changeColor }]}>{change.display}</Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  symbol: { fontSize: 14, fontWeight: '600' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { fontSize: 14 },
  change: { fontSize: 13, fontWeight: '600', minWidth: 70, textAlign: 'right' },
});
