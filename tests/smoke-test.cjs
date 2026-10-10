// Dependency-free regression checks: node tests/smoke-test.cjs
// Executes the classic browser scripts using a small DOM/Firebase test double.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const paths = ["config.js", "hero.js", "kingdom.js", "enemy.js", "database.js", "ui.js", "game.js"];
const source = paths.map(file => fs.readFileSync(path.join(__dirname, "..", file), "utf8")).join("\n");
const nodes = new Map(), intervals = new Map(), listeners = {}, storage = new Map();
let nextInterval = 0, unsubscribed = 0, mockNow = 1000;

function element(tag = "div") {
    return {
        tagName: tag, style: {}, textContent: "", innerHTML: "", checked: true,
        disabled: false, value: "", width: 150, height: 150, childNodes: [],
        classList: { add() {}, remove() {} },
        appendChild(item) { this.childNodes.push(item); return item; },
        append(...items) { this.childNodes.push(...items); },
        replaceChildren(...items) { this.childNodes = items; },
        remove() {}, addEventListener() {}, querySelector() { return element(); },
        querySelectorAll() { return []; }, closest() { return element(); },
        getContext() { return { clearRect() {}, fillRect() {} }; },
        getBoundingClientRect() { return { width: this.width, height: this.height, top: 0, left: 0 }; }
    };
}
const document = {
    hidden: false, body: element("body"),
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
    createElement: element,
    createTextNode: text => ({ textContent: text }),
    createDocumentFragment: () => element("fragment"),
    addEventListener(name, callback) { listeners[name] = callback; }
};
const userContent = {
    name: "<img src=x onerror=alert(1)>",
    msg: "<script>alert(1)</script>",
    score: 13,
    timestamp: { toDate() { return new Date(); } }
};
const snapshot = { forEach(callback) { callback({ data() { return userContent; } }); } };
const collection = {
    orderBy() { return this; }, limit() { return this; },
    onSnapshot(callback) { callback(snapshot); return () => unsubscribed++; },
    doc() { return { get: async () => ({ exists: false }), set: async () => {} }; },
    add: async () => {}
};
function firestore() { return { collection() { return collection; } }; }
firestore.FieldValue = { serverTimestamp: () => new Date() };
const ctx = vm.createContext({
    intervals, nodes, listeners, userContent,
    get unsubscribed() { return unsubscribed; },
    document, window: { addEventListener() {} }, firebase: { initializeApp() {}, firestore },
    localStorage: {
        getItem: key => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key)
    },
    setInterval: (fn, ms) => { const id = ++nextInterval; intervals.set(id, { fn, ms }); return id; },
    clearInterval: id => intervals.delete(id),
    setTimeout: () => 1, clearTimeout() {},
    performance: { now: () => mockNow },
    alert() {}, confirm: () => true, console
});
vm.runInContext(source, ctx, { timeout: 2000, filename: "game-scripts" });

const checks = vm.runInContext("(() => {\n    const passed = [];\n    function ok(value, label) {\n        if (!value) throw new Error(\"FAIL: \" + label);\n        passed.push(label);\n    }\n    gold = 1e20;\n    playerLevel = 109;\n    structures.castle.level = 1;\n    upgradeMultiplier = 100;\n    ok(levelUpPlayerCost(true)[1] === 1, \"Bulk price constrained by player level cap\");\n    levelUpPlayer();\n    ok(playerLevel === 110, \"Bulk upgrade respects level cap\");\n    ok(levelUpPlayerCost(true)[1] === 0, \"Purchases at cap rejected\");\n    const custom = estimateUpgradeCost({\n        baseLevel: 8, upgradeEquation: () => 1, cap: 100,\n        resourceAvailable: 100, multiplier: 10, query: true,\n        capFunction: level => level >= 10\n    });\n    ok(custom[1] === 2, \"Custom level cap checked for each purchase\");\n    playerGearLevel = 4;\n    structures.blacksmith.level = 1;\n    ok(gearUpPlayerCost(true)[1] === 1, \"Bulk gear price respects cap\");\n    gearUpPlayer();\n    ok(playerGearLevel === 5, \"Bulk gear purchase respects cap\");\n    hiredMercenaries.push(\n        { level: 1, gearLevel: 0, attackSpeedLevel: 0, squad: 1 },\n        { level: 1, gearLevel: 0, attackSpeedLevel: 0, squad: 1 }\n    );\n    const base = getAutoDamage();\n    ok(Math.abs(base - 1.1) < 1e-9, \"Squad DPS formula\");\n    hiredMercenaries[0].attackSpeedLevel = 9;\n    ok(Math.abs(getAutoDamage() - base * 10) < 1e-9, \"Speed counted once\");\n    startSquadAttack(); startSquadAttack(); startSquadAttack(2);\n    ok([...intervals.values()].filter(x => x.ms === 250).length === 1, \"One bounded combat interval\");\n    document.hidden = true;\n    listeners.visibilitychange();\n    ok(![...intervals.values()].some(x => x.ms === 250), \"Combat pauses in background\");\n    document.hidden = false;\n    listeners.visibilitychange();\n    ok([...intervals.values()].filter(x => x.ms === 250).length === 1, \"Combat resumes\");\n    showLeaderboard(); closeLeaderboard();\n    showMessage(); closeMessage();\n    ok(unsubscribed === 2, \"Firebase subscriptions cleaned up\");\n    ok(!nodes.get(\"leaderboard-scroll\").innerHTML.includes(userContent.name), \"Leaderboard XSS prevented\");\n    ok(!nodes.get(\"message-scroll\").innerHTML.includes(userContent.msg), \"Message board XSS prevented\");\n    const reward = awardOfflineGold(100000000);\n    ok(reward >= 0 && reward <= getAutoDamage() * 0.25 * 86400 * mktUp(4), \"Offline progress limited\");\n    saveGame();\n    const saved = JSON.parse(localStorage.getItem(\"clickerHeroSave\"));\n    ok(saved.lastSaved <= Date.now() && Date.now() - saved.lastSaved < 10000, \"Save timestamp valid\");\n    ok(typeof saved.autoAdvance === \"boolean\" && typeof saved.underfillEnabled === \"boolean\", \"Settings saved\");\n    ok(saved.hiredMercenaries.length === 2, \"Mercenaries saved\");\n    localStorage.setItem(\"clickerHeroSave\", JSON.stringify({\n        gold: 123, playerLevel: 7, hiredMercenaries: [], lastSaved: Date.now() + 60000\n    }));\n    loadGame();\n    ok(gold === 123 && playerLevel === 7, \"Old save format loads\");\n    return passed;\n})()", ctx, { timeout: 2000 });
checks.forEach(label => console.log('PASS ' + label));
console.log(checks.length + ' checks passed.');
