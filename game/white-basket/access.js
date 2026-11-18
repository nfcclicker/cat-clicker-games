"use strict";

const accessDigest = "d846f084fc67fe987b3f83f0c408208d67a2b3b717758a60fa7cda602f11e761";
const accessStorageKey = "cat-clicker:white-basket:access";
const accessMarker = "nfc-v2";
const gameScripts = ["stages.js","fish-data.js","aquarium-data.js","achievements.js","player-data.js","transfer-code.js","validation.js","save-history.js","save-data.js","progress.js","collection.js","profile-ui.js","power-ups.js","game.js","session.js","aquarium.js","ui.js"];
const guide = document.getElementById("access-guide");
const app = document.querySelector("main.app");
let gameAccessAllowed = false;
let gameLoading;

function loadAuthenticatedGame() {
  gameAccessAllowed = true;
  guide.hidden = true;
  app.hidden = false;
  if (gameLoading) return gameLoading;
  // Preserve the original script order and prevent the locked page from initializing saves.
  gameLoading = gameScripts.reduce((ready, file) => ready.then(() => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./" + file;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  })), Promise.resolve());
  return gameLoading;
}

async function initializeAccess() {
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const supplied = fragment.getAll("key");
  if (supplied.length) {
    fragment.delete("key");
    url.hash = fragment.toString();
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }
  let authorized = gameAccessAllowed;
  try { authorized ||= localStorage.getItem(accessStorageKey) === accessMarker; } catch {}
  if (supplied.length === 1 && /^[A-Za-z0-9_-]{32}$/.test(supplied[0]) && crypto.subtle) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(supplied[0]));
    const hex = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
    if (hex === accessDigest) {
      authorized = true;
      try { localStorage.setItem(accessStorageKey, accessMarker); } catch {}
    }
  }
  if (authorized) await loadAuthenticatedGame();
}

const guideCanvas = document.getElementById("access-cat");
const guideContext = guideCanvas.getContext("2d");
guideContext.translate(100, 151);
guideContext.scale(1.28, 1.28);
drawCatFace(guideContext, { coat: "white" });

function checkAccess() {
  void initializeAccess().catch(() => {
    if (!gameAccessAllowed) guide.hidden = false;
  });
}
checkAccess();
window.addEventListener("hashchange", checkAccess);

if (window.isSecureContext && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
}
