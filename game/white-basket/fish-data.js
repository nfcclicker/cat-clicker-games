"use strict";

const originalRareFish = [
  ["stripe", "しましまフィッシュ", 1, 20, "#73cdd0", "#20687a", "M-9 -11 Q-3 0 -9 11 M0 -11 Q6 0 0 11 M9 -9 Q14 0 9 9", true],
  ["dot", "みずたまフィッシュ", 1, 20, "#8dbafa", "#365598", "M-5 -5 a2.5 2.5 0 1 0 .01 0 M4 3 a3 3 0 1 0 .01 0 M10 -6 a2 2 0 1 0 .01 0"],
  ["pink", "ピンクフィッシュ", 1, 20, "#f4a7bd", "#9c4569", "M-9 3 Q-5 -5 -1 3 T7 3 T15 3", true],
  ["green", "みどりフィッシュ", 1, 20, "#9bd480", "#42773d", "M-7 7 Q-9 -4 1 -7 Q5 3 -7 7 M3 7 Q3 -2 12 -3 Q13 6 3 7"],
  ["rainbow", "にじいろフィッシュ", 2, 30, "#f1b2cf", "#765198", "M-9 7 Q1 -17 12 4", true],
  ["night", "ほしぞらフィッシュ", 2, 30, "#7885c7", "#333a78", "M0 -10 L2 -3 L8 -2 L3 1 L4 7 L0 3 L-5 7 L-4 1 L-9 -2 L-2 -3Z M11 3 L13 7 L17 8 L13 9 L11 13 L10 9 L6 8 L10 7Z"],
  ["heart", "ハートフィッシュ", 2, 30, "#f7b2c1", "#a94768", "M2 9 C-2 6 -9 1 -8 -4 C-7 -9 -1 -8 2 -4 C5 -8 11 -9 12 -4 C13 1 6 6 2 9Z"],
  ["crystal", "クリスタルフィッシュ", 2, 30, "#98e5ed", "#286e86", "M2 -11 L11 -4 L2 10 L-7 -4Z M2 -11 L6 -4 L2 10 L-2 -4Z M-7 -4 H11"],
  ["crown", "おうかんフィッシュ", 3, 50, "#c9a4ef", "#6e4595", "M-8 3 L-11 -8 L-4 -4 L1 -11 L6 -4 L13 -8 L10 3Z M-8 7 H10"],
  ["angel", "てんしフィッシュ", 3, 50, "#b5dcf4", "#5474aa", "M0 6 Q-12 5 -12 -7 Q-5 -8 1 -2 Q6 -8 13 -8 Q13 3 1 6Z M-5 -18 Q0 -24 8 -19 Q6 -14 -5 -18Z"],
  ["ghost", "まぼろしフィッシュ", 4, 100, "#c0b6f1", "#5e4b9f", "M10 -6 C2 -11 -7 -7 -6 0 C-5 8 8 10 11 3 C14 -3 6 -5 2 -2 C-2 1 0 5 5 3", true],
  ["legend", "でんせつの金魚", 5, 150, "#ffe88a", "#9a531c", "M0 -13 L3 -5 L12 -3 L5 2 L7 11 L0 6 L-7 11 L-5 2 L-12 -3 L-3 -5Z M17 -10 L20 -17 L23 -10 L20 -4Z"],
].map(([id, name, tier, points, color, ink, motif, line]) => ({ id, name, tier, points, color, ink, motif, line }));

const originalFishNotes = [
  "青い縞が、浅瀬を流れる波にそっくり。", "水玉模様を揺らしながら泳ぎます。",
  "桃色のうろこが朝の海でほんのり光ります。", "海藻のそばで葉っぱのように揺れます。",
  "体を傾けるたびに小さな虹が見えます。", "紺色の体に星を散りばめたような魚。",
  "おなかのハートが目印の、のんびりした魚。", "透き通ったうろこが光をはね返します。",
  "王冠の模様をつけて、ゆったり泳ぎます。", "羽のようなひれで海の中をふわりと舞います。",
  "渦を残して、すぐに姿を隠してしまいます。", "大きな金色の尾びれで海を明るく照らします。",
];
for (const [index, fish] of originalRareFish.entries()) {
  fish.description = originalFishNotes[index];
  fish.stages = seaStages.map(({ id }) => id);
}

