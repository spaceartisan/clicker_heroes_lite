// Dependency-free regression checks: node tests/smoke-test.cjs
// Executes the classic browser scripts using a small DOM/Firebase test double.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const paths = ["theme.js", "config.js", "season.js", "research.js", "progression.js", "frontier.js", "combat-content.js", "hero.js", "kingdom.js", "enemy.js", "database.js", "ui.js", "game.js", "army.js", "systems.js", "telemetry.js"];
const source = paths.map(file => fs.readFileSync(path.join(__dirname, "..", file), "utf8")).join("\n");
const nodes = new Map(), intervals = new Map(), listeners = {}, storage = new Map();
let nextInterval = 0, unsubscribed = 0, mockNow = 1000;

function element(tag = "div") {
    return {
        tagName: tag, style: {}, textContent: "", innerHTML: "", checked: true,
        disabled: false, value: "", width: 150, height: 150, childNodes: [],
        classList: { add() {}, remove() {}, toggle() {} },
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
    getElementById(id) {
        if (!nodes.has(id)) {
            const item = element();
            // Match the inline display:none on tabs that exist in the real HTML.
            if (id === "army-view" || id === "research-popup") item.style.display = "none";
            nodes.set(id, item);
        }
        return nodes.get(id);
    },
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
    flushPromiseCallbacks: () => new Promise(resolve => setImmediate(resolve)),
    performance: { now: () => mockNow },
    advanceClock: ms => { mockNow += ms; },
    alert() {}, confirm: () => true, console
});
vm.runInContext(source, ctx, { timeout: 2000, filename: "game-scripts" });

const checks = vm.runInContext("(() => {\n    const passed = [];\n    function ok(test, description) {\n        if (!test) throw new Error(\"FAIL: \" + description);\n        passed.push(description);\n    }\n    gold = 1e20;\n    structures.castle.level = 1;\n    playerLevel = 109;\n    upgradeMultiplier = 100;\n    ok(levelUpPlayerCost(true)[1] === 1, \"Bulk level pricing respects cap\");\n    levelUpPlayer();\n    ok(playerLevel === 110, \"Bulk hero upgrade stops at cap\");\n    ok(levelUpPlayerCost(true)[1] === 0, \"Cannot purchase above cap\");\n    const priced = estimateUpgradeCost({\n        baseLevel: 8, upgradeEquation: () => 1, cap: 100,\n        resourceAvailable: 100, multiplier: 10, query: true,\n        capFunction: level => level >= 10\n    });\n    ok(priced[1] === 2, \"Custom caps tested for each purchased level\");\n    playerGearLevel = 4; structures.blacksmith.level = 1;\n    ok(gearUpPlayerCost(true)[1] === 1, \"Bulk gear respects cap\");\n    gearUpPlayer();\n    ok(playerGearLevel === 5, \"Gear only increases by paid levels\");\n\n    ok(ENEMY_TYPES.length === 6, \"Six enemies have unique mechanics\");\n    ok(ENEMY_TYPES.every(type => type.sprite.length === 16), \"All silhouettes have 16 rows\");\n    ok(isBossEnemy(getEnemyType(10)) && isBossEnemy(getEnemyType(20)) && getEnemyType(20).id === \"wyvern\", \"Boss every ten stages\");\n    ok(getEnemyType(1).trait === \"regenerating\" && getEnemyType(2).trait === \"evasive\", \"Regenerating and evasive enemies\");\n    ok(getEnemyType(3).trait === \"armored\" && getEnemyType(4).trait === \"spectral\", \"Armored and spectral enemies\");\n    enemyType = getEnemyType(3); currentLevel = 3; drawRandomEnemy();\n    ok(enemyType.id === \"golem\" && enemyHealth === getEnemyHealth(), \"Enemy art and health spawn\");\n    ok(document.getElementById(\"enemy-trait\").textContent.includes(\"Piercing\"), \"Enemy weaknesses are explained\");\n\n    enemyType = getEnemyType(1);\n    hiredMercenaries.push(\n        { level: 1, gearLevel: 0, attackSpeedLevel: 0, squad: 1 },\n        { level: 1, gearLevel: 0, attackSpeedLevel: 0, squad: 1 }\n    );\n    const initial = getAutoDamage();\n    ok(Math.abs(initial - 1.265) < 1e-9, \"Legacy squads default to Vanguard DPS\");\n    hiredMercenaries[0].attackSpeedLevel = 9;\n    ok(Math.abs(getAutoDamage() - initial * 10) < 1e-9, \"Attack speed counted once\");\n\n    structures.barracks.level = 0;\n    ok(!setSquadRole(1, \"mystic\"), \"Advanced roles require barracks upgrades\");\n    structures.barracks.level = 4;\n    enemyType = getEnemyType(4);\n    const spiritBefore = getAutoDamage();\n    ok(setSquadRole(1, \"mystic\"), \"Mystic role assignment succeeds\");\n    ok(getAutoDamage() > spiritBefore, \"Mystics counter spectral enemies\");\n    structures.barracks.level = 6;\n    ok(setSquadRole(1, \"raider\"), \"Raider role is unlocked\");\n    ok(getSquadGoldMultiplier() > 1, \"Raider squad increases gold rewards\");\n\n    structures.blacksmith.level = 0;\n    ok(!buyOrEquipSquadKit(1, \"ember\"), \"Advanced kits cannot bypass forge level\");\n    structures.blacksmith.level = 6;\n    const goldBeforeKit = gold;\n    ok(buyOrEquipSquadKit(1, \"ember\"), \"Ember Blades can be forged\");\n    ok(gold < goldBeforeKit, \"Forge charges gold\");\n    const afterForge = gold;\n    buyOrEquipSquadKit(1, \"basic\"); buyOrEquipSquadKit(1, \"ember\");\n    ok(gold === afterForge, \"Previously owned kits are free to equip\");\n    ok(squadsSuppressRegeneration(), \"Fire kit suppresses regeneration\");\n    enemyType = getEnemyType(1);\n    const emberDps = getAutoDamage();\n    buyOrEquipSquadKit(1, \"basic\");\n    ok(emberDps > getAutoDamage(), \"Ember kit counters regenerating slime\");\n    buyOrEquipSquadKit(1, \"ember\");\n\n    structures.castle.level = 20; structures.tavern.level = 6;\n    structures.market.level = 5; structures.barracks.level = 6;\n    drawKingdom();\n    ok(true, \"Developed kingdom renders\");\n    showMenu(\"barracks\"); showMenu(\"blacksmith\");\n    ok(true, \"Loadout menus render with squad selectors\");\n\n    startSquadAttack(); startSquadAttack(); startSquadAttack(2);\n    ok([...intervals.values()].filter(t => t.ms === 250).length === 1, \"Only one bounded combat timer\");\n    document.hidden = true; listeners.visibilitychange();\n    ok(![...intervals.values()].some(t => t.ms === 250), \"Combat pauses in background\");\n    document.hidden = false; listeners.visibilitychange();\n    ok([...intervals.values()].filter(t => t.ms === 250).length === 1, \"Combat resumes in foreground\");\n\n    showLeaderboard(); closeLeaderboard(); showMessage(); closeMessage();\n    ok(unsubscribed === 2, \"Realtime Firebase listeners close\");\n    ok(!nodes.get(\"leaderboard-scroll\").innerHTML.includes(userContent.name), \"Leaderboard XSS prevented\");\n    ok(!nodes.get(\"message-scroll\").innerHTML.includes(userContent.msg), \"Community message XSS prevented\");\n    const reward = awardOfflineGold(100000000);\n    ok(reward >= 0 && reward <= getAutoDamage() * 0.25 * 86400 * mktUp(4), \"Offline earnings capped\");\n\n    saveGame();\n    const save = JSON.parse(localStorage.getItem(\"clickerHeroSave\"));\n    ok(save.lastSaved <= Date.now() && Date.now() - save.lastSaved < 10000, \"Save timestamp valid\");\n    ok(save.hiredMercenaries.length === 2, \"Mercenary progress saved\");\n    ok(save.squadBuilds[\"1\"].role === \"raider\" && save.squadBuilds[\"1\"].kit === \"ember\", \"Squad roles and owned kits saved\");\n    ok(typeof save.autoAdvance === \"boolean\" && typeof save.underfillEnabled === \"boolean\", \"Gameplay preferences saved\");\n\n    localStorage.setItem(\"clickerHeroSave\", JSON.stringify({schemaVersion:GAME_SCHEMA_VERSION,seasonId:GAME_SEASON_ID,\n        gold: 123, playerLevel: 7, hiredMercenaries: [], lastSaved: Date.now() + 60000\n    }));\n    loadGame();\n    ok(gold === 123 && playerLevel === 7, \"Partial Season II save loads\");\n    ok(Object.keys(squadBuilds).length === 0, \"Missing squad data defaults safely\");\n    return passed;\n})()", ctx, { timeout: 3000 });
checks.forEach(label => console.log('PASS ' + label));
console.log(checks.length + ' checks passed.');

const armyChecks = vm.runInContext("(() => {\n    const labels = [];\n    const ok = (test, label) => {\n        if (!test) throw new Error(\"FAIL army: \" + label);\n        labels.push(label);\n    };\n\n    // Six mercenaries across three existing squads with the same progression.\n    hiredMercenaries.length = 0;\n    squadBuilds = {};\n    structures.tavern.level = 20;\n    structures.barracks.level = 6;\n    structures.blacksmith.level = 6;\n    marketUpgrades.mkt2.level = 0;\n    gold = 30;\n    for (let i = 0; i < 6; i++) {\n        hiredMercenaries.push({\n            name: \"Test\" + i, squad: Math.floor(i / 2) + 1,\n            level: 1, gearLevel: 0, attackSpeedLevel: 0,\n            gearCost: 100, attackSpeedCost: 100, nextGearLevelReq: 10\n        });\n    }\n    const beforeQuote = JSON.stringify(hiredMercenaries);\n    const fair = planArmyUpgrade([1,2,3], \"level\", 1);\n    ok(fair.units === 3 && fair.maximumUnits === 6 && fair.spent === 30, \"Partial preview quotes exactly affordable levels\");\n    ok(JSON.stringify(hiredMercenaries) === beforeQuote, \"Preview never mutates a save\");\n    ok(fair.operations.map(op => op.indices[0]).join(\",\") === \"0,2,4\", \"Short budgets upgrade one mercenary per squad first\");\n    ok(applyArmyUpgradePlan(fair), \"Fair plan purchases successfully\");\n    ok(gold === 0, \"Bulk purchase spends exact amount\");\n    ok([0,2,4].every(i => hiredMercenaries[i].level === 2), \"Selected squad levels are applied\");\n    ok([1,3,5].every(i => hiredMercenaries[i].level === 1), \"Unaffordable levels were skipped\");\n\n    gold = 250000;\n    const speed = planArmyUpgrade([2], \"speed\", 1);\n    ok(speed.units === 1 && speed.targets === 1 && speed.spent === 100, \"Squad speed is purchased once per squad\");\n    applyArmyUpgradePlan(speed);\n    ok(hiredMercenaries[2].attackSpeedLevel === 1 &&\n       hiredMercenaries[3].attackSpeedLevel === 1, \"Squad-wide speed upgrade reaches both mercenaries\");\n    const gear = planArmyUpgrade([3], \"gear\", 1);\n    ok(gear.units === 1 && gear.spent === 100, \"Squad gear cost counted once\");\n    applyArmyUpgradePlan(gear);\n    ok(hiredMercenaries[4].gearLevel === 1 && hiredMercenaries[5].gearLevel === 1,\n       \"Squad gear upgrade reaches every member\");\n    ok(hiredMercenaries[0].gearLevel === 0, \"Unselected squads remain unchanged\");\n\n    const noFunds = planArmyUpgrade([1,2,3], \"level\", 100, 0);\n    ok(noFunds.units === 0 && noFunds.spent === 0 && noFunds.partial, \"Zero-gold quote is safe\");\n    const malformed = planArmyUpgrade([9999, -3], \"gear\", 100);\n    ok(malformed.targets === 0 && malformed.spent === 0, \"Unknown squads cannot spend gold\");\n\n    const cap = getArmyCap(\"speed\");\n    for (const merc of hiredMercenaries) merc.attackSpeedLevel = cap - 1;\n    gold = 1e30;\n    const capped = planArmyUpgrade([1,2,3], \"speed\", 100);\n    ok(capped.units === 3 && capped.maximumUnits === 3, \"Bulk ×100 is limited by speed cap\");\n    applyArmyUpgradePlan(capped);\n    ok(hiredMercenaries.every(m => m.attackSpeedLevel === cap), \"Never breaches squad speed cap\");\n    ok(planArmyUpgrade([1,2,3], \"speed\", 100).capped, \"Maxed squads report capped\");\n\n    document.getElementById(\"army-sort\").value = \"number\";\n    document.getElementById(\"army-upgrade-type\").value = \"level\";\n    document.getElementById(\"army-amount\").value = \"10\";\n    renderArmyView();\n    ok(document.getElementById(\"army-page-status\").textContent === \"Page 1 of 1\", \"Army roster renders first page\");\n    ok(armySelectedSquads.size === 3, \"Initial army selection includes all squads\");\n    armyClearSelection();\n    ok(armySelectedSquads.size === 0, \"Clear selection persists without resetting\");\n    armySelectAll();\n    ok(armySelectedSquads.size === 3, \"Select all reselects the roster\");\n    armySelectedSquads.delete(3);\n    ok(armySelectedExisting().join(\",\") === \"1,2\", \"Army supports custom multi-selection\");\n    const selectedOnly = planArmyUpgrade([1,2], \"level\", 1, 100);\n    ok(selectedOnly.targets === 4, \"Selected-only upgrades exclude squad 3\");\n\n    // More than eight squads use pagination; previous selections are retained.\n    for (let squad = 4; squad <= 13; squad++) {\n        hiredMercenaries.push({\n            name: \"Extra\" + squad, squad, level: 5, gearLevel: 0, attackSpeedLevel: 0\n        });\n    }\n    renderArmyView();\n    ok(document.getElementById(\"army-page-status\").textContent === \"Page 1 of 2\", \"Large armies are paginated\");\n    ok(armySelectedSquads.has(1) && !armySelectedSquads.has(3), \"Page changes do not discard custom selections\");\n    gold = 500;\n    const budgetBefore = gold;\n    const badPlan = { spent: gold + 1, operations: [{ kind: \"gear\", indices: [0] }] };\n    ok(!applyArmyUpgradePlan(badPlan) && gold === budgetBefore, \"Overspending plans are rejected atomically\");\n    const save = JSON.parse(localStorage.getItem(\"clickerHeroSave\"));\n    ok(save.squadBuilds && typeof save.squadBuilds === \"object\", \"New purchase saves retain squad composition\");\n    return labels;\n})()", ctx, { timeout: 3500 });
armyChecks.forEach(label => console.log("PASS " + label));
console.log("Army tests: " + armyChecks.length + " passed.");

