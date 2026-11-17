"use strict";

const missions = [
  ["first", "はじめてのおさかな", "魚を1匹キャッチ", 1, (p) => p.catches],
  ["beginner", "おさかな初心者", "累計50匹キャッチ", 50, (p) => p.catches],
  ["expert", "おさかな名人", "累計200匹キャッチ", 200, (p) => p.catches],
  ["master", "おさかなマスター", "累計1,000匹キャッチ", 1000, (p) => p.catches],
  ["sparkle", "キラキラ発見", "金の魚を累計10匹キャッチ", 10, (p) => p.gold],
  ["combo10", "コンボの達人", "1プレイで10コンボ", 10, (p) => p.maxCombo],
  ["combo20", "コンボマスター", "1プレイで20コンボ", 20, (p) => p.maxCombo],
  ["score300", "スコアハンター", "1プレイで300点に到達", 300, (p) => p.peakScore],
  ["score500", "スコアキング", "1プレイで500点に到達", 500, (p) => p.peakScore],
  ["daily", "毎日おさかな", "異なる3日でプレイを完了", 3, (p) => p.days.length],
  ["adventure", "ねこの大冒険", "累計30プレイを完了", 30, (p) => p.plays],
  ["scholar", "おさかな博士", "レア魚12種類を発見", 12, (p) => Object.keys(p.collection).length],
].map(([id, name, description, target, value]) => ({ id, name, description, target, value }));

function eligibleMissions(progress) {
  return missions.filter((mission) => mission.value(progress) >= mission.target &&
    !progress.achievements.includes(mission.id));
}
