import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppDialog } from '@/src/components/ui/AppDialog';
import { AssistantButton, AssistantCard, AssistantTextField, assistantStyles as s } from '@/src/components/AssistantUI';
import { uiSpacing, uiTypography } from '@/src/lib/designTokens';
import { useTheme } from '@/src/contexts/ThemeContext';
import { PushOfficeNative, type AiModelInfo, type AiModelTestResult } from '@/modules/push-office-native';

function sampleInput() {
  const day = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return day.getFullYear() + '년 ' + (day.getMonth() + 1) + '월 ' + day.getDate() + '일 오후 3시 치과 예약';
}
function isReady(model: AiModelInfo) {
  return model.state === 'installed' || model.state === 'available';
}
function showProgress(model: AiModelInfo) {
  if (model.totalBytes <= 0) return 'Wi-Fi 대기';
  return Math.min(100, Math.round(100 * model.bytesDownloaded / model.totalBytes)) + '%';
}

export default function AiModelsScreen() {
  const { colors } = useTheme();
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [sample, setSample] = useState(sampleInput);
  const [results, setResults] = useState<Record<string, AiModelTestResult>>({});
  const [notice, setNotice] = useState<{title:string;message:string} | null>(null);
  const [removal, setRemoval] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      setModels(await PushOfficeNative.listAiModels());
    } catch {
      setNotice({title:'기기 AI 상태',message:'모델 목록을 확인할 수 없습니다. Android 앱을 다시 실행해 주세요.'});
    } finally { refreshing.current = false; }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    if (!models.some(model => model.state === 'downloading' || model.state === 'verifying')) return;
    const timer = setInterval(() => { void refresh(); }, 2500);
    return () => clearInterval(timer);
  }, [models,refresh]);

  const action = async (id:string, call:()=>Promise<unknown>, title:string) => {
    if(busyId) return;
    setBusyId(id);
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
    if(busyId || !sample.trim()) return;
    setBusyId(id);
    try {
      const result = await PushOfficeNative.testAiModel(id,sample);
      setResults(old=>({...old,[id]:result}));
    } catch {
      setResults(old=>({...old,[id]:{modelId:id,success:false,durationMs:0,message:'이 기기에서 모델을 실행하지 못했습니다.'}}));
    } finally { setBusyId(null); }
  };

  const compareAll = async () => {
    if(busyId || !sample.trim()) return;
    setBusyId('compare');
    try {
      for(const model of models.filter(isReady)) {
        try {
          const result=await PushOfficeNative.testAiModel(model.id,sample);
          setResults(old=>({...old,[model.id]:result}));
        } catch {
          setResults(old=>({...old,[model.id]:{modelId:model.id,success:false,durationMs:0,message:'모델 실행 실패'}}));
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
            모델 크기는 파일 용량입니다. 실제 처리 속도와 정확도는 이 기기에서 실행한 결과로 비교합니다.
            Gemini Nano는 AICore가 관리하고, 다른 모델은 Wi-Fi에서 사용자가 선택한 것만 설치됩니다.
          </Text>
          <AssistantTextField label="공통 한국어 일정 테스트 문장" value={sample}
            onChangeText={value=>{setSample(value);setResults({});}}
            placeholder="예: 내일 오후 3시 치과 예약" multiline />
          <AssistantButton label="설치된 모델 모두 비교" icon="analytics-outline" secondary
            disabled={!models.some(isReady) || Boolean(busyId) || !sample.trim()}
            busy={busyId==='compare'} onPress={()=>{void compareAll();}} />
          <Text style={[styles.caption,{color:colors.textSecondary}]}>
            실제 추출 결과·응답 시간만 표시합니다. 모델 테스트에서는 일정을 저장하지 않습니다.
          </Text>
        </AssistantCard>

        {models.length === 0 ? <Text style={[styles.copy,{color:colors.textSecondary}]}>모델 목록을 확인하고 있습니다.</Text> : null}
        {models.map(model => {
          const ready=isReady(model);
          const result=results[model.id];
          const canInstall=model.id==='gemini-nano'
            ? model.state==='downloadable' || model.state==='error'
            : model.state==='not_installed' || model.state==='error';
          return (
            <AssistantCard key={model.id} title={model.title} icon="hardware-chip-outline" compact>
              <View style={styles.heading}>
                <Text style={[styles.caption,{color:colors.textSecondary}]}>
                  {model.engine+' · '+model.license+' · '+(model.approximateMb>0?'약 '+model.approximateMb+'MB':'시스템 관리')}
                </Text>
                {model.selected && ready ? <Text style={[styles.selected,{color:colors.text}]}>기본 모델</Text> : null}
              </View>
              <Text style={[styles.copy,{color:colors.textSecondary}]}>{model.description}</Text>
              <Text style={[styles.caption,{color:colors.textSecondary}]}>
                {ready?'사용 준비됨':
                  model.state==='downloadable'?'다운로드 가능':
                  model.state==='downloading'?'다운로드 중 · '+showProgress(model):
                  model.state==='verifying'?'파일 무결성 검사 중':
                  model.state==='unavailable'?'현재 기기 사용 불가':
                  model.state==='error'?'다운로드 또는 모델 확인 오류':'설치되지 않음'}
              </Text>
              {model.message ? <Text style={[styles.caption,{color:colors.textSecondary}]}>{model.message}</Text> : null}
              {canInstall ? (
                <AssistantButton label={model.state==='error'?'모델 다운로드 재시도':'모델 다운로드'}
                  icon="download-outline" secondary disabled={Boolean(busyId)} busy={busyId===model.id}
                  onPress={()=>{void action(model.id,()=>model.id==='gemini-nano'
                    ?PushOfficeNative.downloadAiModel():PushOfficeNative.downloadAiModelById(model.id),'기기 AI 다운로드');}} />
              ) : null}
              {ready ? (
                <AssistantButton label="이 모델로 테스트" icon="flask-outline" secondary
                  disabled={Boolean(busyId)||!sample.trim()} busy={busyId===model.id}
                  onPress={()=>{void testOne(model.id);}} />
              ) : null}
              {ready && !model.selected ? (
                <AssistantButton label="기본 모델로 사용" icon="checkmark-outline"
                  disabled={Boolean(busyId)||!result?.success}
                  onPress={()=>{void action(model.id,()=>PushOfficeNative.selectAiModel(model.id),'기본 모델 변경');}} />
              ) : null}
              {model.id!=='gemini-nano' && (model.state==='installed'||model.state==='downloading'||model.state==='verifying') ? (
                <AssistantButton label={model.state==='installed'?'모델 삭제':'다운로드 중지 및 삭제'}
                  icon="trash-outline" secondary disabled={Boolean(busyId)}
                  onPress={()=>setRemoval(model.id)} />
              ) : null}
              <AssistantButton label="모델 출처·라이선스" icon="information-circle-outline" secondary
                onPress={()=>{void Linking.openURL(model.sourceUrl).catch(()=>setNotice({title:'모델 출처',message:'모델 제공 페이지를 열지 못했습니다.'}));}} />
              {result ? (
                <View style={[styles.result,{backgroundColor:colors.inputBackground}]}>
                  <Text style={[styles.selected,{color:colors.text}]}>
                    {(result.success?'테스트 결과':'테스트 실패')+' · '+result.durationMs.toLocaleString('ko-KR')+'ms'}
                  </Text>
                  <Text style={[styles.copy,{color:colors.textSecondary}]}>
                    {result.success
                      ? (result.title||'')+' · '+new Date(result.startAt||0).toLocaleString('ko-KR')+' · '+(result.repeatType||'none')
                      : result.message||'모델 실행에 실패했습니다.'}
                  </Text>
                </View>
              ) : null}
            </AssistantCard>
          );
        })}
      </ScrollView>
      <AppDialog visible={removal!==null} destructive title="기기 AI 모델 삭제"
        message="선택한 모델 파일을 기기에서 삭제합니다. 일정 데이터는 유지되며 선택된 모델은 Gemini Nano로 돌아갑니다."
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
});
