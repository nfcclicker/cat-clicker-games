"use strict";

const byId = (id) => document.getElementById(id);
const canvas = byId("scene");
const field = byId("field");
const ctx = canvas.getContext("2d");
const duration = 30_000;
const bestKey = "cat-clicker:white-basket:best";
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const points = { fish: 10, gold: 50, boot: -20 };

let width = 0;
let height = 0;
let pixelRatio = 1;
let catX = 0;
let state = "title";
let score = 0;
let best = 0;
let fishCount = 0;
let combo = 0;
let round;
let mood = "calm";
let moodUntil = 0;
let startedAt = 0;
let nextSpawn = 0;
let lastFrame = 0;
let lastLane = 0.5;
let objects = [];
let effects = [];
const keys = new Set();

try {
  best = Math.max(0, Number(localStorage.getItem(bestKey)) || 0);
} catch {
  // The score still works for this page if storage is disabled.
}
byId("best").textContent = best;

const notes = {
  start: [392, 523, 659],
  fish: [587, 784],
  gold: [523, 659, 784, 1047],
  boot: [262, 175],
  end: [659, 523, 440, 523],
};
let audio;
let volume;
let muted = true;

async function enableAudio() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    if (!audio) {
      audio = new Audio();
      volume = audio.createGain();
      volume.gain.value = 0.18;
      volume.connect(audio.destination);
    }
    if (audio.state !== "running") await audio.resume();
    return true;
  } catch {
    return false;
  }
}

function sound(type) {
  if (muted || audio?.state !== "running") return;
  notes[type].forEach((frequency, index) => {
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    const at = audio.currentTime + index * 0.075;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.001, at);
    envelope.gain.exponentialRampToValueAtTime(0.28, at + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
    oscillator.connect(envelope);
    envelope.connect(volume);
    oscillator.start(at);
    oscillator.stop(at + 0.17);
  });
}

byId("sound").addEventListener("click", () => {
  muted = !muted;
  byId("sound").setAttribute("aria-pressed", String(!muted));
  byId("sound-state").textContent = muted ? "OFF" : "ON";
  if (volume) volume.gain.value = muted ? 0 : 0.18;
  if (!muted) void enableAudio();
});

// All drawings use CSS-pixel coordinates. Paths are reused across frames.
const paths = new Map();
const basketShape = new Path2D("M-57 -31 Q-54 -8 -39 -2 Q0 9 39 -2 Q54 -8 57 -31 Q0 -13 -57 -31Z");

function path(data, fill, stroke, lineWidth = 2) {
  if (!paths.has(data)) paths.set(data, new Path2D(data));
  const shape = paths.get(data);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(shape);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke(shape);
  }
}

function oval(x, y, rx, ry, fill, stroke) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function fade(y1, y2, first, second) {
  const gradient = ctx.createLinearGradient(0, y1, 0, y2);
  gradient.addColorStop(0, first);
  gradient.addColorStop(1, second);
  return gradient;
}

function sparkle(x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  path("M 0 -1 Q .13 -.13 1 0 Q .13 .13 0 1 Q -.13 .13 -1 0 Q -.13 -.13 0 -1 Z", color);
  ctx.restore();
}

function cat(x, y, scale, expression, bounce = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  oval(0, 3, 58, 8, "#658d8328");
  ctx.translate(0, -bounce);
  const outline = "#855b49";
  // Basket rim behind the cat.
  oval(0, -32, 58, 17, "#ae7250", outline);
  oval(0, -33, 48, 11, "#844e3c");
  drawCatFace(ctx, { expression });
  const basket = basketShape;
  ctx.fillStyle = fade(-33, 6, "#f0c18a", "#ce8e5e");
  ctx.fill(basket);
  ctx.save();
  ctx.clip(basket);
  for (let i = -60; i <= 60; i += 13) {
    ctx.beginPath();
    ctx.moveTo(i, -33);
    ctx.quadraticCurveTo(i + 2, -10, i * 0.78, 6);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "#ab6d4b73";
    ctx.stroke();
  }
  path("M-57 -23 Q0 -5 57 -23 M-57 -14 Q0 4 57 -14 M-57 -6 Q0 11 57 -6", null, "#80503969", 2);
  path("M-57 -26 Q0 -8 57 -26 M-57 -17 Q0 1 57 -17 M-57 -9 Q0 8 57 -9", null, "#ffe1a7ae", 2);
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline;
  ctx.stroke(basket);
  path("M-56 -31 Q0 -12 56 -31", null, "#9d654a", 7);
  path("M-55 -32 Q0 -15 55 -32", null, "#edb57d", 3);
  oval(-25, -28, 11, 8.5, "#fff8f0", outline);
  oval(25, -28, 11, 8.5, "#fff8f0", outline);
  path("M-28 -28 V-25 M-22 -28 V-25 M22 -28 V-25 M28 -28 V-25", null, "#d7b7ab", 1.2);
  ctx.restore();
}

