"use strict";

const playerDialog = progressElement("player-dialog");
const playerStatus = progressElement("player-status");
const titleChoice = progressElement("title-choice");
const importInput = progressElement("import-save");
let pendingImport = null;
let importRequest = 0;
let restoring = false;

function textRow(list, label, value) {
  const row = makeElement("div");
  row.append(makeElement("dt", label), makeElement("dd", value));
  list.append(row);
}

function profileDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return (hours ? formatCount(hours) + "時間 " : "") + minutes + "分 " + (seconds % 60) + "秒";
}

function renderPlayerRecords() {
  const p = savedProgress;
  const rate = (value, total) => Math.round(value / total * 100) + "%（" + value + " / " + total + "）";
  const streak = knownPlayStreak(p.days);
  const time = p.plays > p.timedPlays
    ? (p.timedPlays ? profileDuration(p.playMs) + "（記録開始以降）" : "旧版のため記録なし")
    : profileDuration(p.playMs);
  const stats = progressElement("stats-list");
  stats.replaceChildren();
  [
    ["累計プレイ回数", formatCount(p.plays) + " 回"], ["累計プレイ時間", time],
    ["累計捕獲数", formatCount(p.catches) + " 匹"], ["金の魚の捕獲数", formatCount(p.gold) + " 匹"],
    ["レア魚の捕獲数", formatCount(totalRareCaught(p.collection)) + " 匹"],
    ["最大コンボ", formatCount(p.maxCombo)], ["ハイスコア", formatCount(Math.max(best, readStoredBest()))],
    ["累計プレイ日数", formatCount(p.days.length) + " 日"],
    ["連続プレイ日数", formatCount(streak.current) + " 日"], ["最長連続プレイ日数", formatCount(streak.longest) + " 日"],
    ["図鑑コンプリート率", rate(Object.keys(p.collection).length, rareFish.length)],
    ["実績達成率", rate(p.achievements.length, missions.length)],
  ].forEach(([label, value]) => textRow(stats, label, value));

  const none = makeElement("option", "表示しない");
  none.value = "";
  titleChoice.replaceChildren(none);
  const titles = progressElement("title-list");
  titles.replaceChildren();
  for (const title of playerTitles) {
    const item = makeElement("li", title.label + " ／ " + (title.earned(p) ? "獲得済み" : title.hint));
    if (title.earned(p)) {
      const option = makeElement("option", title.label);
      option.value = title.id;
      titleChoice.append(option);
      item.className = "earned";
    }
    titles.append(item);
  }
  titleChoice.value = Array.from(titleChoice.options).some(({ value }) => value === p.settings.title)
    ? p.settings.title : "";
}

function cancelImport() {
  importRequest += 1;
  pendingImport = null;
  importInput.value = "";
  progressElement("restore-preview").hidden = true;
}

function showPlayerDialog(kind) {
  refreshTitleProgress();
  cancelImport();
  playerStatus.textContent = "";
  progressElement("player-dialog-title").textContent = kind === "records" ? "プレイきろく" : "設定";
  progressElement("player-records").hidden = kind !== "records";
  progressElement("player-settings").hidden = kind !== "settings";
  if (kind === "records") renderPlayerRecords();
  playerDialog.showModal();
  playerDialog.scrollTop = 0;
}

progressElement("show-records").addEventListener("click", () => showPlayerDialog("records"));
progressElement("show-settings").addEventListener("click", () => showPlayerDialog("settings"));
progressElement("close-player").addEventListener("click", () => { if (!restoring) playerDialog.close(); });
playerDialog.addEventListener("cancel", (event) => { if (restoring) event.preventDefault(); });
playerDialog.addEventListener("close", cancelImport);

titleChoice.addEventListener("change", async () => {
  const id = titleChoice.value;
  if (id && !playerTitles.some((title) => title.id === id && title.earned(savedProgress))) return;
  titleChoice.disabled = true;
  try {
    await savePlayerSettings({ title: id });
    refreshTitleProgress();
    playerStatus.textContent = "称号の表示を更新しました。";
  } catch {
    renderPlayerRecords();
    playerStatus.textContent = "称号を保存できませんでした。";
  } finally {
    titleChoice.disabled = false;
  }
});

function downloadArchive(file) {
  const url = URL.createObjectURL(file);
  const download = makeElement("a");
  download.href = url;
  download.download = file.name;
  document.body.append(download);
  download.click();
  download.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

progressElement("export-save").addEventListener("click", async () => {
  refreshTitleProgress();
  const archive = makeSaveArchive(savedProgress, Math.max(best, readStoredBest()));
  const file = new File([JSON.stringify(archive, null, 2)], "osakana-catch-" + localPlayDay() + ".json",
    { type: "application/json" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch (error) {
        if (error.name === "AbortError") return;
        downloadArchive(file);
      }
    } else {
      downloadArchive(file);
    }
    playerStatus.textContent = "バックアップを書き出しました。";
  } catch {
    playerStatus.textContent = "バックアップを書き出せませんでした。";
  }
});

function previewText(p, highScore) {
  return "Lv. " + levelInfo(p.xp).level + " ／ " + formatCount(p.xp) + " XP ／ 最高 " +
    formatCount(highScore) + " 点 ／ " + p.plays + " 回 ／ 図鑑 " + Object.keys(p.collection).length +
    " / " + rareFish.length + " ／ 実績 " + p.achievements.length + " / " + missions.length;
}

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  const request = ++importRequest;
  pendingImport = null;
  progressElement("restore-preview").hidden = true;
  playerStatus.textContent = "";
  if (!file) return;
  try {
    if (file.size > maxSaveBytes) throw new Error("ファイルが大きすぎます（上限2 MB）。");
    const text = await file.text();
    let raw;
    try { raw = JSON.parse(text); } catch { throw new Error("JSONファイルを読み取れません。"); }
    const validated = validateSaveArchive(raw);
    if (request !== importRequest) return;
    pendingImport = raw;
    refreshTitleProgress();
    const list = progressElement("restore-summaries");
    list.replaceChildren();
    textRow(list, "現在", previewText(savedProgress, Math.max(best, readStoredBest())));
    textRow(list, "バックアップ", previewText(validated.progress, validated.best));
    progressElement("restore-preview").hidden = false;
  } catch (error) {
    if (request === importRequest) playerStatus.textContent = error.message || "復元ファイルを読み取れません。";
  }
});

progressElement("cancel-restore").addEventListener("click", cancelImport);
progressElement("confirm-restore").addEventListener("click", async () => {
  if (!pendingImport || restoring) return;
  restoring = true;
  const button = progressElement("confirm-restore");
  button.disabled = true;
  importInput.disabled = true;
  try {
    const restored = await restoreSaveArchive(pendingImport);
    applyRestoredSettings(restored);
    refreshTitleProgress();
    playerStatus.textContent = "セーブデータを復元しました。";
    cancelImport();
  } catch {
    playerStatus.textContent = "復元できませんでした。現在のセーブデータを保護しました。";
  } finally {
    restoring = false;
    importInput.disabled = false;
    button.disabled = false;
  }
});
