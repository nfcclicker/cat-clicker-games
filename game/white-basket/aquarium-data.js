"use strict";

const aquariumTargets = Object.freeze({ coast: 0, reef: 300, tropical: 400, deep: 500, starlit: 600, phantom: 800 });

function aquariumCapacity(level) {
  return level >= 50 ? 30 : level >= 40 ? 25 : level >= 30 ? 20 : level >= 20 ? 15 : level >= 10 ? 10 : 5;
}

function normalizeStageRecords(raw) {
  const records = {};
  for (const stage of seaStages) {
    const entry = raw?.[stage.id];
    if (!entry || typeof entry !== "object") continue;
    records[stage.id] = {
      best: safeCount(entry.best), cleared: safeCount(entry.best) >= aquariumTargets[stage.id],
      clearedAt: safeCount(entry.best) >= aquariumTargets[stage.id] && validTimestamp(entry.clearedAt) ? entry.clearedAt : null,
    };
  }
  return records;
}

function aquariumBackgrounds(records) {
  return seaStages.filter(({ id }) => id === "coast" || (records[id]?.best ?? 0) >= aquariumTargets[id])
    .map(({ id }) => id);
}

function normalizeAquarium(raw, collection, xp, stageRecords) {
  const backgrounds = aquariumBackgrounds(stageRecords);
  const counts = {};
  const fish = [];
  if (Array.isArray(raw?.fish)) {
    for (const id of raw.fish.slice(0, 30)) {
      if (!Object.hasOwn(rareById, id) || !collection[id] ||
          (counts[id] ?? 0) >= collection[id].count || fish.length >= aquariumCapacity(levelInfo(xp).level)) continue;
      counts[id] = (counts[id] ?? 0) + 1;
      fish.push(id);
    }
  }
  return { initialized: raw?.initialized === true, fish,
    background: backgrounds.includes(raw?.background) ? raw.background : "coast", backgrounds,
    feeds: safeCount(raw?.feeds), peak: Math.max(Math.min(30, safeCount(raw?.peak)), fish.length),
    lastFeedAt: validTimestamp(raw?.lastFeedAt) ? raw.lastFeedAt : null };
}

function initialAquariumFish(progress) {
  const fish = [];
  for (const id of Object.keys(progress.collection)) {
    for (let i = 0; i < progress.collection[id].count && fish.length < 5; i++) fish.push(id);
    if (fish.length === 5) break;
  }
  return fish;
}

function recordStageClear(progress, round, date = new Date()) {
  const records = { ...progress.stageRecords };
  const previous = records[round.stageId] ?? { best: 0, clearedAt: null };
  const best = Math.max(previous.best, round.finalScore ?? 0);
  const cleared = best >= aquariumTargets[round.stageId];
  const unlocked = round.stageId !== "coast" && cleared && !progress.aquarium.backgrounds.includes(round.stageId);
  records[round.stageId] = { best, cleared,
    clearedAt: previous.clearedAt ?? (!previous.cleared && cleared ? date.toISOString() : null) };
  progress.stageRecords = records;
  progress.aquarium = { ...progress.aquarium, backgrounds: aquariumBackgrounds(records) };
  return unlocked ? round.stageId : null;
}

function saveAquariumEdit(edit, expectedEpoch) {
  return withProgressLock(() => {
    const next = readProgress();
    if (next.saveEpoch !== expectedEpoch) throw saveConflict();
    if (typeof sessionConflict === "function" && sessionConflict()) throw saveConflict();
    const aquarium = { ...next.aquarium, fish: [...next.aquarium.fish] };
    edit(aquarium, next);
    const normalized = normalizeAquarium(aquarium, next.collection, next.xp, next.stageRecords);
    if (!equivalentData(aquarium, normalized)) throw new Error("展示できる魚の数や背景を確認してください。");
    next.aquarium = normalized;
    const unlocked = eligibleMissions(next);
    next.achievements.push(...unlocked.map(({ id }) => id));
    persistProgress(next);
    savedProgress = readProgress();
    return { progress: savedProgress, unlocked };
  }).catch(error => { reportSaveError(error); throw error; });
}

function addExhibit(aquarium, progress, id, amount) {
  if (!Object.hasOwn(progress.collection, id) || !Object.hasOwn(rareById, id)) throw new Error("まだ捕獲していない魚です。");
  if (amount === 1) {
    const count = aquarium.fish.filter(fish => fish === id).length;
    if (aquarium.fish.length >= aquariumCapacity(levelInfo(progress.xp).level) || count >= progress.collection[id].count) {
      throw new Error("展示数の上限です。");
    }
    aquarium.fish.push(id);
  } else if (amount === -1) {
    const index = aquarium.fish.lastIndexOf(id);
    if (index >= 0) aquarium.fish.splice(index, 1);
  } else throw new Error("展示数が不正です。");
  aquarium.initialized = true;
  aquarium.peak = Math.max(aquarium.peak, aquarium.fish.length);
}

function finishAquariumFeed(aquarium, date = new Date()) {
  if (aquarium.lastFeedAt && date.getTime() - Date.parse(aquarium.lastFeedAt) < 10000) {
    throw new Error("少し待ってからエサをあげてね。");
  }
  aquarium.feeds = addCounts(aquarium.feeds, 1);
  aquarium.lastFeedAt = date.toISOString();
}
