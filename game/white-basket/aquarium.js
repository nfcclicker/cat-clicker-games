"use strict";

const aquariumDialog = byId("aquarium-dialog");
const aquariumCanvas = byId("aquarium-canvas");
const aquariumContext = aquariumCanvas.getContext("2d", { alpha: false });
const aquariumTank = byId("aquarium-tank");
const aquariumStatus = byId("aquarium-status");
const aquariumSprites = new Map();
let aquariumProgress;
let aquariumEpoch;
let swimmers = [];
let aquariumFrameId = 0;
let aquariumTime = 0;
let aquariumLastTime = 0;
let aquariumWidth = 0;
let aquariumHeight = 0;
let aquariumQuality = 1;
let slowAquariumFrames = 0;
let food = [];
let hearts = [];
let feeding = null;
let feedPending = false;
let aquariumEditing = false;
let aquariumNextFeed = 0;

function aquariumSprite(id) {
  if (aquariumSprites.has(id)) return aquariumSprites.get(id);
  const sprite = document.createElement("canvas");
  sprite.width = 192;
  sprite.height = 128;
  drawRareFish(sprite.getContext("2d"), rareById[id], 88, 64, 2);
  aquariumSprites.set(id, sprite);
  return sprite;
}

function swimmerFrom(id, index) {
  const seed = [...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) + index * 73;
  return { id, x: .15 + ((index * 37 + seed) % 70) / 100, y: .16 + ((index * 19 + seed) % 64) / 100,
    direction: index % 2 ? 1 : -1, facing: index % 2 ? 1 : -1, speed: 13 + seed % 15,
    phase: seed % 19, nextTurn: aquariumTime + 4 + seed % 5, reactUntil: 0 };
}

function syncAquariumFish() {
  const existing = [...swimmers];
  swimmers = aquariumProgress.aquarium.fish.map((id, index) => {
    const found = existing.findIndex(fish => fish?.id === id);
    if (found < 0) return swimmerFrom(id, index);
    const swimmer = existing[found];
    existing[found] = null;
    return swimmer;
  });
}

function renderAquariumControls() {
  const p = aquariumProgress;
  byId("aquarium-count").textContent = p.aquarium.fish.length + " / " + aquariumCapacity(levelInfo(p.xp).level) + " 匹";
  byId("aquarium-background-name").textContent = stagesById[p.aquarium.background].label;
  const list = byId("aquarium-fish-list");
  list.replaceChildren();
  for (const fish of rareFish) {
    const caught = p.collection[fish.id]?.count ?? 0;
    if (!caught) continue;
    const shown = p.aquarium.fish.filter(id => id === fish.id).length;
    const row = makeElement("li", undefined, "exhibit-row");
    const icon = makeElement("canvas");
    icon.width = 100; icon.height = 66;
    drawRareFish(icon.getContext("2d"), fish, 45, 33, 1.1);
    icon.setAttribute("aria-hidden", "true");
    const label = makeElement("div", undefined, "exhibit-label");
    label.append(makeElement("strong", fish.name), makeElement("small", "展示 " + shown + " ／ 捕獲 " + formatCount(caught)));
    const minus = makeElement("button", "−", "secondary");
    const plus = makeElement("button", "＋", "secondary");
    for (const [button, amount] of [[minus, -1], [plus, 1]]) {
      button.type = "button";
      button.setAttribute("aria-label", fish.name + (amount === 1 ? "を追加" : "を戻す"));
      button.disabled = aquariumEditing || (amount === 1
        ? shown >= caught || p.aquarium.fish.length >= aquariumCapacity(levelInfo(p.xp).level) : !shown);
      button.addEventListener("click", () => void editAquarium((aq, progress) => addExhibit(aq, progress, fish.id, amount)));
    }
    row.append(icon, label, minus, plus);
    list.append(row);
  }
  if (!list.children.length) list.append(makeElement("li", "おさかな図鑑の魚をキャッチすると、ここでえらべます。"));
  byId("aquarium-background-list").replaceChildren(...seaStages.map(stage => {
    const unlocked = p.aquarium.backgrounds.includes(stage.id);
    const row = makeElement("li");
    const button = makeElement("button", (unlocked ? "" : "🔒 ") + stage.label, "secondary");
    button.type = "button";
    button.setAttribute("aria-pressed", String(p.aquarium.background === stage.id));
    button.disabled = aquariumEditing;
    button.addEventListener("click", () => {
      if (unlocked) void editAquarium(aq => { aq.background = stage.id; });
      else aquariumStatus.textContent = stage.label + "で" + aquariumTargets[stage.id] +
        "点を達成すると解放（記録 " + (p.stageRecords[stage.id]?.best ?? 0) + "点）。";
    });
    row.append(button);
    return row;
  }));
}

