const CACHE_NAME = "heroes-of-click-v1.2.1";
const SHELL = [
    "./",
    "./index.html",
    "./style.css",
    "./theme.js",
    "./config.js",
    "./database.js",
    "./enemy.js",
    "./game.js",
    "./army.js",
    "./hero.js",
    "./combat-content.js",
    "./season.js",
    "./research.js",
    "./progression.js",
    "./frontier.js",
    "./kingdom.js",
    "./ui.js",
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
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];
const FIREBASE_SDK = [
    "https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore-compat.js"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            await cache.addAll(SHELL);
            // Firebase is optional for offline play, but precaching its SDKs
            // allows the game itself to start without connectivity.
            await Promise.allSettled(FIREBASE_SDK.map(async url => {
                const response = await fetch(url, { mode: "no-cors" });
                await cache.put(url, response);
            }));
            await self.skipWaiting();
        })
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(key => key.startsWith("heroes-of-click-") && key !== CACHE_NAME)
                .map(key => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

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

    // Network first: Netlify deploys update promptly, with cached offline fallback.
    event.respondWith(
        fetch(request).then(response => {
            if (response.ok) {
                const copy = response.clone();
                event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
            }
            return response;
        }).catch(async () => {
            const cached = await caches.match(request);
            if (cached) return cached;
            if (request.mode === "navigate") {
                return caches.match("./index.html");
            }
            return Response.error();
        })
    );
});
