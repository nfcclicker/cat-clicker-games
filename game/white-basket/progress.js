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

function normalizeSettings(raw) {
  return { muted: raw?.muted !== false,
    title: playerTitles.some(({ id }) => id === raw?.title) ? raw.title : "" };
}

function normalizeProgress(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const progress = Object.fromEntries(countFields.map((key) => [key, safeCount(data[key])]));
  progress.days = Array.isArray(data.days)
    ? [...new Set(data.days.filter(isPlayDay))]
    : [];
  progress.achievements = missions.filter(({ id }) =>
    Array.isArray(data.achievements) && data.achievements.includes(id)).map(({ id }) => id);
  progress.collection = {};
  for (const { id } of rareFish) {
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
  progress.revision = 22;
  progress.daily = normalizePeriods(data.daily, false);
  progress.weekly = normalizePeriods(data.weekly, true);
  progress.settings = normalizeSettings(data.settings);
  return progress;
}

function readProgress() {
  try {
    return normalizeProgress(JSON.parse(visibleSavePair().progress));
  } catch {
    return normalizeProgress(null);
  }
}

try { archiveLegacySave(); } catch {
  // Keep reading old data if this browser blocks writes.
}
let savedProgress = readProgress();
let unsavedRounds = [];

function localPlayDay(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0")).join("-");
}

function newRound(bestScore, date = new Date()) {
  return { catches: 0, gold: 0, maxCombo: 0, peakScore: bestScore, collection: {},
    day: localPlayDay(date), playMs: 0, roundScore: 0, finalScore: null, boots: 0,
    committed: false, announced: new Set() };
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

function applyRound(base, round, complete) {
  const next = { ...base, days: [...base.days], achievements: [...base.achievements],
    collection: { ...base.collection } };
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
  if (complete) {
    next.plays = addCounts(next.plays, 1);
    next.xp = addCounts(next.xp, roundXP(round));
    if (round.playMs > 0) {
      next.playMs = addCounts(next.playMs, round.playMs);
      next.timedPlays = addCounts(next.timedPlays, 1);
    }
    if (!next.days.includes(round.day)) next.days.push(round.day);
  }
  return next;
}

function applyCompletedRound(base, round) {
  const next = applyRound(base, round, true);
  const unlocked = eligibleMissions(next);
  next.achievements.push(...unlocked.map(({ id }) => id));
  const rewards = awardPeriodicRewards(next, round);
  const bonusXP = rewards.reduce((sum, reward) => sum + reward.xp, 0);
  next.xp = addCounts(next.xp, bonusXP);
  return { next, unlocked, rewards, xp: roundXP(round) + bonusXP };
}

function commitRound(round) {
  if (round.committed) return;
  round.committed = true;
  // A single write covers all counters. Retry unsaved rounds on the next completion.
  let base = readProgress();
  for (const pending of unsavedRounds) base = applyCompletedRound(base, pending).next;
  const { next, unlocked, rewards, xp } = applyCompletedRound(base, round);
  const discoveries = Object.keys(round.collection).filter((id) => !base.collection[id]);
  savedProgress = next;
  const previousBest = Math.max(readStoredBest(), round.previousBest ?? 0);
  const best = Math.max(previousBest, round.finalScore ?? 0,
    ...unsavedRounds.map((pending) => pending.finalScore ?? 0));
  let saved = false;
  try {
    settleRestore();
    archiveLegacySave();
    if (round.finalScore !== null) localStorage.setItem(bestKey, String(best));
    localStorage.setItem(progressKey, JSON.stringify(next));
    unsavedRounds = [];
    saved = true;
  } catch {
    unsavedRounds.push(round);
  }
  return { xp, rewards, best, previousBest, before: levelInfo(base.xp), after: levelInfo(next.xp),
    unlocked, discoveries, saved };
}

function saveRound(round) {
  return withProgressLock(() => commitRound(round));
}
