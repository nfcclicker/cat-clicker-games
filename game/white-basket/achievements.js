"use strict";

const originalMissions = [
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
  ["scholar", "おさかな博士", "レア魚12種類を発見", 12, (p) => originalRareFish.filter(({ id }) => p.collection[id]).length],
].map(([id, name, description, target, value]) => ({ id, name, description, target, value }));

const stageMissions = [
  ["newSea", "新しい海", "Lv.5でサンゴ礁を解放", 5, (p) => levelInfo(p.xp).level],
  ["deepExplorer", "深海探検家", "深海で魚を捕獲", 1, (p) => p.stageCatches.deep ?? 0],
  ["starTraveler", "星空の旅人", "星空の海で魚を捕獲", 1, (p) => p.stageCatches.starlit ?? 0],
  ["secretFish", "幻の発見", "隠し魚を初めて捕獲", 1, (p) => p.collection.oarfish || p.collection.moon ? 1 : 0],
  ["scholar24", "新おさかな博士", "図鑑の24種類をコンプリート", 24, (p) => Object.keys(p.collection).length],
].map(([id, name, description, target, value]) => ({ id, name, description, target, value }));

const aquariumMissions = [
  ["firstAquarium", "はじめての水族館", "魚を初めて展示する", 1, p => p.aquarium?.peak ?? 0],
  ["livelyTank", "にぎやかな水槽", "10匹を同時展示する", 10, p => p.aquarium?.peak ?? 0],
  ["fishCaretaker", "おさかなのお世話係", "エサやり10回を完了する", 10, p => p.aquarium?.feeds ?? 0],
  ["aquariumMaster", "水族館マスター", "30匹を同時展示する", 30, p => p.aquarium?.peak ?? 0],
  ["seaCollector", "海のコレクター", "すべての水族館背景を解放する", 6, p => p.aquarium?.backgrounds.length ?? 1],
].map(([id, name, description, target, value]) => ({ id, name, description, target, value }));
const missions = [...originalMissions, ...stageMissions, ...aquariumMissions];

function eligibleMissions(progress) {
  return missions.filter((mission) => mission.value(progress) >= mission.target &&
    !progress.achievements.includes(mission.id));
}
