import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { isEncryptedBackup, validateBackupPassword, recordSuccessfulBackup, readBackupHistory, restoreWithSettings } from '../src/features/storage/backupFlow.ts';
import { SettingsQueue } from '../src/features/storage/settingsRecoveryPolicy.ts';

test('format dispatch never treats a new encrypted version as plain JSON', () => {
  assert.equal(isEncryptedBackup('PUSH-OFFICE-ENCRYPTED-BACKUP-V1\nabc'), true);
  assert.equal(isEncryptedBackup('PUSH-OFFICE-ENCRYPTED-BACKUP-V2\nabc'), true);
  assert.equal(isEncryptedBackup('{"format":"pushoffice-local-backup"}'), false);
  assert.throws(() => validateBackupPassword('short'));
  assert.throws(() => validateBackupPassword(' '.repeat(12)));
  assert.throws(() => validateBackupPassword('a'.repeat(129)));
  assert.throws(() => validateBackupPassword('synthetic-passphrase','synthetic-other'));
  validateBackupPassword('synthetic-passphrase-한글','synthetic-passphrase-한글');
});

test('only completed file save updates local history and metadata failure is distinct', async () => {
  const events=[];
  const save = async value => {events.push(value);};
  const now = 1800000000000;
  assert.deepEqual(await recordSuccessfulBackup(false,'plain',save,now),{history:null,historyRecorded:false});
  assert.equal(events.length,0);
  const result=await recordSuccessfulBackup(true,'encrypted',save,now);
  assert.deepEqual(result,{history:{savedAt:now,mode:'encrypted'},historyRecorded:true});
  assert.deepEqual(events,[{savedAt:now,mode:'encrypted'}]);
  assert.deepEqual(readBackupHistory(JSON.stringify(events[0])),events[0]);
  const notRecorded = await recordSuccessfulBackup(true,'plain',async()=>{throw Error('disk')},now);
  assert.equal(notRecorded.historyRecorded,false);
  assert.deepEqual(notRecorded.history,{savedAt:now,mode:'plain'});
  for(const bad of [null,'bad','{}','{"savedAt":-1,"mode":"plain"}','{"savedAt":2,"mode":"other"}']) assert.equal(readBackupHistory(bad),null);
});

test('rollback precedes subsequent settings write, but not after successful import',async()=>{
  const events=[];
  const queue=new SettingsQueue();
  const failed=queue.run(()=>restoreWithSettings(async()=>{events.push('apply')},async()=>{events.push('import');throw Error('db failure')},async()=>{events.push('rollback')}));
  const later=queue.run(async()=>{events.push('new settings')});
  await assert.rejects(failed,/db failure/);
  await later;
  assert.deepEqual(events,['apply','import','rollback','new settings']);
  const success=await restoreWithSettings(async()=>{},async()=>({imported:1,alarmsReady:false}),async()=>{throw Error('must not roll back')});
  assert.deepEqual(success,{imported:1,alarmsReady:false});
  await assert.rejects(restoreWithSettings(async()=>{throw Error('apply')},async()=>{throw Error('must not import')},async()=>{throw Error('rollback')}),/되돌리지 못했습니다/);
});

test('integration keeps encryption before SAF and validates before exposing a restore preview',()=>{
  const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const service=read('src/features/storage/localBackupService.ts');
  const screen=read('app/(tabs)/settings.tsx');
  const native=read('modules/push-office-native/android/src/main/java/expo/modules/pushoffice/LocalBackupCrypto.kt');
  assert.match(service,/encryptLocalBackup\(plain, password\)/);
  assert.match(service,/createLocalBackupDocument\(text\)/);
  assert.match(service,/decryptLocalBackup\(text, password\)/);
  assert.match(service,/previewLocalBackup\(plain, 'encrypted'\)/);
  assert.match(service,/parseLocalBackup\(text, checksum\)/);
  assert.match(screen,/secureTextEntry autoCapitalize="none"/);
  assert.match(screen,/setBackupPassword\(''\)/);
  assert.match(screen,/validateBackupPassword\(backupPassword, backupConfirmation\)/);
  assert.match(screen,/setRestoreSettings\(false\)/);
  assert.match(native,/PBKDF2WithHmacSHA256/);
  assert.match(native,/600_000/);
  assert.match(native,/AES\/GCM\/NoPadding/);
  assert.match(native,/SecureRandom/);
  assert.doesNotMatch(native,/Log\.|SharedPreferences|println\(/);
});
