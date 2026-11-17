"use strict";

// Screen routing and presentation only. All progress changes use the existing actions.
const uiTabs = ["play", "collection", "aquarium", "missions", "menu"];
const bottomNav = byId("bottom-nav");
const commonHeader = byId("common-header");
const stageCards = makeElement("div", undefined, "stage-cards");
stageCards.id = "stage-cards";
stageCards.setAttribute("role", "group");
stageCards.setAttribute("aria-label", "ステージ選択");
const headerSave = makeElement("span", "自動セーブ", "header-save");
headerSave.id = "header-save";
headerSave.setAttribute("role", "status");
const scrollPositions = new Map();
let uiRoute = { tab: "play" };
let uiApplying = false;
let uiTransition = 0;
let uiObservedAchievements = new Set(readProgress().achievements);
let uiPlaying = false;
let uiStageSelected;
let aquariumSheetReturn = null;

const iconPaths = {
  gamepad: "M6 8 Q4 8 3 12 L1 18 Q1 22 5 20 L8 17 H16 L19 20 Q23 22 23 18 L21 12 Q20 8 18 8Z M5 12 H11 M8 9 V15 M16 11 H16.1 M19 14 H19.1",
  book: "M12 6 Q7 2 2 5 V21 Q7 18 12 22 Q17 18 22 21 V5 Q17 2 12 6 V22 M5 8 L9 9 M15 9 L19 8",
  fish: "M3 12 Q8 2 17 9 L23 5 V19 L17 15 Q8 22 3 12Z M8 10 H8.1 M13 8 Q17 12 13 16",
  trophy: "M7 3 H17 V10 Q17 16 12 16 Q7 16 7 10Z M7 5 H3 V8 Q3 12 7 12 M17 5 H21 V8 Q21 12 17 12 M12 16 V21 M7 22 H17",
  menu: "M4 6 H20 M4 12 H20 M4 18 H20",
  addFish: "M2 12 Q7 5 14 10 L19 7 V17 L14 14 Q7 20 2 12Z M20 1 V7 M17 4 H23",
  feed: "M4 5 H20 L18 18 Q12 22 6 18Z M7 8 H17 M8 3 L7 1 M12 3 V1 M17 3 L18 1",
  background: "M2 3 H22 V21 H2Z M3 17 L8 11 L13 16 L17 10 L22 17 M16 7 H16.1",
  camera: "M3 7 H7 L9 3 H15 L17 7 H21 V21 H3Z M16 14 A4 4 0 1 1 8 14 A4 4 0 1 1 16 14",
};

function uiIcon(name) {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  canvas.className = "ui-icon";
  canvas.setAttribute("aria-hidden", "true");
  const painter = canvas.getContext("2d");
  painter.scale(2, 2);
  painter.lineWidth = 1.7;
  painter.strokeStyle = "#63483e";
  painter.lineCap = "round";
  painter.lineJoin = "round";
  painter.stroke(new Path2D(iconPaths[name]));
  return canvas;
}

for (const container of document.querySelectorAll("[data-icon]")) container.append(uiIcon(container.dataset.icon));
for (const [id, icon, label] of [
  ["choose-aquarium-fish", "addFish", "魚をえらぶ"],
  ["feed-aquarium", "feed", "エサをあげる"],
  ["choose-aquarium-background", "background", "背景変更"],
  ["photo-aquarium", "camera", "写真を撮る"],
]) byId(id).replaceChildren(uiIcon(icon), makeElement("span", label));

byId("sound-slot").append(byId("sound"));
commonHeader.replaceChildren(document.querySelector(".profile"), headerSave);
const profile = commonHeader.querySelector(".profile");
const levelTitle = makeElement("div", undefined, "header-player");
levelTitle.append(byId("level"), byId("active-title"), byId("rank"));
profile.prepend(levelTitle);
const xpRow = makeElement("div", undefined, "header-xp");
xpRow.append(byId("xp-bar"), byId("xp-label"));
profile.append(xpRow);
profile.querySelector(".progress-row").remove();

