/** Display only device-reported model measurements; never substitute example results. */
export function downloadPercent(downloaded: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(downloaded)) return null;
  return Math.max(0, Math.min(100, Math.round((Math.max(0, downloaded) / total) * 100)));
}

type TestResult = {
  success: boolean;
  title?: string;
  startAt?: number;
  repeatType?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  durationMs: number;
  message?: string;
  verifyMs?: number;
  initializeMs?: number;
  generationMs?: number;
  availableRamBeforeMb?: number;
  availableRamAfterMb?: number;
};

export function describeModelTest(result: TestResult): { headline: string; details: string } {
  const hasDuration = Number.isFinite(result.durationMs) && result.durationMs > 0;
  const duration = hasDuration ? ' · ' + Math.round(result.durationMs).toLocaleString('ko-KR') + 'ms' : '';
  const headline = (result.success ? '테스트 결과' : '테스트 실패') + duration;
  if (!result.success) {
    return { headline, details: result.message?.trim() || '모델 실행에 실패했습니다.' };
  }

  const timestamp = result.startAt;
  const hasValidDate = typeof timestamp === 'number'
    && Number.isFinite(timestamp) && timestamp > 0 && Number.isFinite(new Date(timestamp).getTime());
  const dateLabel = hasValidDate
    ? new Date(timestamp).toLocaleString('ko-KR')
    : '날짜·시간 미확인';
  const repeatLabel = result.repeatType === 'daily' ? '매일 반복'
    : result.repeatType === 'weekly' ? '매주 반복'
    : result.repeatType === 'monthly' ? '매월 반복'
    : result.repeatType === 'yearly' ? '매년 반복'
    : result.repeatType === 'none' ? '반복 없음' : '반복 확인 필요';

  return {
    headline,
    details: [result.title?.trim() || '제목 미확인', dateLabel, repeatLabel].join(' · '),
  };
}

/** Timings and device RAM snapshots are measured on-device; no peak-memory claim. */
export function describeInferenceMetrics(result: TestResult): string[] {
  const out: string[] = [];
  for (const [label, value] of [
    ['SHA-256 검사', result.verifyMs], ['모델 준비', result.initializeMs], ['응답 생성', result.generationMs],
  ] as const) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      out.push(label + ' ' + Math.round(value).toLocaleString('ko-KR') + 'ms');
    }
  }
  const before = result.availableRamBeforeMb, after = result.availableRamAfterMb;
  if (typeof before === 'number' && typeof after === 'number' && Number.isFinite(before) &&
      Number.isFinite(after) && before >= 0 && after >= 0) {
    out.push('기기 전체 여유 RAM: ' + Math.round(before).toLocaleString('ko-KR') +
      ' → ' + Math.round(after).toLocaleString('ko-KR') + 'MB (실행 전·종료 후, 최대 사용량 아님)');
  }
  return out;
}
