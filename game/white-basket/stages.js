"use strict";

const seaStages = [
  ["coast", "いつもの海", 1, "#d9f2f0", "#bde4e5", "#fdf4dc", "#d7b89170"],
  ["reef", "サンゴ礁", 5, "#e7f9f2", "#aaddd0", "#f8dfcf", "#e394a1"],
  ["tropical", "南国の海", 10, "#dcf6fa", "#8eced8", "#ffebbe", "#498e82"],
  ["deep", "深海", 20, "#647baf", "#293d72", "#32456d", "#8bbec9"],
  ["starlit", "星空の海", 35, "#7c79b1", "#4b467c", "#504874", "#ffdfa1"],
  ["phantom", "幻の海", 50, "#beb2df", "#8078ab", "#d6bedf", "#a9f2de"],
].map(([id, label, level, top, bottom, sand, accent]) => ({ id, label, level, top, bottom, sand, accent }));

const stagesById = Object.fromEntries(seaStages.map((stage) => [stage.id, stage]));
const defaultSea = seaStages[0];

function availableSea(id, level) {
  const stage = Object.hasOwn(stagesById, id) && stagesById[id];
  return stage && stage.level <= level ? stage : defaultSea;
}

function drawSeaScenery(ctx, stage, width, height) {
  if (stage === defaultSea) return;
  ctx.save();
  ctx.strokeStyle = stage.accent;
  ctx.fillStyle = stage.accent;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.globalAlpha = .47;
  for (let i = 0; i < 5; i += 1) {
    const x = width * (.07 + i * .21);
    const y = height - 17 - (i % 2) * 6;
    ctx.beginPath();
    if (stage.id === "reef" || stage.id === "tropical") {
      const rise = stage.id === "reef" ? 24 : 35;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - 8, y - rise / 2, x, y - rise);
      ctx.moveTo(x - 3, y - 12);
      ctx.quadraticCurveTo(x - 13, y - 16, x - 12, y - rise + 8);
      ctx.moveTo(x - 2, y - 14);
      ctx.quadraticCurveTo(x + 10, y - 20, x + 8, y - rise + 5);
    } else if (stage.id === "deep") {
      ctx.ellipse(x, y - 8, 11 + i % 2 * 5, 6, 0, 0, Math.PI * 2);
    } else {
      const size = 5 + i % 3 * 2;
      ctx.moveTo(x, y - size * 2);
      ctx.lineTo(x + size, y - size);
      ctx.lineTo(x, y);
      ctx.lineTo(x - size, y - size);
      ctx.closePath();
    }
    ctx.stroke();
  }
  ctx.restore();
}