const stageLabel = document.querySelector(".stage-control");
stageLabel.hidden = true;
byId("menu").prepend(stageCards);
document.querySelector(".legend").classList.add("legacy-links");
document.querySelector(".power-guide").classList.add("legacy-links");
document.querySelector("#menu .progress-actions").classList.add("legacy-links");
byId("show-aquarium").classList.add("legacy-links");
document.querySelector(".profile-links").classList.add("legacy-links");

for (const dialog of [progressDialog, aquariumDialog, playerDialog]) dialog.classList.add("main-tab");
for (const id of ["back-to-title", "close-aquarium"]) byId(id).classList.add("tab-back");
byId("close-player").textContent = "← メニュー";
const tabArea = makeElement("div", undefined, "screen-tabs");
tabArea.append(byId("tab-daily"), byId("tab-weekly"), byId("tab-achievements"));
byId("mission-tabs").append(tabArea);
byId("transfer-restore").open = true;
byId("copy-code").classList.add("save-main-action");

function updateHeader() {
  const states = { idle: "自動セーブ", saved: "セーブ済み", recovered: "復旧しました", failed: "保存できません", conflict: "再読み込みが必要" };
  headerSave.textContent = states[saveStatus.kind] ?? "自動セーブ";
  headerSave.classList.toggle("has-error", ["failed", "conflict"].includes(saveStatus.kind));
  const selected = !byId("active-title").hidden;
  byId("rank").hidden = selected;
}

function renderStageCards() {
  const oldScroll = stageCards.scrollLeft;
  const focusedStage = document.activeElement?.dataset?.stage;
  const p = readProgress();
  const level = levelInfo(p.xp).level;
  stageCards.replaceChildren(...seaStages.map(stage => {
    const unlocked = stage.level <= level;
    const cleared = p.stageRecords[stage.id]?.cleared;
    const card = makeElement("button", undefined, "stage-card");
    card.type = "button";
    card.dataset.stage = stage.id;
    card.disabled = !unlocked;
    card.setAttribute("aria-pressed", String(stageChoice.value === stage.id));
    const preview = document.createElement("canvas");
    preview.width = 220;
    preview.height = 78;
    const painter = preview.getContext("2d");
    const gradient = painter.createLinearGradient(0, 0, 0, 78);
    gradient.addColorStop(0, stage.top);
    gradient.addColorStop(1, stage.bottom);
    painter.fillStyle = gradient;
    painter.fillRect(0, 0, 220, 78);
    drawSeaScenery(painter, stage, 220, 78);
    painter.globalAlpha = .7;
    drawRareFish(painter, rareFish[seaStages.indexOf(stage)], 110, 40, .95);
    preview.setAttribute("aria-hidden", "true");
    const status = !unlocked ? "🔒 Lv. " + stage.level : cleared ? "クリア済み" : "未クリア";
    card.append(preview, makeElement("strong", stage.label), makeElement("small", status, cleared ? "stage-cleared" : ""));
    card.addEventListener("click", () => {
      stageChoice.value = stage.id;
      stageChoice.dispatchEvent(new Event("change"));
      renderStageCards();
    });
    return card;
  }));
  if (uiStageSelected !== stageChoice.value) {
    const card = stageCards.querySelector('[data-stage="' + stageChoice.value + '"]');
    if (card) stageCards.scrollLeft = Math.max(0, card.offsetLeft - stageCards.offsetLeft - stageCards.clientWidth / 2 + card.clientWidth / 2);
    uiStageSelected = stageChoice.value;
  } else stageCards.scrollLeft = oldScroll;
  if (focusedStage) stageCards.querySelector('[data-stage="' + focusedStage + '"]')?.focus({ preventScroll: true });
}

function routeKey(route) {
  return route.tab + "/" + (route.sub ?? "") + "/" + (route.fish ?? "");
}

function closeTabDialogs() {
  stopAquariumAnimation();
  for (const dialog of [aquariumDialog, progressDialog, playerDialog]) if (dialog.open) dialog.close();
}

