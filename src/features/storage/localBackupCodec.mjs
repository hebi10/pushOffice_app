const FORMAT = 'pushoffice-local-backup';
const PACKAGE = 'com.hebi96.pushOffice_app';
const VERSION = 1;
export const MAX_LOCAL_BACKUP_LENGTH = 8 * 1024 * 1024;

function valid(condition, message) {
  if (!condition) throw new Error(message);
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function limitedText(value, max = 1024, allowEmpty = true) {
  return typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
}

function integerTime(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 253402300799999;
}

function timezone(value) {
  valid(limitedText(value, 100, false), '백업의 시간대가 올바르지 않습니다.');
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
  } catch {
    throw new Error('백업의 시간대가 올바르지 않습니다.');
  }
  return value;
}

function textList(value, limit, maxLength) {
  valid(Array.isArray(value) && value.length <= limit &&
    value.every(item => limitedText(item, maxLength)), '백업의 목록 설정이 올바르지 않습니다.');
  return [...value];
}

function normalizeSettings(value) {
  valid(plain(value), '백업의 설정 정보가 올바르지 않습니다.');
  const t = value.dailyBriefingTime;
  const d = value.digestTypes;
  valid(typeof value.pushEnabled === 'boolean' &&
    typeof value.dailyBriefingEnabled === 'boolean' &&
    plain(t) && Number.isInteger(t.hour) && t.hour >= 0 && t.hour <= 23 &&
    Number.isInteger(t.minute) && t.minute >= 0 && t.minute <= 59,
  '백업의 알림 설정이 올바르지 않습니다.');
  valid(plain(d) && ['weather', 'stocks', 'news'].every(k => typeof d[k] === 'boolean'),
    '백업의 브리핑 설정이 올바르지 않습니다.');
  valid(limitedText(value.digestCity, 200) &&
    limitedText(value.newsLanguage, 20, false) &&
    ['system', 'light', 'dark'].includes(value.themeMode) &&
    ['pretendard', 'noto-sans', 'nanum-gothic', 'nanum-myeongjo'].includes(value.fontFamily),
  '백업의 화면 설정이 올바르지 않습니다.');
  let weatherRegion = null;
  if (value.weatherRegion !== null && value.weatherRegion !== undefined) {
    valid(plain(value.weatherRegion) &&
      limitedText(value.weatherRegion.sido, 80, false) &&
      limitedText(value.weatherRegion.gugun, 80) &&
      (value.weatherRegion.dong === undefined || limitedText(value.weatherRegion.dong, 80)),
    '백업의 날씨 지역 설정이 올바르지 않습니다.');
    weatherRegion = {
      sido: value.weatherRegion.sido,
      gugun: value.weatherRegion.gugun,
      ...(value.weatherRegion.dong === undefined ? {} : { dong: value.weatherRegion.dong }),
    };
  }
  return {
    timezone: timezone(value.timezone),
    pushEnabled: value.pushEnabled,
    dailyBriefingEnabled: value.dailyBriefingEnabled,
    dailyBriefingTime: { hour: t.hour, minute: t.minute },
    digestTypes: { weather: d.weather, stocks: d.stocks, news: d.news },
    digestCity: value.digestCity,
    weatherRegion,
    stockTickers: textList(value.stockTickers, 20, 80),
    newsLanguage: value.newsLanguage,
    newsKeywords: textList(value.newsKeywords, 50, 150),
    newsCategories: textList(value.newsCategories, 50, 100),
    themeMode: value.themeMode,
    fontFamily: value.fontFamily,
  };
}

function optionalScheduleExtra(value, field, max) {
  if (value === undefined) return undefined;
  valid(value === null || typeof value === 'string' && value.length <= max,
    '백업의 ' + field + ' 항목이 올바르지 않습니다.');
  if (value === null) return null;
  const cleaned = value.trim();
  if (field === 'location') {
    valid(!/[\r\n\x00-\x1f\x7f]/.test(cleaned), '백업의 장소에 잘못된 문자가 있습니다.');
  } else if (field === 'notes') {
    valid(!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(cleaned), '백업의 메모에 잘못된 문자가 있습니다.');
  } else if (field === 'meetingUrl' && cleaned) {
    let safe = false;
    try {
      const uri = new URL(cleaned);
      safe = uri.protocol.toLowerCase() === 'https:' && !!uri.hostname &&
        !uri.username && !uri.password && !/\s/.test(cleaned);
    } catch {}
    valid(safe, '백업의 회의 링크가 올바르지 않습니다.');
  }
  return cleaned || null;
}