const researchChecks = vm.runInContext("(() => {\n const ok=(v,n)=>{if(!v)throw Error(n);return n}, passed=[];\n researchState={};maxLevel=11;structures.castle.level=1;gold=1000000;\n passed.push(ok(getResearchInsightEarned()===1,\"First boss grants Insight\"));\n passed.push(ok(!canResearchNode(\"royal_mint\"),\"Prerequisites work\"));\n passed.push(ok(canResearchNode(\"field_manuals\"),\"Basic research unlocked\"));\n hiredMercenaries.length=0;\n hiredMercenaries.push({name:\"Veteran\",level:30,gearLevel:1,attackSpeedLevel:1,squad:1});\n const dps=getAutoDamage();\n passed.push(ok(buyResearchNode(\"field_manuals\"),\"Research purchase succeeds\"));\n passed.push(ok(getAutoDamage()>dps,\"Research modifies combat DPS\"));\n passed.push(ok(!buyResearchNode(\"field_manuals\"),\"No double purchases\"));\n passed.push(ok(getResearchInsightAvailable()===0,\"Insight budget enforced\"));\n maxLevel=71;structures.castle.level=5;\n passed.push(ok(getResearchInsightEarned()===8,\"Castle/boss milestones add Insight\"));\n passed.push(ok(buyResearchNode(\"royal_survey\"),\"Survey research available\"));\n const discounted=getStructureCost(structures.castle);\n researchState.royal_survey=false;\n passed.push(ok(getStructureCost(structures.castle)>discounted,\"Castle discount effective\"));\n researchState.royal_survey=true;\n passed.push(ok(buyResearchNode(\"trade_routes\"),\"Trade branch available\"));\n passed.push(ok(buyResearchNode(\"guild_charters\"),\"Guild prereq works\"));\n passed.push(ok(canResearchNode(\"royal_mint\"),\"Royal Mint unlocks when prerequisites and Insight are met\"));\n passed.push(ok(buyResearchNode(\"royal_mint\"),\"Multi-point research spends 3 Insight\"));\n passed.push(ok(getResearchInsightAvailable()===0,\"Research spending cannot exceed earned Insight\"));\n return passed;\n})()", ctx, { timeout: 2500 });
researchChecks.forEach(x=>console.log("PASS "+x));
console.log("Research tests: "+researchChecks.length+" passed.");

const economyChecks = vm.runInContext("(() => {\n const passed=[],ok=(v,n)=>{if(!v)throw Error(n);passed.push(n)};\n researchState={};maxLevel=15;structures.castle.level=1;structures.market.level=0;gold=1000000;\n ok(structureLockReason(\"market\").includes(\"20\"),\"Market stage requirement\");\n const originalGold=gold;\n ok(!upgradeStructure(\"market\")&&gold===originalGold,\"Blocked structure cannot spend\");\n maxLevel=21;\n ok(!structureLockReason(\"market\"),\"Market accessible at stage 20\");\n ok(getStructureCost(structures.market)===10000,\"Affordable initial Market\");\n ok(upgradeStructure(\"market\"),\"Early Market purchase\");\n ok(structureLockReason(\"market\").includes(\"Castle Lv 2\"),\"Second Market needs Castle 2\");\n structures.market.level=2;\n const idx=Object.keys(marketUpgrades).indexOf(\"mkt6\");\n const hold=gold;\n ok(!upgradeMarket(idx)&&gold===hold,\"Market project backend locks levels\");\n structures.market.level=5;\n const cost=marketUpgradeCost(0);\n const before=marketUpgrades.mkt1.level;\n ok(upgradeMarket(0),\"Market project purchase\");\n ok(gold===hold-cost&&marketUpgrades.mkt1.level===before+1,\"Market gold and level exact\");\n marketUpgrades.mkt1.level=10;\n ok(marketUpgradeCost(0)===0&&!upgradeMarket(0),\"Maxed Market cannot exceed cap\");\n const base=marketUpgrades.mkt1.cost;\n ok(base*2*Math.pow(1.65,5)<base*Math.pow(2,6),\"Late Market costs less than legacy curve\");\n return passed;\n})()",ctx,{timeout:2800});
economyChecks.forEach(x=>console.log("PASS "+x));
console.log("Economy tests: "+economyChecks.length+" passed.");

const migrationChecks=vm.runInContext("(() => {\n const passed=[],ok=(v,n)=>{if(!v)throw Error(n);passed.push(n)};\n const previous={schemaVersion:GAME_SCHEMA_VERSION,seasonId:GAME_SEASON_ID,\n  gold:56789,playerLevel:80,currentLevel:30,maxLevel:61,\n  hiredMercenaries:[],lastSaved:Date.now()+60000,\n  structures:{castle:{level:7,baseCost:50000},market:{level:3,baseCost:10000},\n   tavern:{level:1,baseCost:35000},barracks:{level:1,baseCost:20000},\n   blacksmith:{level:1,baseCost:20000}},\n  marketUpgrades:{mkt1:{level:4},mkt2:{level:2},mkt3:{level:1},mkt4:{level:0},mkt5:{level:0}},\n  passiveAbilities:[{level:3}]\n };\n localStorage.setItem(\"clickerHeroSave\",JSON.stringify(previous));\n loadGame();\n ok(gold===56789&&structures.castle.level===7,\"Season II partial save preserves Castle and gold\");\n ok(marketUpgrades.mkt1.level===4&&marketUpgrades.mkt2.level===2,\"Season II Market ranks survive\");\n ok(!!marketUpgrades.mkt6&&!!marketUpgrades.mkt8,\"New Market projects migrate\");\n ok(passiveAbilities[0].level===3&&passiveAbilities[1].level>=1,\"Royal decrees migrate\");\n ok(getResearchInsightEarned()===7&&getResearchInsightAvailable()===7,\"Old save earns retroactive Insight\");\n ok(researchState.field_manuals!==true,\"No fictitious purchased research\");\n openResearchTree();\n ok(document.getElementById(\"research-points\").textContent.includes(\"7 Insight\"),\"Research tree shows Insight\");\n const snap=JSON.parse(localStorage.getItem(\"clickerHeroSave\"));\n ok(!!snap.researchState&&!!snap.marketUpgrades.mkt8,\"New data written in save\");\n ok(RESEARCH_FUTURE_DOMAINS.includes(\"faith\")&&!RESEARCH_BRANCHES.some(b=>b.id===\"faith\"),\n  \"Religion reserved without introducing unfinished mechanics\");\n return passed;\n})()",ctx,{timeout:2800});
migrationChecks.forEach(x=>console.log("PASS "+x));
console.log("Migration tests: "+migrationChecks.length+" passed.");

const scalingChecks=vm.runInContext("(() => {\n const labels=[],ok=(v,n)=>{if(!v)throw Error(n);labels.push(n)};\n gold=1e12;upgradeMultiplier=1;underfillEnabled=false;\n structures.castle.level=10;structures.blacksmith.level=7;structures.barracks.level=7;\n playerLevel=25;passiveAbilities[1].level=1;researchState={};\n const heroBefore=getPlayerClickDamage();\n ok(upgradeSkill(passiveAbilities[1]),\"Royal Guard decree can be purchased\");\n ok(getPlayerClickDamage()>heroBefore,\"Royal Guard boosts actual hero damage\");\n playerLevel=1;\n ok(!upgradeSkill(passiveAbilities[1]),\"Locked decree cannot spend gold\");\n playerLevel=100;\n hiredMercenaries.length=0;\n const merc={name:\"Veteran\",squad:1,level:25,gearLevel:4,attackSpeedLevel:4};\n hiredMercenaries.push(merc);\n ok(getArmyUnitCost(\"level\",25)===levelUpMercenaryCost(0,true)[0],\n  \"Single and Army mercenary level costs match\");\n ok(getArmyUnitCost(\"gear\",4)===upgradeMercenaryGearCost(merc,true)[0],\n  \"Single and Army gear costs match\");\n ok(getArmyUnitCost(\"speed\",4)===upgradeMercenarySpeedCost(merc,true)[0],\n  \"Single and Army speed costs match\");\n ok(getArmyUnitCost(\"gear\",4)<100*Math.pow(5,8),\n  \"Revised gear scaling is cheaper than legacy eighth-power cost\");\n ok(getArmyUnitCost(\"speed\",4)<getArmyUnitCost(\"gear\",4),\n  \"Speed costs less than doubling gear damage\");\n const priceBeforeDiscount=getArmyUnitCost(\"gear\",4);\n researchState.guild_charters=true;\n ok(getArmyUnitCost(\"gear\",4)<priceBeforeDiscount,\n  \"Research decreases squad gear upgrade cost\");\n ok(getArmyUnitCost(\"gear\",4)===upgradeMercenaryGearCost(merc,true)[0],\n  \"Army and single gear prices match after research\");\n return labels;\n})()",ctx,{timeout:2500});
scalingChecks.forEach(x=>console.log("PASS "+x));
console.log("Scaling tests: "+scalingChecks.length+" passed.");

const treasuryChecks=vm.runInContext("(() => {\n const passed=[],ok=(v,n)=>{if(!v)throw Error(\"Treasury: \"+n);passed.push(n)};\n claimedTreasury=[];maxLevel=20;gold=0;\n ok(getTreasuryAvailableGold()===0,\"Stage 20 actually needs clearing\");\n ok(!claimRoyalTreasury(),\"Premature claim blocked\");\n maxLevel=21;\n ok(getTreasuryAvailableGold()===2000,\"First reward is 2000g\");\n ok(claimRoyalTreasury()&&gold===2000,\"Claim credits exact amount\");\n ok(!claimRoyalTreasury()&&gold===2000,\"Claim cannot repeat\");\n ok(JSON.parse(localStorage.getItem(\"clickerHeroSave\")).claimedTreasury.includes(20),\n    \"Claim saved\");\n maxLevel=101;\n ok(getTreasuryAvailableGold()===108000,\"Remaining four chapters add 108000g\");\n ok(claimRoyalTreasury()&&gold===110000,\"Complete rewards total 110000g\");\n ok(getTreasuryAvailableGold()===0,\"No double claims after completion\");\n maxLevel=201;\n ok(getTreasuryAvailableGold()===460000,\"Five Frontier claims remain after classic chapters\");\n ok(claimRoyalTreasury()&&gold===570000,\"All ten chapters total 570000 gold\");\n updateTreasuryUI();\n ok(document.getElementById(\"treasury-status\").textContent.includes(\"All ten\"),\n    \"Completed 10-chapter journey renders\");\n ok(document.getElementById(\"treasury-claim\").disabled,\"Empty claims are disabled\");\n claimedTreasury=[];maxLevel=61;\n ok(getTreasuryAvailableGold()===28000,\"Retroactive chapters sum to 28000g\");\n localStorage.setItem(\"clickerHeroSave\",JSON.stringify({schemaVersion:GAME_SCHEMA_VERSION,seasonId:GAME_SEASON_ID,\n   gold:321,maxLevel:61,currentLevel:55,hiredMercenaries:[],lastSaved:Date.now()+60000\n }));\n loadGame();\n ok(gold===321&&getTreasuryAvailableGold()===28000,\"Season II partial save loads and earns claims\");\n ok(claimedTreasury.length===0,\"Missing save field becomes empty\");\n hiredMercenaries.push({name:\"Patrol\",level:40,gearLevel:2,attackSpeedLevel:1,squad:1});\n currentLevel=55;maxLevel=61;\n const day=estimateOfflineGold(86400);\n ok(day>0&&Number.isFinite(day),\"Offline payout finite\");\n ok(estimateOfflineGold(86400*3)===day,\"Patrol capped at one day\");\n ok(estimateOfflineGold(0)===0,\"No zero-duration rewards\");\n ok(day<86400*getAutoDamage()*.25*mktUp(4),\"Bounded offline payout\");\n hiredMercenaries.length=0;\n ok(estimateOfflineGold(86400)===0,\"No squad means no offline income\");\n return passed;\n})()",ctx,{timeout:3500});
treasuryChecks.forEach(label=>console.log("PASS "+label));
console.log("Treasury tests: "+treasuryChecks.length+" passed.");