function item(type, x, y, scale = 1, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(scale, scale);
  if (type === "boot") {
    const edge = "#74516c";
    path("M-4 -17 Q5 -21 16 -16 L14 2 Q17 7 16 12 Q3 18 -16 15 Q-22 14 -21 8 Q-21 2 -13 2 Q-5 3 -4 -4Z",
      fade(-18, 16, "#cf97b9", "#a06790"), edge);
    path("M-4 -13 Q6 -9 16 -13 L17 -18 Q7 -23 -5 -18Z", "#ecc5d9", edge);
    path("M-20 11 Q-7 15 16 9 L16 13 Q2 19 -16 16 Q-21 15 -20 11Z", "#895a80", edge);
    path("M0 -9 L-1 -2 Q-1 4 -9 6", null, "#f3bfd9", 2);
  } else {
    const gold = type === "gold";
    const edge = gold ? "#9f6d30" : "#467790";
    path("M8 -3 Q18 -5 24 -12 Q28 -11 25 -1 Q24 1 26 7 Q27 12 23 12 Q16 8 8 4Z",
      gold ? "#f2ae49" : "#84c6d5", edge);
    path("M-24 -1 C-21 -10 -7 -16 5 -12 Q15 -8 18 0 Q16 8 5 12 C-8 16 -21 9 -24 3 Q-25 1 -24 -1Z",
      fade(-13, 14, gold ? "#fff0a1" : "#d8f5f2", gold ? "#efb447" : "#79becd"), edge);
    path("M-7 -11 Q0 -19 8 -15 L10 -9 M-5 12 Q2 18 7 13", gold ? "#ffc961" : "#a3d6df", edge, 1.3);
    path("M-7 -7 Q-1 0 -7 8 M2 -5 Q8 -1 2 4 M9 -4 Q14 -1 9 3", null, gold ? "#d79842" : "#669eb1", 1.35);
    oval(-16, -2, 2.4, 2.7, "#493c42");
    oval(-16.6, -2.8, .7, .7, "#fffdf1");
    oval(-15, 4, 3, 1.6, gold ? "#f39f69" : "#e5afb5");
    path("M-20 -6 Q-16 -10 -10 -10", null, "#fff9de", 1.7);
  }
  ctx.restore();
}

function background() {
  ctx.fillStyle = fade(0, height, "#d9f2f0", "#bde4e5");
  ctx.fillRect(0, 0, width, height);
  for (let row = 0; row * 49 < height; row += 1) {
    for (let col = 0; col * 54 < width; col += 1) {
      const x = col * 54 + (row % 2) * 23 + 14;
      const y = row * 49 + 18;
      oval(x, y, (row + col) % 3 === 0 ? 4 : 2, 2, "#ffffff83");
    }
  }
  ctx.fillStyle = "#fdf4dc";
  ctx.beginPath();
  ctx.moveTo(0, height - 37);
  ctx.bezierCurveTo(width * .29, height - 54, width * .69, height - 18, width, height - 39);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
  for (let x = 14; x < width; x += 40) {
    oval(x, height - 12 + (x % 3) * 3, 2.7, 1.3, "#d7b89170");
  }
}

function artScale() {
  return clamp(height / 385, 0.62, 1);
}