async function editAquarium(edit) {
  if (aquariumEditing) return false;
  aquariumEditing = true;
  renderAquariumControls();
  try {
    const result = await saveAquariumEdit(edit, aquariumEpoch);
    aquariumProgress = result.progress;
    syncAquariumFish();
    aquariumStatus.textContent = result.unlocked.length
      ? "実績達成！ " + result.unlocked.map(m => m.name).join("・") : "水槽を保存しました。";
    refreshTitleProgress();
    return true;
  } catch (error) {
    aquariumStatus.textContent = error.name === "SaveConflict"
      ? "別の画面で更新されました。戻って開き直してください。" : error.message;
    return false;
  } finally { aquariumEditing = false; renderAquariumControls(); }
}

function resizeAquarium() {
  if (!aquariumDialog.open) return;
  aquariumWidth = aquariumTank.clientWidth;
  aquariumHeight = aquariumTank.clientHeight;
  const ratio = Math.min(devicePixelRatio || 1, aquariumQuality ? 2 : 1);
  aquariumCanvas.width = Math.round(aquariumWidth * ratio);
  aquariumCanvas.height = Math.round(aquariumHeight * ratio);
  drawAquarium(aquariumContext, aquariumWidth, aquariumHeight);
}
function stopAquariumAnimation() {
  cancelAnimationFrame(aquariumFrameId);
  aquariumFrameId = 0;
  aquariumLastTime = 0;
}
function startAquariumAnimation() {
  if (!aquariumFrameId && aquariumDialog.open && !document.hidden) aquariumFrameId = requestAnimationFrame(animateAquarium);
}
function reactionHeart(x, y) {
  if (hearts.length >= 24) hearts.shift();
  hearts.push({ x, y, at: aquariumTime });
}

function updateAquarium(dt) {
  const width = aquariumWidth, height = aquariumHeight;
  const size = Math.min(1, width / 355);
  const mx = 48 * size / width, my = 38 * size / height;
  for (const fish of swimmers) {
    const jelly = fish.id === "jelly", horse = fish.id === "seahorse";
    if (aquariumTime >= fish.nextTurn) {
      fish.direction *= -1;
      fish.nextTurn = aquariumTime + 5 + fish.phase % 5;
    }
    let vx = fish.direction * fish.speed * (jelly ? .20 : horse ? .28 : 1);
    let vy = Math.cos(aquariumTime * .7 + fish.phase) * (jelly ? 14 : horse ? 10 : 4);
    if (fish.id === "octopus" || fish.id === "squid") vx *= .45 + Math.max(0, Math.sin(aquariumTime * 2 + fish.phase)) * 1.7;
    let nearest;
    let distance = Infinity;
    for (const pellet of food) {
      if (pellet.eaten) continue;
      const d = Math.hypot((pellet.x - fish.x) * width, (pellet.y - fish.y) * height);
      if (d < distance) { nearest = pellet; distance = d; }
    }
    if (nearest && distance < Math.min(width, height) * .7) {
      vx = (nearest.x - fish.x) * width / Math.max(1, distance) * 67;
      vy = (nearest.y - fish.y) * height / Math.max(1, distance) * 67;
      if (distance < 19 * size) {
        nearest.eaten = true;
        if (feeding) feeding.eaten++;
        reactionHeart(fish.x, fish.y);
        fish.reactUntil = aquariumTime + 1;
      }
    }
    fish.x += vx * dt / width;
    fish.y += vy * dt / height;
    if (fish.x < mx || fish.x > 1 - mx) fish.direction *= -1;
    fish.x = Math.max(mx, Math.min(1 - mx, fish.x));
    fish.y = Math.max(my + .025, Math.min(.90 - my, fish.y));
    fish.facing += ((vx > 0 ? 1 : -1) - fish.facing) * Math.min(1, dt * 4);
  }
  for (const pellet of food) if (!pellet.eaten) pellet.y = Math.min(.92, pellet.y + dt * .028);
  hearts = hearts.filter(heart => aquariumTime - heart.at < 1.5);
  if (feeding && !feedPending && !aquariumEditing && aquariumTime - feeding.at >= 6 &&
      (food.every(pellet => pellet.eaten) || aquariumTime - feeding.at >= 10)) {
    const completed = feeding.eaten > 0;
    feeding = null; food = [];
    if (completed) {
      feedPending = true;
      void editAquarium(aq => finishAquariumFeed(aq)).then(saved => {
        if (saved) aquariumStatus.textContent = "ごちそうさま！";
      }).finally(() => { feedPending = false; aquariumNextFeed = aquariumTime + 10; });
    } else {
      aquariumStatus.textContent = "エサはお片づけしたよ。またあげてみよう。";
      aquariumNextFeed = aquariumTime + 3;
    }
  }
  byId("feed-aquarium").disabled = !swimmers.length || Boolean(feeding) || feedPending || aquariumTime < aquariumNextFeed;
}

