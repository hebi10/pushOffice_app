import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const wrapper = fileURLToPath(new URL('../.github/ci/retry-gradle-resolution.sh', import.meta.url));
const available = spawnSync('bash', ['--version']).status === 0;
const retryable = "Error resolving plugin [id: 'com.facebook.react.settings']\nCould not resolve com.google.code.gson:gson:2.9.1.\nCould not GET 'https://repo.maven.apache.org/maven2/com/google/code/gson/gson/2.9.1/gson-2.9.1.pom'. Received status code 429 from server: Too Many Requests";
function run(scenarios, {loggerFailure=false}={}) {
  const dir=mkdtempSync(join(tmpdir(),'po-gradle-retry-'));
  try {
    writeFileSync(join(dir,'sleep'),'#!/usr/bin/env bash\nexit 0\n');
    chmodSync(join(dir,'sleep'),0o755);
    if(loggerFailure){
      writeFileSync(join(dir,'tee'),'#!/usr/bin/env bash\ncat >/dev/null\nexit 9\n');
      chmodSync(join(dir,'tee'),0o755);
    }
    for (const [i,s] of scenarios.entries()) {
      writeFileSync(join(dir,'log'+(i+1)),s.log);
      writeFileSync(join(dir,'code'+(i+1)),String(s.code));
    }
    writeFileSync(join(dir,'gradlew'), '#!/usr/bin/env bash\nset -euo pipefail\nn=0; if [[ -f count ]]; then n=$(cat count); fi\nn=$((n+1)); echo "$n" > count\nprintf "%s\\n" "$@" > args\ncat "log$n"\nexit "$(cat "code$n")"\n');
    chmodSync(join(dir,'gradlew'),0o755);
    const result=spawnSync('bash',[wrapper,'./gradlew',':push-office-native:connectedDebugAndroidTest','-Pandroid.testInstrumentationRunnerArguments.class=Fixture'],{
      cwd:dir, env:{...process.env,PATH:dir+':'+process.env.PATH},encoding:'utf8',timeout:15000,
    });
    assert.equal(result.error,undefined);
    return {status:result.status,count:Number(readFileSync(join(dir,'count'),'utf8')),
      args:readFileSync(join(dir,'args'),'utf8'),output:result.stdout+result.stderr};
  }finally{rmSync(dir,{recursive:true,force:true});}
}

test('CI preserves successful Gradle exit and rejects log writer failures',{skip:!available},()=>{
  const success=run([{code:0,log:'BUILD SUCCESSFUL'}]);
  assert.equal(success.status,0); assert.equal(success.count,1);
  const failure=run([{code:0,log:'BUILD SUCCESSFUL'}],{loggerFailure:true});
  assert.equal(failure.status,9); assert.equal(failure.count,1);
});
test('CI-only bounded recovery for the exact observed Maven 429', {skip:!available},()=>{
  const result=run([{code:1,log:retryable},{code:0,log:'BUILD SUCCESSFUL'}]);
  assert.equal(result.status,0);assert.equal(result.count,2);
  assert.match(result.output,/HTTP 429 before tests/);
  assert.match(result.args,/:push-office-native:connectedDebugAndroidTest/);
  assert.match(result.args,/Fixture/);
  const repeated=run(Array.from({length:3},()=>({code:7,log:retryable})));
  assert.equal(repeated.status,7);assert.equal(repeated.count,3);
});

test('CI does not retry test failures, compiler errors, or untrusted URLs',{skip:!available},()=>{
  for(const log of [
    'There were failing tests. '+retryable,
    '> Task :push-office-native:connectedDebugAndroidTest FAILED\n'+retryable,
    '> Task :push-office-native:testDebugUnitTest\n'+retryable,
    'e: file:Example.kt:1:1 Unresolved reference\n'+retryable,
    retryable.replace('repo.maven.apache.org','example.invalid'),
    retryable.replace('status code 429','status code 404'),
    'Build failed without dependency resolution evidence',
  ]){
    const result=run([{code:5,log}]);assert.equal(result.status,5);assert.equal(result.count,1);
  }
});
