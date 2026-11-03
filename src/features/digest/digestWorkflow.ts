import type { DigestDoc, ScheduleDoc } from '../../types';
import type { GenerateDigestInput } from './digestService';
type DigestResult = Pick<DigestDoc, 'title' | 'summary' | 'contentMarkdown' | 'sources'> & Partial<Pick<DigestDoc, 'weatherData' | 'newsData' | 'stockData' | 'aiBriefing'>>;
/** The only persistence dependency is local. Pending recovery state cannot select another destination. */
export async function generateWithLocalStore(input: GenerateDigestInput, force: boolean, deps: {
  localStore: {getByDate(owner: string, date: string): Promise<DigestDoc | null>; save(digest: DigestDoc): Promise<string>};
  getSchedules(owner: string, start: Date, end: Date): Promise<Pick<ScheduleDoc, 'title'>[]>;
  external(input: GenerateDigestInput): Promise<DigestResult>;
}): Promise<DigestDoc> {
  if (!force && input.allowExternal) {
    const existing = await deps.localStore.getByDate(input.ownerId, input.dateKey);
    if (existing && existing.types.weather === input.types.weather && existing.types.news === input.types.news && existing.types.stocks === input.types.stocks && existing.sources.length) return existing;
  }
  let result: DigestResult;
  if (input.allowExternal) {
    result = await deps.external(input);
  } else {
    const start = new Date(`${input.dateKey}T00:00:00`);
    const end = new Date(start); end.setHours(23, 59, 59, 999);
    const schedules = await deps.getSchedules(input.ownerId, start, end);
    const summary = schedules.length ? `오늘 일정 ${schedules.length}개: ${schedules.map(s => s.title).join(', ')}` : '오늘 등록된 일정이 없습니다.';
    result = {title:'오늘의 로컬 브리핑',summary,contentMarkdown:summary,sources:[]};
  }
  const digest: DigestDoc = {...result,ownerType:input.ownerType,ownerId:input.ownerId,dateKey:input.dateKey,types:input.types,weatherData:result.weatherData??null,newsData:result.newsData??null,stockData:result.stockData??null,aiBriefing:result.aiBriefing??'',createdAt:Date.now(),updatedAt:Date.now()};
  return {...digest,id:await deps.localStore.save(digest)};
}
