"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const storage = new Map();
const context = vm.createContext({
  assert, console, navigator: { locks: { request: (_key, action) => Promise.resolve().then(action) } }, Path2D: class {}, TextEncoder, TextDecoder, btoa, atob, crypto,
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
});
for (const name of ["stages.js", "fish-data.js", "aquarium-data.js", "achievements.js", "player-data.js", "transfer-code.js", "validation.js", "save-history.js", "save-data.js", "progress.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "game/white-basket", name), "utf8"),
    context, { filename: name });
}
vm.runInContext(`
assert.equal(rareFish.length, 24);
assert.equal(new Set(rareFish.map(({ id }) => id)).size, 24);
assert.equal(newRareFish.filter(({ hint }) => hint).length, 2);
assert.equal(originalRareFish.map(({ id }) => id).join(","),
  "stripe,dot,pink,green,rainbow,night,heart,crystal,crown,angel,ghost,legend");
for (const stage of seaStages) {
  assert.equal(availableSea(stage.id, stage.level), stage);
  if (stage.level > 1) assert.equal(availableSea(stage.id, stage.level - 1), defaultSea);
  assert.equal(availableSea(stage.id, 50), stage);
}
assert.equal(availableSea("__proto__", 50), defaultSea);

const expected = { coast: 0, reef: .22, tropical: .22, deep: .2425, starlit: .09875, phantom: .07625 };
const tierOdds = [.6,.28,.09,.025,.005];
const samples = 400000;
let seed = 20261117;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
for (const stage of seaStages) {
  let hits = 0;
  let added = 0;
  const tiers = [0,0,0,0,0];
  const found = new Set();
  for (let i = 0; i < samples; i++) {
    const fish = rollRareFish(random, stage.id);
    if (!fish) continue;
    assert.ok(fish.stages.includes(stage.id) && !fish.hint);
    found.add(fish.id);
    tiers[fish.tier - 1]++;
    hits++;
    if (fish.outline) added++;
  }
  assert.ok(Math.abs(hits / samples - .10) < .002);
  assert.ok(originalRareFish.every(fish => found.has(fish.id)));
  assert.ok(Math.abs(added / hits - expected[stage.id]) < .008);
  tierOdds.forEach((odds, i) => assert.ok(Math.abs(tiers[i] - hits * odds) < 5 * Math.sqrt(hits * odds)));
  console.log(stage.id + ": rare " + (100 * hits / samples).toFixed(2) + "%, new within rare " +
     (100 * added / hits).toFixed(2) + "%");
}
let deep = newRound(0, new Date(2026,10,17), "deep");
assert.equal(hiddenFishAttempt(deep, 7, true, () => 0), null);
assert.equal(hiddenFishAttempt(deep, 8, false, () => .49).id, "oarfish");
assert.equal(hiddenFishAttempt(deep, 8, true, () => 0), null);
deep = newRound(0, new Date(2026,10,17), "deep");
assert.equal(hiddenFishAttempt(deep, 8, false, () => .5), null);
assert.equal(hiddenFishAttempt(deep, 8, false, () => 0), null);

for (const id of ["starlit","phantom"]) {
  const night = newRound(0, new Date(2026,10,17), id);
  night.feverFish = 2;
  assert.equal(hiddenFishAttempt(night, 11, false, () => 0), null);
  assert.equal(hiddenFishAttempt(night, 11, true, () => 0).id, "moon");
  assert.equal(hiddenFishAttempt(night, 11, true, () => 0), null);
}

const blank = normalizeProgress();
const originalOnly = { ...blank, collection: Object.fromEntries(originalRareFish.map(({ id }) => [id,{count:1}])) };
const mostlyNew = { ...blank, collection: Object.fromEntries(rareFish.slice(6, 18).map(({ id }) => [id,{count:1}])) };
assert.equal(missions.length, 22);
assert.equal(eligibleMissions(originalOnly).some(({id}) => id === "scholar"), true);
assert.equal(eligibleMissions(mostlyNew).some(({id}) => id === "scholar"), false);
const all = { ...blank, xp:28050, collection: Object.fromEntries(rareFish.map(({ id }) => [id,{count:1}])),
  stageCatches:{ deep:1, starlit:1 }};
assert.equal(eligibleMissions(all).filter(({id}) => stageMissions.some(m => m.id === id)).length, 5);
const record = newRound(0, new Date(2026,10,17), "starlit");
recordRoundCatch(record, "jelly", 1, 30);
assert.equal(applyCompletedRound(blank, record).unlocked.some(({id}) => id === "starTraveler"), true);
console.log("PASS 24 fish and IDs, stage limits, rarity distribution, both secrets and original/new achievements");
`, context);
