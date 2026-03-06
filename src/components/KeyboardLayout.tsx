/**
 * KeyboardLayout – 키보드 대응 공통 레이아웃
 *
 * 키보드가 올라올 때 입력 영역이 가려지지 않도록 처리합니다.
 * - iOS: KeyboardAvoidingView (behavior='padding') + 탭바 높이 보정
 * - Android: windowSoftInputMode='adjustResize'가 기본이므로 height behavior 적용
 * - Web: 별도 처리 없이 children만 렌더링
 */
import React from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface KeyboardLayoutProps {
  children: React.ReactNode;
  /** 탭 화면 내부에서 사용할 경우 true (탭바 높이만큼 offset 보정) */
  insideTab?: boolean;
  /** iOS에서의 추가 offset (헤더 높이 등) */
  extraOffset?: number;
  style?: ViewStyle;
}

const TAB_BAR_BASE_HEIGHT = 60;

export function KeyboardLayout({
  children,
  insideTab = false,
  extraOffset = 0,
  style,
}: KeyboardLayoutProps) {
  const insets = useSafeAreaInsets();

  // 웹에서는 KeyboardAvoidingView 불필요 – children만 렌더
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }

  // 탭 안에서는 탭바 높이를 offset에 포함
  const tabOffset = insideTab ? TAB_BAR_BASE_HEIGHT + insets.bottom : 0;
  const totalOffset = tabOffset + extraOffset;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? totalOffset : 0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
