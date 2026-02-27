/**
 * 날씨 API 서비스 (OpenWeather)
 */
import { ENV } from '../../lib/env';
import type { WeatherData } from '../../types';

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
  return {
    temp: Math.round(data.main.temp),
    description: data.weather?.[0]?.description ?? '',
    icon: data.weather?.[0]?.icon ?? '01d',
    city: data.name ?? '서울',
  };
}