function aquariumBackdrop(painter, width, height) {
  const stage = stagesById[aquariumProgress.aquarium.background];
  const gradient = painter.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, stage.top); gradient.addColorStop(1, stage.bottom);
  painter.fillStyle = gradient;
  painter.fillRect(0, 0, width, height);
  painter.fillStyle = stage.sand;
  painter.beginPath(); painter.moveTo(0, height * .94);
  painter.bezierCurveTo(width * .3, height * .88, width * .7, height * .98, width, height * .92);
  painter.lineTo(width, height); painter.lineTo(0, height); painter.fill();
  drawSeaScenery(painter, stage, width, height);
  painter.save();
  painter.globalAlpha = .10;
  painter.fillStyle = "#fffdf0";
  const still = reducedMotion.matches;
  for (let i = 0; i < (aquariumQuality ? 3 : 1); i++) {
    const x = width * (.14 + i * .29) + (still ? 0 : Math.sin(aquariumTime * .18 + i) * 13);
    painter.beginPath(); painter.moveTo(x, 0); painter.lineTo(x + width * .15, 0);
    painter.lineTo(x + width * .32, height); painter.lineTo(x - width * .12, height); painter.fill();
  }
  painter.globalAlpha = .4;
  painter.strokeStyle = "#fffef6"; painter.lineWidth = 1.4;
  for (let i = 0; i < (aquariumQuality ? 12 : 5); i++) {
    const x = width * ((i * .173 + .08) % 1) + (still ? 0 : Math.sin(aquariumTime * .6 + i) * 6);
    const y = height * (1 - ((aquariumTime * .022 + i * .137) % 1));
    painter.beginPath(); painter.arc(x, y, 2 + i % 4, 0, Math.PI * 2); painter.stroke();
  }
  painter.strokeStyle = stage.accent; painter.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const x = width * (.035 + i * .234);
    const sway = still ? 0 : Math.sin(aquariumTime * .6 + i) * 5;
    painter.beginPath(); painter.moveTo(x, height - 12);
    painter.bezierCurveTo(x - 8, height - 40, x + sway, height - 53, x + sway + 2, height - 75 - i % 2 * 15); painter.stroke();
  }
  painter.restore();
}

function drawSwimmer(painter, fish, width, height) {
  const data = rareById[fish.id], scale = Math.min(1, width / 355) * .81;
  painter.save();
  painter.translate(fish.x * width, fish.y * height + (reducedMotion.matches ? 0 : Math.sin(aquariumTime * 2 + fish.phase) * 2.5));
  painter.scale(-Math.sign(fish.facing || 1) * Math.max(.15, Math.abs(fish.facing)), 1);
  if (aquariumQuality && data.tier >= 3) {
    const glow = painter.createRadialGradient(0, 0, 3, 0, 0, 38 * scale);
    glow.addColorStop(0, data.tier === 5 ? "#fff1a574" : "#f9e7ff55"); glow.addColorStop(1, "#fff8dd00");
    painter.fillStyle = glow; painter.fillRect(-40, -40, 80, 80);
  }
  const sprite = aquariumSprite(fish.id);
  const wiggle = reducedMotion.matches ? 0 : Math.sin(aquariumTime * (fish.id === "jelly" ? 2 : 6) + fish.phase) * .13;
  painter.scale(scale, scale);
  if (fish.reactUntil > aquariumTime) painter.scale(1.08, 1.08);
  if (fish.id === "jelly" || fish.id === "seahorse") {
    painter.drawImage(sprite, 0, 0, 192, 72, -44, -32, 96, 36);
    painter.translate(0, 4); painter.rotate(wiggle * .5);
    painter.drawImage(sprite, 0, 72, 192, 56, -44, 0, 96, 28);
  } else {
    painter.drawImage(sprite, 0, 0, 112, 128, -44, -32, 56, 64);
    painter.translate(12, 0); painter.rotate(wiggle);
    painter.drawImage(sprite, 112, 0, 80, 128, 0, -32, 40, 64);
  }
  painter.restore();
}

