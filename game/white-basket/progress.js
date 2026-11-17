"use strict";

const progressKey = "cat-clicker:white-basket:progress:v2";
const countFields = ["xp", "plays", "catches", "gold", "maxCombo", "peakScore", "playMs", "timedPlays"];
const safeCount = (value) => Number.isSafeInteger(value) && value > 0 ? value : 0;
const addCounts = (first, second) => Math.min(Number.MAX_SAFE_INTEGER, first + second);
const maxLevel = 50;

function isPlayDay(day) {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(day + "T00:00:00Z");
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === day;
}

function normalizeSettings(raw, revision = 24) {
  const normalized = { muted: raw?.muted !== false,
    title: playerTitles.some(({ id }) => id === raw?.title) ? raw.title : "" };
  if (revision >= 24) normalized.stage = Object.hasOwn(stagesById, raw?.stage) ? raw.stage : defaultSea.id;
  return normalized;
}

function normalizeProgress(raw, revision = 25) {
  const data = raw && typeof raw === "object" ? raw : {};
  const progress = Object.fromEntries(countFields.map((key) => [key, safeCount(data[key])]));
  progress.days = Array.isArray(data.days)
    ? [...new Set(data.days.filter(isPlayDay))]
    : [];
  progress.achievements = (revision === 22 ? originalMissions : missions).filter(({ id }) =>
    Array.isArray(data.achievements) && data.achievements.includes(id)).map(({ id }) => id);
  progress.collection = {};
  for (const { id } of (revision === 22 ? originalRareFish : rareFish)) {
    const entry = data.collection?.[id];
    const count = safeCount(entry?.count);
    if (count) {
      progress.collection[id] = {
        count,
        firstSeen: typeof entry.firstSeen === "string" && Number.isFinite(Date.parse(entry.firstSeen))
          ? entry.firstSeen : null,
      };
    }
  }
  progress.revision = revision;
  progress.daily = normalizePeriods(data.daily, false);
  progress.weekly = normalizePeriods(data.weekly, true);
  progress.settings = normalizeSettings(data.settings, revision);
  if (revision >= 23) {
    progress.stageCatches = {};
    for (const { id } of seaStages) {
      const catches = safeCount(data.stageCatches?.[id]);
      if (catches) progress.stageCatches[id] = catches;
    }
    const seen = Array.isArray(data.seenFish) ? data.seenFish
      : !(data.revision >= 23) ? Object.keys(progress.collection) : [];
    progress.seenFish = Object.keys(progress.collection).filter((id) => seen.includes(id));
  }
  if (revision >= 25) {
    progress.saveCounter = safeCount(data.saveCounter);
    progress.checkpoints = {};
    if (data.checkpoints && typeof data.checkpoints === "object") {
      for (const [id, entry] of Object.entries(data.checkpoints).slice(-32)) {
        if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || !entry || typeof entry !== "object") continue;
        const fish = {};
        for (const [fishId, count] of Object.entries(entry.fish ?? {})) {
          if (Object.hasOwn(rareById, fishId)) fish[fishId] = safeCount(count);
        }
        progress.checkpoints[id] = { catches: safeCount(entry.catches), gold: safeCount(entry.gold), fish };
      }
    }
    progress.saveEpoch = typeof data.saveEpoch === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(data.saveEpoch) ? data.saveEpoch : "initial";
    progress.receipts = Array.isArray(data.receipts) ? [...new Set(data.receipts.filter(id =>
      typeof id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(id)))].slice(-512) : [];
    progress.lastRewardDay = isPlayDay(data.lastRewardDay) ? data.lastRewardDay : "";
    progress.lastCheckedAt = typeof data.lastCheckedAt === "string" && validTimestamp(data.lastCheckedAt) ? data.lastCheckedAt : null;
  }
  return progress;
}

function migrateProgress(raw) {
  const progress = normalizeProgress(raw);
  if (levelInfo(progress.xp).level >= 5 && !progress.achievements.includes("newSea")) {
    progress.achievements.push("newSea");
  }
  return progress;
}

function readProgress() {
  try {
    return migrateProgress(JSON.parse(visibleSavePair().progress));
  } catch {
    return normalizeProgress(null);
  }
}