function draw(now) {
  if (!width || !height) return;
  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  background();
  if (state === "title") {
    const scale = Math.min(width / 242, height / 160, 2.35) * .91;
    cat(width / 2, height * .84, scale, "calm");
    item("fish", width * .19, height * .43, scale * .62, -.27);
    item("gold", width * .81, height * .31, scale * .59, .27);
    sparkle(width * .13, height * .29, 10, "#fffdf1");
    sparkle(width * .86, height * .55, 13, "#fffdf1");
    sparkle(width * .33, height * .24, 7, "#fffdf1");
    sparkle(width * .72, height * .15, 8, "#fef5c9");
    return;
  }
  const scale = artScale();
  for (const object of objects) {
    const fish = Object.hasOwn(rareById, object.type) ? rareById[object.type] : null;
    if (fish) {
      if (fish.tier === 5) {
        const pulse = (Math.sin(now / 130) + 1) * .5;
        oval(object.x * width, object.y, (32 + pulse * 5) * scale, 21 * scale, "#fff4ab7d");
        sparkle(object.x * width - 27 * scale, object.y - 15 * scale, 5 + pulse * 4, "#fffbe2");
        sparkle(object.x * width + 28 * scale, object.y + 12 * scale, 9 - pulse * 4, "#fffbe2");
      }
      drawRareFish(ctx, fish, object.x * width, object.y, scale, object.tilt);
    } else {
      item(object.type, object.x * width, object.y, scale, object.tilt);
    }
    if (object.type === "gold") {
      sparkle(object.x * width + 26 * scale, object.y - 15 * scale, 5, "#fff8bf");
    }
  }
  const remaining = Math.max(0, moodUntil - now);
  const bounce = mood === "happy" ? Math.sin(Math.PI * (1 - remaining / 450)) * 9 : 0;
  cat(catX, height - 13, scale, remaining ? mood : "calm", bounce);
  for (const effect of effects) {
    const age = (now - effect.at) / 800;
    if (age >= 1) continue;
    const x = clamp(effect.x * width, 62, width - 62);
    const y = height - 104 * scale - age * 39;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - age) * 2.8);
    ctx.font = '900 18px "Yu Gothic", sans-serif';
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fff7e7";
    ctx.fillStyle = effect.color;
    ctx.strokeText(effect.text, x, y);
    ctx.fillText(effect.text, x, y);
    sparkle(x - 53, y - 9, 7 + age * 6, effect.color);
    sparkle(x + 52, y - 15, 6, effect.color);
    ctx.restore();
  }
}

function moveCat(x) {
  const margin = 60 * artScale();
  catX = clamp(x, margin, width - margin);
}

function resize() {
  const oldWidth = width;
  const oldHeight = height;
  width = field.clientWidth;
  height = field.clientHeight;
  pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  moveCat(oldWidth ? catX * width / oldWidth : width / 2);
  if (oldHeight) {
    for (const object of objects) object.y *= height / oldHeight;
  }
  draw(performance.now());
}

function spawn(elapsed) {
  const progress = elapsed / duration;
  const roll = Math.random();
  const type = elapsed < 3600 ? "fish" : roll < .14 ? "boot" : roll < .28 ? "gold" : "fish";
  lastLane = clamp(lastLane + (Math.random() - .5) * .85, .12, .88);
  objects.push({
    type: type === "fish" ? rollRareFish()?.id ?? type : type,
    x: lastLane,
    y: -24 * artScale(),
    tilt: (Math.random() - .5) * .45,
    speed: .45 + progress * .33,
  });
  nextSpawn = elapsed + 1040 - progress * 375 + Math.random() * 120;
}

function catchItem(object, now) {
  const { type } = object;
  const value = points[type] ?? rareById[type].points;
  score += value;
  if (type === "boot") {
    combo = 0;
  } else {
    fishCount += 1;
    combo += 1;
  }
  if (type !== "boot") {
    recordRoundCatch(round, type, combo, score);
    announceMissions(round);
  }
  mood = type === "boot" ? "sad" : "happy";
  moodUntil = now + (mood === "happy" ? 450 : 620);
  const label = type === "boot" ? "−20" : "+" + value;
  effects = effects.filter((effect) => Math.abs(effect.x - object.x) * width > 135);
  effects.push({
    x: object.x,
    at: now,
    text: combo >= 2 ? label + "  " + combo + "コンボ" : label,
    color: type === "boot" ? "#79496e" : type === "gold" ? "#8b5517" : "#285e74",
  });
  byId("score").textContent = score;
  sound(Object.hasOwn(points, type) ? type : rareById[type].tier >= 3 ? "gold" : "fish");
}