function drawAquarium(painter, width, height) {
  painter.setTransform(painter.canvas.width / width, 0, 0, painter.canvas.height / height, 0, 0);
  aquariumBackdrop(painter, width, height);
  painter.save(); painter.beginPath(); painter.rect(0, 0, width, height); painter.clip();
  for (const fish of swimmers) drawSwimmer(painter, fish, width, height);
  painter.fillStyle = "#b98451";
  for (const pellet of food) {
    if (!pellet.eaten) { painter.beginPath(); painter.arc(pellet.x * width, pellet.y * height, 2.5, 0, Math.PI * 2); painter.fill(); }
  }
  for (const heart of hearts) {
    const age = aquariumTime - heart.at;
    painter.save(); painter.translate(heart.x * width, heart.y * height - 12 - age * 20);
    painter.globalAlpha = 1 - age / 1.5; painter.fillStyle = "#d86c97";
    painter.beginPath(); painter.moveTo(0, 3);
    painter.bezierCurveTo(-16, -6, -7, -16, 0, -8); painter.bezierCurveTo(7, -16, 16, -6, 0, 3); painter.fill(); painter.restore();
  }
  painter.restore();
}

function animateAquarium(now) {
  aquariumFrameId = 0;
  if (!aquariumDialog.open || document.hidden) { aquariumLastTime = 0; return; }
  const frameTime = aquariumLastTime ? now - aquariumLastTime : 16;
  const dt = Math.min(.05, frameTime / 1000);
  aquariumLastTime = now; aquariumTime += dt;
  slowAquariumFrames = frameTime > 40 ? slowAquariumFrames + 1 : Math.max(0, slowAquariumFrames - 1);
  if (aquariumQuality && slowAquariumFrames > 25) { aquariumQuality = 0; resizeAquarium(); }
  updateAquarium(dt);
  drawAquarium(aquariumContext, aquariumWidth, aquariumHeight);
  startAquariumAnimation();
}