const newRareFish = [
  ["clown", "クマノミ", 1, ["reef","tropical"], "#f59e74", "#974f47", "岩のすき間から白い帯をちらりとのぞかせます。",
    "M-24 0 Q-18 -14 3 -13 Q14 -11 17 -5 L29 -12 Q34 0 29 12 L17 5 Q9 16 -9 13 Q-22 11 -24 0Z",
    "M-7 -10 Q-2 0 -6 10 M8 -10 Q13 0 9 10", -15, -1],
  ["puffer", "フグ", 1, ["reef","tropical"], "#ffe59c", "#9f7547", "驚くと風船みたいにまん丸になります。",
    "M-24 -1 C-24 -23 14 -23 19 -4 L29 -8 L29 9 L18 4 C11 24 -24 20 -24 -1Z",
    "M-12 7 Q-3 16 10 7 M2 -9 h1 M9 -4 h1", -15, -2],
  ["porcupine", "ハリセンボン", 2, ["reef","tropical"], "#d6bbf2", "#68518b", "トゲの先まで丸っこい、小さな海のいがぐり。",
    "M-24 0 L-27 -7 L-20 -9 L-20 -17 L-12 -14 L-7 -20 L0 -16 L8 -20 L11 -13 L20 -13 L19 -6 L29 -9 L28 8 L18 6 L17 14 L10 12 L5 19 L-2 15 L-10 19 L-15 12 L-23 13 L-21 6Z",
    "M-8 5 l3 -5 3 5 M1 -7 l3 -5 3 5 M8 7 l3 -5 3 5", -15, -2],
  ["seahorse", "タツノオトシゴ", 2, ["reef","tropical"], "#ffcd98", "#975266", "しっぽをくるりと巻いて流れに乗ります。",
    "M-14 -17 Q-1 -24 9 -13 Q9 -8 5 -4 Q20 5 10 17 Q3 25 -6 17 Q-11 10 -4 7 Q2 4 5 9 Q-1 8 -1 13 Q4 17 6 11 Q8 5 0 1 Q-6 -2 -8 -7 L-21 -7 L-21 -12Z",
    "M0 -1 Q-1 3 2 6 M6 -5 Q17 -9 15 1 L10 3", -8, -12],
  ["octopus", "タコ", 1, ["reef","deep"], "#f3a9c0", "#954968", "八本の足をくねらせ、海底をおさんぽします。",
    "M-17 0 C-23 -23 24 -25 21 0 Q23 7 30 10 Q29 17 20 13 Q20 21 13 18 L7 12 Q6 22 0 18 L-4 12 Q-9 24 -13 14 Q-22 20 -23 13 Q-34 16 -32 9 Q-22 10 -17 0Z",
    "M-8 7 Q-5 11 -2 7 M6 7 Q9 11 12 7", -8, -4],
  ["squid", "イカ", 2, ["tropical","deep"], "#f6b7ba", "#9a5d7a", "短いひれをぱたぱた、長い足をすいすい。",
    "M-17 1 Q-17 -13 1 -22 L13 -12 Q22 -11 19 0 L14 7 Q21 13 25 14 Q24 19 15 16 L8 11 L12 20 L5 20 L1 12 L-7 20 L-11 16 L-7 10 Q-24 12 -26 6Z",
    "M-9 -6 Q7 -12 12 -5 M-5 4 h9", -8, -2],
  ["sunfish", "マンボウ", 2, ["tropical","phantom"], "#b7d9f4", "#506e8f", "平たい体で、おひさまを追いかけます。",
    "M-25 0 Q-22 -13 -10 -15 L0 -24 Q8 -28 10 -18 L12 -11 L24 -13 Q30 0 24 13 L12 11 L8 22 Q0 25 -5 16 Q-23 14 -25 0Z",
    "M-5 -2 Q1 -6 7 0 Q1 7 -5 -2 M12 -7 Q17 0 12 7", -15, -3],
  ["jelly", "クラゲ", 2, ["deep","starlit","phantom"], "#c3bbf2", "#7257a1", "透けたかさの下に、星くずのような足が揺れます。",
    "M-24 2 C-20 -23 24 -24 25 2 Q24 8 19 8 Q17 18 13 19 Q8 20 9 15 L12 8 Q8 10 5 8 Q3 18 -1 20 Q-7 20 -5 15 L-2 8 Q-6 10 -10 8 Q-12 16 -16 17 Q-22 17 -19 12 L-16 7 Q-25 9 -24 2Z",
    "M-12 -6 Q0 -16 13 -7 M-10 3 Q0 9 10 3", -9, 0],
  ["angler", "チョウチンアンコウ", 3, ["deep","starlit"], "#8cc5d4", "#365e79", "頭のランプで、深い海に小さな灯をともします。",
    "M-24 2 Q-24 -10 -9 -12 Q-13 -23 -22 -16 L-27 -20 Q-17 -27 -9 -21 L-2 -13 Q12 -13 18 -4 L27 -11 L31 9 L17 5 Q6 18 -9 14 Q-23 13 -24 2Z",
    "M-19 7 Q-13 12 -6 7 M-26 -19 h3 M2 -7 h1 M8 -3 h1", -14, -3],
  ["oarfish", "リュウグウノツカイ", 4, ["deep"], "#e6dcf5", "#864f78", "長い体と桃色のたてがみを揺らす深海の案内役。",
    "M-30 2 Q-30 -8 -19 -10 L-20 -18 L-13 -14 L-9 -19 L-6 -11 Q9 -9 11 1 Q21 11 31 7 L33 2 L35 12 Q22 19 10 11 Q-1 2 -10 7 Q-25 15 -30 2Z",
    "M-16 -8 Q-9 -11 -2 -6 M-7 -3 Q2 -4 9 5 Q19 15 31 12", -22, 1,
    "深海で8コンボに達すると、姿を見せることがあります。"],
  ["aurora", "オーロラエイ", 4, ["starlit","phantom"], "#9ce0d3", "#565392", "大きなひれが、夜の海にオーロラの帯を描きます。",
    "M-26 1 Q-16 -2 -8 -17 Q-4 -22 1 -16 Q9 -7 21 -4 Q25 -4 30 -13 L33 -11 Q30 1 22 4 Q9 10 1 17 Q-4 22 -8 17 Q-16 8 -26 5Z",
    "M-11 -6 Q0 -13 10 -3 M-12 2 Q-1 -5 12 3 M-9 9 Q0 2 7 7", -19, 3],
  ["moon", "ムーンフィッシュ", 5, ["starlit","phantom"], "#ffe5ab", "#805398", "月のかけらを抱いて、星明かりの下で泳ぐ魚。",
    "M-27 0 C-25 -16 -3 -20 11 -9 L25 -16 Q33 -16 30 -8 L24 0 L31 9 Q33 16 25 15 L11 8 C-4 20 -25 17 -27 0Z",
    "M4 -11 Q-8 -10 -6 2 Q-3 12 11 7 Q3 7 0 0 Q-2 -6 4 -11Z M12 -9 l2 4 4 1 -4 2 -2 4 -1 -4 -4 -2 4 -1Z", -18, -2,
    "星空の海か幻の海で、1回のフィーバー中に魚を2匹取ると出会えることがあります。"],
].map(([id, name, tier, stages, color, ink, description, outline, detail, eyeX, eyeY, hint]) => ({
  id, name, tier, stages, color, ink, description, outline: new Path2D(outline), detail: new Path2D(detail),
  eyeX, eyeY, hint, points: [20,30,50,100,150][tier - 1],
}));
const rareFish = [...originalRareFish, ...newRareFish];
const rareById = Object.fromEntries(rareFish.map((fish) => [fish.id, fish]));
const rarityCutoffs = [.60, .88, .97, .995, 1];
const fishByTier = rarityCutoffs.map((_, i) => originalRareFish.filter((fish) => fish.tier === i + 1));
const newFishByStage = Object.fromEntries(seaStages.map(({ id }) => [id, rarityCutoffs.map((_, i) =>
  newRareFish.filter((fish) => !fish.hint && fish.tier === i + 1 && fish.stages.includes(id)))]));

