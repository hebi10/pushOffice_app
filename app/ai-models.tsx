import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppDialog } from '@/src/components/ui/AppDialog';
import { AssistantButton, AssistantCard, AssistantTextField, assistantStyles as s } from '@/src/components/AssistantUI';
import { uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';
import { describeModelTest, downloadPercent } from '@/src/features/ai/modelPresentation';
import { useTheme } from '@/src/contexts/ThemeContext';
import { PushOfficeNative, type AiModelInfo, type AiModelTestResult } from '@/modules/push-office-native';

function sampleInput() {
  const day = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return day.getFullYear() + '년 ' + (day.getMonth() + 1) + '월 ' + day.getDate() + '일 오후 3시 치과 예약';
}
function isReady(model: AiModelInfo) {
  return model.state === 'installed' || model.state === 'available';
}
function modelStatus(model: AiModelInfo) {
  if (isReady(model)) return '사용 준비됨';
  if (model.state === 'downloadable') return '설치 가능';
  if (model.state==='downloading') return '다운로드 중 · ' + showProgress(model);
  if (model.state === 'verifying') return '무결성 검사 중';
  if (model.state === 'unavailable') return '기기 미지원';
  if (model.state === 'error') return '오류 · 재시도 필요';
  return '설치 전';
}
function showProgress(model: AiModelInfo) {
  const percent = downloadPercent(model.bytesDownloaded, model.totalBytes);
  return percent === null ? '진행률 확인 중' : percent + '%';
}

export default function AiModelsScreen() {
  const { colors } = useTheme();
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sample, setSample] = useState(sampleInput);
  const [results, setResults] = useState<Record<string, AiModelTestResult>>({});
  const [notice, setNotice] = useState<{title:string;message:string} | null>(null);
  const [removal, setRemoval] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const sampleRevision = useRef(0);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const next = await PushOfficeNative.listAiModels();
      setModels(next);
      setResults(previous => {
        const readyIds = new Set(next.filter(isReady).map(model => model.id));
        return Object.fromEntries(Object.entries(previous).filter(([id]) => readyIds.has(id)));
      });
      setListState('ready');
    } catch {
      setListState('error');
    } finally { refreshing.current = false; }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    if (!models.some(model => model.state === 'downloading' || model.state === 'verifying')) return;
    const timer = setInterval(() => { void refresh(); }, 2500);
    return () => clearInterval(timer);
  }, [models,refresh]);

  const action = async (id:string, call:()=>Promise<unknown>, title:string) => {
    if(busyId || listState !== 'ready') return;
    setBusyId(id);
    setResults(previous => {
      if (!(id in previous)) return previous;
      const next = {...previous};
      delete next[id];
      return next;
    });
    try {
      const result = await call();
      if(result && typeof result === 'object' && 'message' in result) {
        const message = (result as {message?:unknown}).message;
        if (typeof message === 'string' && message) setNotice({title,message});
      }
      await refresh();
    } catch {
      setNotice({title,message:'현재 기기 지원 상태, 네트워크 또는 저장 공간을 확인한 후 다시 시도해 주세요.'});
    } finally { setBusyId(null); }
  };

  const testOne = async (id:string) => {
    if(busyId || listState !== 'ready' || !sample.trim()) return;
    const revision = sampleRevision.current;
    const input = sample.trim();
    setBusyId(id);
    try {
      const result = await PushOfficeNative.testAiModel(id,input);
      if (revision === sampleRevision.current) setResults(old=>({...old,[id]:result}));
    } catch {
      if (revision === sampleRevision.current) setResults(old=>({...old,[id]:{modelId:id,success:false,durationMs:0,message:'이 기기에서 모델을 실행하지 못했습니다.'}}));
    } finally { setBusyId(null); }
  };

  const compareAll = async () => {
    if(busyId || listState !== 'ready' || !sample.trim()) return;
    const revision = sampleRevision.current;
    const input = sample.trim();
    setBusyId('compare');
    try {
      for(const model of models.filter(isReady)) {
        if (revision !== sampleRevision.current) break;
        try {
          const result=await PushOfficeNative.testAiModel(model.id,input);
          if (revision === sampleRevision.current) setResults(old=>({...old,[model.id]:result}));
        } catch {
          if (revision === sampleRevision.current) setResults(old=>({...old,[model.id]:{modelId:model.id,success:false,durationMs:0,message:'모델 실행 실패'}}));
        }
      }
    } finally { setBusyId(null); }
  };

  const remove = async () => {
    const id=removal;
    setRemoval(null);
    if(id) await action(id,()=>PushOfficeNative.removeAiModel(id),'모델 삭제');
  };

  return (
    <>
      <ScrollView style={{flex:1,backgroundColor:colors.background}} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <AssistantCard title="기기 AI 모델 비교" icon="layers-outline" compact>
          <Text style={[styles.copy,{color:colors.textSecondary}]}>
            Gemini Nano는 Android AICore가 관리합니다. 다른 4종은 사용자가 Wi-Fi에서 직접 설치합니다.
            파일 크기는 예상 용량이며 실제 테스트 속도는 이 기기에서 측정한 값만 표시합니다.
          </Text>
          <Text style={[styles.caption,{color:colors.textSecondary}]}>
            {listState === 'ready' ? `사용 준비된 모델 ${models.filter(isReady).length} / ${models.length}종` : listState === 'loading' ? '모델 상태 확인 중' : '모델 상태 조회 실패 · 이전 결과일 수 있음'}
          </Text>
          {listState === 'error' ? (
            <AssistantButton label="모델 목록 다시 확인" icon="refresh-outline" secondary onPress={()=>{void refresh();}} />
          ) : null}
          <AssistantTextField label="공통 한국어 일정 테스트 문장" value={sample}
            onChangeText={value=>{sampleRevision.current += 1;setSample(value);setResults({});}}
            placeholder="예: 내일 오후 3시 치과 예약" multiline />
          <AssistantButton label="사용 준비된 모델 모두 비교" icon="analytics-outline" secondary
            disabled={listState !== 'ready' || !models.some(isReady) || Boolean(busyId) || !sample.trim()}
            busy={busyId==='compare'} onPress={()=>{void compareAll();}} />
          <Text style={[styles.caption,{color:colors.textSecondary}]}>
            실제 추출 결과·응답 시간만 표시합니다. 모델 테스트에서는 일정을 저장하지 않습니다.
          </Text>
        </AssistantCard>

        {models.length === 0 && listState === 'loading' ? (
          <Text style={[styles.copy,{color:colors.textSecondary}]}>모델 목록을 확인하고 있습니다.</Text>
        ) : null}
        {models.length === 0 && listState === 'ready' ? (
          <Text style={[styles.copy,{color:colors.textSecondary}]}>표시할 모델이 없습니다. 기기 지원 상태를 다시 확인해 주세요.</Text>
        ) : null}
        {models.map(model => {
          const ready=isReady(model);
          const result=results[model.id];
          const progress=downloadPercent(model.bytesDownloaded, model.totalBytes);
          const canInstall=model.id==='gemini-nano'
            ? model.state==='downloadable' || model.state==='error'
            : model.state==='not_installed' || model.state==='error';
          return (
            <AssistantCard key={model.id} title={model.title} icon="hardware-chip-outline" compact>
              <View style={styles.heading}>
                <Text style={[styles.caption,{color:colors.textSecondary}]}>
                  {model.engine+' · '+(model.approximateMb>0?'약 '+model.approximateMb+'MB':'시스템 관리')}
                </Text>
                {model.selected && ready ? <Text style={[styles.selected,{color:colors.text}]}>기본 모델</Text> : null}
              </View>
              <View
                style={[styles.statusRow,{backgroundColor:colors.inputBackground}]}
                accessible
                accessibilityLabel={'모델 상태: '+modelStatus(model)}
              >
                <Text style={[styles.statusText,{color:model.state==='error'?colors.danger:colors.text}]}>{modelStatus(model)}</Text>
                {model.selected && ready ? <Text style={[styles.caption,{color:colors.textSecondary}]}>기본 선택됨</Text> : null}
              </View>
              {model.state==='downloading' && progress !== null ? (
                <View style={styles.progressGroup}>
                  <View
                    style={[styles.progressTrack,{backgroundColor:colors.surfaceBorder}]}
                    accessible
                    accessibilityRole="progressbar"
                    accessibilityLabel={model.title+' 다운로드 진행률'}
                    accessibilityValue={{min:0,max:100,now:progress}}
                  >
                    <View style={[styles.progressFill,{width:(progress+'%') as `${number}%`,backgroundColor:colors.primary}]} />
                  </View>
                  <Text style={[styles.caption,{color:colors.textSecondary}]}>
                    {Math.max(0,model.bytesDownloaded / 1048576).toFixed(1)+' / '+(model.totalBytes / 1048576).toFixed(1)+' MB'}
                  </Text>
                </View>
              ) : null}
              {(model.state==='error' || model.state==='unavailable' || model.state==='downloading' || model.state==='verifying') && model.message ? (
                <Text style={[styles.caption,{color:colors.textSecondary}]}>{model.message}</Text>
              ) : null}
              {canInstall ? (
                <AssistantButton label={model.state==='error'?'모델 다운로드 재시도':'모델 다운로드'}
                  icon="download-outline" secondary disabled={Boolean(busyId) || listState !== 'ready'} busy={busyId===model.id}
                  onPress={()=>{void action(model.id,()=>model.id==='gemini-nano'
                    ?PushOfficeNative.downloadAiModel():PushOfficeNative.downloadAiModelById(model.id),'기기 AI 다운로드');}} />
              ) : null}
              {model.id !== 'gemini-nano' && model.state === 'installed' ? (
                <AssistantButton label="파일 SHA-256 무결성 검사" icon="shield-checkmark-outline" secondary
                  disabled={Boolean(busyId) || listState !== 'ready'} busy={busyId === model.id}
                  onPress={() => { void action(model.id, () => PushOfficeNative.verifyAiModel(model.id), '파일 무결성 검사'); }} />
              ) : null}
              {ready ? (
                <AssistantButton label="이 모델로 테스트" icon="flask-outline" secondary
                  disabled={Boolean(busyId)||listState !== 'ready'||!sample.trim()} busy={busyId===model.id}
                  onPress={()=>{void testOne(model.id);}} />
              ) : null}
              {result ? (
                <View style={[styles.result,{backgroundColor:colors.inputBackground}]} accessibilityRole="summary">
                  <Text style={[styles.selected,{color:result.success?colors.text:colors.danger}]}>
                    {describeModelTest(result).headline}
                  </Text>
                  <Text style={[styles.copy,{color:colors.textSecondary}]}>
                    {describeModelTest(result).details}
                  </Text>
                </View>
              ) : ready ? (
                <Text style={[styles.caption,{color:colors.textSecondary}]}>테스트 전 · 모델 선택 전 테스트 결과를 확인해 주세요.</Text>
              ) : null}
              {ready && !model.selected ? (
                <AssistantButton label="기본 모델로 사용" icon="checkmark-outline"
                  disabled={Boolean(busyId)||listState !== 'ready'||!result?.success}
                  onPress={()=>{void action(model.id,()=>PushOfficeNative.selectAiModel(model.id),'기본 모델 변경');}} />
              ) : null}
              {model.id!=='gemini-nano' && (model.state==='installed'||model.state==='downloading'||model.state==='verifying'||model.state==='error') ? (
                <AssistantButton label={model.state==='installed'?'모델 삭제':model.state==='error'?'오류 모델 데이터 삭제':'다운로드 중지 및 삭제'}
                  icon="trash-outline" secondary disabled={Boolean(busyId) || listState !== 'ready'}
                  onPress={()=>setRemoval(model.id)} />
              ) : null}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={model.title+' 상세 정보 '+(expandedIds.includes(model.id)?'접기':'펼치기')}
                accessibilityState={{expanded:expandedIds.includes(model.id)}}
                onPress={()=>setExpandedIds(old=>old.includes(model.id)?old.filter(id=>id!==model.id):[...old,model.id])}
                style={styles.detailsToggle}
              >
                <Text style={[styles.caption,{color:colors.textSecondary}]}>{expandedIds.includes(model.id)?'상세 정보 접기':'설명·라이선스 보기'}</Text>
              </TouchableOpacity>
              {expandedIds.includes(model.id) ? (
                <View style={styles.details}>
                  <Text style={[styles.copy,{color:colors.textSecondary}]}>{model.description}</Text>
                  <Text style={[styles.caption,{color:colors.textSecondary}]}>{'라이선스: '+model.license}</Text>
                  <AssistantButton label="모델 출처·라이선스" icon="information-circle-outline" secondary
                    onPress={()=>{void Linking.openURL(model.sourceUrl).catch(()=>setNotice({title:'모델 출처',message:'모델 제공 페이지를 열지 못했습니다.'}));}} />
                </View>
              ) : null}
            </AssistantCard>
          );
        })}
      </ScrollView>
      <AppDialog visible={removal!==null} destructive title="기기 AI 모델 삭제"
        message="선택한 모델 파일을 기기에서 삭제합니다. 일정 데이터는 유지됩니다. 기본 선택 모델을 삭제하면 Gemini Nano로 돌아가며, Nano 미지원 기기에서는 텍스트 입력을 이용해 주세요."
        confirmLabel="모델 삭제" onDismiss={()=>setRemoval(null)} onConfirm={()=>{void remove();}} />
      <AppDialog visible={notice!==null} title={notice?.title??''}
        message={notice?.message??''} showCancel={false}
        onDismiss={()=>setNotice(null)} onConfirm={()=>setNotice(null)} />
    </>
  );
}

const styles=StyleSheet.create({
  heading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:uiSpacing.sm},
  selected:{...uiTypography.caption,fontWeight:'700'},
  copy:{...uiTypography.body},
  caption:{...uiTypography.caption},
  result:{padding:uiSpacing.sm,gap:uiSpacing.xs},
  progressGroup:{gap:uiSpacing.xxs,paddingHorizontal:uiSpacing.xxs},
  progressTrack:{height:6,width:'100%',overflow:'hidden'},
  progressFill:{height:'100%'},
  statusRow:{minHeight:uiSizes.touchMinHeight,flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:uiSpacing.xs,paddingHorizontal:uiSpacing.sm,paddingVertical:uiSpacing.xs},
  statusText:{...uiTypography.body,fontWeight:'700'},
  detailsToggle:{minHeight:uiSizes.touchMinHeight,justifyContent:'center',paddingHorizontal:uiSpacing.xs},
  details:{gap:uiSpacing.xs},
});
