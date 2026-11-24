import { useWindowDimensions } from 'react-native';
import { adaptiveLayout } from './adaptiveLayout';

export function useAdaptiveLayout() {
  const {width,fontScale} = useWindowDimensions();
  return adaptiveLayout(width,fontScale);
}
