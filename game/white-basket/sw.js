"use strict";

const base = self.registration.scope;
const cachePrefix = "cat-clicker-white-basket:" + base + ":";
const cacheName = cachePrefix + "v9";
const url = (name) => new URL(name, base).href;
const files = ["index.html", "style.css", "cat-face.js", "stages.js", "fish-data.js", "aquarium-data.js", "achievements.js", "player-data.js", "transfer-code.js", "validation.js", "save-history.js", "save-data.js", "progress.js", "collection.js", "profile-ui.js", "power-ups.js", "access.js", "game.js", "session.js", "aquarium.js"].map(url);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(files.map((file) => new Request(file, { cache: "reload" })))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(base)) return;
  if (request.mode === "navigate") {
    const path = new URL(request.url).pathname;
    if (path !== new URL(base).pathname && path !== new URL(url("index.html")).pathname) return;
    event.respondWith(caches.match(url("index.html"), { cacheName }).then((response) => response || fetch(request)));
  } else if (files.includes(request.url)) {
    event.respondWith(caches.match(request, { cacheName }).then((response) => response || fetch(request)));
  }
});
