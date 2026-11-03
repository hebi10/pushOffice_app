import test from 'node:test';
import assert from 'node:assert/strict';
import {createLaunchIntentController} from '../src/features/notifications/launchIntent.ts';
import {bootstrapLocal} from '../src/features/storage/recoveryPolicy.ts';
const id='0427ccb8-d408-428f-8297-4387aa926d4a';
const uri=`pushofficeapp://schedule/${id}`;
const route=`/schedule/${id}`;
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
function navigation(){let path='/';const routes=[];return{routes,setPath:value=>path=value,controller:createLaunchIntentController({currentPath:()=>path,replace:next=>{routes.push(next);path=next;}})};}

test('late Android initial URL survives local bootstrap and waits for mounted navigation exactly once',async()=>{
 const n=navigation();const native=deferred();const settings=deferred();let fallback=0;
 const initial=n.controller.initialize(()=>native.promise,async()=>{fallback++;return '/briefing';});
 const bootstrap=bootstrapLocal({activate:async()=>{},getIdentity:async()=> 'device',getSettings:()=>settings.promise,publish:()=>n.controller.setReadiness({localReady:true,navigationReady:false}),recover:async()=>{},onRecoveryError:assert.fail});
 // Expo Router's 150ms read may already have fallen back to Home. The direct read remains pending.
 native.resolve(uri);await initial;assert.deepEqual(n.routes,[]);
 settings.resolve({pushEnabled:false});await bootstrap;assert.deepEqual(n.routes,[]);
 n.controller.setReadiness({localReady:true,navigationReady:true});assert.deepEqual(n.routes,[route]);
 n.controller.setReadiness({localReady:true,navigationReady:true});assert.deepEqual(n.routes,[route]);assert.equal(fallback,0);
});
test('initial URL resolving after both readiness gates still navigates from the settled Home route',async()=>{
 const n=navigation();const native=deferred();const initial=n.controller.initialize(()=>native.promise);
 n.controller.setReadiness({localReady:true,navigationReady:true});assert.deepEqual(n.routes,[]);
 native.resolve(uri);await initial;assert.deepEqual(n.routes,[route]);
});
test('warm URL received during bootstrap queues until local state is ready',()=>{
 const n=navigation();n.controller.setReadiness({localReady:false,navigationReady:true});
 n.controller.receive(uri);assert.deepEqual(n.routes,[]);
 n.controller.setReadiness({localReady:true,navigationReady:true});assert.deepEqual(n.routes,[route]);
});
test('new warm intent wins over a slower old initial-URL result',async()=>{
 const n=navigation();const native=deferred();const initial=n.controller.initialize(()=>native.promise);
 n.controller.setReadiness({localReady:true,navigationReady:true});
 n.controller.receive('pushofficeapp://schedule/newer-id');native.resolve(uri);await initial;
 assert.deepEqual(n.routes,['/schedule/newer-id']);
});
test('warm delivery cooperates with an already handled Expo route and repeated later taps still work',()=>{
 const n=navigation();n.controller.setReadiness({localReady:true,navigationReady:true});n.setPath(route);
 n.controller.receive(uri);assert.deepEqual(n.routes,[]);
 n.setPath('/');n.controller.receive(uri);assert.deepEqual(n.routes,[route]);
});
test('legacy Expo response cannot override a native ACTION_VIEW and invalid/external routes are ignored',async()=>{
 const n=navigation();n.controller.setReadiness({localReady:true,navigationReady:true});
 await n.controller.initialize(async()=>uri,async()=>'/schedule/old-response');assert.deepEqual(n.routes,[route]);
 n.controller.receive('https://other.example/schedule/private');n.controller.receive('pushofficeapp://unsupported/route');assert.deepEqual(n.routes,[route]);
});
test('disposed bootstrap cannot navigate after its delayed native read resolves',async()=>{
 const n=navigation();const native=deferred();const initial=n.controller.initialize(()=>native.promise);n.controller.dispose();
 n.controller.setReadiness({localReady:true,navigationReady:true});native.resolve(uri);await initial;assert.deepEqual(n.routes,[]);
});
test('native daily briefing root URI and legacy calendar notification routes stay usable',async()=>{
 const n=navigation();n.controller.setReadiness({localReady:true,navigationReady:true});n.setPath('/schedule/previous');
 await n.controller.initialize(async()=> 'pushofficeapp:///');assert.deepEqual(n.routes,['/(tabs)']);
 n.controller.receive('/(tabs)/calendar');assert.deepEqual(n.routes,['/(tabs)','/calendar']);
});
test('newer same-app intent delegated to Expo invalidates a slower initial detail read',async()=>{
 const n=navigation();const native=deferred();const initial=n.controller.initialize(()=>native.promise);
 n.controller.setReadiness({localReady:true,navigationReady:true});
 n.controller.receive('pushofficeapp://settings');n.setPath('/settings');
 native.resolve(uri);await initial;assert.deepEqual(n.routes,[]);
});
test('newer delegated same-app intent clears an older detail queued before navigation readiness',()=>{
 const n=navigation();n.controller.receive(uri);n.controller.receive('pushofficeapp://settings');n.setPath('/settings');
 n.controller.setReadiness({localReady:true,navigationReady:true});assert.deepEqual(n.routes,[]);
});
test('cold same-app intent delegated to Expo suppresses a stale legacy response',async()=>{
 const n=navigation();n.setPath('/settings');n.controller.setReadiness({localReady:true,navigationReady:true});
 await n.controller.initialize(async()=> 'pushofficeapp://settings',async()=> '/schedule/old-response');
 assert.deepEqual(n.routes,[]);
});
test('missing, external, or malformed initial URLs still allow the legacy response fallback',async()=>{
 for(const initialURL of [null,'https://example.com/settings','not a URI','pushofficeapp://schedule/%E0%A4']){
  const n=navigation();n.controller.setReadiness({localReady:true,navigationReady:true});
  await n.controller.initialize(async()=>initialURL,async()=> '/schedule/old-response');
  assert.deepEqual(n.routes,['/schedule/old-response']);
 }
});
test('external or malformed events do not cancel a valid pending initial detail',async()=>{
 for(const invalid of ['https://example.com/settings','not a URI','pushofficeapp://schedule/%E0%A4']){
  const n=navigation();const native=deferred();const initial=n.controller.initialize(()=>native.promise);
  n.controller.setReadiness({localReady:true,navigationReady:true});n.controller.receive(invalid);
  native.resolve(uri);await initial;assert.deepEqual(n.routes,[route]);
 }
});