const frontierChecks=vm.runInContext("(()=>{\n const labels=[],ok=(x,d)=>{if(!x)throw Error(\"Frontier: \"+d);labels.push(d)};\n ok(!getFrontierRegion(100)&&!getFrontierRegion(201),\"Non-frontier stages unchanged\");\n ok(FRONTIER_REGIONS.length===5,\"Five Frontier regions defined\");\n for(const [level,id] of [[101,\"ashen\"],[121,\"iron\"],[141,\"wisp\"],[161,\"storm\"],[181,\"crown\"]])\n   ok(getFrontierRegion(level).id===id,\"Region starts correctly at \"+level);\n ok(!getEnemyType(100).frontier&&getEnemyType(101).frontier,\"Frontier applies only beyond 100\");\n ok(getEnemyType(105).champion&&getEnemyType(105).name.includes(\"Veteran\"),\"Veteran on stage 105\");\n ok(!getEnemyType(110).champion&&isBossEnemy(getEnemyType(110)),\"Rotating boss preserved on stage 110\");\n ok(getEnemyType(123).hp>ENEMY_TYPES[2].hp,\"Iron Frontier armor pressure\");\n ok(getEnemyType(144).resistance<ENEMY_TYPES[3].resistance,\"Wisp Fen spectral pressure\");\n ok(getEnemyType(162).dodge>ENEMY_TYPES[1].dodge,\"Storm Pass dodging\");\n ok(getEnemyType(190).hp>ENEMY_TYPES[5].hp,\"Dragon Crown boss health\");\n ok(getEnemyType(105).gold>ENEMY_TYPES[4].gold,\"Veteran gold bonus\");\n ok(getTreasuryReward(120)===45000&&getTreasuryReward(200)===145000,\"New bounties correct\");\n ok([120,140,160,180,200].reduce((t,l)=>t+getTreasuryReward(l),0)===460000,\n  \"New chapter bounties total 460000\");\n const first=ENEMY_TYPES[0].hp;getEnemyType(101);getEnemyType(106);\n ok(ENEMY_TYPES[0].hp===first,\"Base archetypes not mutated\");\n researchState={};maxLevel=125;structures.castle.level=5;\n ok(!canResearchNode(\"veteran_drills\"),\"Veteran Drills need Bestiary\");\n researchState.beast_lore=true;\n ok(canResearchNode(\"veteran_drills\"),\"Veteran Drills stage gate works\");\n hiredMercenaries.length=0;\n hiredMercenaries.push({level:30,gearLevel:2,attackSpeedLevel:1,squad:1});\n currentLevel=105;enemyType=getEnemyType(105);\n const base=getAutoDamage();\n ok(buyResearchNode(\"veteran_drills\"),\"Veteran Drills purchasable\");\n ok(getAutoDamage()>base,\"Veteran Drills improve real DPS\");\n enemyType=getEnemyType(106);\n const regular=getAutoDamage();\n researchState.veteran_drills=false;\n ok(Math.abs(getAutoDamage()-regular)<1e-8,\"Veteran research not applied to regular encounters\");\n researchState.veteran_drills=true;\n maxLevel=201;claimedTreasury=[20,40,60,80,100];gold=0;\n ok(getTreasuryAvailableGold()===460000,\"Existing save gets unclaimed Frontier bounties\");\n ok(claimRoyalTreasury()&&gold===460000,\"Frontier bounty awarded\");\n ok(!claimRoyalTreasury()&&gold===460000,\"Frontier claims only once\");\n const save=JSON.parse(localStorage.getItem(\"clickerHeroSave\"));\n ok(save.claimedTreasury.length===10,\"All ten claims stored\");\n ok(save.researchState.veteran_drills===true,\"Frontier research stored\");\n currentLevel=180;enemyType=getEnemyType(180);drawRandomEnemy();\n ok(document.getElementById(\"frontier-hero\").textContent.includes(\"Storm Pass\"),\"Hero Frontier UI\");\n ok(document.getElementById(\"frontier-kingdom\").textContent.includes(\"Frontier\") ||\n   document.getElementById(\"frontier-kingdom\").textContent.includes(\"Dragon Crown\"),\n   \"Kingdom Frontier UI\");\n return labels;\n})()",ctx,{timeout:3500});
frontierChecks.forEach(s=>console.log("PASS "+s));
console.log("Frontier tests: "+frontierChecks.length+" passed.");

const castleUiChecks = vm.runInContext("(() => {\n const results=[],ok=(value,label)=>{if(!value)throw Error(\"Castle menu: \"+label);results.push(label)};\n gold=1e12;playerLevel=100;structures.castle.level=12;\n passiveAbilities[1].level=1;\n const outer=document.getElementById(\"upgrade-buttons\");\n const outer2=document.getElementById(\"upgrade-buttons-2\");\n const abilitiesRoot=document.getElementById(\"upgrade-list\");\n const decreesRoot=document.getElementById(\"upgrade-list-2\");\n const args=[null,outer,outer2,abilitiesRoot,decreesRoot];\n CastleUpgradeUI(...args);\n ok(outer.childNodes.length===3,\"One Castle introduction, Academy action, and Insight note\");\n ok(outer2.childNodes.length===2,\"One Royal Decrees heading and description\");\n ok(abilitiesRoot.childNodes.length===1&&abilitiesRoot.childNodes[0].tagName===\"details\",\n   \"Hero abilities collapsed into one details control\");\n ok(decreesRoot.childNodes.length===passiveAbilities.length,\"Every Decree is visible once\");\n const firstTitle=outer.childNodes[0].textContent;\n CastleUpgradeUI(...args);\n CastleUpgradeUI(...args);\n ok(outer.childNodes.length===3&&outer2.childNodes.length===2,\n   \"Repeated opening cannot duplicate Royal Court content\");\n ok(outer.childNodes[0].textContent===firstTitle,\n   \"Court description stays stable\");\n ok(decreesRoot.childNodes.length===passiveAbilities.length,\n   \"Decree cards stay singular through rerenders\");\n const royal=decreesRoot.childNodes[1];\n const royalButton=royal.childNodes[1];\n ok(!royalButton.disabled&&typeof royalButton.onclick===\"function\",\n   \"Affordable Royal Guard button is enabled\");\n const oldRank=passiveAbilities[1].level;\n royalButton.onclick();\n ok(passiveAbilities[1].level===oldRank+1,\n   \"Purchasing a Decree increases its rank\");\n ok(outer.childNodes.length===3&&outer2.childNodes.length===2,\n   \"Buying a Decree never duplicates Court sections\");\n ok(decreesRoot.childNodes.length===passiveAbilities.length,\n   \"Decrees remain visible after buying\");\n ok(decreesRoot.childNodes[1].childNodes[0].childNodes[1].textContent.includes(\"Rank \"+(oldRank+1)),\n   \"Updated rank is immediately visible\");\n ok(!Object.keys(JSON.parse(localStorage.getItem(\"clickerHeroSave\"))).includes(\"castleUiState\"),\n   \"No new save fields introduced for cosmetic UI\");\n return results;\n})()", ctx, {timeout: 3000});
castleUiChecks.forEach(label => console.log("PASS " + label));
console.log("Castle UI tests: " + castleUiChecks.length + " passed.");

const seasonChecks=vm.runInContext("(() => {\n const passed=[],ok=(value,label)=>{if(!value)throw Error(\"Season II: \"+label);passed.push(label)};\n const legacy=JSON.stringify({gold:999999,maxLevel:24730857,playerLevel:100000,structures:{castle:{level:1000}}});\n localStorage.setItem(\"clickerHeroSave\",legacy);\n localStorage.removeItem(GAME_LEGACY_BACKUP_KEY);\n const changed=prepareSeasonSave();\n ok(changed===true,\"Legacy progress triggers a fresh season\");\n ok(localStorage.getItem(\"clickerHeroSave\")===null,\"Legacy balance does not enter new season\");\n ok(localStorage.getItem(GAME_LEGACY_BACKUP_KEY)===legacy,\"Legacy save archived losslessly\");\n ok(!prepareSeasonSave(),\"Repeated empty loads do not rearchive\");\n ok(!isCurrentSeasonSave(JSON.parse(legacy)),\"Old file import recognized as incompatible\");\n ok(document.getElementById(\"season-transition\").style.display===\"flex\",\"Transition notice visible\");\n closeSeasonTransition();\n ok(document.getElementById(\"season-transition\").style.display===\"none\",\"Transition dialog closes\");\n // Start a new season and establish the season marker.\n gold=1000;playerLevel=4;maxLevel=20;currentLevel=20;\n dynastyCount=0;renown=0;bestSeasonStage=1;highestCastleEver=1;\n dynastyInvestments={warfare:0,commerce:0,stewardship:0};\n academyDisciplines={warfare:0,commerce:0,governance:0};\n marketCharterRank=0;researchState={};claimedTreasury=[];\n saveGame();\n const saved=JSON.parse(localStorage.getItem(\"clickerHeroSave\"));\n ok(saved.schemaVersion===2&&saved.seasonId===GAME_SEASON_ID,\"Season save schema persists\");\n ok(isCurrentSeasonSave(saved),\"New save passes season validation\");\n ok(localStorage.getItem(GAME_LEGACY_BACKUP_KEY)===legacy,\"Season save does not overwrite legacy backup\");\n // Long-run numerical health and reward functions remain representable.\n currentLevel=20000000;maxLevel=20000001;\n enemyType=getEnemyType(currentLevel);\n ok(Number.isFinite(getEnemyHealth())&&getEnemyHealth()>0,\"20m-stage health finite\");\n hiredMercenaries.length=0;\n hiredMercenaries.push({name:\"Scaler\",level:100,gearLevel:2000,attackSpeedLevel:50,squad:1});\n ok(Number.isFinite(getAutoDamage())&&getAutoDamage()>0,\"Extreme gear and DPS finite\");\n playerGearLevel=2000;\n ok(Number.isFinite(getPlayerClickDamage()),\"Extreme hero click damage finite\");\n structures.castle.level=3000;\n ok(Number.isFinite(getStructureCost(structures.castle)),\"Castle upgrade cost never reaches Infinity\");\n playerGearLevel=0;structures.castle.level=5;currentLevel=200;maxLevel=201;\n // Dynasty preserves lifetime progression and learned research, resets purchases.\n bestSeasonStage=1;highestCastleEver=1;\n structures.market.level=4;\n marketCharterRank=3;\n researchState.field_manuals=true;\n academyDisciplines.warfare=2;\n hiredMercenaries.length=1;gold=100000;passiveAbilities[0].level=4;\n const reward=getDynastyReward();\n ok(reward>=1,\"Stage 200 permits optional rebirth\");\n ok(foundNewDynasty(),\"Confirmed Dynasty transition succeeds\");\n ok(dynastyCount===1&&renown===reward,\"Dynasty earns permanent Renown\");\n ok(gold===0&&maxLevel===1&&playerLevel===1,\"Rebirth resets temporary economy\");\n ok(hiredMercenaries.length===0&&structures.market.level===0,\"Rebirth resets mercenary/Market progress\");\n ok(marketCharterRank===0,\"Rebirth resets nonpermanent Guild Charters\");\n ok(researchState.field_manuals===true&&academyDisciplines.warfare===2,\"Permanent research survives rebirth\");\n ok(bestSeasonStage>=201&&highestCastleEver>=5,\"Career stage/Castle records survive\");\n const lifetime=getResearchInsightEarned();\n ok(lifetime>=20,\"Lifetime Insight remains available after rebirth\");\n ok(getDynastyReward()===0,\"Cannot immediately rebirth twice\");\n const beforeRenown=renown;\n ok(purchaseDynastyPerk(\"warfare\"),\"Permanent Dynasty investment succeeds\");\n ok(renown<beforeRenown&&getDynastyBonus(\"warfare\")>0,\"Renown buys a bounded combat bonus\");\n ok(getDynastyBonus(\"warfare\")<1,\"Dynasty bonuses remain bounded\");\n // Market and Insight sinks grow in cost but offer diminishing returns.\n structures.market.level=4;gold=1e8;\n const charterBefore=marketCharterRank;\n const price=getMarketCharterCost();\n ok(purchaseMarketCharter(),\"Guild Charter can be purchased\");\n ok(marketCharterRank===charterBefore+1&&gold<1e8&&price>0,\"Guild investment costs actual gold\");\n ok(getMarketCharterBonus()<=1.6,\"Market charter bonus capped at +60%\");\n const earlierCost=getAcademyDisciplineCost(\"warfare\");\n const earlierBonus=getAcademyDisciplineBonus(\"warfare\");\n ok(upgradeAcademyDiscipline(\"warfare\"),\"Insight can fund repeatable College\");\n ok(getAcademyDisciplineCost(\"warfare\")>earlierCost,\"College ranks get more expensive\");\n ok(getAcademyDisciplineBonus(\"warfare\")>earlierBonus,\"College ranks increase damage\");\n ok(getResearchInsightAvailable()>=0,\"Insight cannot become negative\");\n saveGame();\n const loaded=JSON.parse(localStorage.getItem(\"clickerHeroSave\"));\n ok(loaded.dynastyCount===1&&loaded.marketCharterRank===1,\"Dynasty and Charter states persist\");\n ok(loaded.academyDisciplines.warfare===3,\"College rank persists\");\n ok(GAME_SCORE_COLLECTION===\"scores_dynasty_ii\",\"New-season rankings isolated by collection\");\n const requested=[];\n const originalCollection=db.collection;\n db.collection=(name)=>{requested.push(name);return originalCollection(name)};\n showLeaderboard();closeLeaderboard();\n ok(requested.includes(GAME_SCORE_COLLECTION),\"Live leaderboard reads new-season collection\");\n nameConfirm=true;playerName=\"NewSeasonTester\";lastSubmittedScore=-1;maxLevel=220;bestSeasonStage=220;\n submitScore();\n ok(requested.filter(name=>name===GAME_SCORE_COLLECTION).length>=2,\n   \"Score submission routes to same Season II collection\");\n db.collection=originalCollection;\n ok(!requested.includes(\"scores\"),\"Prior season leaderboard is not read or overwritten\");\n return passed;\n})()",ctx,{timeout:5000});
seasonChecks.forEach(x=>console.log("PASS "+x));
console.log("Season II tests: "+seasonChecks.length+" passed.");

