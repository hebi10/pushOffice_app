import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExternalBriefingPayload, BRIEFING_CITIES, isTrustedBriefingEndpoint, isSafeNewsLink } from '../src/features/digest/externalBriefingRequest.ts';
import { parseDigestRequest } from '../functions/src/briefingPolicy.ts';

test('external request sends only selected validated fields and no local identity', () => {
  const source = { ownerId: 'private-local-id', ownerType: 'device', dateKey: '2026-11-24',
    timezone: 'Asia/Seoul', newsKeywords: ['private'], schedule: ['private'],
    types: { weather: true, stocks: false, news: true, private: 'hidden' },
    city: 'Seoul', stockTickers: ['PRIVATE'], newsLanguage: 'en', allowExternal: true };
  const payload = buildExternalBriefingPayload(source);
  assert.deepEqual(payload, {types: {weather:true, stocks:false, news:true}, city:'서울', newsLanguage:'en'});
  assert.equal(parseDigestRequest(payload).newsCountry, 'us');
  for (const [ko, en] of BRIEFING_CITIES) {
    assert.deepEqual(parseDigestRequest(buildExternalBriefingPayload({...source, city:en})),
      parseDigestRequest(buildExternalBriefingPayload({...source, city:ko})));
  }
  assert.throws(() => buildExternalBriefingPayload({...source, allowExternal:false}));
  assert.throws(() => buildExternalBriefingPayload({...source, city:'unregistered'}));
  assert.throws(() => buildExternalBriefingPayload({...source, newsLanguage:'xx'}));
});

test('rejects unsupported authenticated URLs and non-HTTPS news links', () => {
  for (const url of ['https://generate-digest-example.run.app', 'https://asia-northeast3-example.cloudfunctions.net/generateDigest']) assert.equal(isTrustedBriefingEndpoint(url),true);
  for (const url of ['http://example.run.app','https://example.run.app.evil.test','https://u@example.run.app','https://example.run.app?x=y','https://example.run.app/#x','https://example.com']) assert.equal(isTrustedBriefingEndpoint(url),false);
  assert.equal(isSafeNewsLink('https://news.example/article'),true);
  for (const url of ['http://news.example','intent://test','javascript:alert(1)','https://u@news.example']) assert.equal(isSafeNewsLink(url),false);
});

test('stock input has five-symbol bound and permits no query injection', () => {
  const input = { types:{weather:false,news:false,stocks:true}, allowExternal:true };
  assert.deepEqual(buildExternalBriefingPayload({...input,stockTickers:['aapl',' AAPL ','TSLA']}).stockTickers,['AAPL','TSLA']);
  for (const stockTickers of [[], ['A&apikey=x'], ['a','b','c','d','e','f']]) assert.throws(() => buildExternalBriefingPayload({...input,stockTickers}));
});
