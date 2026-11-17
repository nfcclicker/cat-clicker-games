"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const storage = new Map();
const context = vm.createContext({ console, assert, crypto, TextEncoder, TextDecoder, btoa, atob,
  navigator: { locks: { request: (_key, action) => Promise.resolve().then(action) } }, Path2D: class {},
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,String(value)),
    removeItem: key => storage.delete(key) } });
for (const file of ["stages.js","fish-data.js","aquarium-data.js","achievements.js","player-data.js","transfer-code.js",
  "validation.js","save-history.js","save-data.js","progress.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,"..","game/white-basket",file),"utf8"),context);
}
vm.runInContext(`(async()=>{
  persistProgress(normalizeProgress(),0);
  const stale = readProgress();
  await savePlayerSettings({ muted:false });
  assert.throws(()=>persistProgress(stale), {name:"SaveConflict"});
  const current=readProgress();
  const r=newRound(0,new Date(2026,10,18));
  r.boots=1; r.playMs=30000; r.finalScore=20;
  recordRoundCatch(r,"fish",1,10);
  checkpointRound(r);
  while(r.checkpointPending) await Promise.resolve();
  const clone={...r, committed:false,savedCatches:0,savedGold:0,savedFish:{}};
  const a=await saveRound(clone);
  const after=readProgress();
  assert.equal(after.catches,1);
  r.committed=false;
  await saveRound(r);
  assert.equal(readProgress().plays,after.plays);
  assert.equal(readProgress().xp,after.xp);
  const replay={...clone,committed:false,checkpointPending:false,savedCatches:0,savedGold:0,savedFish:{}};
  checkpointRound(replay);
  while(replay.checkpointPending) await Promise.resolve();
  assert.equal(readProgress().catches,after.catches);
  const restore=makeSaveArchive(readProgress(),20);
  const oldRound=newRound(0);
  await restoreSaveArchive(restore);
  assert.throws(()=>assertRoundWritable(oldRound), {name:"SaveConflict"});
  const repeat={...r,id:crypto.randomUUID(),committed:false,savedCatches:1};
  repeat.epoch=readProgress().saveEpoch;
  const paid=readProgress().daily[r.day];
  const duplicate=applyCompletedRound(readProgress(),repeat);
  assert.equal(duplicate.rewards.length,0);
  const archive=makeSaveArchive(readProgress(),20);
  for(const mutate of [
    x=>x.progress.xp=-1, x=>x.progress.xp=Infinity,x=>x.level=51,
    x=>x.progress.collection.bad={count:1,firstSeen:null},
    x=>x.progress.achievements.push("bad"),x=>x.progress.settings.muted="false",
    x=>x.exportedAt="2026-02-30T12:00:00Z",x=>x.progress.plays=1.5,
    x=>x.progress.saveCounter=Number.MAX_SAFE_INTEGER+1,
  ]){const x=structuredClone(archive);mutate(x);assert.throws(()=>validateSaveArchive(x));}
  assert.throws(()=>decodeTransferCode("x".repeat(maxSaveBytes*2+1)));
  assert.throws(()=>unpackTransfer(Uint8Array.of(255,255,255,255,0)));
  const base=normalizeProgress();base.lastRewardDay="2030-01-01";base.lastCheckedAt="2030-01-01T12:00:00Z";
  const back=newRound(0,new Date(2026,10,18));back.boots=1;
  const guarded=applyCompletedRound(base,back);
  assert.equal(guarded.rewards.length,0);
  assert.equal(guarded.next.plays,1);
  assert.equal(readSaveHistory().length,3);
  console.log("PASS stale revision, checkpoint replay, duplicate completion, restore epoch, invalid IDs/types/dates/sizes and clock rollback");
})()`, Object.assign(context,{structuredClone})).catch(e=>{console.error(e);process.exitCode=1;});
