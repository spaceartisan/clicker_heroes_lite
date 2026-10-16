// One low-frequency animation timer, only while the unobstructed map is visible.
// Never changes gameplay, progression or saved state.
let kingdomLifeTimer = null;
let kingdomLifeTime = 0;
const kingdomLifeUpgrades = new Map();
let kingdomLifeOnScreen = true;
const kingdomReducedMotion = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : {matches:false};
function kingdomLifeVisible() {
    const map = document.getElementById('kingdom-view');
    return !!map && map.style.display !== 'none' && !document.hidden && kingdomLifeOnScreen &&
        !(typeof GameDialogs !== 'undefined' && GameDialogs.current());
}
function notifyKingdomUpgrade(id) {
    if (Object.hasOwn(structures, id)) kingdomLifeUpgrades.set(id, {id, elapsed:0});
}
function resetKingdomLife() {
    kingdomLifeUpgrades.clear();
    kingdomLifeTime = 0;
}
function refreshKingdomLife() {
    if (kingdomLifeTimer !== null) clearTimeout(kingdomLifeTimer);
    kingdomLifeTimer = null;
    if (!kingdomLifeVisible() || kingdomReducedMotion.matches) return;
    const delay = batterySaverEnabled ? 600 : 180;
    kingdomLifeTimer = setTimeout(() => {
        kingdomLifeTimer = null;
        if (!kingdomLifeVisible() || kingdomReducedMotion.matches) return;
        kingdomLifeTime += delay;
        for (const [id, effect] of kingdomLifeUpgrades) {
            effect.elapsed += delay;
            if (effect.elapsed > 1800) kingdomLifeUpgrades.delete(id);
        }
        drawKingdom();
        refreshKingdomLife();
    }, delay);
}
(function () {
    const originalDraw = drawKingdom;
    drawKingdom = function (...args) {
        const result = originalDraw(...args);
        if (!kingdomReducedMotion.matches) {
            const canvas = document.getElementById('kingdom-canvas');
            KingdomArt.drawLife(canvas.getContext('2d'), {
                levels:Object.fromEntries(Object.entries(structures).map(([id,s])=>[id,s.level])),
                time:kingdomLifeTime, upgrades:[...kingdomLifeUpgrades.values()]
            }, canvas.width);
        }
        return result;
    };
    document.addEventListener('visibilitychange', refreshKingdomLife);
    kingdomReducedMotion.addEventListener?.('change', () => {
        refreshKingdomLife(); drawKingdom();
    });
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof IntersectionObserver === 'function') {
            const observer = new IntersectionObserver(entries => {
                kingdomLifeOnScreen = entries.some(entry => entry.isIntersecting);
                refreshKingdomLife();
            });
            observer.observe(document.getElementById('kingdom-canvas'));
        }
        refreshKingdomLife();
    });
})();
