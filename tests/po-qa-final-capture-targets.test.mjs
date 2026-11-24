import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('capture QA resolves exact app controls across calendar month and week boundaries',()=>{
  const path=fileURLToPath(new URL('../tools/ui/test_calendar_capture_target.py',import.meta.url));
  const result=spawnSync('python3',[path],{encoding:'utf8',timeout:10000});
  assert.equal(result.error,undefined);
  assert.equal(result.status,0,result.stdout+result.stderr);
  const capture=read('tools/ui/capture_android.py');
  assert.match(capture,/tap_exact\("주간 일정"\)/);
  assert.match(capture,/week_shift\(current_day, fixture_day\)/);
  assert.match(capture,/tap_exact\(day_label\(fixture_day, 1\)\)/);
  assert.doesNotMatch(capture,/\"input\", \"tap\", \"547\", \"330\"/);
});
test('actual capture evidence binds to the exact QA commit',()=>{
  const capture=read('tools/ui/capture_android.py'),verify=read('tools/ui/verify_captures.py');
  assert.match(capture,/"source_commit": SOURCE_COMMIT/);
  assert.match(verify,/report\.get\("source_commit"\) != expected_commit/);
});
