"use strict";

const bestKey = "cat-clicker:white-basket:best";
const migrationBackupKey = "cat-clicker:white-basket:backup:before-v22";
const stageMigrationBackupKey = "cat-clicker:white-basket:backup:before-v23";
const restoreBackupKey = "cat-clicker:white-basket:backup:before-restore";
const restoreJournalKey = "cat-clicker:white-basket:restore-journal";
const saveFormat = "osakana-catch:white-basket";
const saveVersion = 2;
const maxSaveBytes = 2 * 1024 * 1024;

function rawSavePair() {
  return { progress: localStorage.getItem(progressKey), best: localStorage.getItem(bestKey) };
}

function samePair(first, second) {
  return first.progress === second.progress && first.best === second.best;
}

function pendingRestore() {
  const raw = localStorage.getItem(restoreJournalKey);
  if (!raw) return null;
  try {
    const journal = JSON.parse(raw);
    const validPair = (pair) => pair && ["progress", "best"].every((key) =>
      pair[key] === null || typeof pair[key] === "string");
    if (validPair(journal.before) && validPair(journal.after)) return journal;
  } catch {
    // A damaged journal cannot describe a recoverable transaction.
  }
  return null;
}

function visibleSavePair() {
  const current = rawSavePair();
  const journal = pendingRestore();
  return journal && !samePair(current, journal.after) ? journal.before : current;
}

function writeStoredValue(key, value) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

function writeSavePair(target) {
  const current = rawSavePair();
  if (current.best !== target.best) writeStoredValue(bestKey, target.best);
  if (current.progress !== target.progress) writeStoredValue(progressKey, target.progress);
}

function settleRestore() {
  const journal = pendingRestore();
  if (!journal) return;
  if (!samePair(rawSavePair(), journal.after)) writeSavePair(journal.before);
  localStorage.removeItem(restoreJournalKey);
}

function archiveLegacySave() {
  const pair = visibleSavePair();
  if (pair.progress === null && pair.best === null) return;
  let revision;
  try { revision = JSON.parse(pair.progress)?.revision; } catch {
    // Preserve the original even if its JSON cannot be decoded.
  }
  if (revision === 23) return;
  if (revision !== 22 && localStorage.getItem(migrationBackupKey) === null) {
    localStorage.setItem(migrationBackupKey, JSON.stringify(pair));
  }
  if (localStorage.getItem(stageMigrationBackupKey) === null) {
    localStorage.setItem(stageMigrationBackupKey, JSON.stringify(pair));
  }
}

function markFishSeen(id) {
  return withProgressLock(() => {
    settleRestore();
    const progress = readProgress();
    if (!progress.collection[id] || progress.seenFish.includes(id)) return false;
    archiveLegacySave();
    progress.seenFish.push(id);
    localStorage.setItem(progressKey, JSON.stringify(progress));
    if (unsavedRounds.length) savedProgress.seenFish = progress.seenFish;
    else savedProgress = progress;
    return true;
  });
}

function readStoredBest() {
  try { return safeCount(Number(visibleSavePair().best)); } catch { return 0; }
}

async function withProgressLock(action) {
  if (!navigator.locks) return action();
  let started = false;
  try {
    return await navigator.locks.request(progressKey, () => {
      started = true;
      return action();
    });
  } catch (error) {
    if (started) throw error;
    return action();
  }
}

function savePlayerSettings(update) {
  return withProgressLock(() => {
    settleRestore();
    archiveLegacySave();
    const next = readProgress();
    next.settings = normalizeSettings({ ...next.settings, ...update });
    localStorage.setItem(progressKey, JSON.stringify(next));
    if (unsavedRounds.length) savedProgress.settings = next.settings;
    else savedProgress = next;
    return next.settings;
  });
}

function makeSaveArchive(progress, best, date = new Date()) {
  const data = normalizeProgress(progress);
  return { format: saveFormat, version: saveVersion, exportedAt: date.toISOString(),
    best, level: levelInfo(data.xp).level, progress: data };
}

function equivalentData(first, second) {
  if (first === second) return true;
  if (!first || !second || typeof first !== "object" || typeof second !== "object" ||
      Array.isArray(first) !== Array.isArray(second)) return false;
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length &&
    keys.every((key) => Object.hasOwn(second, key) && equivalentData(first[key], second[key]));
}

function validPeriodRewards(periods, weekly) {
  return Object.entries(periods).every(([day, period]) => {
    const goals = weekly ? weeklyGoals : dailyGoals(day);
    const complete = goals.filter((goal) => period.counts[goal.metric] >= goal.target);
    return period.claimed.length === complete.length &&
      complete.every(({ id }) => period.claimed.includes(id)) &&
      period.bonus === (!weekly && period.counts.plays > 0) &&
      period.sweep === (!weekly && complete.length === goals.length);
  });
}

function validateSaveArchive(raw) {
  const revision = raw?.version === 1 ? 22 : raw?.version === saveVersion ? 23 : null;
  if (!revision || raw.format !== saveFormat || raw.progress?.revision !== revision) {
    throw new Error("このゲームに対応したセーブデータではありません。");
  }
  if (!Number.isSafeInteger(raw.best) || raw.best < 0 ||
      typeof raw.exportedAt !== "string" || !Number.isFinite(Date.parse(raw.exportedAt))) {
    throw new Error("ハイスコアまたは保存日時が不正です。");
  }
  const progress = normalizeProgress(raw.progress, revision);
  const level = levelInfo(progress.xp).level;
  if (level !== raw.level || progress.timedPlays > progress.plays ||
      progress.playMs < progress.timedPlays * 30000 || progress.playMs > progress.timedPlays * 35000 ||
      !equivalentData(raw.progress, progress) ||
      !validPeriodRewards(progress.daily, false) || !validPeriodRewards(progress.weekly, true)) {
    throw new Error("セーブデータの項目または値が不正です。");
  }
  return { best: raw.best, level, progress: migrateProgress(progress) };
}

function restoreSaveArchive(raw) {
  const incoming = validateSaveArchive(raw);
  return withProgressLock(() => {
    settleRestore();
    archiveLegacySave();
    const before = rawSavePair();
    const after = { best: String(incoming.best), progress: JSON.stringify(incoming.progress) };
    // Store recovery data first. The progress write is the commit point.
    localStorage.setItem(restoreBackupKey, JSON.stringify(before));
    localStorage.setItem(restoreJournalKey, JSON.stringify({ before, after }));
    try {
      writeSavePair(after);
    } catch (error) {
      try {
        writeSavePair(before);
        localStorage.removeItem(restoreJournalKey);
      } catch {
        // Reads keep using the previous pair until storage accepts rollback.
      }
      throw error;
    }
    try { settleRestore(); } catch {
      // Both keys are committed, so the journal can be cleared on the next write.
    }
    unsavedRounds = [];
    savedProgress = incoming.progress;
    return incoming;
  });
}