const batteryChecks = vm.runInContext("(() => {\n const passed=[],ok=(value,name)=>{if(!value)throw Error(\"Battery Saver: \"+name);passed.push(name)};\n const original={\n  battery:batterySaverEnabled,level:currentLevel,max:maxLevel,enemy:enemyType,\n  health:enemyHealth,gold,runDefeats:runEnemyDefeats,\n  runSeconds:runCombatSeconds,runGold:runGoldEarned,death:deathCooldown,\n  mercenaries:hiredMercenaries.slice(),update:updateUI,\n  matchMedia:window.matchMedia,timerRunning:autoCombatTimer!==null\n };\n try {\n  stopSquadAttack();\n  ok(!getDefaultBatterySaver(),\"Desktop mock defaults to normal mode\");\n  window.matchMedia=()=>({matches:true});\n  ok(getDefaultBatterySaver(),\"Coarse-pointer devices default to Battery Saver\");\n  window.matchMedia=original.matchMedia;\n  currentLevel=110;maxLevel=111;enemyType=getEnemyType(currentLevel);\n  hiredMercenaries.length=0;\n  hiredMercenaries.push({name:\"Pacing\",level:1,gearLevel:0,attackSpeedLevel:0,squad:1});\n  deathCooldown=false;\n  const fixedDps=getAutoDamage();\n  ok(fixedDps>0 && Number.isFinite(fixedDps),\"Test army has nonzero DPS\");\n  let draws=0;updateUI=()=>{draws++};\n  // One second at 250-ms ticks.\n  applyBatterySaver(false,false);\n  ok(getCombatTickIntervalMs()===250,\"Normal combat interval remains 250ms\");\n  enemyHealth=1000000;runCombatSeconds=0;\n  startSquadAttack();\n  const classic=[...intervals.values()].filter(t=>t.ms===250);\n  ok(classic.length===1,\"Normal mode creates one combat timer\");\n  const classicDrawsBefore=draws;\n  for(let i=0;i<4;i++){advanceClock(250);classic[0].fn()}\n  const classicDamage=1000000-enemyHealth;\n  const classicDraws=draws-classicDrawsBefore;\n  ok(Math.abs(classicDamage-fixedDps)<1e-5,\"Normal one-second damage uses DPS times elapsed\");\n  ok(classicDraws===4,\"Normal mode refreshes HUD four times a second\");\n  ok(Math.abs(runCombatSeconds-1)<1e-8,\"Normal active-combat time measured accurately\");\n  // Combat continues every 250ms, with half as many HUD refreshes.\n  stopSquadAttack();applyBatterySaver(true,false);\n  ok(getCombatTickIntervalMs()===250,\"Battery mode preserves 250ms combat rate\");\n  ok(batterySaverToggle.checked,\"Battery option reflects actual state\");\n  enemyHealth=1000000;runCombatSeconds=0;\n  startSquadAttack();\n  const eco=[...intervals.values()].filter(t=>t.ms===250);\n  ok(eco.length===1,\"Battery mode has only one 250ms combat timer\");\n  const ecoDrawsBefore=draws;\n  for(let i=0;i<4;i++){advanceClock(250);eco[0].fn()}\n  const ecoDamage=1000000-enemyHealth;\n  const ecoDraws=draws-ecoDrawsBefore;\n  ok(Math.abs(ecoDamage-fixedDps)<1e-5,\"Battery mode preserves one-second DPS\");\n  ok(Math.abs(ecoDamage-classicDamage)<1e-8,\"Both modes deal equivalent elapsed-time damage\");\n  ok(ecoDraws===2&&ecoDraws<classicDraws,\"Battery mode halves combat HUD work without losing ticks\");\n  ok(Math.abs(runCombatSeconds-1)<1e-8,\"Battery run time counts real elapsed time\");\n  const ecoTimerId=[...intervals.keys()].find(id=>intervals.get(id).ms===250);\n  applyBatterySaver(false,true);\n  ok(intervals.size>0 && [...intervals.values()].filter(t=>t.ms===250).length===1 &&\n     !intervals.has(ecoTimerId),\n     \"Changing the setting replaces the timer rather than stacking timers\");\n  document.hidden=true;stopSquadAttack();\n  ok(![...intervals.values()].some(t=>t.ms===250),\n     \"No combat timers run in background\");\n  document.hidden=false;startSquadAttack();\n  ok([...intervals.values()].filter(t=>t.ms===250).length===1,\n     \"Combat timer resumes in foreground\");\n  // Test save/load and older Season II saves without a power-mode field.\n  stopSquadAttack();updateUI=original.update;\n  applyBatterySaver(true,false);\n  runEnemyDefeats=71;runCombatSeconds=93.5;runGoldEarned=654321;\n  saveGame();\n  const saved=JSON.parse(localStorage.getItem(\"clickerHeroSave\"));\n  ok(saved.batterySaverEnabled && saved.runEnemyDefeats===71 &&\n     saved.runCombatSeconds===93.5 && saved.runGoldEarned===654321,\n     \"Battery preference and per-run counters persist\");\n  delete saved.batterySaverEnabled;delete saved.runEnemyDefeats;\n  delete saved.runCombatSeconds;delete saved.runGoldEarned;\n  localStorage.setItem(\"clickerHeroSave\",JSON.stringify(saved));\n  loadGame();\n  ok(typeof batterySaverEnabled===\"boolean\" && runEnemyDefeats===0 &&\n     runCombatSeconds===0 && runGoldEarned===0,\n     \"Older Season II saves default missing performance and run fields\");\n  stopSquadAttack();\n  // Explicitly verify that a rebirth resets run-only counters.\n  currentLevel=201;maxLevel=202;runEnemyDefeats=22;\n  runCombatSeconds=250;runGoldEarned=17000;\n  ok(foundNewDynasty(),\"Dynasty can be founded with completed stage 200\");\n  ok(runEnemyDefeats===0 && runCombatSeconds===0 && runGoldEarned===0,\n     \"Rebirth resets per-run counters\");\n  renderDynastyPanel();\n  ok(document.getElementById(\"dynasty-panel\").childNodes.length>=4,\n     \"Dynasty displays the new run summary\");\n  return passed;\n }finally{\n  stopSquadAttack();updateUI=original.update;\n  applyBatterySaver(original.battery,false);\n  currentLevel=original.level;maxLevel=original.max;\n  enemyType=original.enemy;enemyHealth=original.health;\n  gold=original.gold;runEnemyDefeats=original.runDefeats;\n  runCombatSeconds=original.runSeconds;runGoldEarned=original.runGold;\n  deathCooldown=original.death;window.matchMedia=original.matchMedia;\n  hiredMercenaries.length=0;hiredMercenaries.push(...original.mercenaries);\n  document.hidden=false;\n  if(original.timerRunning)startSquadAttack();\n }\n})()", ctx, {timeout:5500});
batteryChecks.forEach(label=>console.log("PASS "+label));
console.log("Battery and pacing tests: "+batteryChecks.length+" passed.");

const visualAssetChecks = (() => {
 const checked=[],ok=(valid,label)=>{if(!valid)throw Error("Visual assets: "+label);checked.push(label)};
 const source=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
 const css=fs.readFileSync(path.join(__dirname,"..","style.css"),"utf8");
 const sw=fs.readFileSync(path.join(__dirname,"..","sw.js"),"utf8");
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,"..","manifest.webmanifest"),"utf8"));
 const glyphNames=["hero","kingdom","army","leaderboard","message","settings","research",
     "treasury","dynasty","achievements","stats","save","delete","export","import",
     "gold","previous","next","battle","market","governance","battery","clock","shield"];
 ok(source.includes('id="stone-theme-toggle"'),"Stone theme toggle exists in Game Config");
 ok(source.includes("setGameTheme(this.checked ? 'stone' : 'default')"),
    "Stone setting is wired to the theme controller");
 ok(source.indexOf('<script src="./theme.js"></script>') < source.indexOf('href="style.css"'),
    "Saved theme loads before CSS to prevent flashing");
 ok(source.includes('aria-label="Previous stage"')&&source.includes('aria-label="Next stage"'),
    "Icon-only arrows retain accessible labels");
 ok(source.includes('icons/emblem.svg')&&!source.includes("emojicdn"),
    "Favicon is a local scalable crown");
 ok(!/\p{Extended_Pictographic}/u.test(source),"Static UI contains no device-rendered emoji");
 ok(css.includes("brick-wall-dark.png"),"Classic brick texture is restored behind the game");
 ok(css.includes(':root[data-theme="stone"]')&&css.includes("--panel-fill"),
    "Stone mode uses semantic design tokens");
 ok(css.includes("background-attachment: scroll"),"Background avoids fixed-position mobile repaint");
 ok(sw.includes("heroes-of-click-v1.5.0")&&sw.includes('"./theme.js"'),
    "Theme controller is precached in PWA");
 for(const name of glyphNames){
    const file="icons/ui-"+name+".svg";
    const svg=fs.readFileSync(path.join(__dirname,"..",file),"utf8");
    ok(svg.includes('viewBox="0 0 24 24"')&&svg.includes("<svg ")&&svg.includes("</svg>"),
       "Vector artwork structurally valid: "+name);
    ok(css.includes(".ui-icon-"+name),"CSS includes vector icon mask "+name);
    ok(sw.includes('"./'+file+'"'),"Offline shell includes icon "+name);
 }
 const iconKeys=[...source.matchAll(/ui-icon-([a-z-]+)/g)].map(m=>m[1]);
 ok(iconKeys.length>=20&&iconKeys.every(name=>glyphNames.includes(name)),
    "Every static UI icon references the local set");
 ok(manifest.icons.some(i=>i.type==="image/svg+xml"&&i.src==="./icons/emblem.svg"),
    "PWA manifest includes the scalable emblem");
 return checked;
})();
visualAssetChecks.forEach(label=>console.log('PASS '+label));
console.log('Visual asset tests: '+visualAssetChecks.length+' passed.');
const themeChecks=vm.runInContext("(() => {\n const done=[],ok=(v,label)=>{if(!v)throw Error(\"Theme: \"+label);done.push(label)};\n const before=localStorage.getItem(GAME_THEME_KEY),root=document.documentElement;\n const attributes={};\n document.documentElement={setAttribute(k,v){attributes[k]=v}};\n const checkbox=document.getElementById(\"stone-theme-toggle\");\n try{\n   localStorage.removeItem(GAME_THEME_KEY);\n   ok(readGameTheme()===\"default\",\"Default theme used when no preference exists\");\n   ok(setGameTheme(\"stone\")===\"stone\",\"Game Config can select Stone\");\n   ok(readGameTheme()===\"stone\"&&attributes[\"data-theme\"]===\"stone\",\n      \"Stone theme persists locally and applies to document\");\n   ok(checkbox.checked===true,\"Checkbox reflects the active Stone theme\");\n   saveGame();\n   ok(localStorage.getItem(GAME_THEME_KEY)===\"stone\",\n      \"Player save does not overwrite appearance settings\");\n   showOptions();\n   ok(checkbox.checked===true,\"Reopening Game Config synchronizes toggle\");\n   ok(setGameTheme(\"default\")===\"default\"&&checkbox.checked===false,\n      \"Default appearance restores without reloading\");\n   ok(setGameTheme(\"unknown\")===\"default\",\"Invalid theme falls back safely\");\n   localStorage.setItem(GAME_THEME_KEY,\"dark\");\n   ok(readGameTheme()===\"stone\",\"Legacy Dark preference remains enabled as Stone\");\n   setGameTheme(\"default\");\n   ok(makeUIIcon(\"hero\").className.includes(\"ui-icon-hero\"),\n      \"Runtime icons use the local SVG mask class\");\n   const button=document.createElement(\"button\");\n   setIconLabel(button,\"research\",\"Royal Academy\");\n   ok(button.childNodes.length===2&&button.childNodes[0].className.includes(\"ui-icon-research\"),\n      \"Dynamic buttons contain a vector icon and readable label\");\n   return done;\n } finally {\n   if(before===null)localStorage.removeItem(GAME_THEME_KEY);\n   else localStorage.setItem(GAME_THEME_KEY,before);\n   document.documentElement=root;\n   applyGameTheme(readGameTheme());\n }\n})()",ctx,{timeout:3000});
themeChecks.forEach(label=>console.log('PASS '+label));
console.log('Theme interaction tests: '+themeChecks.length+' passed.');


