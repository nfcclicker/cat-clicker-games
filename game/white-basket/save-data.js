"use strict";

const bestKey = "cat-clicker:white-basket:best";
const migrationBackupKey = "cat-clicker:white-basket:backup:before-v22";
const stageMigrationBackupKey = "cat-clicker:white-basket:backup:before-v23";
const restoreBackupKey = "cat-clicker:white-basket:backup:before-restore";
const restoreJournalKey = "cat-clicker:white-basket:restore-journal";
const saveFormat = "osakana-catch:white-basket";
const saveVersion = 5;
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
  return recoverableSave().pair;
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
  if (!saveWasCommitted(journal, rawSavePair())) writeSavePair(journal.before);
  localStorage.removeItem(restoreJournalKey);
}

function archiveLegacySave() {
  const pair = rawSavePair();
  if (pair.progress === null && pair.best === null) return;
  let revision;
  try { revision = JSON.parse(pair.progress)?.revision; } catch {
    // Preserve the original even if its JSON cannot be decoded.
  }
  if (revision === 26) return;
  if (revision === 25) {
    const key = "cat-clicker:white-basket:backup:before-v26";
    if (localStorage.getItem(key) === null && validSavePair(pair)) localStorage.setItem(key, JSON.stringify(pair));
    return;
  }
  if (revision === 24) {
    const key = "cat-clicker:white-basket:backup:before-v25";
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(pair));
    return;
  }
  if (!validSavePair(pair)) return;
  if (revision !== 22 && revision !== 23 && localStorage.getItem(migrationBackupKey) === null) {
    localStorage.setItem(migrationBackupKey, JSON.stringify(pair));
  }
  if (revision !== 23 && localStorage.getItem(stageMigrationBackupKey) === null) {
    localStorage.setItem(stageMigrationBackupKey, JSON.stringify(pair));
  }
  if (localStorage.getItem(safetyMigrationKey) === null) {
    localStorage.setItem(safetyMigrationKey, JSON.stringify(pair));
  }
}

function markFishSeen(id) {
  return withProgressLock(() => {
    settleRestore();
    const progress = readProgress();
    if (!progress.collection[id] || progress.seenFish.includes(id)) return false;
    archiveLegacySave();
    progress.seenFish.push(id);
    persistProgress(progress, undefined, { notify: !unsavedRounds.length });
    if (unsavedRounds.length) savedProgress.seenFish = progress.seenFish;
    else savedProgress = progress;
    return true;
  }).catch((error) => {
    reportSaveError();
    throw error;
  });
}

function readStoredBest() {
  try { return safeCount(Number(visibleSavePair().best)); } catch { return 0; }
}

function withDatabaseLock(action) {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("同時保存を保護できないため保存を中止しました。"));
  }
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("osakana-catch-save-lock", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("lock");
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error("保存用のロックを開けません。"));
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction("lock", "readwrite");
      let result;
      let failure;
      transaction.oncomplete = () => { database.close(); resolve(result); };
      transaction.onabort = () => { database.close(); reject(failure ?? transaction.error); };
      transaction.objectStore("lock").get("writer").onsuccess = () => {
        try { result = action(); } catch (error) { failure = error; transaction.abort(); }
      };
    };
  });
}

async function withProgressLock(action) {
  if (!navigator.locks) return withDatabaseLock(action);
  let started = false;
  try {
    return await navigator.locks.request(progressKey, () => {
      started = true;
      return action();
    });
  } catch (error) {
    if (started) throw error;
    return withDatabaseLock(action);
  }
}

function savePlayerSettings(update) {
  return withProgressLock(() => {
    settleRestore();
    archiveLegacySave();
    const next = readProgress();
    next.settings = normalizeSettings({ ...next.settings, ...update });
    persistProgress(next, undefined, { notify: !unsavedRounds.length });
    if (unsavedRounds.length) savedProgress.settings = next.settings;
    else savedProgress = next;
    return next.settings;
  }).catch((error) => {
    reportSaveError();
    throw error;
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
  const revision = [22, 23, 24, 25, 26][raw?.version - 1];
  if (!Number.isInteger(raw?.version) || !revision || raw.format !== saveFormat || raw.progress?.revision !== revision) {
    throw new Error("このゲームに対応したセーブデータではありません。");
  }
  if (!Number.isSafeInteger(raw.best) || raw.best < 0 || raw.best > 100000 ||
      typeof raw.exportedAt !== "string" || !Number.isFinite(Date.parse(raw.exportedAt))) {
    throw new Error("ハイスコアまたは保存日時が不正です。");
  }
  validateDataShape(raw);
  const progress = normalizeProgress(raw.progress, revision);
  const level = levelInfo(progress.xp).level;
  if (level !== raw.level || progress.timedPlays > progress.plays ||
      progress.playMs < progress.timedPlays * 30000 || progress.playMs > progress.timedPlays * 35000 ||
      !equivalentData(raw.progress, progress) ||
      !validPeriodRewards(progress.daily, false) || !validPeriodRewards(progress.weekly, true)) {
    throw new Error("セーブデータの項目または値が不正です。");
  }
  return { best: raw.best, level, exportedAt: raw.exportedAt, progress: migrateProgress(progress) };
}

function restoreSaveArchive(raw, expectedCounter) {
  const incoming = validateSaveArchive(raw);
  return withProgressLock(() => {
    if (expectedCounter !== undefined && readProgress().saveCounter !== expectedCounter) throw saveConflict();
    let restoreSnapshot;
    if (unsavedRounds.length) {
      const pending = pendingRoundResult();
      restoreSnapshot = { best: String(pending.best), progress: JSON.stringify(normalizeProgress(pending.next)) };
    }
    if (typeof sessionConflict === "function" && sessionConflict()) throw saveConflict();
    incoming.progress.saveCounter = readProgress().saveCounter;
    incoming.progress.saveEpoch = crypto.randomUUID();
    persistProgress(incoming.progress, incoming.best, { restore: true, restoreSnapshot });
    unsavedRounds = [];
    savedProgress = incoming.progress;
    return incoming;
  }).catch((error) => {
    reportSaveError();
    throw error;
  });
}
