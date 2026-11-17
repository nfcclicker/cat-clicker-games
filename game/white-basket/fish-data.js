"use strict";

const rareFish = [
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

const rareById = Object.fromEntries(rareFish.map((fish) => [fish.id, fish]));
const rarityCutoffs = [.60, .88, .97, .995, 1];
const fishByTier = rarityCutoffs.map((_, i) => rareFish.filter((fish) => fish.tier === i + 1));

function rollRareFish(random = Math.random) {
  if (random() >= .10) return null;
  const rarity = random();
  const pool = fishByTier[rarityCutoffs.findIndex((cutoff) => rarity < cutoff)];
  return pool[Math.floor(random() * pool.length)];
}

const rareBody = new Path2D("M-25 0 C-21 -13 -6 -17 7 -12 Q16 -8 18 0 Q13 10 3 13 C-10 17 -23 9 -25 0Z");
const rareTail = new Path2D("M10 0 Q20 -5 27 -13 Q31 -9 26 0 Q32 10 27 13 Q18 5 10 0Z");
const legendTail = new Path2D("M10 0 Q18 -4 29 -15 Q37 -21 39 -15 Q35 -5 27 0 Q41 9 37 16 Q27 17 17 6Z");
const rareMotifs = new Map(rareFish.map((fish) => [fish.id, new Path2D(fish.motif)]));

function drawRareFish(ctx, fish, x, y, scale = 1, tilt = 0, silhouette = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(scale, scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
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
