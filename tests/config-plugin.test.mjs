import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {configureRootGradle,configureGradleProperties}=require('../plugins/with-local-assistant.js');

test('prebuild properties preserve unrelated values and idempotently align Android and Kotlin',()=>{
 const before=[{type:'property',key:'android.minSdkVersion',value:'24'},{type:'property',key:'android.kotlinVersion',value:'2.1.20'},{type:'property',key:'test.retained',value:'yes'}];
 const once=configureGradleProperties(before);
 assert.deepEqual(configureGradleProperties(once),once);
 assert.equal(once.find(x=>x.key==='android.minSdkVersion').value,'26');
 assert.equal(once.find(x=>x.key==='android.kotlinVersion').value,'2.4.0');
 assert.equal(once.find(x=>x.key==='test.retained').value,'yes');
});
test('root compiler classpath and KSP override are explicit, correctly ordered and idempotent',()=>{
 const root=`buildscript { dependencies { classpath('org.jetbrains.kotlin:kotlin-gradle-plugin') } }\napply plugin: "expo-root-project"\napply plugin: "com.facebook.react.rootproject"\n`;
 const once=configureRootGradle(root);
 assert.equal(configureRootGradle(once),once);
 assert.equal((once.match(/ext.kspVersion/g)||[]).length,1);
 assert.ok(once.indexOf("ext.kspVersion = '2.3.10'")<once.indexOf('apply plugin: "expo-root-project"'));
 assert.ok(once.includes("org.jetbrains.kotlin:kotlin-gradle-plugin:${project.findProperty('android.kotlinVersion') ?: '2.4.0'}"));
 assert.ok(once.includes('apply plugin: "com.facebook.react.rootproject"'));
 assert.throws(()=>configureRootGradle('invalid root'),/Cannot locate Kotlin/);
});

test('MainActivity persists new intents before RN delivery and the transform is idempotent',()=>{
 const {configureMainActivity}=require('../plugins/with-local-assistant.js');
 const baseline='package example\nclass MainActivity : ReactActivity() {\n  override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(null) }\n}\n';
 const once=configureMainActivity(baseline);
 assert.equal(configureMainActivity(once),once);
 assert.equal((once.match(/override fun onNewIntent/g)||[]).length,1);
 assert.ok(once.indexOf('setIntent(intent)')<once.indexOf('super.onNewIntent(intent)'));
 assert.ok(once.includes('super.onCreate(null)'));
 assert.throws(()=>configureMainActivity(baseline.replace('  override fun onCreate','  override fun onNewIntent(intent: android.content.Intent) { super.onNewIntent(intent) }\n  override fun onCreate')),/existing onNewIntent/);
 assert.throws(()=>configureMainActivity('unrecognized Activity template'),/MainActivity/);
});
