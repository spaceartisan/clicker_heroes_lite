const CACHE_NAME = "heroes-of-click-v1.17.0";
const SHELL = [
    "./",
    "./index.html",
    "./style.css",
    "./theme.js",
    "./app-updates.js",
    "./config.js",
    "./database.js",
    "./enemy.js",
    "./game.js",
    "./army.js",
    "./systems.js",
    "./monster-codex.js",
    "./player-account.js",
    "./session-guard.js",
    "./account-leaderboard.js",
    "./telemetry.js",
    "./hero.js",
    "./combat-content.js",
    "./season.js",
    "./research.js",
    "./progression.js",
    "./frontier.js",
    "./commissions.js",
    "./kingdom-life.js",
    "./kingdom-art.js",
    "./kingdom.js",
    "./kingdom-map.js",
    "./ui.js",
    "./dialogs.js",
    "./menus.css",
    "./manifest.webmanifest",
    "./icons/emblem.svg",
    "./icons/ui-hero.svg",
    "./icons/ui-kingdom.svg",
    "./icons/ui-army.svg",
    "./icons/ui-leaderboard.svg",
    "./icons/ui-message.svg",
    "./icons/ui-settings.svg",
    "./icons/ui-research.svg",
    "./icons/ui-treasury.svg",
    "./icons/ui-dynasty.svg",
    "./icons/ui-achievements.svg",
    "./icons/ui-stats.svg",
    "./icons/ui-save.svg",
    "./icons/ui-delete.svg",
    "./icons/ui-export.svg",
    "./icons/ui-import.svg",
    "./icons/ui-gold.svg",
    "./icons/ui-previous.svg",
    "./icons/ui-next.svg",
    "./icons/ui-battle.svg",
    "./icons/ui-market.svg",
    "./icons/ui-governance.svg",
    "./icons/ui-battery.svg",
    "./icons/ui-clock.svg",
    "./icons/ui-shield.svg",
    "./icons/apple-touch-icon.png",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];
const FIREBASE_SDK = [
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js",
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            // Bypass the HTTP cache when assembling a new release. A failed
            // shell download prevents installation; the current release stays usable.
            await cache.addAll(SHELL.map(path => new Request(
                new URL(path, self.location.href), { cache: "reload" })));
            // Firebase is optional for offline play, but precaching its SDKs
            // allows the game itself to start without connectivity.
            await Promise.allSettled(FIREBASE_SDK.map(async url => {
                const response = await fetch(url, { mode: "no-cors" });
                await cache.put(url, response);
            }));
            // Updates wait until the player accepts, or all old windows close.
        })
    );
});

self.addEventListener("message", event => {
    if (event.data?.type === "ACTIVATE_UPDATE") event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(key => key.startsWith("heroes-of-click-") && key !== CACHE_NAME)
                .map(key => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

const shellUrls = new Set(SHELL.map(path => new URL(path, self.location.href).href));

self.addEventListener("fetch", event => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    const sameOrigin = url.origin === self.location.origin;
    const isFirebaseSdk = FIREBASE_SDK.includes(url.href);
    if (!sameOrigin && !isFirebaseSdk) return;

    if (isFirebaseSdk) {
        event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
            if (response.ok || response.type === "opaque") {
                const copy = response.clone();
                event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
            }
            return response;
        })));
        return;
    }

    // Keep HTML, scripts and styles from the installed release together.
    // Rechecking the worker downloads the next complete release separately.
    const documentUrl = new URL("./index.html", self.location.href).href;
    const pageUrl = new URL(request.url);
    pageUrl.search = "";
    const isGamePage = request.mode === "navigate" &&
        (pageUrl.href === new URL("./", self.location.href).href || pageUrl.href === documentUrl);
    const cacheKey = isGamePage ? documentUrl : request;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        if (isGamePage || shellUrls.has(url.href)) {
            const cached = await cache.match(cacheKey);
            if (cached) return cached;
        }
        // Non-shell pages are fetched normally; never replace a release's
        // cached shell with individual files from a later deployment.
        try {
            return await fetch(request, { cache: "no-cache" });
        } catch (_) {
            return (await cache.match(cacheKey)) || Response.error();
        }
    })());
});