let savedProgress = readProgress();
let unsavedRounds = [];

function localPlayDay(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0")).join("-");
}

function newRound(bestScore, date = new Date(), stageId = defaultSea.id) {
  return { catches: 0, gold: 0, maxCombo: 0, peakScore: bestScore, collection: {},
    day: localPlayDay(date), playMs: 0, roundScore: 0, finalScore: null, boots: 0,
    id: crypto.randomUUID(), bornCounter: readProgress().saveCounter, epoch: readProgress().saveEpoch, owner: typeof sessionHeld !== "undefined" && sessionHeld ? sessionOwner : null, stageId, hiddenAttempted: false, feverFish: 0, committed: false, announced: new Set(),
    savedCatches: 0, savedGold: 0, savedFish: {}, earlyAchievements: [], earlyDiscoveries: [] };
}

function levelInfo(totalXP) {
  let xp = totalXP;
  for (let level = 1; level < maxLevel; level += 1) {
    const needed = 100 + (level - 1) * 50;
    if (xp < needed) return { level, xp, needed };
    xp -= needed;
  }
  return { level: maxLevel, xp: 1, needed: 1 };
}

function roundXP(round) {
  return 20 + (round.catches - round.gold) * 2 + round.gold * 10 +
    (round.maxCombo >= 10 ? 15 : 0) + (round.maxCombo >= 20 ? 25 : 0);
}

function recordRoundCatch(round, type, combo, score, now = new Date()) {
  if (type === "boot") return;
  round.catches += 1;
  round.maxCombo = Math.max(round.maxCombo, combo);
  round.peakScore = Math.max(round.peakScore, score);
  round.roundScore = Math.max(round.roundScore, score);
  if (type === "gold") round.gold += 1;
  if (Object.hasOwn(rareById, type)) {
    const entry = round.collection[type] ??= { count: 0, firstSeen: now.toISOString() };
    entry.count += 1;
  }
}

function applyRound(base, round) {
  const next = { ...base, days: [...base.days], achievements: [...base.achievements],
    collection: { ...base.collection }, stageCatches: { ...base.stageCatches } };
  if (round.catches) next.stageCatches[round.stageId] = addCounts(next.stageCatches[round.stageId] ?? 0, round.catches);
  next.catches = addCounts(next.catches, round.catches);
  next.gold = addCounts(next.gold, round.gold);
  next.maxCombo = Math.max(next.maxCombo, round.maxCombo);
  next.peakScore = Math.max(next.peakScore, round.peakScore);
  for (const [id, entry] of Object.entries(round.collection)) {
    const current = next.collection[id];
    next.collection[id] = {
      count: addCounts(current?.count ?? 0, entry.count),
      firstSeen: current?.firstSeen && Date.parse(current.firstSeen) <= Date.parse(entry.firstSeen)
        ? current.firstSeen : entry.firstSeen,
    };
  }
  return next;
}

function catchDelta(round, base = readProgress()) {
  const receipt = base.checkpoints[round.id];
  const collection = {};
  for (const [id, entry] of Object.entries(round.collection)) {
    const count = entry.count - (receipt?.fish[id] ?? round.savedFish[id] ?? 0);
    if (count) collection[id] = { count, firstSeen: entry.firstSeen };
  }
  return { ...round, catches: round.catches - (receipt?.catches ?? round.savedCatches), gold: round.gold - (receipt?.gold ?? round.savedGold), collection };
}

function checkpointRound(round) {
  if (round.checkpointPending || round.committed) return;
  round.checkpointPending = true;
  void withProgressLock(() => {
    if (round.committed) return;
    assertRoundWritable(round);
    const base = readProgress();
    if (base.receipts.includes(round.id)) return;
    const delta = catchDelta(round, base);
    if (!delta.catches) return;
    const next = applyRound(base, delta);
    const unlocked = eligibleMissions(next);
    const discoveries = Object.keys(delta.collection).filter((id) => !base.collection[id]);
    next.achievements.push(...unlocked.map(({ id }) => id));
    next.checkpoints = { ...next.checkpoints, [round.id]: { catches: round.catches, gold: round.gold,
      fish: Object.fromEntries(Object.entries(round.collection).map(([id, entry]) => [id, entry.count])) } };
    persistProgress(next, undefined, { notify: !unsavedRounds.length });
    round.savedCatches = round.catches;
    round.savedGold = round.gold;
    round.savedFish = Object.fromEntries(Object.entries(round.collection).map(([id, entry]) => [id, entry.count]));
    round.earlyAchievements.push(...unlocked);
    round.earlyDiscoveries.push(...discoveries);
    if (!unsavedRounds.length) savedProgress = next;
  }).catch(reportSaveError).finally(() => { round.checkpointPending = false; });
}

