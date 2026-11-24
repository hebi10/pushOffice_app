import type { ScheduleConflict } from '../../../modules/push-office-native';
import { dayjs } from '../../lib/time';

export function describeScheduleConflicts(hits: ScheduleConflict[], repeating: boolean): string {
  return hits.slice(0,8).map(hit => dayjs(hit.startAt).format('YYYY-MM-DD HH:mm') + ' · ' + hit.title).join('\n')
    + '\n\n최대 8건 표시. ' + (repeating ? '반복 일정은 첫 예정 회차부터 30일 범위를 확인합니다. ' : '')
    + '종료 미지정 일정은 시작 시각만 비교합니다. 겹침 안내는 확인 시점 기준이며 자동으로 일정을 변경하지 않습니다.';
}
