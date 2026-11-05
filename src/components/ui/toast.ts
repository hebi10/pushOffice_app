import { Alert, Platform, ToastAndroid } from 'react-native';

export type DialogNotice = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm?: () => void;
};

let dialogListener: ((notice: DialogNotice) => void) | null = null;

export function subscribeDialog(listener: (notice: DialogNotice) => void): () => void {
  dialogListener = listener;
  return () => {
    if (dialogListener === listener) dialogListener = null;
  };
}

function presentDialog(notice: DialogNotice): void {
  if (dialogListener) {
    dialogListener(notice);
    return;
  }
  Alert.alert(notice.title, notice.message, notice.onConfirm
    ? [{ text: '취소', style: 'cancel' }, { text: notice.confirmLabel ?? '확인', onPress: notice.onConfirm }]
    : [{ text: '확인' }]);
}

export function showToast(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('알림', message);
  }
}

export function showError(error: unknown, fallback = '오류가 발생했습니다.'): void {
  presentDialog({
    title: '오류',
    message: error instanceof Error ? error.message : fallback,
  });
}

export function confirmAction(title: string, message: string, onConfirm: () => void): void {
  presentDialog({ title, message, confirmLabel: '확인', onConfirm });
}
