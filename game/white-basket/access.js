"use strict";
// Enable only after NFC tag migration and explicit approval.
const nfcAccessConfig = Object.freeze({ enabled: false, game: "white-basket", key: "wb-2026-k7Qm4Zp9rT2vN6xC" });
const accessStorageKey = "cat-clicker:white-basket:access";
function verifyAccess(key, stored, enabled = nfcAccessConfig.enabled) {
  const valid = key === nfcAccessConfig.key;
  return { allowed: !enabled || valid || stored === "nfc-v1", verified: valid };
}
function initializeAccess() {
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const key = fragment.get("access") ?? url.searchParams.get("access");
  if (key !== null) {
    fragment.delete("access");
    url.searchParams.delete("access");
    url.hash = fragment.toString();
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  let stored;
  try { stored = localStorage.getItem(accessStorageKey); } catch {}
  const access = verifyAccess(key, stored);
  if (access.verified) {
    try { localStorage.setItem(accessStorageKey, "nfc-v1"); } catch {}
  }
  document.getElementById("access-guide").hidden = access.allowed;
  document.querySelector("main.app").hidden = !access.allowed;
  return access.allowed;
}
let gameAccessAllowed = initializeAccess();
window.addEventListener("hashchange", () => { gameAccessAllowed = initializeAccess(); });
