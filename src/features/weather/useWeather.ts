import { useQuery } from '@tanstack/react-query';
import type { WeatherData } from '../../types';
import { fetchWeather } from './weatherService';

export function useWeather(enabled = false) {
  return useQuery<WeatherData>({
    queryKey: ['weather'],
    enabled,
    queryFn: () => fetchWeather(),
    staleTime: 30 * 60 * 1000, // 30분
    retry: 1,
  });
}
