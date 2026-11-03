import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWithLocalStore} from '../src/features/digest/digestWorkflow.ts';

test('a local briefing with pending Firebase recovery persists titles only to local storage',async()=>{
 const local=[];let requests=0;
 const input={ownerType:'device',ownerId:'device',dateKey:'2026-11-03',timezone:'Asia/Seoul',types:{weather:false,news:false,stocks:false}};
 const deps={localStore:{getByDate:async()=>null,save:async doc=>{local.push(doc);return 'local-digest';}},getSchedules:async()=>[{title:'기밀 로컬 회의'}],external:async()=>{requests++;throw new Error('must not transmit');}};
 const result=await generateWithLocalStore(input,false,deps);
 assert.match(result.summary,/기밀 로컬 회의/);assert.equal(result.id,'local-digest');assert.equal(local.length,1);assert.equal(requests,0);
});
test('explicit external request still persists response locally and propagates network failure without cloud fallback',async()=>{
 let saves=0;const input={ownerType:'device',ownerId:'device',dateKey:'2026-11-03',timezone:'UTC',types:{weather:true,news:false,stocks:false},allowExternal:true};
 const deps={localStore:{getByDate:async()=>null,save:async()=>{saves++;return 'local-id';}},getSchedules:async()=>{throw new Error('must not read private titles for external request');},external:async()=>({title:'날씨',summary:'맑음',contentMarkdown:'맑음',sources:[]})};
 assert.equal((await generateWithLocalStore(input,true,deps)).id,'local-id');assert.equal(saves,1);
 await assert.rejects(generateWithLocalStore(input,true,{...deps,external:async()=>{throw new Error('offline');}}),/offline/);assert.equal(saves,1);
});