function rollRareFish(random = Math.random, stageId = defaultSea.id) {
  if (random() >= .10) return null;
  const rarity = random();
  const tier = rarityCutoffs.findIndex((cutoff) => rarity < cutoff);
  const additions = newFishByStage[stageId][tier];
  const pool = additions.length && random() < .25 ? additions : fishByTier[tier];
  return pool[Math.floor(random() * pool.length)];
}

function hiddenFishAttempt(round, combo, fever, random = Math.random) {
  if (round.hiddenAttempted) return null;
  let id;
  if (round.stageId === "deep" && combo === 8) id = "oarfish";
  if (["starlit", "phantom"].includes(round.stageId) && fever && round.feverFish === 2) id = "moon";
  if (!id) return null;
  round.hiddenAttempted = true;
  return random() < .5 ? rareById[id] : null;
}

const rareBody = new Path2D("M-25 0 C-21 -13 -6 -17 7 -12 Q16 -8 18 0 Q13 10 3 13 C-10 17 -23 9 -25 0Z");
const rareTail = new Path2D("M10 0 Q20 -5 27 -13 Q31 -9 26 0 Q32 10 27 13 Q18 5 10 0Z");
const legendTail = new Path2D("M10 0 Q18 -4 29 -15 Q37 -21 39 -15 Q35 -5 27 0 Q41 9 37 16 Q27 17 17 6Z");
const rareMotifs = new Map(originalRareFish.map((fish) => [fish.id, new Path2D(fish.motif)]));