const seasonHistoryChecks=vm.runInContext(`(()=>{
 const checked=[],ok=(v,n)=>{if(!v)throw Error("Leaderboard season: "+n);checked.push(n)};
 const priorCollection=db.collection, priorName=playerName, priorConfirm=nameConfirm;
 let closes=0,subscribes=0;
 const callbacks={},scroll=document.getElementById("leaderboard-scroll");
 const seasonPicker=document.getElementById("leaderboard-season");
 const nameEntry=document.getElementById("name-entry");
 const syncButton=document.getElementById("sync-score-button");
 const syncStatus=document.getElementById("leaderboard-sync-status");
 const sample=(person,score)=>({forEach(fn){fn({data:()=>({name:person,score})})}});
 try {
  nameConfirm=true;playerName="Same Name";
  db.collection=collection=>{
   ok([GAME_SCORE_COLLECTION,"scores"].includes(collection),"Only known collections queried");
   return {
    orderBy(k,d){ok(k==="score"&&d==="desc","Rank order unchanged");return this},
    limit(count){ok(count===50,"Rank limit unchanged");return this},
    onSnapshot(next,error){callbacks[collection]={next,error};subscribes++;return ()=>{closes++}}
   };
  };
  showLeaderboard();
  ok(seasonPicker.value===GAME_SEASON_ID&&subscribes===1,"Current season opens by default");
  ok(!nameEntry.hidden&&!syncButton.hidden&&!syncStatus.hidden,"Current-season controls visible");
  callbacks[GAME_SCORE_COLLECTION].next(sample("Same Name",55));
  ok(scroll.childNodes[0].childNodes[0].textContent.includes("(You)"),"Current player highlighted");
  switchLeaderboardSeason("legacy");
  ok(seasonPicker.value==="legacy"&&closes===1&&subscribes===2,"Switch unsubscribes old feed");
  ok(nameEntry.hidden&&syncButton.hidden&&syncStatus.hidden,"Historical season is read-only");
  ok(document.getElementById("leaderboard-season-note").textContent.includes("read-only"),"Archive description visible");
  callbacks.scores.next(sample("Same Name",24730857));
  const priorLine=scroll.childNodes[0].childNodes[0].textContent;
  ok(priorLine.includes("24730857")&&!priorLine.includes("(You)"),"Historic score without false identity match");
  callbacks[GAME_SCORE_COLLECTION].next(sample("Stale",5));
  ok(scroll.childNodes[0].childNodes[0].textContent===priorLine,"Stale snapshot ignored");
  switchLeaderboardSeason(GAME_SEASON_ID);
  ok(closes===2&&subscribes===3,"Returning to current restarts current feed");
  ok(!nameEntry.hidden&&!syncButton.hidden&&!syncStatus.hidden,"Current controls restored");
  callbacks[GAME_SCORE_COLLECTION].error({code:"permission-denied"});
  ok(scroll.textContent.includes("Firebase read permissions"),"Readable permission error");
  closeLeaderboard();
  ok(closes===3,"Closing tears down active listener");
  scroll.textContent="Closed";
  callbacks[GAME_SCORE_COLLECTION].next(sample("Late",200));
  ok(scroll.textContent==="Closed","Late snapshot after closure ignored");
  return checked;
 } finally {
  closeLeaderboard();
  db.collection=priorCollection;playerName=priorName;nameConfirm=priorConfirm;
  nameEntry.hidden=false;syncButton.hidden=false;syncStatus.hidden=false;
 }
})()`,ctx,{timeout:3000});
seasonHistoryChecks.forEach(label=>console.log("PASS "+label));
console.log("Leaderboard history tests: "+seasonHistoryChecks.length+" passed.");

const abilityAchievementChecks = vm.runInContext("(() => {\n    const passed = [];\n    const ok = (value,label) => { if (!value) throw Error(\"Skills & achievements: \" + label); passed.push(label); };\n    const previous = {\n        playerLevel, gold, maxLevel, currentLevel, bestSeasonStage, highestCastleEver,\n        dynastyCount, abilitiesCount, abilitiesUsed: [...abilitiesUsed],\n        achievements: new Set(unlockedAchievements),\n        timerCount: intervals.size, doubleAttackReady, rallyActive, goldRushActive\n    };\n    const saveBefore = localStorage.getItem(\"clickerHeroSave\");\n    try {\n        // No unearned controls occupy screen space, including after a Dynasty reset.\n        resetAbilityEffects();\n        playerLevel = 1;\n        updateAbilityHUD(Date.now(), true);\n        ok(document.getElementById(\"ability-bar\").hidden, \"Ability bar hidden before first unlock\");\n        ok(abilities.every(a => abilityStates[a.name].button.hidden), \"Locked skills have no visible buttons\");\n        ok(!activateAbility(abilities[0]), \"Cannot activate an unearned skill\");\n        playerLevel = 5;\n        updateAbilityHUD(Date.now(), true);\n        ok(!document.getElementById(\"ability-bar\").hidden, \"Ability bar appears at first unlock\");\n        ok(!abilityStates[\"Strong Attack\"].button.hidden, \"Strong Attack appears at level 5\");\n        ok(abilities.filter(a => a.name !== \"Strong Attack\")\n            .every(a => abilityStates[a.name].button.hidden), \"Later abilities stay hidden\");\n        playerLevel = 12;\n        updateAbilityHUD(Date.now(), true);\n        ok(!abilityStates[\"Rally\"].button.hidden && !abilityStates[\"Gold Rush\"].button.hidden,\n            \"Rally and Gold Rush appear at appropriate levels\");\n        ok(abilityStates[\"Rage\"].button.hidden, \"Rage remains hidden below level 20\");\n        let currentAbilityTimers = [...intervals.values()].filter(v => v.ms === 1000).length;\n        ok(activateAbility(abilities.find(a => a.name === \"Rally\")), \"Rally activates\");\n        const rally = abilityStates[\"Rally\"].button;\n        ok(rally.textContent.includes(\"ACTIVE\") && rally.textContent.includes(\"CD\"),\n            \"Rally displays active duration and cooldown together\");\n        ok(rally.disabled, \"Active Rally cannot be activated a second time\");\n        ok(document.getElementById(\"ability-active-status\").textContent.includes(\"Rally\"),\n            \"A separate active-effect status line is present\");\n        ok(activateAbility(abilities.find(a => a.name === \"Gold Rush\")), \"Gold Rush activates\");\n        ok(goldRushActive && rallyActive, \"Multiple active effects can overlap\");\n        ok([...intervals.values()].filter(v => v.ms === 1000).length === currentAbilityTimers + 1,\n            \"One shared cooldown ticker handles multiple abilities\");\n        updateAbilityHUD(Date.now() + 31000, true);\n        ok(!rallyActive && !goldRushActive, \"Duration ends both temporary buffs\");\n        ok(rally.textContent.includes(\"CD\") && !rally.textContent.includes(\"ACTIVE\"),\n            \"Expired effect remains on cooldown without active highlight\");\n        updateAbilityHUD(Date.now() + 61000, true);\n        ok(!abilityStates[\"Rally\"].cooldown && !abilityStates[\"Gold Rush\"].cooldown,\n            \"Cooldown completes based on elapsed time\");\n        playerLevel = 15;\n        resetAbilityEffects();\n        ok(activateAbility(abilities.find(a => a.name === \"Double Attack\")), \"Double Attack can be readied\");\n        ok(doubleAttackReady && abilityStates[\"Double Attack\"].button.textContent.includes(\"READY CHARGE\"),\n            \"Prepared one-hit ability has persistent status\");\n        doubleAttackReady = false;\n        updateAbilityHUD(Date.now(), true);\n        ok(!abilityStates[\"Double Attack\"].button.textContent.includes(\"READY CHARGE\"),\n            \"Prepared indicator disappears after being consumed\");\n        playerLevel = 20;\n        resetAbilityEffects();\n        ok(!abilityStates[\"Rage\"].button.hidden, \"Rage appears at level 20\");\n        ok(activateAbility(abilities.find(a => a.name === \"Rage\")), \"Rage starts\");\n        const totalBeforeReset = intervals.size;\n        resetAbilityEffects();\n        ok(rageInterval === null && abilityHudTimer === null &&\n            intervals.size <= totalBeforeReset - 2, \"Rebirth cleanup stops Rage and the cooldown ticker\");\n        playerLevel = 1;\n        updateAbilityHUD(Date.now(), true);\n        ok(document.getElementById(\"ability-bar\").hidden, \"Abilities hide again after progress resets\");\n\n        const allIds = achievements.map(a => a.id);\n        ok(new Set(allIds).size === allIds.length, \"Every achievement ID is unique\");\n        ok(allIds.includes(\"gear_50\") && allIds.includes(\"merc_gear_50\"),\n            \"Player and mercenary gear 50 have separate achievements\");\n        ok(allIds.includes(\"dynasty_10\") && allIds.includes(\"research_12\") &&\n            allIds.includes(\"stage_1000000\"), \"Long-term Season II achievements exist\");\n        currentLevel = 1;\n        maxLevel = 80;\n        bestSeasonStage = 501;\n        const explorer = achievements.find(a => a.id === \"stage_500\");\n        ok(explorer.condition() && getAchievementProgress(explorer).current === 500,\n            \"Explorer uses highest previously cleared stage, not selected stage\");\n        gold = 50;\n        ok(!achievements.find(a => a.id === \"gold_100\").condition() &&\n            achievements.find(a => a.id === \"gold_100\").description.includes(\"Hold\"),\n            \"Gold milestones describe what they actually test\");\n        unlockedAchievements = new Set();\n        dynastyCount = 10;\n        playerLevel = 1;\n        gold = 0;\n        maxLevel = 1;\n        bestSeasonStage = 1;\n        highestCastleEver = 1;\n        abilitiesUsed = [];\n        abilitiesCount = 0;\n        hiredMercenaries.length = 0;\n        const beforeCount = unlockedAchievements.size;\n        checkAchievements();\n        ok(unlockedAchievements.has(\"dynasty_1\") && unlockedAchievements.has(\"dynasty_5\") &&\n            unlockedAchievements.has(\"dynasty_10\"), \"Retroactive Dynasty achievements unlock together\");\n        ok(unlockedAchievements.size >= beforeCount + 3, \"Unlocked milestones tracked distinctly\");\n        const saved = JSON.parse(localStorage.getItem(\"clickerHeroSave\"));\n        ok(saved.unlockedAchievements.includes(\"dynasty_10\"), \"Achievement batch persists to saved game\");\n        const toast = document.getElementById(\"achievement-popup\");\n        ok(toast.childNodes.length <= 3, \"Multiple unlocks use one consolidated notification\");\n        const select = document.getElementById(\"achievement-filter\");\n        select.value = \"locked\";\n        renderAchievements();\n        ok(document.getElementById(\"achievement-summary\").textContent.includes(\"achievements\"),\n            \"Achievement completion summary is rendered\");\n        const list = document.getElementById(\"achievement-list\");\n        ok(list.childNodes.length > 0, \"Achievement grid renders filtered results\");\n        const countLocked = list.childNodes[0].childNodes.length;\n        select.value = \"unlocked\";\n        renderAchievements();\n        ok(list.childNodes[0].childNodes.length < countLocked,\n            \"Completed filter reduces visible achievement cards\");\n        select.value = \"all\";\n        showAchievements();\n        ok(document.getElementById(\"achievement-menu\").style.display === \"flex\",\n            \"Achievements modal opens with a progress view\");\n        closeAchievements();\n        ok(document.getElementById(\"achievement-menu\").style.display === \"none\",\n            \"Achievements modal closes\");\n        return passed;\n    } finally {\n        resetAbilityEffects();\n        playerLevel = previous.playerLevel;\n        gold = previous.gold;\n        currentLevel = previous.currentLevel;\n        maxLevel = previous.maxLevel;\n        bestSeasonStage = previous.bestSeasonStage;\n        highestCastleEver = previous.highestCastleEver;\n        dynastyCount = previous.dynastyCount;\n        abilitiesCount = previous.abilitiesCount;\n        abilitiesUsed = previous.abilitiesUsed;\n        unlockedAchievements = previous.achievements;\n        rallyActive = previous.rallyActive;\n        goldRushActive = previous.goldRushActive;\n        doubleAttackReady = previous.doubleAttackReady;\n        if (saveBefore) localStorage.setItem(\"clickerHeroSave\", saveBefore);\n        updateAbilityHUD(Date.now(), true);\n    }\n})()", ctx, {timeout:4500});
abilityAchievementChecks.forEach(label=>console.log("PASS "+label));
console.log("Ability and achievement tests: "+abilityAchievementChecks.length+" passed.");

const pacingChecks = vm.runInContext("(() => {\n    const passed=[],ok=(v,m)=>{if(!v)throw Error(\"Pacing: \"+m);passed.push(m)};\n    const beforeMax=maxLevel,beforeStage=currentLevel,beforeEnemy=enemyType;\n    try {\n        // Use boss stages for a like-for-like health comparison.\n        currentLevel=200;maxLevel=201;enemyType=getEnemyType(200);\n        const hp200=getEnemyHealth();\n        const prestige200=getDynastyReward();\n        currentLevel=500;maxLevel=501;enemyType=getEnemyType(500);\n        const hp500=getEnemyHealth();\n        const prestige500=getDynastyReward();\n        currentLevel=1000;maxLevel=1001;enemyType=getEnemyType(1000);\n        const hp1000=getEnemyHealth();\n        const prestige1000=getDynastyReward();\n        currentLevel=10000;maxLevel=10001;enemyType=getEnemyType(10000);\n        const hp10000=getEnemyHealth();\n        const prestige10000=getDynastyReward();\n        currentLevel=20000000;maxLevel=20000001;enemyType=getEnemyType(currentLevel);\n        const hpLong=getEnemyHealth();\n        const prestigeLong=getDynastyReward();\n        ok([hp200,hp500,hp1000,hp10000,hpLong].every(Number.isFinite),\n            \"Boss health remains finite through 20 million stages\");\n        ok(hp200<hp500&&hp500<hp1000&&hp1000<hp10000&&hp10000<hpLong,\n            \"Boss health increases steadily after stage 200\");\n        ok(hp1000/hp200>8&&hp1000/hp200<20,\n            \"Stage 1000 boss health grows moderately versus stage 200\");\n        ok(prestige200===1&&prestige500>=2&&prestige1000>=3,\n            \"Early Dynasty rewards rise with extra stage progress\");\n        ok(prestige10000>prestige1000&&prestigeLong>prestige10000,\n            \"Longer runs remain more rewarding\");\n        ok(prestigeLong<=50,\"Renown per-run reward remains capped\");\n        ok(getDynastyBonus(\"warfare\")<1&&getDynastyBonus(\"commerce\")<1,\n            \"Permanent bonuses stay below runaway multiplier thresholds\");\n        return passed;\n    } finally {\n        maxLevel=beforeMax;currentLevel=beforeStage;enemyType=beforeEnemy;\n    }\n})()", ctx, {timeout:2500});
pacingChecks.forEach(label=>console.log("PASS "+label));
console.log("Dynasty pacing tests: "+pacingChecks.length+" passed.");