function finish() {
  if (state !== "playing") return;
  state = "result";
  byId("mission-toast").hidden = true;
  byId("replay").disabled = true;
  byId("return-title").disabled = true;
  byId("earned-xp").textContent = "…";
  byId("new-fish").textContent = "…";
  byId("new-missions").textContent = "…";
  byId("level-up").hidden = true;
  byId("save-warning").hidden = true;
  void saveRound(round).then((summary) => {
    renderRoundSummary(summary);
    byId("replay").disabled = false;
    byId("return-title").disabled = false;
  });
  try {
    best = Math.max(best, Number(localStorage.getItem(bestKey)) || 0, score);
    localStorage.setItem(bestKey, String(best));
  } catch {
    best = Math.max(best, score);
  }
  byId("time").textContent = "0";
  byId("final-score").textContent = score;
  byId("final-best").textContent = best;
  byId("final-fish").textContent = fishCount;
  byId("hud").hidden = true;
  byId("instruction").hidden = true;
  byId("result").hidden = false;
  document.body.classList.remove("playing");
  document.body.classList.add("finished");
  byId("result").scrollTop = 0;
  byId("result-title").focus({ preventScroll: true });
  sound("end");
  resize();
}

function frame(now) {
  const elapsed = now - startedAt;
  if (elapsed >= duration) {
    finish();
    return;
  }
  byId("time").textContent = Math.ceil((duration - elapsed) / 1000);
  const dt = clamp((now - lastFrame) / 1000, 0, .05);
  lastFrame = now;
  if (keys.has("ArrowLeft")) moveCat(catX - dt * width * 1.2);
  if (keys.has("ArrowRight")) moveCat(catX + dt * width * 1.2);
  if (elapsed >= nextSpawn) spawn(elapsed);

  const scale = artScale();
  const catchTop = height - 13 - 90 * scale;
  const catchBottom = height - 13 - 22 * scale;
  objects = objects.filter((object) => {
    const previousY = object.y;
    object.y += object.speed * height * dt;
    if (object.y >= catchTop && previousY <= catchBottom &&
        Math.abs(object.x * width - catX) <= 54 * scale) {
      catchItem(object, now);
      return false;
    }
    if (object.y <= height + 22 * scale) return true;
    if (object.type !== "boot") combo = 0;
    return false;
  });
  effects = effects.filter((effect) => now - effect.at < 800);
  draw(now);
  requestAnimationFrame(frame);
}

function start() {
  if (state === "playing" || byId("replay").disabled) return;
  refreshTitleProgress();
  round = newRound(best);
  state = "playing";
  score = fishCount = combo = moodUntil = 0;
  objects = [];
  effects = [];
  keys.clear();
  lastLane = .5;
  nextSpawn = 200;
  byId("title").hidden = true;
  byId("menu").hidden = true;
  byId("result").hidden = true;
  byId("hud").hidden = false;
  byId("instruction").hidden = false;
  byId("score").textContent = "0";
  byId("time").textContent = "30";
  document.body.classList.remove("finished");
  document.body.classList.add("playing");
  window.scrollTo(0, 0);
  resize();
  moveCat(width / 2);
  startedAt = lastFrame = performance.now();
  draw(startedAt);
  if (!muted) void enableAudio().then((enabled) => {
    if (enabled && state === "playing") sound("start");
  });
  requestAnimationFrame(frame);
}

byId("start").addEventListener("click", start);
byId("replay").addEventListener("click", start);
byId("return-title").addEventListener("click", () => {
  state = "title";
  byId("result").hidden = true;
  byId("title").hidden = false;
  byId("menu").hidden = false;
  byId("best").textContent = best;
  document.body.classList.remove("finished");
  window.scrollTo(0, 0);
  resize();
  byId("start").focus({ preventScroll: true });
});

function handlePointer(event) {
  if (state !== "playing" || !event.isPrimary) return;
  const rect = canvas.getBoundingClientRect();
  moveCat(event.clientX - rect.left);
}

canvas.addEventListener("pointerdown", (event) => {
  if (state !== "playing" || !event.isPrimary) return;
  if (event.pointerType !== "mouse") canvas.setPointerCapture(event.pointerId);
  handlePointer(event);
});
canvas.addEventListener("pointermove", handlePointer);
window.addEventListener("keydown", (event) => {
  if (state !== "playing" || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  keys.add(event.key);
});
window.addEventListener("keyup", (event) => keys.delete(event.key));
window.addEventListener("blur", () => keys.clear());

resize();
new ResizeObserver(resize).observe(field);

if (window.isSecureContext && "serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // A worker failure does not prevent online play.
  });
}
