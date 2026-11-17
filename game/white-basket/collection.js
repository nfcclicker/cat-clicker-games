"use strict";

const progressElement = (id) => document.getElementById(id);
const numberFormat = new Intl.NumberFormat("ja-JP");
const dateFormat = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" });
const formatCount = (value) => numberFormat.format(value);
const progressDialog = progressElement("progress-dialog");

function makeElement(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function refreshTitleProgress() {
  if (!unsavedRounds.length) savedProgress = readProgress();
  const { level, xp, needed } = levelInfo(savedProgress.xp);
  const ranks = ["おさかな見習い", "おさかな探検家", "おさかな名人", "おさかな達人", "おさかなマスター"];
  progressElement("level").textContent = "Lv. " + level;
  progressElement("rank").textContent = ranks[Math.min(4, Math.floor(level / 10))];
  progressElement("xp-label").textContent = level === maxLevel ? "レベル上限" : xp + " / " + needed + " XP";
  const meter = progressElement("xp-bar");
  meter.max = needed;
  meter.value = xp;
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

function fishCards(progress) {
  return rareFish.map((fish) => {
    const entry = progress.collection[fish.id];
    const card = makeElement("li", undefined, "collection-card");
    const image = makeElement("canvas");
    image.width = 176;
    image.height = 100;
    image.setAttribute("aria-hidden", "true");
    drawRareFish(image.getContext("2d"), fish, 84, 52, 2, 0, !entry);
    card.append(image, makeElement("strong", entry ? fish.name : "？？？"));
    if (entry) {
      card.append(makeElement("p", "★".repeat(fish.tier), "fish-stars"),
        makeElement("p", "捕獲 " + formatCount(entry.count) + " 匹"),
        makeElement("p", "発見 " + (entry.firstSeen ? dateFormat.format(new Date(entry.firstSeen)) : "日時不明")));
    } else {
      card.append(makeElement("p", "未発見"));
    }
    return card;
  });
}

function showProgressDialog(kind) {
  refreshTitleProgress();
  const isCollection = kind === "collection";
  const count = isCollection ? Object.keys(savedProgress.collection).length : savedProgress.achievements.length;
  const total = isCollection ? rareFish.length : missions.length;
  progressElement("progress-dialog-title").textContent = isCollection ? "おさかな図鑑" : "ミッション";
  progressElement("progress-dialog-summary").textContent = isCollection
    ? "収集率 " + Math.round(count / total * 100) + "%（" + count + " / " + total + " 種）"
    : count + " / " + total + " 達成";
  const list = progressElement("progress-list");
  list.className = isCollection ? "collection-grid" : "mission-list";
  list.replaceChildren(...(isCollection ? fishCards(savedProgress) : missionCards(savedProgress)));
  progressDialog.showModal();
  progressDialog.scrollTop = 0;
}

progressElement("show-missions").addEventListener("click", () => showProgressDialog("missions"));
progressElement("show-collection").addEventListener("click", () => showProgressDialog("collection"));
progressElement("back-to-title").addEventListener("click", () => progressDialog.close());
window.addEventListener("storage", (event) => {
  if (event.key === progressKey && !unsavedRounds.length) refreshTitleProgress();
});

let toastTimer;
function announceMissions(round) {
  const next = applyRound(savedProgress, round, false);
  const newlyEligible = eligibleMissions(next).filter(({ id }) => !round.announced.has(id));
  if (!newlyEligible.length) return;
  newlyEligible.forEach(({ id }) => round.announced.add(id));
  const toast = progressElement("mission-toast");
  toast.textContent = "ミッション達成！ " + newlyEligible.map(({ name }) => name).join("・");
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2700);
}

function renderRoundSummary(summary) {
  progressElement("earned-xp").textContent = "+" + summary.xp + " XP";
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
