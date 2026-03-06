/**
 * 날씨 API 서비스 (OpenWeather)
 */
import { ENV } from '../../lib/env';
import type { WeatherData } from '../../types';

/** OpenWeather API의 영문 도시명 → 한국어 매핑 */
const CITY_KR: Record<string, string> = {
  'Seoul': '서울',
  'Busan': '부산',
  'Daegu': '대구',
  'Incheon': '인천',
  'Gwangju': '광주',
  'Daejeon': '대전',
  'Ulsan': '울산',
  'Sejong': '세종',
  'Jeju': '제주',
  'Suwon': '수원',
  'Changwon': '창원',
  'Goyang': '고양',
  'Yongin': '용인',
  'Seongnam': '성남',
};

export async function fetchWeather(lat?: number, lon?: number): Promise<WeatherData> {
  // 기본 서울 좌표
  const latitude = lat ?? 37.5665;
  const longitude = lon ?? 126.978;

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&lang=ko&appid=${ENV.OPENWEATHER_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('날씨 정보를 불러올 수 없습니다.');
  }

  const data = await response.json();
  const rawCity = data.name ?? '서울';
  const city = CITY_KR[rawCity] ?? rawCity;

  return {
    temp: Math.round(data.main.temp),
    tempMin: Math.round(data.main.temp_min ?? data.main.temp),
    tempMax: Math.round(data.main.temp_max ?? data.main.temp),
    feelsLike: Math.round(data.main.feels_like ?? data.main.temp),
    description: data.weather?.[0]?.description ?? '',
    icon: data.weather?.[0]?.icon ?? '01d',
    city,
  };
}
