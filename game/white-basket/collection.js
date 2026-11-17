"use strict";

const progressElement = (id) => document.getElementById(id);
const numberFormat = new Intl.NumberFormat("ja-JP");
const dateFormat = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" });
const formatCount = (value) => numberFormat.format(value);
const progressDialog = progressElement("progress-dialog");
const stageChoice = progressElement("stage-choice");
const rarityFilter = progressElement("filter-rarity");
const stageFilter = progressElement("filter-stage");
const collectionFilters = progressElement("collection-filters");
const fishDetail = progressElement("fish-detail");
let collectionScroll = 0;
let inspectedFish = "";

function makeElement(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function stageOption(value, label, disabled = false) {
  const option = makeElement("option", label);
  option.value = value;
  option.disabled = disabled;
  return option;
}

function refreshStageChoice(level) {
  const selected = availableSea(stageChoice.value || savedProgress.settings.stage, level);
  stageChoice.replaceChildren(...seaStages.map((stage) => stageOption(stage.id,
    stage.level <= level ? stage.label : stage.label + "（Lv. " + stage.level + "）", stage.level > level)));
  stageChoice.value = selected.id;
}

function refreshTitleProgress() {
  if (!unsavedRounds.length) savedProgress = readProgress();
  const { level, xp, needed } = levelInfo(savedProgress.xp);
  refreshStageChoice(level);
  const ranks = ["おさかな見習い", "おさかな探検家", "おさかな名人", "おさかな達人", "おさかなマスター"];
  progressElement("level").textContent = "Lv. " + level;
  progressElement("rank").textContent = ranks[Math.min(4, Math.floor(level / 10))];
  progressElement("xp-label").textContent = level === maxLevel ? "レベル上限" : xp + " / " + needed + " XP";
  const meter = progressElement("xp-bar");
  meter.max = needed;
  meter.value = xp;
  const title = playerTitles.find((option) => option.id === savedProgress.settings.title && option.earned(savedProgress));
  const tag = progressElement("active-title");
  tag.hidden = !title;
  tag.textContent = title?.label ?? "";
}

function missionCards(progress) {
  return missions.map((mission) => {
    const value = Math.min(mission.target, mission.value(progress));
    const achieved = progress.achievements.includes(mission.id);
    const card = makeElement("li", undefined, "mission-card");
    const header = makeElement("div", undefined, "progress-row");
    header.append(makeElement("strong", mission.name));
    if (achieved) header.append(makeElement("span", "達成済み", "badge"));
    const meter = makeElement("progress");
    meter.setAttribute("aria-label", mission.name + "の進捗");
    meter.max = mission.target;
    meter.value = value;
    card.append(header, makeElement("p", mission.description + " · " +
      formatCount(value) + " / " + formatCount(mission.target)), meter);
    return card;
  });
}

function fishIllustration(fish, entry, large = false) {
  const canvas = makeElement("canvas");
  canvas.width = large ? 300 : 176;
  canvas.height = large ? 155 : 100;
  canvas.setAttribute("aria-hidden", "true");
  drawRareFish(canvas.getContext("2d"), fish, canvas.width / 2 - 3, canvas.height / 2,
    large ? 3.3 : 2, 0, !entry);
  return canvas;
}

function visibleFish() {
  return rareFish.filter((fish) =>
    (!rarityFilter.value || fish.tier === Number(rarityFilter.value)) &&
    (!stageFilter.value || fish.stages.includes(stageFilter.value)));
}

function renderFishList() {
  const list = progressElement("progress-list");
  const count = Object.keys(savedProgress.collection).length;
  const visible = visibleFish();
  progressElement("progress-dialog-summary").textContent = "収集率 " + Math.round(count / rareFish.length * 100) +
    "%（" + count + " / " + rareFish.length + " 種）";
  list.className = "collection-grid";
  list.replaceChildren(...visible.map((fish) => {
    const entry = savedProgress.collection[fish.id];
    const card = makeElement("li", undefined, "collection-card");
    const button = makeElement("button", undefined, "fish-entry");
    button.type = "button";
    button.dataset.fish = fish.id;
    button.append(fishIllustration(fish, entry), makeElement("strong", entry ? fish.name : "？？？"));
    if (entry) {
      button.append(makeElement("p", "★".repeat(fish.tier), "fish-stars"));
      if (!savedProgress.seenFish.includes(fish.id)) button.append(makeElement("span", "NEW", "new-badge"));
    } else {
      button.append(makeElement("p", fish.hint ? "未発見・隠し魚" : "未発見"));
      if (fish.hint) button.append(makeElement("p", fish.hint, "fish-hint"));
    }
    button.addEventListener("click", () => openFishDetail(fish));
    card.append(button);
    return card;
  }));
  if (!visible.length) list.append(makeElement("li", "条件に合う魚はいません。", "period-note"));
}

function openFishDetail(fish) {
  const entry = savedProgress.collection[fish.id];
  collectionScroll = progressDialog.scrollTop;
  inspectedFish = fish.id;
  const body = progressElement("fish-detail-body");
  body.replaceChildren(fishIllustration(fish, entry, true));
  if (entry) {
    body.append(makeElement("p", "★".repeat(fish.tier) + " ／ " + fish.points + " 点", "fish-stars"),
      makeElement("p", fish.description),
      makeElement("p", "捕獲数 " + formatCount(entry.count) + " 匹"),
      makeElement("p", "初回発見 " + (entry.firstSeen ? dateFormat.format(new Date(entry.firstSeen)) : "日時不明")));
    if (!savedProgress.seenFish.includes(fish.id)) void markFishSeen(fish.id).catch(() => {});
  } else {
    body.append(makeElement("p", "未発見"));
  }
  if (fish.hint) body.append(makeElement("p", fish.hint, "period-note"));
  body.append(makeElement("p", "出現ステージ " + fish.stages.map((id) => stagesById[id].label).join("・")));
  progressElement("fish-detail-title").textContent = entry ? fish.name : "？？？";
  collectionFilters.hidden = true;
  progressElement("mission-panel").hidden = true;
  fishDetail.hidden = false;
  progressDialog.scrollTop = 0;
  progressElement("fish-detail-title").focus({ preventScroll: true });
}

progressElement("back-to-fish").addEventListener("click", () => {
  fishDetail.hidden = true;
  collectionFilters.hidden = false;
  progressElement("mission-panel").hidden = false;
  renderFishList();
  progressDialog.scrollTop = collectionScroll;
  progressElement("progress-list").querySelector('[data-fish="' + inspectedFish + '"]')?.focus({ preventScroll: true });
});
for (let tier = 1; tier <= 5; tier++) rarityFilter.append(stageOption(String(tier), "★".repeat(tier)));
for (const stage of seaStages) stageFilter.append(stageOption(stage.id, stage.label));
rarityFilter.addEventListener("change", renderFishList);
stageFilter.addEventListener("change", renderFishList);

const missionTabs = ["achievements", "daily", "weekly"];
const missionPanel = progressElement("mission-panel");
let activeMissionTab = "achievements";
let viewedMissionDay;
let missionDateTimer;

function periodCards(goals, period) {
  return goals.map((goal) => {
    const value = Math.min(goal.target, period.counts[goal.metric]);
    const card = makeElement("li", undefined, "mission-card");
    const header = makeElement("div", undefined, "progress-row");
    header.append(makeElement("strong", goal.label),
      makeElement("span", period.claimed.includes(goal.id) ? "達成済み" : "+" + goal.xp + " XP", "badge"));
    const meter = makeElement("progress");
    meter.max = goal.target;
    meter.value = value;
    meter.setAttribute("aria-label", goal.label + "の進捗");
    card.append(header, makeElement("p", missionDifficulties[goal.tier] + " ／ " + value + " / " + goal.target), meter);
    return card;
  });
}

function renderMissionTab(tab, date = new Date()) {
  const today = localPlayDay(date);
  viewedMissionDay = today;
  activeMissionTab = tab;
  for (const name of missionTabs) {
    const button = progressElement("tab-" + name);
    button.setAttribute("aria-selected", String(name === tab));
    button.tabIndex = name === tab ? 0 : -1;
  }
  missionPanel.setAttribute("role", "tabpanel");
  missionPanel.setAttribute("aria-labelledby", "tab-" + tab);
  const list = progressElement("progress-list");
  list.className = "mission-list";
  const label = progressElement("progress-dialog-summary");
  if (tab === "achievements") {
    label.textContent = savedProgress.achievements.length + " / " + missions.length + " 達成";
    list.replaceChildren(...missionCards(savedProgress));
  } else {
    const daily = tab === "daily";
    const period = (daily ? savedProgress.daily[today] : savedProgress.weekly[weekStart(today)]) ?? emptyPeriod();
    const dateLabel = daily ? today : weekStart(today) + " 〜 " + shiftPlayDay(weekStart(today), 6);
    label.textContent = dateLabel + " ／ " + period.claimed.length + " / 3 達成";
    list.replaceChildren(...periodCards(daily ? dailyGoals(today) : weeklyGoals, period));
    if (daily) {
      list.append(makeElement("li", period.sweep ? "全達成ボーナス受取済み"
        : "全3種類達成で追加 200 XP", "period-note"));
      list.append(makeElement("li", period.bonus ? "本日のデイリーボーナス受取済み"
        : "今日の初回プレイ完了で 100 XP", "period-note"));
    }
  }
}

function refreshMissionDate() {
  if (!progressDialog.open || progressElement("mission-tabs").hidden || viewedMissionDay === localPlayDay()) return;
  renderMissionTab(activeMissionTab);
}

function showProgressDialog(kind) {
  refreshTitleProgress();
  const isCollection = kind === "collection";
  progressElement("progress-dialog-title").textContent = isCollection ? "おさかな図鑑" : "ミッション";
  progressElement("mission-tabs").hidden = isCollection;
  fishDetail.hidden = true;
  missionPanel.hidden = false;
  collectionFilters.hidden = !isCollection;
  if (isCollection) {
    missionPanel.removeAttribute("role");
    missionPanel.removeAttribute("aria-labelledby");
    renderFishList();
  } else {
    renderMissionTab("achievements");
    clearInterval(missionDateTimer);
    missionDateTimer = setInterval(refreshMissionDate, 1000);
  }
  progressDialog.showModal();
  progressDialog.scrollTop = 0;
}

progressElement("show-missions").addEventListener("click", () => showProgressDialog("missions"));
progressElement("show-collection").addEventListener("click", () => showProgressDialog("collection"));
progressElement("back-to-title").addEventListener("click", () => progressDialog.close());
progressDialog.addEventListener("close", () => clearInterval(missionDateTimer));
document.addEventListener("visibilitychange", refreshMissionDate);
for (const [index, name] of missionTabs.entries()) {
  const tab = progressElement("tab-" + name);
  tab.addEventListener("click", () => renderMissionTab(name));
  tab.addEventListener("keydown", (event) => {
    const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!delta && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? missionTabs.length - 1
      : (index + delta + missionTabs.length) % missionTabs.length;
    renderMissionTab(missionTabs[next]);
    progressElement("tab-" + missionTabs[next]).focus();
  });
}

window.addEventListener("storage", (event) => {
  if (![progressKey, saveHistoryKey].includes(event.key) || unsavedRounds.length) return;
  refreshTitleProgress();
  if (progressDialog.open && !progressElement("mission-tabs").hidden) renderMissionTab(activeMissionTab);
  else if (progressDialog.open && fishDetail.hidden) renderFishList();
});

let toastTimer;
function announceMissions(round) {
  const next = applyRound(savedProgress, catchDelta(round));
  const newlyEligible = eligibleMissions(next).filter(({ id }) => !round.announced.has(id));
  if (!newlyEligible.length) return false;
  newlyEligible.forEach(({ id }) => round.announced.add(id));
  const toast = progressElement("mission-toast");
  toast.textContent = "ミッション達成！ " + newlyEligible.map(({ name }) => name).join("・");
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2700);
  return true;
}

function renderRoundSummary(summary) {
  progressElement("earned-xp").textContent = "+" + summary.xp + " XP";
  progressElement("round-rewards-row").hidden = !summary.rewards.length;
  progressElement("round-rewards").textContent = summary.rewards
    .map(({ label, xp }) => label + " +" + xp + " XP").join("・");
  const levelUp = progressElement("level-up");
  levelUp.hidden = summary.after.level === summary.before.level;
  levelUp.textContent = "レベルアップ！ Lv. " + summary.before.level + " → " + summary.after.level;
  const newFish = summary.discoveries.map((id) => rareById[id].name);
  progressElement("new-fish").textContent = newFish.length ? newFish.join("・") : "なし";
  progressElement("discovery-badge").hidden = !newFish.length;
  progressElement("new-missions").textContent = summary.unlocked.length
    ? summary.unlocked.map(({ name }) => name).join("・") : "なし";
  progressElement("save-warning").hidden = summary.saved;
  refreshTitleProgress();
}

refreshTitleProgress();
