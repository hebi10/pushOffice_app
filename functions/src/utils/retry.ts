/**
 * API 호출 재시도 유틸리티
 * - 최대 3회 재시도
 * - 지수 백오프 적용
 */
import * as logger from "firebase-functions/logger";
import { MAX_RETRIES } from "../config.js";

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  retries: number = MAX_RETRIES,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(`[${label}] 시도 ${attempt}/${retries} 실패: ${lastError.message}`);

      if (attempt < retries) {
        // 지수 백오프: 1초, 2초, 4초 ...
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastError!;
}
