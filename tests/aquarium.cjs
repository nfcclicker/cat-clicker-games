"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const storage = new Map();
const context = vm.createContext({ assert, console, crypto, TextEncoder, TextDecoder, btoa, atob, Path2D: class {},
  navigator: {locks:{request:(_key,action)=>Promise.resolve().then(action)}},
  localStorage: {getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)} });
for (const file of ["stages.js","fish-data.js","aquarium-data.js","achievements.js","player-data.js","transfer-code.js",
  "validation.js","save-history.js","save-data.js","progress.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,"..","game/white-basket",file),"utf8"),context);
}
vm.runInContext(`(async()=>{
  assert.deepEqual(Array.from([1,9,10,19,20,29,30,39,40,49,50],aquariumCapacity).join(","),
    "5,5,10,10,15,15,20,20,25,25,30");
  const old=normalizeProgress({xp:100000,plays:4,collection:{legend:{count:30,firstSeen:"2026-11-17T00:00:00Z"}},achievements:["first"]},25);
  const migrated=migrateProgress(old);
  assert.equal(migrated.aquarium.fish.length,0);
  assert.equal(migrated.aquarium.backgrounds.join(","),"coast");
  assert.equal(migrated.stageCatches.coast,undefined);
  assert.equal(migrated.xp,old.xp);
  const oldArchive={format:saveFormat,version:4,exportedAt:"2026-11-17T00:00:00Z",best:88,
    level:levelInfo(old.xp).level,progress:old};
  assert.equal(validateSaveArchive(oldArchive).progress.revision,26);
  persistProgress(migrated,88);
  const original=readProgress().collection.legend.count;
  await saveAquariumEdit((aq,p)=>{
    aq.fish=initialAquariumFish(p);aq.peak=aq.fish.length;aq.initialized=true;
  },readProgress().saveEpoch);
  assert.equal(readProgress().aquarium.fish.length,5);
  assert.ok(readProgress().achievements.includes("firstAquarium"));
  await assert.rejects(saveAquariumEdit((aq,p)=>addExhibit(aq,p,"moon",1),readProgress().saveEpoch));
  await saveAquariumEdit((aq,p)=>{
    while(aq.fish.length<30)addExhibit(aq,p,"legend",1);
  },readProgress().saveEpoch);
  assert.ok(readProgress().achievements.includes("livelyTank") && readProgress().achievements.includes("aquariumMaster"));
  await assert.rejects(saveAquariumEdit((aq,p)=>addExhibit(aq,p,"legend",1),readProgress().saveEpoch));
  await assert.rejects(saveAquariumEdit(aq=>{aq.background="deep";},readProgress().saveEpoch));
  await saveAquariumEdit((aq,p)=>addExhibit(aq,p,"legend",-1),readProgress().saveEpoch);
  assert.equal(readProgress().collection.legend.count,original);
  const limited=normalizeProgress({collection:{legend:{count:2,firstSeen:null}}});
  const aq=limited.aquarium;
  addExhibit(aq,limited,"legend",1);addExhibit(aq,limited,"legend",1);
  assert.throws(()=>addExhibit(aq,limited,"legend",1));
  const epoch=readProgress().saveEpoch;
  for(let i=0;i<10;i++){
    await saveAquariumEdit(aq=>finishAquariumFeed(aq,new Date(2026,10,17,12,0,i*11)),epoch);
  }
  assert.equal(readProgress().aquarium.feeds,10);
  assert.ok(readProgress().achievements.includes("fishCaretaker"));
  await assert.rejects(saveAquariumEdit(aq=>finishAquariumFeed(aq,new Date(2026,10,17,12,1,40)),epoch));
  for(const stage of seaStages){
    const base=readProgress();
    const r=newRound(0,new Date(2026,10,17),stage.id);
    r.finalScore=aquariumTargets[stage.id]-1;r.boots=1;r.playMs=30000;
    assert.equal(applyCompletedRound(base,r).next.aquarium.backgrounds.includes(stage.id),stage.id==="coast");
    r.finalScore=aquariumTargets[stage.id];
    const result=await saveRound(r);
    assert.equal(result.saved,true);
    assert.equal(readProgress().stageRecords[stage.id].cleared,true);
    assert.ok(readProgress().stageRecords[stage.id].clearedAt);
    assert.ok(readProgress().aquarium.backgrounds.includes(stage.id));
  }
  assert.ok(readProgress().achievements.includes("seaCollector"));
  const photoBefore=JSON.stringify(readProgress().collection);
  await saveAquariumEdit(aq=>{aq.background="phantom";},epoch);
  assert.equal(readProgress().aquarium.fish.length,29);
  assert.equal(JSON.stringify(readProgress().collection),photoBefore);
  const exported=makeSaveArchive(readProgress(),readStoredBest());
  const transfer=decodeTransferCode(encodeTransferCode(exported));
  assert.equal(transfer.progress.aquarium.feeds,10);
  assert.equal(transfer.progress.aquarium.fish.length,29);
  const currentCounter=readProgress().saveCounter;
  await restoreSaveArchive(transfer,currentCounter);
  await assert.rejects(saveAquariumEdit(aq=>{aq.fish=[];},epoch),{name:"SaveConflict"});
  const invalid=JSON.parse(JSON.stringify(makeSaveArchive(readProgress(),100)));
  invalid.progress.aquarium.fish.push("unknown");
  assert.throws(()=>validateSaveArchive(invalid));
  console.log("PASS aquarium ownership/count/capacity, stage clear thresholds and timestamps, feed cooldown, achievements, old save and code restoration");
})()`,context).catch(error=>{console.error(error);process.exitCode=1;});
