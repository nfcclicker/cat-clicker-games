"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const storage = new Map();
let failure = () => false;
const files = ["stages.js","fish-data.js","aquarium-data.js","achievements.js","player-data.js","transfer-code.js",
  "validation.js","save-history.js","save-data.js","progress.js"];
function engine(seed = storage) {
  const context = vm.createContext({ assert, TextEncoder, TextDecoder, btoa, atob, navigator: { locks: { request: (_key, action) => Promise.resolve().then(action) } },
    Path2D: class {}, console, crypto,
    fail: (fn) => { failure = fn; },
    localStorage: {
      getItem: (key) => seed.get(key) ?? null,
      setItem(key, value) { if (failure(key, value)) throw new DOMException("Full","QuotaExceededError"); seed.set(key,String(value)); },
      removeItem(key) { seed.delete(key); },
    },
  });
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "game/white-basket", file),"utf8"), context);
  return context;
}
(async () => {
  const live = engine();
  const code = await vm.runInContext(`(async () => {
    const p = normalizeProgress({xp:28050});
    persistProgress(p, 51);
    const r = newRound(51, new Date(2026,10,17), "deep");
    r.boots = 1;
    recordRoundCatch(r,"oarfish",1,100);
    checkpointRound(r);
    while (r.checkpointPending) await Promise.resolve();
    assert.equal(readProgress().collection.oarfish.count,1);
    assert.equal(readProgress().stageCatches.deep,1);
    assert.equal(readProgress().achievements.includes("secretFish"),true);
    assert.equal(readProgress().xp,28050);
    recordRoundCatch(r,"fish",2,110);
    r.playMs=30000; r.finalScore=110;
    const result=await saveRound(r);
    assert.equal(result.saved,true);
    assert.equal(result.xp,124);
    assert.equal(result.discoveries.join(","),"oarfish");
    assert.equal(result.unlocked.filter(({id})=>id==="secretFish").length,1);
    assert.equal(readProgress().catches,2);
    assert.equal(readProgress().stageCatches.deep,2);
    assert.equal(readProgress().collection.oarfish.count,1);
    assert.equal(readProgress().daily[r.day].counts.catches,2);
    assert.equal(await saveRound(r),undefined);
    await savePlayerSettings({stage:"deep",title:"first",muted:false});
    assert.equal(readSaveHistory().length,3);
    const stable = JSON.stringify(rawSavePair());
    const oldHistory = localStorage.getItem(saveHistoryKey);
    for (const key of [restoreJournalKey,bestKey,progressKey,saveHistoryKey]) {
      fail((changed) => changed === key);
      assert.throws(() => {
        const candidate = readProgress(); candidate.xp++;
        persistProgress(candidate, 999);
      });
      assert.equal(JSON.stringify(visibleSavePair()),stable);
      assert.equal(localStorage.getItem(saveHistoryKey),oldHistory);
      fail(() => false);
      settleRestore();
      assert.equal(JSON.stringify(rawSavePair()),stable);
    }
    localStorage.setItem(progressKey,'{broken');
    assert.equal(readProgress().collection.oarfish.count,1);
    await startSaveProtection();
    assert.equal(saveStatus.kind,"recovered");
    assert.equal(JSON.stringify(rawSavePair()),stable);
    const ring = JSON.parse(localStorage.getItem(saveHistoryKey));
    ring[0].digest="00000000";
    localStorage.setItem(saveHistoryKey,JSON.stringify(ring));
    localStorage.setItem(progressKey,"{broken again");
    assert.equal(readProgress().settings.stage,"coast");
    await startSaveProtection();
    assert.equal(saveStatus.kind,"recovered");
    await savePlayerSettings({stage:"deep",title:"first",muted:false});
    assert.ok(readSaveHistory().every(entry => validSavePair(entry.pair)));

    const massive = readProgress();
    const day = "2026-11-17";
    for (let i=0;i<2100;i++) {
      const date = shiftPlayDay(day,-i);
      const period = emptyPeriod();
      period.counts.plays=1;
      period.bonus=true;
      massive.daily[date]=period;
    }
    const archive=makeSaveArchive(massive,readStoredBest());
    const code=encodeTransferCode(archive);
    assert.equal(JSON.stringify(decodeTransferCode(code)),JSON.stringify(archive));
    assert.ok(code.length < JSON.stringify(archive).length*.6);
    assert.throws(()=>decodeTransferCode(code.replace(/^OSAKANA1/,"OTHER1")));
    assert.throws(()=>decodeTransferCode(code.replace(/\\.[0-9a-f]{8}\\./,".01234567.")));
    assert.throws(()=>decodeTransferCode(code.slice(0,-7)));
    assert.throws(()=>decodeTransferCode(encodeTransferCode({...archive,format:"other"})));
    assert.throws(()=>decodeTransferCode(encodeTransferCode({...archive,progress:{...archive.progress,xp:-1}})));
    assert.throws(()=>unpackTransfer(Uint8Array.of(0,0,0,1,1,0,0)));
    assert.equal(decodeTransferCode(code.slice(0,20)+"\\n "+code.slice(20)).best,110);
    console.log(JSON.stringify({jsonBytes:new TextEncoder().encode(JSON.stringify(archive)).length,codeChars:code.length}));
    return code;
  })()`,live);
  const restarted = engine();
  assert.equal(vm.runInContext('readProgress().collection.oarfish.count',restarted),1);
  const fresh = engine(new Map());
  fresh.code = code;
  const restored = await vm.runInContext("restoreSaveArchive(decodeTransferCode(code)).then(result => result.progress)",fresh);
  assert.equal(restored.settings.stage,"deep");
  assert.equal(restored.collection.oarfish.count,1);
  assert.equal(Object.keys(restored.daily).length,2100);
  assert.equal(vm.runInContext("readStoredBest()",fresh),110);
  const pending = engine(new Map());
  await vm.runInContext(`(async () => {
    persistProgress(normalizeProgress(), 0);
    const round = newRound(0, new Date(2026,10,19));
    recordRoundCatch(round,"fish",1,10);
    round.playMs=30000; round.finalScore=10;
    fail((key) => key === progressKey);
    assert.equal((await saveRound(round)).saved,false);
    fail(() => false);
    await savePlayerSettings({muted:false});
    assert.equal(saveStatus.kind,"failed");
    await restoreSaveArchive(makeSaveArchive(normalizeProgress(),0));
    const prior=JSON.parse(localStorage.getItem(restoreBackupKey));
    assert.equal(JSON.parse(prior.progress).catches,1);
    assert.equal(JSON.parse(prior.progress).plays,1);
    assert.equal(prior.best,"10");
  })()`,pending);
  console.log("PASS checkpoints, no double commit, 3 healthy generations, quota failures, corruption/restart recovery, transfer size and validation");
})().catch(error => { console.error(error); process.exitCode=1; });
