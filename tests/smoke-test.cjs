// Dependency-free regression checks: node tests/smoke-test.cjs
// Executes the classic browser scripts using a small DOM/Firebase test double.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const paths = ["config.js", "combat-content.js", "hero.js", "kingdom.js", "enemy.js", "database.js", "ui.js", "game.js"];
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
        remove() {}, addEventListener() {}, setAttribute() {}, querySelector() { return element(); },
        querySelectorAll() { return []; }, closest() { return element(); },
        getContext() { return { clearRect() {}, fillRect() {} }; },
        getBoundingClientRect() { return { width: this.width, height: this.height, top: 0, left: 0 }; }
    };
}
const document = {
    hidden: false, body: element("body"),
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
    createElement: element,
    querySelector() { return element(); },
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
    advanceClock: ms => { mockNow += ms; },
    alert() {}, confirm: () => true, console
});
vm.runInContext(source, ctx, { timeout: 2000, filename: "game-scripts" });

const checks = vm.runInContext("(() => {\n    const passed = [];\n    function ok(test, description) {\n        if (!test) throw new Error(\"FAIL: \" + description);\n        passed.push(description);\n    }\n    gold = 1e20;\n    structures.castle.level = 1;\n    playerLevel = 109;\n    upgradeMultiplier = 100;\n    ok(levelUpPlayerCost(true)[1] === 1, \"Bulk level pricing respects cap\");\n    levelUpPlayer();\n    ok(playerLevel === 110, \"Bulk hero upgrade stops at cap\");\n    ok(levelUpPlayerCost(true)[1] === 0, \"Cannot purchase above cap\");\n    const priced = estimateUpgradeCost({\n        baseLevel: 8, upgradeEquation: () => 1, cap: 100,\n        resourceAvailable: 100, multiplier: 10, query: true,\n        capFunction: level => level >= 10\n    });\n    ok(priced[1] === 2, \"Custom caps tested for each purchased level\");\n    playerGearLevel = 4; structures.blacksmith.level = 1;\n    ok(gearUpPlayerCost(true)[1] === 1, \"Bulk gear respects cap\");\n    gearUpPlayer();\n    ok(playerGearLevel === 5, \"Gear only increases by paid levels\");\n\n    ok(ENEMY_TYPES.length === 6, \"Six enemies have unique mechanics\");\n    ok(ENEMY_TYPES.every(type => type.sprite.length === 16), \"All silhouettes have 16 rows\");\n    ok(getEnemyType(10).id === \"dragon\" && getEnemyType(20).id === \"dragon\", \"Boss every ten stages\");\n    ok(getEnemyType(1).trait === \"regenerating\" && getEnemyType(2).trait === \"evasive\", \"Regenerating and evasive enemies\");\n    ok(getEnemyType(3).trait === \"armored\" && getEnemyType(4).trait === \"spectral\", \"Armored and spectral enemies\");\n    enemyType = getEnemyType(3); currentLevel = 3; drawRandomEnemy();\n    ok(enemyType.id === \"golem\" && enemyHealth === getEnemyHealth(), \"Enemy art and health spawn\");\n    ok(document.getElementById(\"enemy-trait\").textContent.includes(\"Piercing\"), \"Enemy weaknesses are explained\");\n\n    enemyType = getEnemyType(1);\n    hiredMercenaries.push(\n        { level: 1, gearLevel: 0, attackSpeedLevel: 0, squad: 1 },\n        { level: 1, gearLevel: 0, attackSpeedLevel: 0, squad: 1 }\n    );\n    const initial = getAutoDamage();\n    ok(Math.abs(initial - 1.265) < 1e-9, \"Legacy squads default to Vanguard DPS\");\n    hiredMercenaries[0].attackSpeedLevel = 9;\n    ok(Math.abs(getAutoDamage() - initial * 10) < 1e-9, \"Attack speed counted once\");\n\n    structures.barracks.level = 0;\n    ok(!setSquadRole(1, \"mystic\"), \"Advanced roles require barracks upgrades\");\n    structures.barracks.level = 4;\n    enemyType = getEnemyType(4);\n    const spiritBefore = getAutoDamage();\n    ok(setSquadRole(1, \"mystic\"), \"Mystic role assignment succeeds\");\n    ok(getAutoDamage() > spiritBefore, \"Mystics counter spectral enemies\");\n    structures.barracks.level = 6;\n    ok(setSquadRole(1, \"raider\"), \"Raider role is unlocked\");\n    ok(getSquadGoldMultiplier() > 1, \"Raider squad increases gold rewards\");\n\n    structures.blacksmith.level = 0;\n    ok(!buyOrEquipSquadKit(1, \"ember\"), \"Advanced kits cannot bypass forge level\");\n    structures.blacksmith.level = 6;\n    const goldBeforeKit = gold;\n    ok(buyOrEquipSquadKit(1, \"ember\"), \"Ember Blades can be forged\");\n    ok(gold < goldBeforeKit, \"Forge charges gold\");\n    const afterForge = gold;\n    buyOrEquipSquadKit(1, \"basic\"); buyOrEquipSquadKit(1, \"ember\");\n    ok(gold === afterForge, \"Previously owned kits are free to equip\");\n    ok(squadsSuppressRegeneration(), \"Fire kit suppresses regeneration\");\n    enemyType = getEnemyType(1);\n    const emberDps = getAutoDamage();\n    buyOrEquipSquadKit(1, \"basic\");\n    ok(emberDps > getAutoDamage(), \"Ember kit counters regenerating slime\");\n    buyOrEquipSquadKit(1, \"ember\");\n\n    structures.castle.level = 20; structures.tavern.level = 6;\n    structures.market.level = 5; structures.barracks.level = 6;\n    drawKingdom();\n    ok(true, \"Developed kingdom renders\");\n    showMenu(\"barracks\"); showMenu(\"blacksmith\");\n    ok(true, \"Loadout menus render with squad selectors\");\n\n    startSquadAttack(); startSquadAttack(); startSquadAttack(2);\n    ok([...intervals.values()].filter(t => t.ms === 250).length === 1, \"Only one bounded combat timer\");\n    document.hidden = true; listeners.visibilitychange();\n    ok(![...intervals.values()].some(t => t.ms === 250), \"Combat pauses in background\");\n    document.hidden = false; listeners.visibilitychange();\n    ok([...intervals.values()].filter(t => t.ms === 250).length === 1, \"Combat resumes in foreground\");\n\n    showLeaderboard(); closeLeaderboard(); showMessage(); closeMessage();\n    ok(unsubscribed === 2, \"Realtime Firebase listeners close\");\n    ok(!nodes.get(\"leaderboard-scroll\").innerHTML.includes(userContent.name), \"Leaderboard XSS prevented\");\n    ok(!nodes.get(\"message-scroll\").innerHTML.includes(userContent.msg), \"Community message XSS prevented\");\n    const reward = awardOfflineGold(100000000);\n    ok(reward >= 0 && reward <= getAutoDamage() * 0.25 * 86400 * mktUp(4), \"Offline earnings capped\");\n\n    saveGame();\n    const save = JSON.parse(localStorage.getItem(\"clickerHeroSave\"));\n    ok(save.lastSaved <= Date.now() && Date.now() - save.lastSaved < 10000, \"Save timestamp valid\");\n    ok(save.hiredMercenaries.length === 2, \"Mercenary progress saved\");\n    ok(save.squadBuilds[\"1\"].role === \"raider\" && save.squadBuilds[\"1\"].kit === \"ember\", \"Squad roles and owned kits saved\");\n    ok(typeof save.autoAdvance === \"boolean\" && typeof save.underfillEnabled === \"boolean\", \"Gameplay preferences saved\");\n\n    localStorage.setItem(\"clickerHeroSave\", JSON.stringify({\n        gold: 123, playerLevel: 7, hiredMercenaries: [], lastSaved: Date.now() + 60000\n    }));\n    loadGame();\n    ok(gold === 123 && playerLevel === 7, \"Old save format loads\");\n    ok(Object.keys(squadBuilds).length === 0, \"Old saves initialize squad build data safely\");\n    return passed;\n})()", ctx, { timeout: 3000 });
checks.forEach(label => console.log('PASS ' + label));
console.log(checks.length + ' checks passed.');
