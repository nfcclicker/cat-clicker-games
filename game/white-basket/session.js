"use strict";
const sessionKey = "cat-clicker:white-basket:play-session";
const sessionOwner = crypto.randomUUID();
const sessionLifetime = 15000;
let sessionHeld = false;
let sessionHeartbeat;
let sessionStarting = false;
let sessionChannel;
try { sessionChannel = new BroadcastChannel(sessionKey); } catch {}
function sessionRecord() {
  try {
    const record = JSON.parse(localStorage.getItem(sessionKey));
    return record && typeof record.owner === "string" && Number.isFinite(record.until) ? record : null;
  } catch { return null; }
}
function sessionConflict() {
  const current = sessionRecord();
  return current && current.owner !== sessionOwner && current.until > Date.now();
}
async function acquireSession(takeover = false) {
  return withProgressLock(() => {
    if (!gameAccessAllowed) throw new Error("猫クリッカーをかざしてください。");
    if (!takeover && sessionConflict()) return false;
    localStorage.setItem(sessionKey, JSON.stringify({ owner: sessionOwner, until: Date.now() + sessionLifetime }));
    sessionHeld = true;
    return true;
  });
}
function showSessionConflict() {
  const dialog = byId("session-conflict");
  if (!dialog.open) dialog.showModal();
}
async function beginSession(takeover = false) {
  if (sessionStarting || state === "playing" || state === "paused") return;
  sessionStarting = true;
  try {
    if (!await acquireSession(takeover)) { showSessionConflict(); return; }
    sessionChannel?.postMessage({ type: "owner", owner: sessionOwner });
    byId("session-conflict").close();
    startGame();
    clearInterval(sessionHeartbeat);
    sessionHeartbeat = setInterval(() => {
      void withProgressLock(() => {
        if (!sessionHeld || sessionRecord()?.owner !== sessionOwner) { stopTransferredGame(); return; }
        localStorage.setItem(sessionKey, JSON.stringify({ owner: sessionOwner, until: Date.now() + sessionLifetime }));
      }).catch(() => { pauseGame(); reportSaveError(); });
    }, 4000);
  } catch { reportSaveError(); } finally { sessionStarting = false; }
}
function stopTransferredGame() {
  if (!sessionHeld) return;
  sessionHeld = false;
  clearInterval(sessionHeartbeat);
  if (state === "playing" || state === "paused") {
    pauseGame();
    state = "superseded";
    byId("resume-dialog").close();
    showSessionConflict();
  }
}
function releaseSession() {
  sessionHeld = false;
  clearInterval(sessionHeartbeat);
  void withProgressLock(() => {
    if (sessionRecord()?.owner === sessionOwner) localStorage.removeItem(sessionKey);
  }).catch(reportSaveError);
}
function assertRoundSession(round) {
  if (round.owner && sessionRecord()?.owner !== round.owner) throw saveConflict();
}
window.addEventListener("storage", event => {
  if (event.key === sessionKey && sessionHeld && sessionRecord()?.owner !== sessionOwner) stopTransferredGame();
});
if (sessionChannel) sessionChannel.onmessage = () => {
  if (sessionHeld && sessionRecord()?.owner !== sessionOwner) stopTransferredGame();
};
byId("take-session").addEventListener("click", () => void beginSession(true));
byId("close-session").addEventListener("click", () => {
  byId("session-conflict").close();
  if (state === "superseded") location.reload();
  else window.close();
});
if (sessionConflict()) showSessionConflict();
window.addEventListener("pagehide", () => {
  if (state === "playing" || state === "paused") pauseGame();
  releaseSession();
});
