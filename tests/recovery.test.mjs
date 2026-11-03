import test from 'node:test';
import assert from 'node:assert/strict';
import { activateLocalStorage, bootstrapLocal, recoverLegacySources, subscribeOnActive, STORAGE_MODE_KEY, LEGACY_CLOUD_KEY } from '../src/features/storage/recoveryPolicy.ts';
const memory=(initial={})=>{const rows=new Map(Object.entries(initial));return {rows,getItem:async k=>rows.get(k)??null,setItems:async entries=>{for(const [k,v]of entries)rows.set(k,v);}};};

test('active persisted mode becomes local while missing-config legacy metadata remains independently pending',async()=>{
 const storage=memory({[STORAGE_MODE_KEY]:'firebase'});
 await activateLocalStorage(storage);
 assert.equal(storage.rows.get(STORAGE_MODE_KEY),'local');
 const pending=JSON.parse(storage.rows.get(LEGACY_CLOUD_KEY));assert.equal(pending.pending,true);
 await activateLocalStorage(storage);assert.deepEqual(JSON.parse(storage.rows.get(LEGACY_CLOUD_KEY)),pending);
});
test('identity, saved notification settings and local UI publish before an indefinitely delayed cloud recovery',async()=>{
 const events=[];const settings={pushEnabled:false,dailyBriefingEnabled:true,dailyBriefingTime:{hour:7,minute:45}};
 await bootstrapLocal({activate:async()=>events.push('persist-local'),getIdentity:async()=> 'device-id',getSettings:async()=>settings,publish:local=>{events.push('ui-ready');assert.equal(local.identity,'device-id');assert.equal(local.settings,settings);},recover:()=>{events.push('cloud-start');return new Promise(()=>{});},onRecoveryError:()=>{throw new Error('unexpected');}});
 assert.deepEqual(events,['persist-local','ui-ready','cloud-start']);
});
function recovery(overrides={}){
 let state={pending:true,uid:'existing-owner',message:'pending'};const events=[];
 const deps={importLocal:async()=>events.push('local'),getCloudState:async()=>state,saveCloudState:async x=>{state=x;},configured:()=>true,readExistingIdentity:async()=> 'existing-owner',importCloud:async uid=>events.push(`cloud:${uid}`),finishCleanup:async()=>events.push('final-cleanup'),...overrides};
 return {deps,events,state:()=>state};
}
test('missing configuration and missing auth preserve cloud metadata without global cleanup',async()=>{
 for(const override of [{configured:()=>false},{readExistingIdentity:async()=>null}]){
  const r=recovery(override);const result=await recoverLegacySources(r.deps);
  assert.equal(result.pending,true);assert.equal(r.state().uid,'existing-owner');assert.deepEqual(r.events,[]);
 }
});
test('cloud fetch failure leaves only pending source state and explicit retry can finish it',async()=>{
 let fail=true;const r=recovery({importCloud:async()=>{if(fail)throw new Error('offline');}});
 await recoverLegacySources(r.deps);assert.equal(r.state().pending,true);assert.match(r.state().message,/offline/);assert.deepEqual(r.events,['local']);
 fail=false;const result=await recoverLegacySources(r.deps);assert.equal(result.pending,false);assert.deepEqual(r.events,['local','local','final-cleanup']);
});
test('a different restored account cannot silently replace the pending source owner',async()=>{
 const r=recovery({readExistingIdentity:async()=> 'different-owner'});const result=await recoverLegacySources(r.deps);
 assert.equal(result.pending,true);assert.equal(r.state().uid,'existing-owner');assert.deepEqual(r.events,[]);
});
test('a completed import retries final cleanup without reading cloud or reimporting',async()=>{
 let cleanup=0;const r=recovery({getCloudState:async()=>({pending:false,uid:'existing-owner',message:'done'}),readExistingIdentity:async()=>{throw new Error('must not restore auth');},finishCleanup:async()=>{cleanup++;if(cleanup===1)throw new Error('cleanup offline');}});
 await assert.rejects(recoverLegacySources(r.deps),/cleanup offline/);
 await recoverLegacySources(r.deps);assert.equal(cleanup,2);assert.deepEqual(r.events,['local','local']);
});
test('return from system settings refreshes capabilities even when the route never loses focus',()=>{
 let listener;let removed=false;let refreshes=0;
 const unsubscribe=subscribeOnActive({addEventListener:(event,fn)=>{assert.equal(event,'change');listener=fn;return{remove(){removed=true;}};}},()=>refreshes++);
 listener('background');listener('inactive');assert.equal(refreshes,0);listener('active');assert.equal(refreshes,1);unsubscribe();assert.equal(removed,true);
});

test('an imported cloud snapshot retries only cleanup even after keys/auth become unavailable',async()=>{
 const events=[];let state={pending:true,uid:'existing-owner',message:'cleanup interrupted'};
 const result=await recoverLegacySources({importLocal:async()=>{},getCloudState:async()=>state,saveCloudState:async x=>state=x,configured:()=>false,cloudAlreadyImported:async uid=>uid==='existing-owner',readExistingIdentity:async()=>{throw new Error('must not initialize auth for cleanup');},importCloud:async uid=>events.push(`cleanup:${uid}`),finishCleanup:async()=>events.push('final-cleanup')});
 assert.equal(result.pending,false);assert.deepEqual(events,['cleanup:existing-owner','final-cleanup']);
});
test('legacy source resumes when configuration later becomes available',async()=>{
 let configured=false;const r=recovery({configured:()=>configured});
 await recoverLegacySources(r.deps);assert.equal(r.state().pending,true);
 configured=true;await recoverLegacySources(r.deps);assert.equal(r.state().pending,false);assert.ok(r.events.includes('cloud:existing-owner'));
});
test('rejected cloud recovery never republishes defaults over restored local settings',async()=>{
 const settings={pushEnabled:false,dailyBriefingEnabled:true};const publications=[];const errors=[];
 await bootstrapLocal({activate:async()=>{},getIdentity:async()=> 'device',getSettings:async()=>settings,publish:value=>publications.push(value),recover:async()=>{throw new Error('offline');},onRecoveryError:error=>errors.push(error)});
 await Promise.resolve();assert.equal(publications.length,1);assert.equal(publications[0].settings,settings);assert.equal(errors.length,1);
});