function assertRoundWritable(round) {
  validateRound(round);
  if (typeof assertRoundSession === "function") assertRoundSession(round);
  const current = readProgress();
  if (current.saveEpoch !== round.epoch || !Number.isSafeInteger(round.bornCounter) ||
      current.saveCounter - round.bornCounter > 512) throw saveConflict();
}

function applyCompletedRound(base, round) {
  if (base.receipts.includes(round.id)) return { next: base, unlocked: [], rewards: [], xp: 0 };
  const next = applyRound(base, catchDelta(round, base));
  next.checkpoints = { ...next.checkpoints };
  delete next.checkpoints[round.id];
  next.receipts = [...next.receipts, round.id].slice(-512);
  next.plays = addCounts(next.plays, 1);
  next.xp = addCounts(next.xp, roundXP(round));
  if (round.playMs > 0) {
    next.playMs = addCounts(next.playMs, round.playMs);
    next.timedPlays = addCounts(next.timedPlays, 1);
  }
  if (!next.days.includes(round.day)) next.days.push(round.day);
  const rewards = awardPeriodicRewards(next, round);
  const bonusXP = rewards.reduce((sum, reward) => sum + reward.xp, 0);
  next.xp = addCounts(next.xp, bonusXP);
  const unlocked = eligibleMissions(next);
  next.achievements.push(...unlocked.map(({ id }) => id));
  return { next, unlocked, rewards, xp: roundXP(round) + bonusXP };
}

function commitRound(round) {
  if (round.committed) return;
  assertRoundWritable(round);
  round.committed = true;
  // A single write covers all counters. Retry unsaved rounds on the next completion.
  let base = readProgress();
  for (const pending of unsavedRounds) { assertRoundWritable(pending); base = applyCompletedRound(base, pending).next; }
  const { next, unlocked, rewards, xp } = applyCompletedRound(base, round);
  const discoveries = [...round.earlyDiscoveries,
    ...Object.keys(round.collection).filter((id) => !base.collection[id])];
  savedProgress = next;
  const previousBest = Math.max(readStoredBest(), round.previousBest ?? 0);
  const best = Math.max(previousBest, round.finalScore ?? 0,
    ...unsavedRounds.map((pending) => pending.finalScore ?? 0));
  let saved = false;
  try {
    persistProgress(next, best);
    unsavedRounds = [];
    saved = true;
  } catch {
    unsavedRounds.push(round);
    reportSaveError();
  }
  return { xp, rewards, best, previousBest, before: levelInfo(base.xp), after: levelInfo(next.xp),
    unlocked: [...round.earlyAchievements, ...unlocked], discoveries, saved };
}

function saveRound(round) {
  return withProgressLock(() => commitRound(round)).catch((error) => {
    if (!round.committed) {
      assertRoundWritable(round);
  round.committed = true;
      unsavedRounds.push(round);
    }
    throw error;
  });
}

function pendingRoundResult() {
  let next = readProgress();
  let best = readStoredBest();
  for (const round of unsavedRounds) {
    assertRoundWritable(round); next = applyCompletedRound(next, round).next;
    best = Math.max(best, round.finalScore ?? 0, round.previousBest ?? 0);
  }
  return { next, best };
}

function retryPendingRounds() {
  return withProgressLock(() => {
    if (!unsavedRounds.length) return;
    const { next, best } = pendingRoundResult();
    persistProgress(next, best);
    savedProgress = next;
    unsavedRounds = [];
  }).catch(reportSaveError);
}