let uiNavigation = Promise.resolve();
function applyUiRoute(route, options) {
  // Keep asynchronous aquarium initialization and rapid tab presses in order.
  uiNavigation = uiNavigation.catch(reportSaveError).then(() => renderUiRoute(route, options));
  return uiNavigation;
}

async function renderUiRoute(route, { push = true, remember = true } = {}) {
  if (!uiTabs.includes(route.tab) || !gameAccessAllowed || restoring) return;
  if (["playing", "paused", "superseded"].includes(state)) return;
  if (state === "result" && byId("return-title").disabled) return;
  if (route.tab === "aquarium" && uiRoute.tab === "aquarium" && aquariumDialog.open) {
    uiRoute = { ...route };
    byId("aquarium-fish-panel").hidden = route.sheet !== "fish";
    byId("aquarium-background-panel").hidden = route.sheet !== "background";
    if (!route.sheet && aquariumSheetReturn) byId(aquariumSheetReturn).focus({ preventScroll: true });
    if (push) history.pushState({ osakanaUI: true, route: uiRoute }, "", location.pathname + location.search);
    return;
  }
  if (remember) scrollPositions.set(routeKey(uiRoute), window.scrollY);
  const transition = ++uiTransition;
  uiApplying = true;
  closeTabDialogs();
  await new Promise(resolve => setTimeout(resolve, 0)); // Let dialog close handlers finish before reopening.
  if (transition !== uiTransition) return;
  if (state === "result") byId("return-title").click();
  uiRoute = { ...route };
  document.body.dataset.tab = route.tab;
  for (const node of [byId("title"), field, byId("menu")]) node.hidden = route.tab !== "play";
  for (const id of ["menu-screen", "help-screen", "sound-screen"]) byId(id).hidden = true;
  byId("player-records").classList.remove("titles-only", "records-only");
  refreshTitleProgress();
  updateHeader();
  for (const button of bottomNav.querySelectorAll("[data-tab]")) {
    if (button.dataset.tab === route.tab) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  if (route.tab === "play") {
    renderStageCards();
    resize();
  } else if (route.tab === "collection") {
    showProgressDialog("collection", true);
    if (route.fish && Object.hasOwn(rareById, route.fish)) openFishDetail(rareById[route.fish]);
  } else if (route.tab === "missions") {
    showProgressDialog("missions", true);
    renderMissionTab(route.sub ?? "daily");
    byId("mission-dot").hidden = true;
    uiObservedAchievements = new Set(readProgress().achievements);
  } else if (route.tab === "aquarium") {
    try { await openAquarium(true); } catch (error) {
      uiApplying = false;
      reportSaveError(error);
    }
    if (transition !== uiTransition) return;
    resizeAquarium();
  } else if (!route.sub) byId("menu-screen").hidden = false;
  else if (["records", "titles", "save"].includes(route.sub)) {
    showPlayerDialog(route.sub === "save" ? "settings" : "records", true);
    if (route.sub !== "save") byId("player-records").classList.add(route.sub === "titles" ? "titles-only" : "records-only");
    if (route.sub === "titles") byId("player-dialog-title").textContent = "称号コレクション";
  } else byId(route.sub === "sound" ? "sound-screen" : "help-screen").hidden = false;
  if (push) history.pushState({ osakanaUI: true, route: uiRoute }, "", location.pathname + location.search);
  uiApplying = false;
  requestAnimationFrame(() => {
    if (transition !== uiTransition) return;
    window.scrollTo(0, scrollPositions.get(routeKey(route)) ?? 0);
  });
}

for (const button of bottomNav.querySelectorAll("[data-tab]")) {
  button.addEventListener("click", () => void applyUiRoute({ tab: button.dataset.tab }));
}
for (const button of document.querySelectorAll("[data-menu]")) {
  button.addEventListener("click", () => void applyUiRoute({ tab: "menu", sub: button.dataset.menu }));
}

byId("close-player").addEventListener("click", () => void applyUiRoute({ tab: "menu" }));
for (const id of ["close-sound", "close-help"]) byId(id).addEventListener("click", () => void applyUiRoute({ tab: "menu" }));
byId("back-to-fish").addEventListener("click", () => {
  if (!uiApplying) void applyUiRoute({ tab: "collection" });
});
document.addEventListener("ui-fish-detail", event => {
  if (!uiApplying && uiRoute.tab === "collection") {
    scrollPositions.set(routeKey(uiRoute), window.scrollY);
    uiRoute = { tab: "collection", fish: event.detail };
    history.pushState({ osakanaUI: true, route: uiRoute }, "", location.pathname + location.search);
    window.scrollTo(0, 0);
  }
});
for (const name of missionTabs) {
  byId("tab-" + name).addEventListener("click", () => {
    if (uiApplying || uiRoute.tab !== "missions") return;
    uiRoute = { tab: "missions", sub: name };
    history.replaceState({ osakanaUI: true, route: uiRoute }, "", location.pathname + location.search);
  });
}

window.addEventListener("popstate", event => {
  if (["playing", "paused", "superseded"].includes(state)) {
    pauseGame();
    history.pushState({ osakanaUI: true, route: uiRoute }, "", location.pathname + location.search);
    return;
  }
  void applyUiRoute(event.state?.osakanaUI ? event.state.route : { tab: "play" }, { push: false, remember: false });
});

function updateGameUi() {
  const playing = document.body.classList.contains("playing");
  commonHeader.hidden = playing;
  bottomNav.hidden = playing || !gameAccessAllowed;
  document.body.classList.toggle("ui-game", playing);
  if (playing && !uiPlaying) history.pushState({ osakanaUI: true, route: { tab: "play" } }, "", location.pathname + location.search);
  uiPlaying = playing;
}
new MutationObserver(updateGameUi).observe(document.body, { attributes: true, attributeFilter: ["class"] });
new MutationObserver(() => {
  const viewing = aquariumDialog.classList.contains("viewing") && aquariumDialog.open;
  document.body.classList.toggle("ui-viewing", viewing);
}).observe(aquariumDialog, { attributes: true, attributeFilter: ["class", "open"] });
new MutationObserver(updateHeader).observe(profile, { childList: true, subtree: true });

document.addEventListener("save-status", () => {
  updateHeader();
  const achievements = readProgress().achievements;
  if (uiRoute.tab !== "missions" && achievements.some(id => !uiObservedAchievements.has(id))) byId("mission-dot").hidden = false;
  if (uiRoute.tab === "play" && state === "title") renderStageCards();
});
window.addEventListener("storage", () => { updateHeader(); if (uiRoute.tab === "play") renderStageCards(); });

history.replaceState({ osakanaUI: true, route: { tab: "play" } }, "", location.pathname + location.search + location.hash);
void applyUiRoute({ tab: "play" }, { push: false }).catch(reportSaveError);

function closeAquariumSheet() {
  if (uiRoute.sheet) history.back();
  else {
    byId("aquarium-fish-panel").hidden = true;
    byId("aquarium-background-panel").hidden = true;
  }
}
for (const [id, buttonId, name] of [
  ["aquarium-fish-panel", "choose-aquarium-fish", "fish"],
  ["aquarium-background-panel", "choose-aquarium-background", "background"],
]) {
  const panel = byId(id);
  const header = makeElement("div", undefined, "sheet-header");
  const close = makeElement("button", "×");
  close.type = "button";
  close.setAttribute("aria-label", "パネルを閉じる");
  close.addEventListener("click", closeAquariumSheet);
  header.append(panel.querySelector("h3"), close);
  panel.prepend(header);
  byId(buttonId).addEventListener("click", () => {
    aquariumSheetReturn = buttonId;
    uiRoute = panel.hidden ? { tab: "aquarium" } : { tab: "aquarium", sheet: name };
    history.pushState({ osakanaUI: true, route: uiRoute }, "", location.pathname + location.search);
  });
}
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && uiRoute.tab === "aquarium" &&
      (!byId("aquarium-fish-panel").hidden || !byId("aquarium-background-panel").hidden)) {
    event.preventDefault();
    closeAquariumSheet();
  }
});
