const assert = require("node:assert/strict");
const test = require("node:test");
const {parseDigestRequest, parseRestRequest, approvedPilotUids, reserveQuota} =
  require("../lib/briefingPolicy.js");
const {authorizeAndReserve} = require("../lib/briefingAdmission.js");
const flags = {weather: true, stocks: false, news: true};
const input = {types: flags, city: "Seoul", newsLanguage: "en"};

test("strict request validates actual selected fields and rejects private or unsupported data", () => {
  assert.deepEqual(parseDigestRequest(input), {
    types: flags, lat: 37.5665, lon: 126.978, newsCountry: "us",
  });
  assert.equal(parseDigestRequest({...input, city: "서울특별시", newsLanguage: "ko"}).newsCountry, "kr");
  for (const body of [
    null, [], {}, {...input, city: "not-registered"}, {...input, city: "private address"},
    {...input, ownerId: "local"}, {...input, timezone: "Asia/Seoul"},
    {...input, newsKeywords: ["private"]}, {...input, stockTickers: ["AAPL"]},
    {...input, types: {...flags, weather: "true"}}, {...input, newsLanguage: "xx"},
    {types: {weather: false, news: false, stocks: false}},
  ]) assert.throws(() => parseDigestRequest(body));
});

test("stock symbols and REST coordinates cannot bypass validation", () => {
  const types = {weather: false, news: false, stocks: true};
  assert.deepEqual(parseDigestRequest({types, stockTickers: ["aapl", "AAPL", "TSLA"]}).stockTickers, ["AAPL", "TSLA"]);
  for (const stockTickers of [[], ["A&apikey=x"], ["x".repeat(13)], ["a","b","c","d","e","f"], [null]]) {
    assert.throws(() => parseDigestRequest({types, stockTickers}));
  }
  assert.equal(parseRestRequest({lat: "0", lon: "0", symbol: "AAPL"}).lat, 0);
  for (const lat of ["NaN", "91", "1e9", "37abc", ["1","2"], undefined]) {
    assert.throws(() => parseRestRequest({lat, lon: "127", symbol: "AAPL"}));
  }
});

test("default off and explicit bounded approval", () => {
  assert.equal(approvedPilotUids(undefined, "alice").size, 0);
  assert.equal(approvedPilotUids("true", "").size, 0);
  assert.equal(approvedPilotUids("true", "a b").size, 0);
  assert.equal(approvedPilotUids("true", Array.from({length:51}, (_,i)=>"u"+i).join(",")).size, 0);
  assert.deepEqual([...approvedPilotUids("true", "alice,bob")], ["alice", "bob"]);
});

test("shared counters apply across instances and UTC days without exceeding stock budget", () => {
  const t = Date.parse("2026-11-24T00:00:00Z");
  const first = reserveQuota(undefined, undefined, t, 15);
  assert.equal(first.global.stockCalls, 15);
  assert.equal(reserveQuota(first.global, first.user, t, 0), null);
  assert.equal(reserveQuota(first.global, undefined, t+60000, 12), null);
  const second = reserveQuota(first.global, undefined, t+60000, 9);
  assert.equal(second.global.stockCalls, 24);
  assert.equal(reserveQuota(second.global, undefined, t+120000, 3), null);
  const reset = reserveQuota(second.global, second.user, t+86400000, 3);
  assert.equal(reset.global.daily, 1);
  assert.equal(reset.global.stockCalls, 3);
  assert.throws(() => reserveQuota({daily: 0}, undefined, t, 0));
  let global;
  for (let i=0;i<12;i++) global = reserveQuota(global, undefined, t+i*60000, 0).global;
  assert.equal(reserveQuota(global, undefined, t+12*60000, 0), null);
});

test("authentication and quota failure are fail-closed before admission", async () => {
  const request = parseDigestRequest({types:{weather:false,news:false,stocks:true},stockTickers:["AAPL","TSLA"]});
  const header = "Bearer " + "x".repeat(30);
  let verifies=0, reserves=0;
  const deps={enabled:"true",allowedUids:"alice",
    verify:async()=>{verifies++;return "alice";},
    reserve:async(uid,cost)=>{reserves++;assert.equal(uid,"alice");assert.equal(cost,6);return true;}};
  const denied=(promise,status)=>assert.rejects(promise,{status});
  await denied(authorizeAndReserve(header,request,{...deps,enabled:"false"}),503);
  await denied(authorizeAndReserve(undefined,request,deps),401);
  assert.equal(verifies,0);
  await denied(authorizeAndReserve(header,request,{...deps,verify:async()=>{throw Error("invalid");}}),401);
  await denied(authorizeAndReserve(header,request,{...deps,verify:async()=>"bob"}),403);
  assert.equal(reserves,0);
  await denied(authorizeAndReserve(header,request,{...deps,reserve:async()=>false}),429);
  await denied(authorizeAndReserve(header,request,{...deps,reserve:async()=>{throw Error("unavailable");}}),503);
  await authorizeAndReserve(header,request,deps);
  assert.equal(reserves,1);
});
