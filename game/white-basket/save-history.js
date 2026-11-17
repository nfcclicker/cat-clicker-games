"use strict";

const saveHistoryKey = "cat-clicker:white-basket:save-history";
const safetyMigrationKey = "cat-clicker:white-basket:backup:before-v24";
const externalBackupKey = "cat-clicker:white-basket:last-external-backup";
const noSavePair = Object.freeze({ best: null, progress: null });
const saveEncoder = new TextEncoder();
let cachedHistoryRaw;
let cachedHistory = [];
let saveStatus = { kind: "idle", at: null };
let saveSequence = 0;

function publishSaveStatus(kind, at = null) {
  saveStatus = { kind, at };
  if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("save-status"));
}

function readSaveHistory() {
  const raw = localStorage.getItem(saveHistoryKey);
  if (cachedHistoryRaw === raw) return cachedHistory;
  let snapshots = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) snapshots = parsed.slice(0, 3).filter((entry) =>
      typeof entry?.id === "string" && typeof entry.at === "string" && Number.isFinite(Date.parse(entry.at)) &&
      validSavePair(entry.pair) && entry.digest === checksum(saveEncoder.encode(JSON.stringify(entry.pair))));
  } catch {
    // Only validated snapshots are used during recovery.
  }
  cachedHistoryRaw = raw;
  cachedHistory = snapshots;
  return snapshots;
}

function validSavePair(pair) {
  if (!pair || (pair.best !== null && typeof pair.best !== "string") ||
      (pair.progress !== null && typeof pair.progress !== "string")) return false;
  if (pair.best !== null && (!/^\d+$/.test(pair.best) || !Number.isSafeInteger(Number(pair.best)) || Number(pair.best) > 100000)) return false;
  if (pair.progress === null) return true;
  if (pair.progress.length > maxSaveBytes) return false;
  try {
    const raw = JSON.parse(pair.progress);
    if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
        (raw.revision !== undefined && ![22, 23, 24, 25, 26].includes(raw.revision))) return false;
    validateDataShape(raw);
    if (raw.revision >= 24) {
      const normalized = normalizeProgress(raw, raw.revision);
      return equivalentData(raw, normalized) && validPeriodRewards(normalized.daily, false) &&
        validPeriodRewards(normalized.weekly, true) && normalized.timedPlays <= normalized.plays &&
        normalized.playMs >= normalized.timedPlays * 30000 && normalized.playMs <= normalized.timedPlays * 35000;
    }
    const normalized = normalizeProgress(raw, raw.revision ?? 22);
    for (const [name, weekly] of [["daily", false], ["weekly", true]]) {
      if (!Object.hasOwn(raw, name)) continue;
      if (!raw[name] || typeof raw[name] !== "object" || Array.isArray(raw[name]) ||
          Object.keys(raw[name]).length !== Object.keys(normalized[name]).length ||
          !validPeriodRewards(normalized[name], weekly)) return false;
      for (const [day, period] of Object.entries(raw[name])) {
        const target = normalized[name][day];
        if (!target || !Array.isArray(period?.claimed) ||
            !equivalentData({ ...period, claimed: [...period.claimed].sort() },
              { ...target, claimed: [...target.claimed].sort() })) return false;
      }
    }
    const unordered = new Set(["achievements", "seenFish"]);
    return Object.keys(raw).every((key) => {
      if (!Object.hasOwn(normalized, key) || key === "daily" || key === "weekly") return true;
      if (unordered.has(key) && Array.isArray(raw[key])) {
        return equivalentData([...raw[key]].sort(), [...normalized[key]].sort());
      }
      return equivalentData(raw[key], normalized[key]);
    });
  } catch {
    return false;
  }
}

function recoverableSave() {
  const raw = rawSavePair();
  const history = readSaveHistory();
  const journal = pendingRestore();
  if (journal && !saveWasCommitted(journal, raw, history)) {
    if (validSavePair(journal.before)) return { pair: journal.before, history, repair: true };
  }
  const newest = history[0];
  if (newest && samePair(raw, newest.pair)) return { pair: raw, history, repair: false };
  if (!newest && validSavePair(raw)) return { pair: raw, history, repair: false };
  if (newest) return { pair: newest.pair, history, repair: true };
  return { pair: noSavePair, history, repair: true, damaged: true };
}

