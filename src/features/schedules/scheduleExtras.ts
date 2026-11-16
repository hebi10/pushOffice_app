/** Optional fields travel with schedule records; no service receives these values implicitly. */
export interface ScheduleExtrasInput {
  location?: string | null;
  meetingUrl?: string | null;
  notes?: string | null;
}

const trim = (value: string | null | undefined) => value?.trim() || null;

/** A meeting URL must be a user-chosen HTTPS URL without embedded credentials. */
export function isSafeMeetingUrl(value: string | null | undefined): boolean {
  const text = trim(value);
  if (!text) return true;
  if (text.length > 2048 || /\s/.test(text)) return false;
  try {
    const parsed = new URL(text);
    return parsed.protocol.toLowerCase() === 'https:' && !!parsed.hostname
      && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function normalizeScheduleExtras(input: ScheduleExtrasInput) {
  const location = trim(input.location);
  const meetingUrl = trim(input.meetingUrl);
  const notes = trim(input.notes);
  if (location && (location.length > 160 || /[\r\n\x00-\x1f\x7f]/.test(location))) {
    throw new Error('장소는 줄바꿈 없이 160자 이내로 입력해 주세요.');
  }
  if (!isSafeMeetingUrl(meetingUrl)) {
    throw new Error('회의 링크는 계정 정보가 없는 HTTPS 주소로 입력해 주세요.');
  }
  if (notes && (notes.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(notes))) {
    throw new Error('메모는 2000자 이내로 입력해 주세요.');
  }
  return { location, meetingUrl, notes };
}
