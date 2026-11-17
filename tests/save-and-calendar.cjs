"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const repo = path.resolve(__dirname, "..");
const map = new Map();
let fail = () => false;
const context = vm.createContext({
  navigator: { locks: { request: (_key, action) => Promise.resolve().then(action) } }, console, Path2D: class {}, TextEncoder, TextDecoder, btoa, atob, crypto,
  assert, deep: (a,b) => assert.equal(JSON.stringify(a),JSON.stringify(b)),
  failWrite: (callback) => { fail = callback; },
  localStorage: {
    getItem: (key) => map.get(key) ?? null,
    setItem(key, value) { if (fail(key, value)) throw Error("blocked"); map.set(key, String(value)); },
    removeItem(key) { if (fail(key, null)) throw Error("blocked"); map.delete(key); }
  }
});
map.set("cat-clicker:white-basket:best", "467");
const legacy = { xp: 990, plays: 8, catches: 103, gold: 5, maxCombo: 19, peakScore: 467,
  days: ["2026-11-14","2026-11-15"], achievements: ["first","beginner","combo10","score300"],
  collection: {ghost: {count: 2, firstSeen: "2026-11-14T03:00:00.000Z"}} };
map.set("cat-clicker:white-basket:progress:v2", JSON.stringify(legacy));
for (const file of ["stages.js","fish-data.js","aquarium-data.js","achievements.js","player-data.js","transfer-code.js","validation.js","save-history.js","save-data.js","progress.js"]) {
  vm.runInContext(fs.readFileSync(path.join(repo, "game/white-basket", file), "utf8"), context, { filename: file });
}
(async () => vm.runInContext(`(async () => {
  await startSaveProtection();
  const old = readProgress();
  const archived = JSON.parse(localStorage.getItem(migrationBackupKey));
  assert.equal(JSON.parse(archived.progress).xp, 990);
  assert.equal(archived.best, "467");
  assert.equal(old.xp, 990);
  assert.equal(old.collection.ghost.count, 2);
  assert.equal(old.achievements.length, 5);
  assert.equal(old.achievements.includes("newSea"), true);
  assert.equal(old.timedPlays, 0);
  assert.equal(old.playMs, 0);
  assert.equal(readStoredBest(), 467);
  assert.equal(playerTitles.find(t => t.id === "ghost").earned(old), true);
  deep(knownPlayStreak(old.days, "2026-11-16"), {current:2,longest:2});
  deep(knownPlayStreak(old.days, "2026-11-17"), {current:0,longest:2});
  assert.equal(weekStart("2026-11-15"), "2026-11-09");
  assert.equal(weekStart("2026-11-16"), "2026-11-16");
  assert.equal(weekStart("2027-01-01"), "2026-12-28");
  const makeRound = (day, stats = {}) => {
    const round = newRound(467, new Date(2026,10,day,12));
    return Object.assign(round, { boots: 1, playMs:30000, finalScore:50 }, stats);
  };
  const sunday = makeRound(15);
  assert.equal((await saveRound(sunday)).xp, 120);
  assert.equal(await saveRound(sunday), undefined);
  assert.equal((await saveRound(makeRound(15))).xp, 20);
  const monday = makeRound(16);
  assert.equal((await saveRound(monday)).xp, 120);
  assert.equal(readProgress().weekly["2026-11-09"].counts.plays, 2);
  assert.equal(readProgress().weekly["2026-11-16"].counts.plays, 1);
  assert.equal(readProgress().daily["2026-11-16"].counts.score, 0);
  assert.equal(readProgress().peakScore, 467);
  assert.equal(readProgress().playMs, 90000);
  assert.equal(readProgress().timedPlays, 3);
  assert.equal(readProgress().plays, 11);
  for (let i = 1; i <= 28; i++) {
    const day = "2026-11-" + String(i).padStart(2, "0");
    const goals = dailyGoals(day);
    assert.equal(goals.length, 3);
    deep(goals, dailyGoals(day));
    deep(goals.map(g => g.xp), [50,100,150]);
  }
  const day = "2026-11-16";
  const threshold = makeRound(16, { catches: 250, gold: 6, maxCombo: 20, roundScore: 500, finalScore: 500,
    boots: 0, collection: { ghost: { count: 8, firstSeen: "2026-11-16T00:00:00.000Z" } } });
  const fastDaily = normalizeProgress();
  fastDaily.daily[day] = emptyPeriod();
  fastDaily.daily[day].counts.plays = 2;
  const fastWeek = emptyPeriod();
  fastWeek.counts.plays = 13;
  fastDaily.weekly[day] = fastWeek;
  const payout = applyCompletedRound(fastDaily, threshold);
  assert.equal(payout.rewards.reduce((sum,r) => sum + r.xp,0), 2500);
  assert.equal(payout.next.daily[day].claimed.length,3);
  assert.equal(payout.next.weekly[day].claimed.length,3);
  assert.equal(applyCompletedRound(payout.next, threshold).rewards.length, 0);
  assert.equal(fastDaily.daily[day].counts.plays, 2);
  assert.equal(fastDaily.weekly[day].claimed.length,0);
  const original = visibleSavePair();
  const v22 = { ...makeSaveArchive(readProgress(), 467), version: 1,
    progress: normalizeProgress(readProgress(), 22) };
  assert.equal(v22.progress.revision, 22);
  const migrated = validateSaveArchive(v22).progress;
  assert.equal(migrated.revision, 26);
  assert.equal(migrated.xp, v22.progress.xp);
  deep(migrated.daily, v22.progress.daily);
  deep(migrated.weekly, v22.progress.weekly);
  deep(migrated.stageCatches, {});
  deep(migrated.seenFish, ["ghost"]);
  assert.equal(migrated.achievements.includes("newSea"), true);
  const incoming = makeSaveArchive(payout.next, 777);
  assert.equal(validateSaveArchive(incoming).best, 777);
  for (const mutate of [
    a => a.format = "other", a => a.version = 99, a => a.progress.xp = -1,
    a => a.best = "777", a => a.progress.collection.ghost.count = 1.5,
    a => a.progress.settings.muted = "true", a => a.progress.daily[day].bonus = 1,
    a => a.progress.weekly["2026-11-17"] = emptyPeriod(), a => a.level = 99,
    a => a.progress.days.push("2026-02-30"),
  ]) {
    const copy = JSON.parse(JSON.stringify(incoming)); mutate(copy);
    assert.throws(() => validateSaveArchive(copy));
    deep(visibleSavePair(), original);
  }
  failWrite(key => key === restoreBackupKey);
  await assert.rejects(restoreSaveArchive(incoming));
  deep(rawSavePair(), original);
  failWrite(key => key === bestKey);
  await assert.rejects(restoreSaveArchive(incoming));
  deep(rawSavePair(), original);
  failWrite(key => key === progressKey);
  await assert.rejects(restoreSaveArchive(incoming));
  deep(rawSavePair(), original);
  failWrite((key, value) => key === progressKey || (key === bestKey && value === original.best));
  await assert.rejects(restoreSaveArchive(incoming));
  deep(visibleSavePair(), original);
  assert.equal(readStoredBest(), 467);
  assert.equal(readProgress().xp, JSON.parse(original.progress).xp);
  failWrite(() => false);
  settleRestore();
  deep(rawSavePair(), original);
  const restored = await restoreSaveArchive(incoming);
  assert.equal(restored.best, 777);
  assert.equal(readStoredBest(), 777);
  deep(JSON.parse(localStorage.getItem(restoreBackupKey)), original);
  assert.equal(JSON.parse(localStorage.getItem(migrationBackupKey)).best, "467");
  assert.equal(localStorage.getItem(restoreJournalKey), null);
  assert.equal(readProgress().daily[day].sweep, true);
  await savePlayerSettings({title:"ghost", muted:false});
  assert.equal(readProgress().settings.title, "ghost");
  assert.equal(readProgress().settings.muted, false);
  const baseXp = readProgress().xp;
  failWrite((key) => key === progressKey);
  const pending = makeRound(18);
  const failed = await saveRound(pending);
  assert.equal(failed.saved, false);
  assert.equal(failed.rewards[0].label, "デイリーボーナス");
  assert.equal(readProgress().xp, baseXp);
  assert.equal(await saveRound(pending), undefined);
  failWrite(() => false);
  const retry = await saveRound(makeRound(18));
  assert.equal(retry.rewards.length, 0);
  assert.equal(readProgress().xp, baseXp + 140);
  const matchingProgress = makeSaveArchive(readProgress(), 788);
  failWrite((key) => key === progressKey);
  await assert.rejects(restoreSaveArchive(matchingProgress));
  failWrite(() => false);
  assert.equal((await restoreSaveArchive(matchingProgress)).best, 788);
  assert.equal(readStoredBest(), 788);
  failWrite(() => false);
  const legacyRestored = await restoreSaveArchive(v22);
  assert.equal(legacyRestored.progress.revision, 26);
  assert.equal(readStoredBest(), 467);
  assert.equal(readProgress().collection.ghost.count, 2);
  assert.equal(readProgress().xp, v22.progress.xp);
  console.log("PASS legacy save, local midnight/Monday, deterministic goals, one-time rewards, streaks, JSON validation and rollback (including failed rollback recovery)");
})()`, context))().catch((error) => { console.error(error); process.exitCode = 1; });
