// Update the installed game without deleting saves, settings or sign-in data.
(() => {
    const notice = document.getElementById("app-update-notice");
    const noticeText = document.getElementById("app-update-notice-text");
    const status = document.getElementById("app-update-status");
    const checkButton = document.getElementById("app-update-check");
    const reloadButtons = [...document.querySelectorAll("[data-app-update-reload]")];
    let registration = null;
    let checking = false;
    let applying = false;
    let reloaded = false;
    let controllerChanged = false;
    let lastCheck = 0;
    let initialController = navigator.serviceWorker?.controller;

    function report(message) { if (status) status.textContent = message; }
    function offerUpdate() {
        if (!registration?.waiting && !controllerChanged) return false;
        report("A game update is ready. Reload when you are ready to continue.");
        if (notice) notice.hidden = false;
        if (noticeText) noticeText.textContent = "A game update is ready. Your progress will be saved before reloading.";
        reloadButtons.forEach(button => { button.hidden = false; });
        return true;
    }
    function reloadOnce() {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
    }
    function applyUpdate() {
        if (applying || (!registration?.waiting && !controllerChanged)) return;
        try {
            if (typeof saveGame !== "function") throw new Error("Game is still loading");
            saveGame();
        } catch (error) {
            report("Could not save progress. The game has not reloaded. Please try again.");
            if (noticeText) noticeText.textContent = "Could not save progress. Please try updating again.";
            console.warn("Update paused because saving failed:", error);
            return;
        }
        applying = true;
        reloadButtons.forEach(button => { button.disabled = true; });
        report("Progress saved. Opening the updated game…");
        if (registration?.waiting) {
            registration.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
        } else {
            reloadOnce();
        }
    }
    async function checkForUpdate(manual = false) {
        if (!registration || checking || applying) return;
        if (!manual && Date.now() - lastCheck < 60000) return;
        checking = true;
        lastCheck = Date.now();
        if (checkButton) checkButton.disabled = true;
        report("Checking for updates…");
        try {
            await registration.update();
            if (!offerUpdate()) report(registration.installing
                ? "Downloading the update. You can keep playing."
                : "No new update is available.");
        } catch (_) {
            if (!offerUpdate()) report("Could not check for updates. Reconnect and try again.");
        } finally {
            checking = false;
            if (checkButton) checkButton.disabled = false;
        }
    }
    reloadButtons.forEach(button => button.addEventListener("click", applyUpdate));
    if (!("serviceWorker" in navigator)) {
        report("Automatic updates are unavailable in this browser. Reopen the game online to refresh.");
        if (checkButton) checkButton.disabled = true;
        return;
    }
    if (checkButton) checkButton.addEventListener("click", () => checkForUpdate(true));
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        // First installation needs no refresh. Another window accepting an
        // update must not interrupt this player's unsaved activity.
        if (applying) {
            reloadOnce();
        } else if (initialController) {
            controllerChanged = true;
            offerUpdate();
        }
        initialController = navigator.serviceWorker.controller;
    });
    window.addEventListener("load", async () => {
        try {
            registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
            function watchInstallation() {
                const worker = registration.installing;
                if (!worker) return;
                report("Downloading game files. You can keep playing.");
                worker.addEventListener("statechange", () => {
                    if (worker.state === "installed") {
                        if (!offerUpdate()) report("The game is ready for offline play.");
                    } else if (worker.state === "redundant") {
                        if (!offerUpdate()) report("The update could not finish. You can check again.");
                    }
                });
            }
            registration.addEventListener("updatefound", watchInstallation);
            watchInstallation();
            offerUpdate();
            await checkForUpdate();
        } catch (error) {
            report("Updates are unavailable right now. Reopen the game online to try again.");
            if (checkButton) checkButton.disabled = true;
            console.warn("Offline support unavailable:", error);
        }
    });
    // Installed phone apps can remain suspended for days without a navigation.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
    });
    window.addEventListener("online", () => checkForUpdate(true));
})();