function drawRareFish(ctx, fish, x, y, scale = 1, tilt = 0, silhouette = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(scale, scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (fish.outline) {
    ctx.fillStyle = silhouette ? "#a9bfc0" : fish.color;
    ctx.fill(fish.outline);
    if (!silhouette) {
      ctx.strokeStyle = fish.ink;
      ctx.lineWidth = 1.7;
      ctx.stroke(fish.outline);
      ctx.strokeStyle = "#fff9ed";
      ctx.lineWidth = 2.5;
      ctx.stroke(fish.detail);
      ctx.beginPath();
      ctx.arc(fish.eyeX, fish.eyeY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#423341";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fish.eyeX - .6, fish.eyeY - .7, .7, 0, Math.PI * 2);
      ctx.fillStyle = "#fff9ed";
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  const tail = fish.tier === 5 ? legendTail : rareTail;
  if (silhouette) {
    ctx.fillStyle = "#a9bfc0";
    ctx.fill(tail);
    ctx.fill(rareBody);
  } else {
    ctx.fillStyle = fish.color;
    ctx.strokeStyle = fish.ink;
    ctx.lineWidth = 1.6;
    ctx.fill(tail);
    ctx.stroke(tail);
    ctx.fill(rareBody);
    ctx.stroke(rareBody);
    const motif = rareMotifs.get(fish.id);
    ctx.fillStyle = fish.tier >= 3 || fish.id === "night" ? "#fff0a8" : fish.ink;
    if (fish.id === "rainbow") {
      const rainbow = ctx.createLinearGradient(-9, -4, 12, -4);
      ["#e95679", "#f59d43", "#ffe46c", "#63c892", "#4a78d7"].forEach((color, i) => rainbow.addColorStop(i / 4, color));
      ctx.strokeStyle = rainbow;
      ctx.lineWidth = 5;
      ctx.stroke(motif);
    } else if (fish.line || fish.id === "crystal") {
      ctx.stroke(motif);
    } else {
      ctx.fill(motif);
    }
    ctx.beginPath();
    ctx.arc(-17, -2, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = "#423341";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-17.5, -2.6, .7, 0, Math.PI * 2);
    ctx.fillStyle = "#fff9ea";
    ctx.fill();
  }
  ctx.restore();
}