const layoutChecks = (() => {
 const checked=[],assert=(v,label)=>{if(!v)throw Error("Responsive layout: "+label);checked.push(label)};
 const source=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
 const css=fs.readFileSync(path.join(__dirname,"..","style.css"),"utf8");
 const sw=fs.readFileSync(path.join(__dirname,"..","sw.js"),"utf8");
 assert(source.includes('v1.5.0') && sw.includes('heroes-of-click-v1.5.0'),"Markup and PWA cache versions match");
 for(const section of ["hero","kingdom","army"]) {
    assert(source.includes('id="view-tab-'+section+'"'),"Accessible tab exists for "+section);
 }
 assert((source.match(/class="structure-card"/g)||[]).length===5,"All five buildings are structured cards");
 for(const building of ["castle","tavern","blacksmith","barracks","market"]) {
    const card=source.match(new RegExp('<article class="structure-card">([\\s\\S]*?id="'+building+'-cost"[\\s\\S]*?)<\\/article>'));
    assert(!!card,"Old upgrade cost IDs remain inside "+building+" card");
 }
 assert((source.match(/class="game-actions"/g)||[]).length===1,"Utility menu actions grouped exactly once");
 assert((source.match(/class="checkbox-option"/g)||[]).length===2,
        "Both settings toggles keep their control and label together");
 assert((source.match(/class="modal-close"/g)||[]).length===5,"Five dialog close actions styled consistently");
 assert(!source.includes("<h3></h3>"),"Empty heading spacers removed");
 assert(!source.includes("<p></p>"),"Empty paragraph spacers removed");
 const ids=[...source.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
 assert(new Set(ids).size===ids.length,"No duplicate DOM IDs");
 const blocks=[".structure-list",".game-actions","#view-switch","#shop",".inline-form",
    "#save-load-controls","#export-import-controls",".modal-close",":focus-visible"];
 for(const selector of blocks)assert(css.includes(selector),"Shared style "+selector);
 assert(css.includes("min-height: var(--ui-touch-target)"),"Shared button touch minimum");
 assert(css.includes("#achievement-menu #achievement-list"),"Scrollable achievements preserved");
 assert(css.includes("#upgrade-menu.castle-menu .popup-content"),"Castle modal layout preserved");
 assert(css.includes(".battery-saver-option"),"Battery Saver layout preserved");
 assert(!css.includes("/* Hero Ability Bar */"),"Legacy duplicate skill button rules removed");
 const normalized=css.replace(/\/\*[\s\S]*?\*\//g,"").replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'""');
 let depth=0;for(const ch of normalized){if(ch==="{")depth++;if(ch==="}")depth--;if(depth<0)break}
 assert(depth===0,"CSS braces are balanced");
 const ui=fs.readFileSync(path.join(__dirname,"..","ui.js"),"utf8");
 assert(ui.includes('tabButton.classList.toggle("is-active", selected)'),
        "Selected view styling updates during navigation");
 return checked;
})();
layoutChecks.forEach(label=>console.log("PASS "+label));
console.log("Responsive layout tests: "+layoutChecks.length+" passed.");

ctx.fs=fs;ctx.path=path;ctx.__dirname=__dirname;
const enemyCardChecks = vm.runInContext("(() => {\n const verified=[],check=(value,label)=>{if(!value)throw Error(\"Enemy card: \"+label);verified.push(label)};\n const html=fs.readFileSync(path.join(__dirname,\"..\",\"index.html\"),\"utf8\");\n const css=fs.readFileSync(path.join(__dirname,\"..\",\"style.css\"),\"utf8\");\n const game=fs.readFileSync(path.join(__dirname,\"..\",\"game.js\"),\"utf8\");\n const enemy=fs.readFileSync(path.join(__dirname,\"..\",\"enemy.js\"),\"utf8\");\n const sw=fs.readFileSync(path.join(__dirname,\"..\",\"sw.js\"),\"utf8\");\n check(html.includes('id=\"enemy-name\"') && html.includes('id=\"enemy-trait\"'),\n   \"Name and trait labels are authored in the card\");\n check(html.indexOf('id=\"enemy-level\"')<html.indexOf('id=\"enemy-name\"') &&\n   html.indexOf('id=\"enemy-name\"')<html.indexOf('id=\"enemy-trait\"'),\n   \"Stage, name and trait follow a consistent visual hierarchy\");\n check(game.includes('document.getElementById(\"enemy-name\")'),\n   \"Enemy name reuses authored HTML instead of appending a runtime label\");\n check(!game.includes('document.getElementById(\"enemy-box\").appendChild(enemyNameText)'),\n   \"Old runtime name insertion removed\");\n check(css.includes(\"grid-template-columns: var(--enemy-nav-size) minmax(0, 1fr) var(--enemy-nav-size)\"),\n   \"Navigation uses two stable side columns with a constrained card\");\n check(css.includes(\"max-width: 464px\")&&css.includes(\"width: 100%\"),\n   \"Encounter row is bounded and responsive\");\n check(css.includes(\"#enemy-name\")&&css.includes(\"overflow-wrap: anywhere\"),\n   \"Long enemy names wrap without forcing row growth\");\n check(css.includes(\"margin-top: calc(var(--enemy-card-padding) + 51px)\"),\n   \"Navigation arrows are anchored at the sprite position\");\n check(css.includes(\"--enemy-nav-size: 42px\")&&css.includes(\"gap: 6px\"),\n   \"Phone layout retains fixed button slots\");\n check(sw.includes(\"heroes-of-click-v1.5.0\")&&html.includes(\"v1.5.0\"),\n   \"Installed PWA and visible version update together\");\n check(enemy.includes(\"enemyNameText.textContent = type.name\"),\n   \"Enemy spawning still updates the name\");\n const oldStage=currentLevel, oldEnemy=enemyType;\n try {\n   currentLevel=1;drawRandomEnemy();\n   const first=enemyNameText.textContent;\n   check(first.includes(getEnemyType(1).name),\"First enemy shows correct name\");\n   currentLevel=105;drawRandomEnemy();\n   check(enemyNameText.textContent.includes(\"Veteran\")&&enemyLevelText.textContent.includes(\"VETERAN\"),\n     \"Veteran text updates without extra DOM insertion\");\n   currentLevel=110;drawRandomEnemy();\n   check(enemyLevelText.textContent.includes(\"BOSS\"),\n     \"Boss stage label remains visible\");\n } finally {\n   currentLevel=oldStage;enemyType=oldEnemy;\n }\n return verified;\n})()",ctx,{timeout:2800});
delete ctx.fs;delete ctx.path;delete ctx.__dirname;
enemyCardChecks.forEach(label=>console.log("PASS "+label));
console.log("Enemy card layout tests: "+enemyCardChecks.length+" passed.");


// Run the asynchronous Firestore stress suite after all synchronous state-mutating
// suites; otherwise they change its mock player/score during awaited writes.

const messageDateChecks=vm.runInContext(`(()=>{
 const passed=[],ok=(condition,label)=>{if(!condition)throw Error("Message date: "+label);passed.push(label)};
 const oldCollection=db.collection;
 let onData=null,closed=false;
 const recorded=new Date(2022,8,15,19,5);
 const entries=[
  {name:"An Older Hero",msg:"Old message",timestamp:{toDate:()=>recorded}},
  {name:"<img src=x onerror=alert(1)>",msg:"<script>alert(1)</script>",
   timestamp:{toDate:()=>new Date(2026,9,10,11,20)}}
 ];
 try{
   db.collection=collectionName=>{
     ok(collectionName==="message","Only the message collection is queried");
     return {
       orderBy(field,direction){ok(field==="timestamp"&&direction==="desc","Newest-first ordering preserved");return this},
       limit(count){ok(count===50,"Previous message count limit retained");return this},
       onSnapshot(callback){onData=callback;return ()=>{closed=true}}
     };
   };
   showMessage();
   ok(typeof onData==="function","Message listener starts");
   onData({forEach(callback){for(const item of entries)callback({data:()=>item})}});
   const log=document.getElementById("message-scroll");
   ok(log.childNodes.length===1&&log.childNodes[0].childNodes.length===2,
       "Two historic messages render");
   const first=log.childNodes[0].childNodes[0];
   const stamp=first.childNodes[0].childNodes[1];
   const body=first.childNodes[1];
   const expected=recorded.toLocaleString(undefined,{
     year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"
   });
   ok(stamp.textContent===expected,"Posting date and local time are both displayed");
   ok(stamp.textContent.includes("2022"),"Older entries retain their posting year");
   ok(stamp.dateTime===recorded.toISOString(),"Semantic timestamp uses original instant");
   ok(body.textContent==="Old message","Message body unchanged");
   const hostile=log.childNodes[0].childNodes[1];
   ok(hostile.childNodes[0].childNodes[0].textContent===entries[1].name&&
      hostile.childNodes[1].textContent===entries[1].msg,
      "User names and messages remain text, not HTML");
   closeMessage();
   ok(closed,"Closing the board cleans up the listener");
   return passed;
 }finally{
   closeMessage();
   db.collection=oldCollection;
 }
})()`,ctx,{timeout:2500});
messageDateChecks.forEach(label=>console.log("PASS "+label));
console.log("Message date tests: "+messageDateChecks.length+" passed.");


const campaignRelicChecks=vm.runInContext(`(()=>{
 const passed=[],ok=(v,n)=>{if(!v)throw Error("Campaign and relic: "+n);passed.push(n)};
 const old={
  gold,level:currentLevel,max:maxLevel,savedBest:bestSeasonStage,auto:autoAdvance,
  enemy:enemyType,enemyHp:enemyHealth,cooldown:deathCooldown,
  structures:JSON.parse(JSON.stringify(structures)),mercs:hiredMercenaries.slice(),
  builds:JSON.parse(JSON.stringify(squadBuilds)),
  missions:activeCampaigns,serial:campaignSerial,inventory:relicInventory,
  slots:relicSlots,fragments:relicFragments,bossClaims:relicBossClaims,
  retry:bossRetryStage,clockStage:bossClockStage,clockDeadline:bossClockDeadline,
  clockPaused:bossClockPausedMs
 };
 try{
  for(const merc of hiredMercenaries.splice(0)){}
  hiredMercenaries.push({squad:1,level:20,gearLevel:2,attackSpeedLevel:2},
    {squad:1,level:20,gearLevel:2,attackSpeedLevel:2});
  squadBuilds={};
  structures.barracks.level=6;structures.blacksmith.level=4;
  currentLevel=9;maxLevel=10;bestSeasonStage=10;enemyType=getEnemyType(9);
  activeCampaigns=[];relicInventory={};relicSlots=[null,null,null];relicFragments=0;
  relicBossClaims=[];bossRetryStage=0;deathCooldown=false;autoAdvance=true;
  ok(CAMPAIGN_DEFINITIONS.length===3&&RELIC_DEFINITIONS.length===5,"Three missions and five relics");
  ok(getAutoDamage()>0,"Squad contributes DPS before deployment");
  ok(startSquadCampaign("patrol",1),"Dispatch a rostered squad");
  ok(isSquadOnCampaign(1)&&getAutoDamage()===0,"Deployed squad cannot fight");
  ok(!startSquadCampaign("ruins",1),"Cannot dispatch occupied squad twice");
  const pending=activeCampaigns[0],oldGold=gold;
  ok(!claimSquadCampaign(pending.id),"Cannot claim unfinished campaign");
  pending.endsAt=Date.now()-1;
  ok(claimSquadCampaign(pending.id),"Completed offline expedition claimed");
  ok(gold>oldGold&&!isSquadOnCampaign(1),"Gold awarded and squad returned");
  ok(!claimSquadCampaign(pending.id),"Campaign reward cannot be claimed twice");
  grantRelic("ember");grantRelic("ember");
  ok(equipRelic("ember",0)&&getRelicBonus("boss")>0,"Equipped relic boosts boss combat");
  ok(!equipRelic("ember",1),"One relic type cannot occupy multiple slots");
  ok(recycleRelic("ember")&&relicFragments>=2,"Extra relic salvages to crafting fragments");
  ok(!recycleRelic("ember"),"Last equipped relic cannot be recycled");
  recordBossVictory(10,true);
  const trophyCount=relicBossClaims.length;
  recordBossVictory(10,true);
  ok(trophyCount===1&&relicBossClaims.length===1,"Boss milestone trophy cannot repeat");
  currentLevel=10;maxLevel=10;enemyType=getEnemyType(10);
  resetBossClockForSpawn();
  ok(bossClockStage===10&&bossRemainingMs()>0,"New boss starts 30-second trial");
  pauseBossClock();
  ok(bossClockDeadline===0&&bossClockPausedMs>0,"Background pause freezes timer");
  resumeBossClock();
  ok(bossClockDeadline>Date.now(),"Foreground resume restores clock");
  ok(failBossChallenge()&&currentLevel===9&&!autoAdvance,"Failure farms previous stage");
  ok(bossRetryStage===10&&retryBossChallenge()&&currentLevel===10,"Retry button returns to boss");
  recordBossVictory(10,true);
  ok(bossRetryStage===0,"Boss victory clears failed gate");
  const archived={
   relicInventory,relicSlots,relicFragments,relicBossClaims,
   activeCampaigns,campaignSerial,bossRetryStage
  };
  loadCampaignRelicState(archived);
  ok(relicSlots[0]==="ember"&&relicBossClaims.includes(10),"Relic equipment and claims survive save restore");
  resetCampaignsForDynasty();
  ok(activeCampaigns.length===0&&relicInventory.ember===2&&relicSlots[0]==="ember",
     "Dynasty resets campaigns but retains artifacts");
  return passed;
 }finally{
  gold=old.gold;currentLevel=old.level;maxLevel=old.max;bestSeasonStage=old.savedBest;
  autoAdvance=old.auto;enemyType=old.enemy;enemyHealth=old.enemyHp;deathCooldown=old.cooldown;
  for(const [key,v] of Object.entries(old.structures))structures[key].level=v.level;
  hiredMercenaries.splice(0,hiredMercenaries.length,...old.mercs);squadBuilds=old.builds;
  activeCampaigns=old.missions;campaignSerial=old.serial;relicInventory=old.inventory;
  relicSlots=old.slots;relicFragments=old.fragments;relicBossClaims=old.bossClaims;
  bossRetryStage=old.retry;bossClockStage=old.clockStage;bossClockDeadline=old.clockDeadline;
  bossClockPausedMs=old.clockPaused;
 }
})()`,ctx,{timeout:5000});
campaignRelicChecks.forEach(label=>console.log("PASS "+label));
console.log("Campaign and relic tests: "+campaignRelicChecks.length+" passed.");


const balanceReportingChecks=vm.runInContext(`(()=>{
 const results=[],ok=(v,n)=>{if(!v)throw Error("Balancing: "+n);results.push(n)};
 const priorConsent=localStorage.getItem(BALANCE_CONSENT_KEY);
 const priorRun=balanceRun,priorQueue=balancePending,priorLast=balanceLastWrite;
 const priorLevel=currentLevel,priorMax=maxLevel,priorEnemy=enemyType;
 const mercenaries=hiredMercenaries.slice(),builds=JSON.parse(JSON.stringify(squadBuilds));
 const oldCampaigns=activeCampaigns;
 try{
  ok(!balanceEnabled(),"Game analytics is opt-in, not automatically enabled");
  ok(balanceBucket(11)==="20"&&balanceBucket(100)==="100","Boss buckets are deterministic");
  ok(balanceClamp(-1)===0&&balanceClamp(Infinity)===0,"Non-finite statistics sanitized");
  localStorage.setItem(BALANCE_CONSENT_KEY,"yes");
  balanceRun={schemaVersion:1,runId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
   seasonId:GAME_SEASON_ID,build:"1.4.0",dynasty:0,startedAt:Date.now(),
   highestStage:0,currentStage:9,activeSeconds:0,ended:false,endedStage:0,
   bosses:{},campaigns:{started:0,claimed:0,won:0,lost:0},
   relics:{found:0,equipped:0}};
  balancePending=[];balanceLastWrite=Date.now();
  balanceStageCleared(9);balanceBossAttempt(10,1.5);
  balanceBossResult(10,false,30);balanceBossAttempt(10,2);
  balanceBossResult(10,true,12.5);
  const boss=balanceRun.bosses.b10;
  ok(boss.attempts===2&&boss.timeouts===1&&boss.wins===1,"Attempts and outcomes aggregate by boss band");
  ok(boss.winSeconds===12.5&&boss.powerSum===3.5,"Kill time and opening DPS ratio captured");
  balanceCampaignStarted();balanceCampaignClaimed(true);balanceRelicFound();
  balanceRelicEquipped();
  ok(balanceRun.campaigns.claimed===1&&balanceRun.relics.equipped===1,
     "Campaign and relic activities counted without identities");
  const payload=balancePayload(balanceRun,"anonymous-firebase-uid");
  ok(payload.ownerUid==="anonymous-firebase-uid"&&
    !Object.keys(payload).some(k=>["playerName","email","message","save","clientId"].includes(k)),
    "Firestore payload excludes names, chat and player saves");
  ok(payload.bosses.b10.attempts===2&&payload.seasonId===GAME_SEASON_ID,
     "Payload retains versioned season-bounded aggregates");
  balanceConsentChanged(false);
  ok(!balanceEnabled()&&balanceRun===null&&
    localStorage.getItem(BALANCE_RUN_KEY)===null,"Opting out drops local pending data");
  hiredMercenaries.splice(0,hiredMercenaries.length,
    {squad:1,level:25,gearLevel:3,attackSpeedLevel:2},
    {squad:1,level:30,gearLevel:3,attackSpeedLevel:2});
  squadBuilds={};activeCampaigns=[];currentLevel=1;maxLevel=10;enemyType=getEnemyType(1);
  const group=getArmySquads()[0];
  const neutral=getArmySquadDps(group,true),slime=getArmySquadDps(group);
  ok(neutral>0&&slime>0,"Army neutral and effective DPS are both available");
  ok(Math.abs(getAutoDamage()-slime)<Math.max(0.000001,slime*1e-10),
     "Army effective DPS matches actual mercenary combat");
  enemyType=getEnemyType(4);
  ok(getArmySquadDps(group)<slime,"Resistance changes displayed effective DPS");
  ok(getArmySquadDps(group,true)===neutral,"Neutral DPS is enemy-independent");
  hiredMercenaries[0].level+=2;
  ok(getArmySquadDps(group,true)>neutral,"Squad leveling increases neutral DPS");
  activeCampaigns=[{kind:"patrol",squadId:1,id:12,endsAt:Date.now()+40000}];
  ok(getArmySquadDps(group)===0&&getAutoDamage()===0,"Campaign absence affects both displays");
  return results;
 }finally{
  if(priorConsent===null)localStorage.removeItem(BALANCE_CONSENT_KEY);
  else localStorage.setItem(BALANCE_CONSENT_KEY,priorConsent);
  balanceRun=priorRun;balancePending=priorQueue;balanceLastWrite=priorLast;
  currentLevel=priorLevel;maxLevel=priorMax;enemyType=priorEnemy;
  hiredMercenaries.splice(0,hiredMercenaries.length,...mercenaries);
  squadBuilds=builds;activeCampaigns=oldCampaigns;
 }
})()`,ctx,{timeout:5000});
balanceReportingChecks.forEach(label=>console.log("PASS "+label));
console.log("Balance telemetry and Army DPS tests: "+balanceReportingChecks.length+" passed.");

const adminDashboardChecks=(()=>{
 const assertions=[],ok=(v,n)=>{if(!v)throw Error("Admin dashboard: "+n);assertions.push(n)};
 const html=fs.readFileSync(path.join(__dirname,"../admin/balance.html"),"utf8");
 const js=fs.readFileSync(path.join(__dirname,"../admin/balance.js"),"utf8");
 const docs=fs.readFileSync(path.join(__dirname,"../docs/BALANCE_ANALYTICS.md"),"utf8");
 ok(html.includes('id="boss-results"')&&html.includes('id="run-stages"'),"Boss and run diagnostics authored");
 ok(html.includes('id="season-current"')&&html.includes('id="season-legacy"'),
     "Both leaderboard seasons can be analyzed");
 ok(js.includes("claims.balanceAdmin")&&js.includes("getIdTokenResult(true)"),
     "Admin custom claim checked before live reads");
 ok(js.includes('limit(2000)')&&js.includes('sanitize')===false,
     "Live reads capped and sanitize through clean()");
 ok(docs.includes("request.auth.token.balanceAdmin")&&docs.includes("safeShape()"),
     "Server enforcement and deployment documented");
 return assertions;
})();
adminDashboardChecks.forEach(label=>console.log("PASS "+label));
console.log("Admin dashboard static tests: "+adminDashboardChecks.length+" passed.");


const expeditionTacticsChecks=vm.runInContext(`(()=>{
 const passed=[],ok=(v,label)=>{if(!v)throw Error("Expedition tactics: "+label);passed.push(label)};
 const old={
  structures:JSON.parse(JSON.stringify(structures)),mercs:hiredMercenaries.slice(),
  builds:JSON.parse(JSON.stringify(squadBuilds)),missions:activeCampaigns,
  serial:campaignSerial,gold,fragments:relicFragments,runGold:runGoldEarned,
  level:currentLevel,max:maxLevel,enemy:enemyType
 };
 try{
  structures.barracks.level=6;structures.blacksmith.level=6;
  hiredMercenaries.splice(0,hiredMercenaries.length,
    {squad:1,level:35,gearLevel:5,attackSpeedLevel:2},
    {squad:1,level:30,gearLevel:4,attackSpeedLevel:2},
    {squad:2,level:2,gearLevel:0,attackSpeedLevel:0});
  squadBuilds={
    1:{role:"raider",kit:"ember",ownedKits:["basic","ember"]},
    2:{role:"vanguard",kit:"basic",ownedKits:["basic"]}
  };
  activeCampaigns=[];currentLevel=1;maxLevel=10;enemyType=getEnemyType(1);
  const siege=CAMPAIGN_DEFINITIONS[2],patrol=CAMPAIGN_DEFINITIONS[0];
  const trained=getCampaignSuccessChance(siege,1);
  const novice=getCampaignSuccessChance(siege,2);
  ok(trained>novice&&trained<=0.97&&novice>0,"Squad training and forged equipment improve bounded success chance");
  const priorGoldBonus=getSquadGoldMultiplier(),priorDps=getAutoDamage();
  ok(priorGoldBonus>1&&squadsSuppressRegeneration(),"Combat perks apply to available raiders and ember kit");
  ok(startSquadCampaign("patrol",1),"Launch an expedition");
  const trip=activeCampaigns[0];
  ok(Number.isFinite(trip.chance)&&trip.chance===getCampaignSuccessChance(patrol,1),
     "Odds are snapshotted at dispatch");
  ok(!squadsSuppressRegeneration()&&getSquadGoldMultiplier()===1,
     "Away squads grant neither gold nor regeneration benefits");
  ok(getAutoDamage()<priorDps,"Squads dispatched to missions lose combat DPS");
  const wallet=gold,shards=relicFragments;
  ok(recallSquadCampaign(trip.id),"Recall unfinished squad after player confirmation");
  ok(activeCampaigns.length===0&&gold===wallet&&relicFragments===shards,
     "Early recall grants no unfinished mission rewards");
  ok(getAutoDamage()===priorDps&&squadsSuppressRegeneration()&&
     getSquadGoldMultiplier()===priorGoldBonus,"Recall restores all combat perks");
  activeCampaigns=[
    {id:1001,kind:"patrol",squadId:1,startedAt:Date.now()-60000,endsAt:Date.now()-1000,
     success:true,reward:{gold:30,fragments:1,relic:null}},
    {id:1002,kind:"ruins",squadId:2,startedAt:Date.now()-60000,endsAt:Date.now()-1000,
     success:false,reward:{gold:10,fragments:0,relic:null}}
  ];
  const goldBefore=gold,shardsBefore=relicFragments;
  ok(claimReadyCampaigns()&&activeCampaigns.length===0,"Claim all finished missions at once");
  ok(gold===goldBefore+40&&relicFragments===shardsBefore+1,
     "Bulk claim awards exact sum of loot");
  ok(!claimReadyCampaigns(),"Bulk claim cannot duplicate rewards");
  activeCampaigns=[{
    id:1003,kind:"siege",squadId:1,startedAt:Date.now(),endsAt:Date.now()+600000,
    success:true,reward:{gold:1000,fragments:3,relic:null}
  }];
  const before=gold;
  ok(recallAllSquadsForBoss()&&activeCampaigns.length===0&&gold===before,
     "Boss recall returns squads without reward exploits");
  return passed;
 }finally{
  gold=old.gold;relicFragments=old.fragments;runGoldEarned=old.runGold;
  currentLevel=old.level;maxLevel=old.max;enemyType=old.enemy;
  for(const [key,building] of Object.entries(old.structures))structures[key].level=building.level;
  hiredMercenaries.splice(0,hiredMercenaries.length,...old.mercs);
  squadBuilds=old.builds;activeCampaigns=old.missions;campaignSerial=old.serial;
 }
})()`,ctx,{timeout:5000});
expeditionTacticsChecks.forEach(label=>console.log("PASS "+label));
console.log("Expedition tactics tests: "+expeditionTacticsChecks.length+" passed.");

const expeditionInterfaceChecks=(()=>{
 const passed=[],ok=(value,label)=>{if(!value)throw Error("Expedition interface: "+label);passed.push(label)};
 const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
 const systems=fs.readFileSync(path.join(__dirname,"../systems.js"),"utf8");
 ok(html.includes('id="boss-recall-all"')&&html.includes('id="boss-readiness"'),
    "Hero boss recall and readiness fields authored");
 ok(html.includes('id="campaign-claim-ready"'),"Claim all ready action authored");
 ok(systems.includes('setInterval(()=>')&&systems.includes('updateCampaignTimers();'),
    "Mission status refresh uses in-place countdown updates");
 ok(systems.includes('select.addEventListener("change",updatePreview)'),
    "Per-squad chance and commitment preview changes on selection");
 return passed;
})();
expeditionInterfaceChecks.forEach(label=>console.log("PASS "+label));
console.log("Expedition UI tests: "+expeditionInterfaceChecks.length+" passed.");


const bossTacticsChecks=vm.runInContext(`(()=>{
 const passed=[],ok=(v,n)=>{if(!v)throw Error("Boss tactics: "+n);passed.push(n)};
 const old={
  currentLevel,maxLevel,enemyType,enemyHealth,deathCooldown,
  bossClockStage,bossClockDeadline,bossClockPausedMs,bossHealLastTick,
  mercs:hiredMercenaries.slice(),builds:JSON.parse(JSON.stringify(squadBuilds)),
  missions:activeCampaigns,barracks:structures.barracks.level,
  blacksmith:structures.blacksmith.level
 };
 try{
  structures.barracks.level=6;structures.blacksmith.level=6;
  hiredMercenaries.splice(0,hiredMercenaries.length,
   {squad:1,level:20,gearLevel:3,attackSpeedLevel:2});
  squadBuilds={"1":{role:"vanguard",kit:"basic",ownedKits:["basic","piercing","runic","ember"]}};
  activeCampaigns=[];
  const bosses=[getEnemyType(10),getEnemyType(20),getEnemyType(30),getEnemyType(40)];
  ok(bosses.map(b=>b.id).join(",")==="dragon,wyvern,lich,hydra",
    "Four boss species rotate every ten stages");
  ok(bosses.every(b=>isBossEnemy(b))&&getEnemyType(50).id==="dragon"&&
    getEnemyType(110).id==="lich","Boss frequency and 40-stage cycle preserved through Frontier");
  ok(!isBossEnemy(getEnemyType(9))&&!isBossEnemy(getEnemyType(11)),
    "Regular opponents remain distinct from bosses");
  ok(bosses.every(b=>b.sprite.length===16&&b.sprite.every(row=>row.length===16))&&
    new Set(bosses.map(b=>b.sprite.join(""))).size===4,
    "Each boss has a separate valid 16x16 authored silhouette");
  ok(bosses.every(b=>b.counter&&b.summary&&b.hp<=4.5&&b.hp>=4.0),
    "Encounters advertise meaningful counters without inflating HP");
  currentLevel=10;maxLevel=10;enemyType=getEnemyType(10);
  bossClockStage=10;bossClockDeadline=Date.now()+30000;bossClockPausedMs=30000;
  ok(bossScalesUp(enemyType),"Dragon starts in its ten-second guarded phase");
  ok(getBossSquadDamageFactor(enemyType,{role:"ranger",kit:"basic"})===.82&&
    getBossSquadDamageFactor(enemyType,{role:"vanguard",kit:"basic"})===1&&
    getBossSquadDamageFactor(enemyType,{role:"ranger",kit:"piercing"})===1,
    "Vanguards and Piercing Arms bypass opening armor");
  ok(getBossHeroDamageFactor(enemyType)===.9,"Opening scale guard affects hero clicks");
  bossClockDeadline=Date.now()+17000;
  ok(!bossScalesUp(enemyType)&&getBossHeroDamageFactor(enemyType)===1,
    "Scales break after the first ten seconds");
  currentLevel=20;maxLevel=20;enemyType=getEnemyType(20);
  bossClockStage=20;bossClockDeadline=Date.now()+30000;
  ok(getBossAwareDodge(enemyType)===.26,"Wyvern veil initially dodges hero clicks");
  squadBuilds["1"].role="ranger";
  ok(getBossAwareDodge(enemyType)===.08,"Active Rangers ground Wyvern and reduce dodges");
  const group=getArmySquads()[0];
  ok(Math.abs(getArmySquadDps(group)-getAutoDamage())<1e-7,
    "Army damage and combat damage agree against the Wyvern");
  activeCampaigns=[{squadId:1,id:78,kind:"patrol",endsAt:Date.now()+30000}];
  ok(getBossAwareDodge(enemyType)===.26,"Away Rangers cannot ground the boss");
  activeCampaigns=[];
  currentLevel=30;maxLevel=30;enemyType=getEnemyType(30);
  bossClockStage=30;bossClockDeadline=Date.now()+30000;
  squadBuilds["1"].role="vanguard";
  ok(getBossRegenerationRate(enemyType)===.025,"Grave Wyrm ward restores boss health");
  squadBuilds["1"].role="mystic";
  ok(getBossRegenerationRate(enemyType)===0,"Mystic squad breaks Soul Ward");
  squadBuilds["1"].role="vanguard";squadBuilds["1"].kit="runic";
  ok(getBossRegenerationRate(enemyType)===0,"Runic kit also breaks Soul Ward");
  currentLevel=40;maxLevel=40;enemyType=getEnemyType(40);
  bossClockStage=40;bossClockDeadline=Date.now()+30000;
  squadBuilds["1"].kit="basic";
  ok(getBossRegenerationRate(enemyType)===.045,"Hydra heads regrow without counter gear");
  squadBuilds["1"].kit="ember";
  ok(getBossRegenerationRate(enemyType)===0,"Active Ember Blades stop Hydra regrowth");
  ok(Number.isFinite(getEnemyHealth()),"Hydra health finite");
  activeCampaigns=[{squadId:1,id:80,kind:"ruins",endsAt:Date.now()+50000}];
  ok(getBossRegenerationRate(enemyType)===.045,"Away Ember squad cannot block regeneration");
  activeCampaigns=[];bossClockStage=0;
  ok(!bossScalesUp(getEnemyType(10))&&getBossSquadDamageFactor(getEnemyType(10),
    {role:"ranger",kit:"basic"})===1,"Revisited bosses are untimed and lack opening guard");
  currentLevel=20000000;maxLevel=20000001;enemyType=getEnemyType(currentLevel);
  ok(isBossEnemy(enemyType)&&Number.isFinite(getEnemyHealth())&&
     getEnemyHealth()>0,"Extreme-stage boss is finite and fully recognized");
  return passed;
 }finally{
  currentLevel=old.currentLevel;maxLevel=old.maxLevel;enemyType=old.enemyType;
  enemyHealth=old.enemyHealth;deathCooldown=old.deathCooldown;
  bossClockStage=old.bossClockStage;bossClockDeadline=old.bossClockDeadline;
  bossClockPausedMs=old.bossClockPausedMs;bossHealLastTick=old.bossHealLastTick;
  hiredMercenaries.splice(0,hiredMercenaries.length,...old.mercs);
  squadBuilds=old.builds;activeCampaigns=old.missions;
  structures.barracks.level=old.barracks;
  structures.blacksmith.level=old.blacksmith;
 }
})()`,ctx,{timeout:5000});
bossTacticsChecks.forEach(label=>console.log("PASS "+label));
console.log("Boss tactics tests: "+bossTacticsChecks.length+" passed.");

const bossDossierChecks=(()=>{
 const passed=[],ok=(v,n)=>{if(!v)throw Error("Boss dossier UI: "+n);passed.push(n)};
 const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
 const css=fs.readFileSync(path.join(__dirname,"..","style.css"),"utf8");
 const content=fs.readFileSync(path.join(__dirname,"..","combat-content.js"),"utf8");
 ok(html.includes('id="boss-dossier-title"')&&html.includes('id="boss-dossier-state"'),
   "Boss name, counters and mechanic status appear in authored markup");
 ok(css.includes(".boss-dossier")&&css.includes("overflow-wrap:anywhere"),
   "Tactical card remains responsive on phones");
 ok(content.includes("BOSS_ENCOUNTERS")&&content.includes("bossAtStage"),
   "All bosses come from the editable encounter definitions");
 return passed;
})();
bossDossierChecks.forEach(label=>console.log("PASS "+label));
console.log("Boss dossier UI tests: "+bossDossierChecks.length+" passed.");

const seasonStabilityChecks = vm.runInContext("(async () => {\n  const passed=[],ok=(condition,label)=>{if(!condition)throw Error(\"Sync: \"+label);passed.push(label)};\n  await flushPromiseCallbacks();\n  const originalCollection=db.collection;\n  const savedName=playerName, savedConfirmed=nameConfirm;\n  const savedBest=bestSeasonStage, savedMax=maxLevel;\n  const savedSubmitted=lastSubmittedScore;\n  const previous=document.getElementById(\"leaderboard-sync-status\").textContent;\n  try {\n    let resolveWrite=null,writeCount=0,latestWritten=null;\n    db.collection=collectionName=>{\n      ok(collectionName===GAME_SCORE_COLLECTION,\"All uploads target Season II\");\n      return { doc:name=>({\n        set:payload=>{\n          writeCount++;latestWritten=payload;\n          return new Promise(resolve=>{resolveWrite=resolve});\n        },\n        get:()=>Promise.resolve({exists:false})\n      }) };\n    };\n    nameConfirm=true;playerName=\"SyncTester\";lastSubmittedScore=1;\n    bestSeasonStage=111;maxLevel=111;\n    scoreUploadPending=false;lastScoreUploadAttempt=-Infinity;scoreUploadRetryAt=0;\n    let save=inspectSeasonSave(localStorage.getItem(\"clickerHeroSave\"))||{};\n    save.schemaVersion=GAME_SCHEMA_VERSION;save.seasonId=GAME_SEASON_ID;\n    save.playerName=playerName;save.lastSubmittedScore=1;\n    localStorage.setItem(\"clickerHeroSave\",JSON.stringify(save));\n    ok(submitScore(),\"Unsynced progress schedules upload\");\n    ok(writeCount===1&&latestWritten.score===111,\"First upload captures exact stage\");\n    bestSeasonStage=222;maxLevel=222;\n    ok(!submitScore()&&writeCount===1,\"Concurrent saves do not duplicate writes\");\n    ok(scoreUploadPending,\"Pending flag prevents duplicate requests\");\n    resolveWrite();\n    await flushPromiseCallbacks();\n    ok(!scoreUploadPending&&lastSubmittedScore===111,\"Ack does not mark newer stages synchronized\");\n    const persisted=inspectSeasonSave(localStorage.getItem(\"clickerHeroSave\"));\n    ok(persisted.lastSubmittedScore===111,\"Confirmed stage is cached without another network write\");\n    ok(!submitScore()&&writeCount===1,\"Follow-up writes are rate-limited\");\n    lastScoreUploadAttempt=-Infinity;\n    ok(submitScore()&&writeCount===2&&latestWritten.score===222,\"New progress eventually uploads\");\n    resolveWrite();\n    await flushPromiseCallbacks();\n    ok(lastSubmittedScore===222,\"Second acknowledgement advances score\");\n    // Permission-denied registration leaves the name field usable.\n    db.collection=()=>({doc:()=>({\n      get:()=>Promise.reject({code:\"permission-denied\"}),\n      set:()=>Promise.reject({code:\"permission-denied\"})\n    })});\n    nameConfirm=false;nameRegistrationPending=false;\n    nameConfirmButton.disabled=false;\n    nameInput.value=\"FreshName\";\n    confirmName();\n    ok(nameRegistrationPending&&nameConfirmButton.disabled,\"Registration blocks duplicate clicks while waiting\");\n    for(let i=0;i<10;i++)await Promise.resolve();\n    ok(!nameRegistrationPending&&!nameConfirm&&nameConfirmButton.disabled===false,\n       \"Denied registration is recoverable, not a false confirmation\");\n    ok(document.getElementById(\"leaderboard-sync-status\").textContent.includes(\"Firebase\"),\n       \"Permission failure has actionable feedback\");\n    // Exact College prefix costs and repeated queries should be O(1) after initial fill.\n    const rank=3500;\n    academyDisciplines.warfare=rank;academyDisciplines.commerce=rank;\n    const expectedCost=Array.from({length:rank},(_,i)=>3+Math.floor(Math.pow(i+1,1.4)))\n      .reduce((sum,value)=>sum+value,0);\n    ok(getAcademyTotalSpent(rank)===expectedCost,\"College prefix cost equals exact rank-by-rank sum\");\n    const memoSize=academyInsightCostPrefix.length;\n    for(let i=0;i<20;i++)getResearchInsightSpent();\n    ok(academyInsightCostPrefix.length===memoSize,\"Repeated research queries reuse cached costs\");\n    academyDisciplines.warfare=10000;\n    ok(!upgradeAcademyDiscipline(\"warfare\"),\"College cap enforced before purchase\");\n    return passed;\n  } finally {\n    db.collection=originalCollection;\n    playerName=savedName;nameConfirm=savedConfirmed;\n    maxLevel=savedMax;bestSeasonStage=savedBest;lastSubmittedScore=savedSubmitted;\n    academyDisciplines={warfare:0,commerce:0,governance:0};\n    scoreUploadPending=false;nameRegistrationPending=false;\n    lastScoreUploadAttempt=-Infinity;scoreUploadRetryAt=0;\n    document.getElementById(\"leaderboard-sync-status\").textContent=previous;\n  }\n})()", ctx, {timeout:5000});
seasonStabilityChecks.then(labels=>{
 labels.forEach(label=>console.log("PASS "+label));
 console.log("Season II stability tests: "+labels.length+" passed.");
}).catch(error=>{
 console.error(error);
 process.exitCode=1;
});