function normalizeSchedule(value) {
  valid(plain(value) && limitedText(value.id, 200, false) &&
    limitedText(value.userId, 200, false) && limitedText(value.type, 40, false) &&
    limitedText(value.title, 1000, false) &&
    integerTime(value.startAt) && integerTime(value.createdAt) && integerTime(value.updatedAt) &&
    (value.endAt === null || (integerTime(value.endAt) && value.endAt >= value.startAt)) &&
    typeof value.isAllDay === 'boolean' &&
    ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(value.repeatType) &&
    typeof value.notificationEnabled === 'boolean' &&
    (value.notificationId === null || limitedText(value.notificationId, 256)) &&
    limitedText(value.sourceText, 12000),
  '백업의 일정 데이터가 올바르지 않습니다.');
  if (value.anchorZone !== undefined && value.anchorZone !== null) timezone(value.anchorZone);
  const extras = {
    ...(value.location === undefined ? {} : { location: optionalScheduleExtra(value.location, 'location', 160) }),
    ...(value.meetingUrl === undefined ? {} : { meetingUrl: optionalScheduleExtra(value.meetingUrl, 'meetingUrl', 2048) }),
    ...(value.notes === undefined ? {} : { notes: optionalScheduleExtra(value.notes, 'notes', 2000) }),
  };
  return {
    id: value.id, userId: value.userId, type: value.type, title: value.title,
    startAt: value.startAt, endAt: value.endAt, isAllDay: value.isAllDay,
    repeatType: value.repeatType, notificationEnabled: value.notificationEnabled,
    notificationId: value.notificationId, sourceText: value.sourceText,
    createdAt: value.createdAt, updatedAt: value.updatedAt,
    ...(value.anchorZone === undefined ? {} : { anchorZone: value.anchorZone }),
    ...extras,
  };
}

function normalizePayload(payload) {
  valid(plain(payload) && payload.packageName === PACKAGE && payload.version === VERSION &&
    limitedText(payload.exportedAt, 40, false) &&
    !Number.isNaN(Date.parse(payload.exportedAt)) &&
    Array.isArray(payload.schedules) && payload.schedules.length <= 10000,
  'Push Office 백업 파일 형식이나 버전이 올바르지 않습니다.');
  const schedules = payload.schedules.map(normalizeSchedule);
  const ids = new Set(schedules.map(item => item.id));
  valid(ids.size === schedules.length, '백업에 중복된 일정 ID가 있습니다.');
  return {
    packageName: PACKAGE, version: VERSION, exportedAt: payload.exportedAt,
    schedules, settings: normalizeSettings(payload.settings),
  };
}

/** A checksum detects accidental damage; it is not a signature or encryption. */
export async function createLocalBackup(schedules, settings, hash, now = new Date()) {
  valid(typeof hash === 'function', '백업 무결성 기능을 사용할 수 없습니다.');
  const payload = normalizePayload({
    packageName: PACKAGE, version: VERSION, exportedAt: now.toISOString(),
    schedules, settings,
  });
  const sha256 = await hash(JSON.stringify(payload));
  valid(/^[0-9a-f]{64}$/.test(sha256), '백업 무결성 정보를 생성하지 못했습니다.');
  const result = JSON.stringify({ format: FORMAT, sha256, payload }, null, 2);
  valid(result.length <= MAX_LOCAL_BACKUP_LENGTH, '백업 파일이 너무 큽니다.');
  return result;
}

export async function parseLocalBackup(text, hash) {
  valid(typeof text === 'string' && text.length <= MAX_LOCAL_BACKUP_LENGTH,
    '백업 파일이 너무 크거나 올바르지 않습니다.');
  valid(typeof hash === 'function', '백업 무결성 기능을 사용할 수 없습니다.');
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error('백업 JSON 파일을 읽을 수 없습니다.');
  }
  valid(plain(document) && document.format === FORMAT && /^[0-9a-f]{64}$/.test(document.sha256) &&
    plain(document.payload), 'Push Office 백업 파일이 아닙니다.');
  const expected = await hash(JSON.stringify(document.payload));
  valid(expected === document.sha256, '백업 파일이 손상되었거나 내용이 변경되었습니다.');
  return normalizePayload(document.payload);
}