function saveWasCommitted(journal, raw, history = readSaveHistory()) {
  return journal.commit ? history[0]?.id === journal.commit : samePair(raw, journal.after);
}

function snapshotFor(pair, at) {
  return { id: globalThis.crypto?.randomUUID?.() ?? at + "-" + (++saveSequence),
    at, pair, digest: checksum(saveEncoder.encode(JSON.stringify(pair))) };
}

function persistSavePair(after, { restore = false, recovery = false, restoreSnapshot, notify = true } = {}) {
  settleRestore();
  const source = recoverableSave();
  if (source.damaged && !restore) throw new Error("正常なセーブを確認できません。");
  archiveLegacySave();
  const before = source.damaged ? rawSavePair() : source.pair;
  const currentData = source.damaged ? normalizeProgress(null) : migrateProgress(JSON.parse(before.progress));
  const nextData = after.progress === null ? null : JSON.parse(after.progress);
  if (nextData && !recovery) {
    if (nextData.revision !== 26 || nextData.saveCounter !== currentData.saveCounter ||
        (!restore && nextData.saveEpoch !== currentData.saveEpoch)) throw saveConflict();
    nextData.saveCounter = currentData.saveCounter + 1;
    after = { ...after, progress: JSON.stringify(nextData) };
  }
  if (!validSavePair(after)) throw new Error("保存するデータが不正です。");

  if (restore) localStorage.setItem(restoreBackupKey, JSON.stringify(restoreSnapshot ?? before));
  const latest = source.history[0];
  if (!restore && !recovery && !source.repair && latest && samePair(latest.pair, after)) {
    if (notify) publishSaveStatus("saved", latest.at);
    return latest.at;
  }

  const at = new Date().toISOString();
  const snapshot = snapshotFor(after, at);
  const history = [snapshot];
  // Preserve the previous logical save even if the raw keys had to be recovered.
  if (!source.damaged && !samePair(before, after) && (before.best !== null || before.progress !== null)) {
    history.push(source.history.find((entry) => samePair(entry.pair, before)) ?? snapshotFor(before, at));
  }
  for (const entry of source.history) {
    if (history.length === 3) break;
    if (!history.some((known) => samePair(known.pair, entry.pair))) history.push(entry);
  }

  const journal = { before, after, commit: snapshot.id };
  localStorage.setItem(restoreJournalKey, JSON.stringify(journal));
  try {
    writeSavePair(after);
    const encoded = JSON.stringify(history);
    localStorage.setItem(saveHistoryKey, encoded);
    cachedHistoryRaw = encoded;
    cachedHistory = history;
  } catch (error) {
    try {
      writeSavePair(before);
      localStorage.removeItem(restoreJournalKey);
    } catch {
      // Keep the journal so reads still use the last normal save.
    }
    throw error;
  }
  try { localStorage.removeItem(restoreJournalKey); } catch { /* Already committed. */ }
  if (notify) publishSaveStatus(recovery || source.repair && !restore ? "recovered" : "saved", at);
  return at;
}

function persistProgress(progress, best = visibleSavePair().best, options) {
  const value = typeof best === "number" ? String(best) : best;
  return persistSavePair({ best: value, progress: JSON.stringify(normalizeProgress(progress)) }, options);
}

function startSaveProtection() {
  return withProgressLock(() => {
    const source = recoverableSave();
    if (source.damaged) { publishSaveStatus("failed", source.history[0]?.at); return; }
    if (source.repair) {
      persistSavePair(source.pair, { recovery: true });
    } else if ((!source.history.length || JSON.parse(source.pair.progress)?.revision !== 26) && (source.pair.progress !== null || source.pair.best !== null)) {
      persistProgress(migrateProgress(JSON.parse(source.pair.progress)), source.pair.best);
    } else if (source.history.length && saveStatus.kind === "idle") {
      publishSaveStatus("idle", source.history[0].at);
    }
  }).catch(reportSaveError);
}

function reportSaveError(error) {
  publishSaveStatus(error?.name === "SaveConflict" ? "conflict" : "failed", saveStatus.at);
}
