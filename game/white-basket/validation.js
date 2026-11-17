"use strict";
function saveConflict() {
  const error = new Error("別の画面で保存データが更新されました。再読み込みして続けてください。");
  error.name = "SaveConflict";
  return error;
}
function validTimestamp(value) {
  return typeof value === "string" && value.length <= 35 &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && isPlayDay(value.slice(0, 10)) &&
    Date.parse(value) >= 0 && Date.parse(value) <= 253402300799999;
}
function validateDataShape(root) {
  const stack = [[root, 0]];
  let nodes = 0;
  while (stack.length) {
    const [value, depth] = stack.pop();
    if (++nodes > 250000 || depth > 14) throw new Error("セーブデータの構造が大きすぎます。");
    if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0 || value > 1000000000000000)) throw new Error("不正な数値です。");
    if (typeof value === "string" && value.length > 256) throw new Error("不正な文字列です。");
    if (value && typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length > 20000) throw new Error("セーブデータの項目が多すぎます。");
      for (const [key, entry] of entries) {
        if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("不正な項目です。");
        if ((key === "firstSeen" || key === "exportedAt" || key === "lastCheckedAt") &&
            entry !== null && !validTimestamp(entry)) throw new Error("保存日時が不正です。");
        stack.push([entry, depth + 1]);
      }
    } else if (value !== null && !["number", "string", "boolean"].includes(typeof value)) throw new Error("不正な値です。");
  }
}
function validateRound(round) {
  if (!round || typeof round.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(round.id) ||
      !isPlayDay(round.day) || !Object.hasOwn(stagesById, round.stageId)) throw new Error("プレイデータが不正です。");
  for (const name of ["catches", "gold", "maxCombo", "boots"]) {
    if (!Number.isInteger(round[name]) || round[name] < 0 || round[name] > 256) throw new Error("捕獲数が不正です。");
  }
  if (round.gold > round.catches || !Number.isSafeInteger(round.roundScore) || round.roundScore < 0 ||
      round.roundScore > 100000 || (round.finalScore !== null &&
        (!Number.isSafeInteger(round.finalScore) || round.finalScore < -100000 || round.finalScore > 100000)) ||
      ![0, 30000, 35000].includes(round.playMs)) throw new Error("スコアが不正です。");
  for (const [id, entry] of Object.entries(round.collection)) {
    if (!Object.hasOwn(rareById, id) || !Number.isInteger(entry.count) || entry.count < 1 ||
        entry.count > round.catches || !validTimestamp(entry.firstSeen)) throw new Error("魚の記録が不正です。");
  }
}
