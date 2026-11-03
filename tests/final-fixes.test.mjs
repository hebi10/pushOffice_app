import test from 'node:test';
import assert from 'node:assert/strict';
import { ForegroundRequest, runForegroundRequest } from '../src/features/notifications/foregroundRequest.ts';
import { nextSchedule, nextOccurrence } from '../src/features/schedules/scheduleCodec.ts';
import { SettingsQueue, effectiveSchedulingSettings, recoverSchedulingSettings } from '../src/features/storage/settingsRecoveryPolicy.ts';
import { recoverLegacySources } from '../src/features/storage/recoveryPolicy.ts';
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => { resolve=yes; reject=no; }); return {promise,resolve,reject}; };
for (const reason of ['source', 'blur', 'background', 'unmount', 'new-request']) {
 test(`late Nano success/error/finalization is discarded after ${reason}`, async () => {
  for (const fails of [false,true]) {
   const scope=new ForegroundRequest();scope.setSource('old');scope.setActive(true);
   const pending=deferred();const effects=[];
   const running=runForegroundRequest(scope.begin(),()=>pending.promise,{result:x=>effects.push(x),error:()=>effects.push('error'),finish:()=>effects.push('finish')});
   if(reason==='source')scope.setSource('edited/deleted/next date');else if(reason==='new-request')scope.begin();else scope.setActive(false);
   if(fails)pending.reject(new Error('late'));else pending.resolve('old summary');
   await running;assert.deepEqual(effects,[]);
  }
 });
}
test('current foreground request completes normally; resume requires a fresh request', async () => {
 const scope=new ForegroundRequest();scope.setActive(true);const old=scope.begin();scope.setActive(false);scope.setActive(true);assert.equal(old(),false);
 const effects=[];await runForegroundRequest(scope.begin(),async()=> 'fresh',{result:x=>effects.push(x),error:()=>{},finish:()=>effects.push('finish')});assert.deepEqual(effects,['fresh','finish']);
});
const event={id:'future',userId:'local',type:'schedule',title:'future',startAt:Date.parse('2032-02-29T09:00:00Z'),endAt:null,isAllDay:false,repeatType:'none',notificationEnabled:false,notificationId:null,sourceText:'',createdAt:1,updatedAt:1,anchorZone:'UTC'};
test('Home next-event is independent of a one-year view, including a future leap anchor',()=>{
 const now=Date.parse('2026-11-03T00:00:00Z');assert.equal(nextSchedule([event],now).startAt,event.startAt);
 assert.equal(nextOccurrence({...event,repeatType:'yearly'},now).startAt,event.startAt);
 assert.equal(new Date(nextOccurrence({...event,repeatType:'yearly'},Date.parse('2033-03-01T00:00Z')).startAt).toISOString(),'2034-02-28T09:00:00.000Z');
 assert.equal(nextOccurrence(event,event.startAt+1),null);
});
test('settings recovery configures original owner opt-out before imports and old briefing cleanup',async()=>{
 const effects=[];let state={pending:true,uid:'original',message:''};let local={};
 await recoverLegacySources({getCloudState:async()=>state,saveCloudState:async x=>state=x,configured:()=>true,readExistingIdentity:async()=> 'original',settingsAlreadyRecovered:async()=>false,
  recoverSettings:uid=>recoverSchedulingSettings({readRemote:async()=>{assert.equal(uid,'original');return {pushEnabled:false,dailyBriefingEnabled:true,dailyBriefingTime:{hour:6,minute:15},timezone:'Asia/Seoul'};},commit:async remote=>{local={...remote,...local};effects.push(['configure',local.pushEnabled,local.dailyBriefingEnabled,local.dailyBriefingTime]);}}),
  importLocal:async()=>effects.push('local-import'),importCloud:async()=>effects.push('cloud-import'),finishCleanup:async()=>effects.push('cleanup')});
 assert.deepEqual(effects,[['configure',false,true,{hour:6,minute:15}],'local-import','cloud-import','cleanup']);assert.equal(state.pending,false);
});
test('local choice made during delayed settings fetch wins, without racing serialized writes',async()=>{
 const queue=new SettingsQueue();const remote=deferred();let local={dailyBriefingEnabled:false};let configured;
 const recovery=recoverSchedulingSettings({readRemote:()=>remote.promise,commit:value=>queue.run(async()=>{local={...value,...local};configured=local;})});
 await queue.run(async()=>{local={...local,pushEnabled:true};});
 remote.resolve({pushEnabled:false,dailyBriefingEnabled:true,dailyBriefingTime:{hour:7,minute:30}});await recovery;
 assert.equal(configured.pushEnabled,true);assert.equal(configured.dailyBriefingEnabled,false);assert.deepEqual(configured.dailyBriefingTime,{hour:7,minute:30});
});
test('failed or malformed owner settings remain pending: no import, notification opt-in or old daily cleanup',async()=>{
 for(const failure of ['offline','malformed']) {
  let state={pending:true,uid:'original',message:''};const effects=[];
  await recoverLegacySources({getCloudState:async()=>state,saveCloudState:async x=>state=x,configured:()=>true,readExistingIdentity:async()=> 'original',settingsAlreadyRecovered:async()=>false,
   recoverSettings:()=>recoverSchedulingSettings({readRemote:async()=>{if(failure==='offline')throw new Error('offline');return {};},commit:async()=>effects.push('configure')}),
   importLocal:async()=>effects.push('import'),importCloud:async()=>effects.push('cloud'),finishCleanup:async()=>effects.push('cleanup')});
  assert.equal(state.pending,true);assert.deepEqual(effects,[]);
  assert.equal(effectiveSchedulingSettings({},true,'UTC').pushEnabled,false);
  assert.equal(effectiveSchedulingSettings({pushEnabled:true},true,'UTC').pushEnabled,true);
 }
});
test('an earlier schedule-import marker cannot retire old briefing until owner settings recover',async()=>{
 let state={pending:true,uid:'original',message:''};let cleanup=false;
 await recoverLegacySources({getCloudState:async()=>state,saveCloudState:async x=>state=x,configured:()=>false,settingsAlreadyRecovered:async()=>false,cloudAlreadyImported:async()=>true,readExistingIdentity:async()=>{throw new Error('unexpected');},importLocal:async()=>{},importCloud:async()=>{cleanup=true;},finishCleanup:async()=>{cleanup=true;}});
 assert.equal(state.pending,true);assert.equal(cleanup,false);
});