async function openAquarium() {
  if (state !== "title" || !gameAccessAllowed || aquariumDialog.open) return;
  refreshTitleProgress();
  aquariumProgress = savedProgress; aquariumEpoch = aquariumProgress.saveEpoch;
  if (!aquariumProgress.aquarium.initialized) {
    const result = await saveAquariumEdit((aq, progress) => {
      if (aq.initialized) return; aq.fish = initialAquariumFish(progress); aq.peak = Math.max(aq.peak, aq.fish.length); aq.initialized = true;
    }, aquariumEpoch);
    aquariumProgress = result.progress;
  }
  aquariumStatus.textContent = "";
  aquariumQuality = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2 ? 0 : 1;
  aquariumDialog.classList.remove("viewing"); byId("view-aquarium").setAttribute("aria-pressed", "false");
  byId("aquarium-fish-panel").hidden = true; byId("aquarium-background-panel").hidden = true;
  syncAquariumFish(); renderAquariumControls();
  aquariumDialog.showModal(); resizeAquarium(); startAquariumAnimation();
}
byId("show-aquarium").addEventListener("click", async () => {
  const button = byId("show-aquarium");
  button.disabled = true;
  try { await openAquarium(); } catch (error) { reportSaveError(error); }
  finally { button.disabled = false; }
});
byId("close-aquarium").addEventListener("click", () => aquariumDialog.close());
aquariumDialog.addEventListener("cancel", stopAquariumAnimation);
aquariumDialog.addEventListener("close", () => {
  stopAquariumAnimation(); food = []; hearts = []; feeding = null; refreshTitleProgress();
});
new ResizeObserver(resizeAquarium).observe(aquariumTank);
document.addEventListener("visibilitychange", () => { if (document.hidden) stopAquariumAnimation(); else startAquariumAnimation(); });
window.addEventListener("pagehide", stopAquariumAnimation);
window.addEventListener("storage", event => {
  if (![progressKey, saveHistoryKey].includes(event.key) || !aquariumDialog.open) return;
  const latest = readProgress();
  if (latest.saveEpoch !== aquariumEpoch) { aquariumDialog.close(); reportSaveError(saveConflict()); return; }
  aquariumProgress = latest; syncAquariumFish(); renderAquariumControls();
});
function toggleAquariumView() {
  const viewing = aquariumDialog.classList.toggle("viewing");
  byId("view-aquarium").setAttribute("aria-pressed", String(viewing));
  if (viewing) { byId("aquarium-fish-panel").hidden = true; byId("aquarium-background-panel").hidden = true; }
  resizeAquarium();
}
byId("view-aquarium").addEventListener("click", toggleAquariumView);
aquariumCanvas.addEventListener("pointerdown", event => {
  if (!event.isPrimary) return;
  const rect = aquariumCanvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
  const fish = [...swimmers].reverse().find(f => Math.hypot((f.x - x) * rect.width, (f.y - y) * rect.height) < 33 * Math.min(1, rect.width / 355));
  if (!fish) { toggleAquariumView(); return; }
  fish.reactUntil = aquariumTime + 1.1; reactionHeart(fish.x, fish.y);
  aquariumStatus.textContent = rareById[fish.id].name + "がごきげん！";
});
for (const [button, panel, other] of [
  ["choose-aquarium-fish", "aquarium-fish-panel", "aquarium-background-panel"],
  ["choose-aquarium-background", "aquarium-background-panel", "aquarium-fish-panel"],
]) {
  byId(button).addEventListener("click", () => {
    byId(panel).hidden = !byId(panel).hidden; byId(other).hidden = true;
    if (!byId(panel).hidden) byId(panel).scrollIntoView({ block: "nearest" });
  });
}
byId("feed-aquarium").addEventListener("click", () => {
  if (!swimmers.length || feeding || feedPending || aquariumTime < aquariumNextFeed) return;
  feeding = { at: aquariumTime, eaten: 0 };
  const target = swimmers[Math.floor(Math.random() * swimmers.length)];
  food = Array.from({ length: Math.min(5, swimmers.length + 1) }, (_, i) => ({
    x: Math.max(.10, Math.min(.90, target.x + (i - 2) * .035)), y: .10 + i * .008, eaten: false,
  }));
  byId("feed-aquarium").disabled = true; aquariumStatus.textContent = "もぐもぐタイム。";
});
byId("photo-aquarium").addEventListener("click", async () => {
  const button = byId("photo-aquarium"); button.disabled = true;
  try {
    const scene = document.createElement("canvas");
    scene.width = 600;
    scene.height = Math.round(600 * aquariumHeight / aquariumWidth);
    drawAquarium(scene.getContext("2d"), aquariumWidth, aquariumHeight);
    const photo = document.createElement("canvas");
    photo.width = 600;
    photo.height = scene.height + 124;
    const painter = photo.getContext("2d");
    painter.fillStyle = "#fff8e9";
    painter.fillRect(0, 0, photo.width, photo.height);
    painter.drawImage(scene, 0, 76);
    painter.fillStyle = "#50372e";
    painter.textAlign = "center";
    painter.font = '900 27px "Yu Gothic", sans-serif';
    painter.fillText("マイ水族館", 300, 32);
    painter.font = '700 17px "Yu Gothic", sans-serif';
    painter.fillText("Lv. " + levelInfo(aquariumProgress.xp).level + " ／ " +
      stagesById[aquariumProgress.aquarium.background].label, 300, 59);
    painter.font = '900 21px "Yu Gothic", sans-serif';
    painter.fillText("おさかなキャッチ", 300, photo.height - 18);
    const blob = await new Promise((resolve, reject) => photo.toBlob(result => result ? resolve(result) : reject(new Error("写真を作成できませんでした。")), "image/png"));
    const file = new File([blob], "my-aquarium-" + localPlayDay() + ".png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ title: "マイ水族館", files: [file] }); } catch (error) {
        if (error.name === "AbortError") return;
        downloadArchive(file);
      }
    } else downloadArchive(file);
    aquariumStatus.textContent = "水族館の写真をつくりました。";
  } catch (error) { aquariumStatus.textContent = error.message || "写真を保存できませんでした。"; }
  finally { button.disabled = false; }
});
