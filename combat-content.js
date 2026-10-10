// Editor-friendly, data-driven combat definitions.
// Single-source data for mechanics, labels, unlocks, and hand-drawn pixel silhouettes.
const SQUAD_ROLES = [
    { id: "vanguard", name: "Vanguard", unlock: 0, summary: "Front-line fighters · +15% DPS, +35% vs armored", power: 1.15, favored: "armored", counter: 1.35 },
    { id: "ranger", name: "Rangers", unlock: 2, summary: "Precision archers · +65% vs evasive enemies", power: 0.90, favored: "evasive", counter: 1.65 },
    { id: "mystic", name: "Mystics", unlock: 4, summary: "Arcane battlemages · +90% vs spectral enemies", power: 0.95, favored: "spectral", counter: 1.90 },
    { id: "raider", name: "Raiders", unlock: 6, summary: "Treasure hunters · -20% DPS, +12% gold per squad", power: 0.80, favored: "treasure", counter: 1 }
];

const EQUIPMENT_KITS = [
    { id: "basic", name: "Standard", unlock: 0, cost: 0, summary: "Reliable starter equipment", power: 1, favored: "", counter: 1 },
    { id: "steel", name: "Forged Steel", unlock: 1, cost: 3000, summary: "+25% damage against all enemies", power: 1.25, favored: "", counter: 1 },
    { id: "piercing", name: "Piercing Arms", unlock: 2, cost: 10000, summary: "+80% damage against armored enemies", power: 1, favored: "armored", counter: 1.8 },
    { id: "ember", name: "Ember Blades", unlock: 4, cost: 30000, summary: "+110% vs regenerating foes; stops their healing", power: 1.1, favored: "regenerating", counter: 2.1 },
    { id: "runic", name: "Runic Weapons", unlock: 6, cost: 90000, summary: "+100% damage against spectral enemies", power: 1.2, favored: "spectral", counter: 2 }
];

// Each sprite is 16 x 16. "." means transparent; numerals are palette entries.
// Shapes are intentionally authored rather than randomly filled rectangles.
const ENEMY_TYPES = [
    {
        id: "slime", name: "Mire Slime", trait: "regenerating",
        summary: "Regenerates health; Ember Blades stop it",
        hp: 1.00, gold: 1.00, resistance: 1, regen: 0.035, dodge: 0,
        palette: ["#14231b", "#356d37", "#6ec85b", "#dbffaf", "#ffefe0"],
        sprite: [
            "................","................","......2222......","....22222222....",
            "...2222222222...","..222222222222..","..223222223222..",".22233333333222.",
            ".22234433443222.","1222344334432221","1222222222222221","1122222222222211",
            ".11222222222211.","..11122222111...","....11111111....","................"
        ]
    },
    {
        id: "harpy", name: "Sky Harpy", trait: "evasive",
        summary: "Can dodge hero clicks; Rangers excel here",
        hp: 0.92, gold: 1.20, resistance: 0.85, regen: 0, dodge: 0.18,
        palette: ["#222338", "#343b74", "#8e8cc6", "#e1d3f1", "#ffd46d"],
        sprite: [
            "................","..22........22..",".2222..22..2222.",".22222222222222.",
            "..122222222221..","...122222221....","...1122332211...","....12344321....",
            ".....123321.....","...1122332211...","..1122.22.2211..",".1122..22..2211.",
            "..11..1221..11..","......1221......",".....11..11.....","................"
        ]
    },
    {
        id: "golem", name: "Iron Golem", trait: "armored",
        summary: "Heavy armor absorbs hits; Piercing Arms counter it",
        hp: 1.85, gold: 1.65, resistance: 0.60, regen: 0, dodge: 0,
        palette: ["#191e24", "#424953", "#788794", "#b9c9c9", "#ff9c63"],
        sprite: [
            "................","....11111111....","...1222222221...",".11122222222111.",".12222344322221.",
            ".12222222222221.",".12222111122221.",".11222122122211.","..112222222211..",
            "..122222222221..","..122222222221..",".112221..122211.",".122221..122221.",
            ".122211..112221.",".11111....11111.","................"
        ]
    },
    {
        id: "wraith", name: "Moon Wraith", trait: "spectral",
        summary: "Resists ordinary steel; Mystics and Runic Weapons excel",
        hp: 1.3, gold: 1.55, resistance: 0.62, regen: 0, dodge: 0,
        palette: ["#111627", "#35365d", "#7574b1", "#b6adf7", "#ff648e"],
        sprite: [
            "................","......1111......","....11222211....","...1222222221...",
            "...1222222221...","..122443344221..","..122443344221..","..122223322221..",
            "..122222222221..",".12223222232221.",".12223222232221.","1222232222322221",
            "1222112222112221","1111.12221.1111",".....11111......","................"
        ]
    },
    {
        id: "bandit", name: "Goblin Marauder", trait: "treasure",
        summary: "Carries extra loot; Raiders increase its bounty",
        hp: 1.15, gold: 1.8, resistance: 1, regen: 0, dodge: 0,
        palette: ["#201b0d", "#435b27", "#73a849", "#c8d982", "#e6bb52"],
        sprite: [
            "................",".....111111.....","...1122222211...","..122222222221..",
            ".12222222222221.","1222234334322221","1222222222222221","1122223333222211",
            "..11122222111...","...122222221....","..11222222211...","..12222222221...",
            ".112211..112211.","112211....112211","11111......11111","................"
        ]
    },
    {
        id: "dragon", name: "Ash Dragon", trait: "armored",
        summary: "Iron Scales guard its opening 10 seconds. Vanguard and Piercing Arms bypass the guard.",
        boss: true, bossMechanic: "scales", counter: "Vanguard / Piercing Arms",
        hp: 4.5, gold: 5.0, resistance: 0.65, regen: 0, dodge: 0,
        palette: ["#231424", "#862d31", "#d45b39", "#f9a35c", "#ffe48c"],
        sprite: [
            "..............1.",             ".............12.",             "........1...122.",             ".....11121.1222.",
            "....12222112222.",             "..1122222222234.",             ".12222333333244.",             "122222333332211.",
            "2211122222221...",             "11..122222211...",             "....12222221....",             "....122112221...",
            "...1221..12221..",             "...111...11211..",             ".........111....",             "................"
        ]
    }
];


// Rotating milestone bosses. All inherit the existing 30-second first-clear
// challenge, Market bounty and relic mechanics, even at extreme stages.
const BOSS_ENCOUNTERS = Object.freeze([
    ENEMY_TYPES[5],
    {
        id:"wyvern",name:"Storm Wyvern",trait:"evasive",boss:true,
        bossMechanic:"gale",counter:"Rangers",
        summary:"Gale Veil dodges hero clicks. Active Rangers disrupt its flight and reduce dodging.",
        hp:4.2,gold:5,resistance:.78,regen:0,dodge:.26,
        palette:["#101928","#26546a","#4b9ba6","#b4dce0","#ffe0a4"],
        sprite:[
            "................","................","..11........11..","..1221....1221..",
            ".122221..122221.","1222222112222221","1222233333222221","1222334444332221",
            ".11222333332211.","...122333221....","..1122222211....","...12222221.....",
            "..122112211.....",".1221.11.1221...","1111......1111..","................"
        ]
    },
    {
        id:"lich",name:"Grave Wyrm",trait:"spectral",boss:true,
        bossMechanic:"ward",counter:"Mystics / Runic Weapons",
        summary:"Soul Ward restores health each second. Mystics or Runic Weapons unravel the ward.",
        hp:4.25,gold:5,resistance:.72,regen:.025,dodge:0,
        palette:["#131323","#343059","#6863a2","#bcb4fa","#84e7d8"],
        sprite:[
            "................","......1111......",".....122221.....","....12233221....",
            "...1223333221...","..122344443221..","..123334433321..","..123333333321..",
            ".11223333333211.","1222333333332221","1223322332233221","1122112332112211",
            "...1122222211...","....122..221....","...111....111...","................"
        ]
    },
    {
        id:"hydra",name:"Cinder Hydra",trait:"regenerating",boss:true,
        bossMechanic:"regrowth",counter:"Ember Blades",
        summary:"Regrowing heads heal each second unless active squads wield Ember Blades.",
        hp:4.4,gold:5,resistance:.82,regen:.045,dodge:0,
        palette:["#231b17","#5b4231","#a6643d","#e7a95b","#ffe7a2"],
        sprite:[
            "................",".111..111..111..","122211222112221.","1233212332123321",
            ".12211122111221.","..122222222221..","...1222332221...","..112233332211..",
            ".12223333332221.","1222233333322221","1222333333332221",".12223333332221.",
            "..112222222211..","...1221..1221...","...111....111...","................"
        ]
    }
]);
function isBossEnemy(type) {
    return Boolean(type && (type.boss===true || type.id==="dragon"));
}
function bossAtStage(stage) {
    const level=Math.max(1,Math.floor(Number(stage)||1));
    return BOSS_ENCOUNTERS[(Math.floor(level/10)-1)%BOSS_ENCOUNTERS.length]||BOSS_ENCOUNTERS[0];
}


const MONSTER_ENCOUNTERS = Object.freeze([
    ...ENEMY_TYPES.slice(0,5),
    {"id":"duskwisp","name":"Dusk Wisp","trait":"spectral","summary":"Flickers through steel; Mystics and Runic Weapons disperse it","hp":1.22,"gold":1.4,"resistance":0.54,"regen":0,"dodge":0,"palette":["#16132b","#353056","#7163a0","#bca9ec","#8bdfea"],"sprite":["................","................","......1111......",".....122221.....","....12233221....","...1223333221...","...1234444321...","..122344443221..","..123344443321..","...1223333221...","..11222332211...","..12222222221...","...1122..2211...","....11....11....",".....1....1.....","................"]},
    {"id":"leech","name":"Bog Leech","trait":"regenerating","summary":"Siphons life from the mire; Ember Blades cauterize its wounds","hp":0.96,"gold":1.12,"resistance":0.97,"regen":0.03,"dodge":0,"palette":["#12211f","#255447","#4f9072","#93c8a0","#e8e3ad"],"sprite":["................","................","................",".....111111.....","...1122222211...","..122222222221..",".12222333322221.","1222333333332221","1222334444332221","1222233333322221",".12222222222221.","..122233322221..","...1122222211...",".....111111.....","................","................"]},
    {"id":"kobold","name":"Copper Kobold","trait":"treasure","summary":"Guards copper caches; Raiders increase its bounty","hp":1.08,"gold":1.75,"resistance":1,"regen":0,"dodge":0,"palette":["#23190f","#6a3f25","#ad753e","#e6b875","#f3e79a"],"sprite":["................","...11......11...","...121....121...","....12211221....","....12222221....","...1223333221...","..122334433221..","..123332233321..","...1222222221...","....11222211....","...1122222211...","..112223322211..","..1221.22.1221..","..121..11..121..","..111......111..","................"]},
    {"id":"mantis","name":"Fang Mantis","trait":"evasive","summary":"Quick lunges dodge hero taps; Rangers track its movements","hp":1.02,"gold":1.35,"resistance":0.88,"regen":0,"dodge":0.15,"palette":["#131b13","#31552c","#5c9147","#a1c974","#e2eaa9"],"sprite":["................","..1..........1..","...1........1...","...12......21...","....12....21....",".....122221.....","....12233221....","...1223333221...","..122344443221..",".11223333332211.","11.122333221.11.","....12222221....","...1122..2211...","..1121....1211..",".111........111.","................"]},
    {"id":"stalker","name":"Wind Stalker","trait":"evasive","summary":"Vaults between ridges; Rangers counter its footwork","hp":1.14,"gold":1.48,"resistance":0.9,"regen":0,"dodge":0.22,"palette":["#1a1d2a","#333b59","#586f93","#91b3d1","#e4e9cb"],"sprite":["................","...11......11...","...121....121...","...122111221....","..12222222221...",".11222333322211.","1222334334332221","1222333333332221",".11222233332211.","..112222222211..","...122222221....","..112211122211..",".11221....12211.","1121........1211","111..........111","................"]},
    {"id":"scarab","name":"Granite Scarab","trait":"armored","summary":"A walking stone shell; Vanguards and Piercing Arms crack it","hp":1.95,"gold":1.6,"resistance":0.7,"regen":0,"dodge":0,"palette":["#171d21","#38454d","#677c83","#abb9b5","#e5b279"],"sprite":["................","......1111......","....11222211....","..112222222211..",".11222333322211.","1222333333332221","1223334444333221","1233344444433321","1233344444433321","1223333333333221","1222333333332221",".11222222222211.","..112211112211..",".11221....12211.","11111......11111","................"]},
    {"id":"hulker","name":"Spore Hulker","trait":"regenerating","summary":"Fungal plates regrow rapidly; Ember Blades burn the spores","hp":1.28,"gold":1.45,"resistance":0.94,"regen":0.04,"dodge":0,"palette":["#182119","#374e32","#6c8b4d","#b4bd79","#f3ddae"],"sprite":["................","......1111......","...1112222111...","..122233332221..",".12223344433221.","1222334444433221","1222334444433221","1222333333333221",".12223333333221.","..122222222221..","..112222222211..","...122222221....","..11221..12211..",".11221....12211.","11111......11111","................"]}
]);
// Keep familiar stage 1–9 enemies; introduce the new seven at 11–17.
// After that, cycle deterministically through all 12, skipping boss stages.
function monsterAtStage(stage){
    const level=Math.max(1,Math.floor(Number(stage)||1));
    if(level<=9)return ENEMY_TYPES[(level-1)%5];
    const since=level-11;
    const ordinal=since-Math.floor(Math.max(0,since)/10);
    return MONSTER_ENCOUNTERS[(5+ordinal)%MONSTER_ENCOUNTERS.length];
}
function monsterFirstStage(type){
    const index=MONSTER_ENCOUNTERS.findIndex(monster=>monster.id===type.id);
    return index<5?index+1:index+6;
}

function findSquadRole(id) {
    return SQUAD_ROLES.find(role => role.id === id) || SQUAD_ROLES[0];
}
function findEquipmentKit(id) {
    return EQUIPMENT_KITS.find(kit => kit.id === id) || EQUIPMENT_KITS[0];
}
function getSquadBuild(squadId) {
    const key = String(Math.max(1, Math.floor(Number(squadId) || 1)));
    if (!squadBuilds[key] || typeof squadBuilds[key] !== "object") {
        squadBuilds[key] = { role: "vanguard", kit: "basic", ownedKits: ["basic"] };
    }
    const build = squadBuilds[key];
    if (!Array.isArray(build.ownedKits)) build.ownedKits = ["basic"];
    if (!build.ownedKits.includes("basic")) build.ownedKits.push("basic");
    if (!build.ownedKits.includes(build.kit)) build.kit = "basic";
    if (findSquadRole(build.role).unlock > structures.barracks.level) build.role = "vanguard";
    if (findEquipmentKit(build.kit).unlock > structures.blacksmith.level) build.kit = "basic";
    return build;
}
function getEnemyType(level = currentLevel) {
    const lvl = Math.max(1, Math.floor(Number(level) || 1));
    const base = lvl % 10 === 0 ? bossAtStage(lvl) : monsterAtStage(lvl);
    return enhanceFrontierEnemy(base,lvl);
}
function squadUpgradeKitCost(squadId, kitId) {
    const kit = findEquipmentKit(kitId);
    return Math.floor(kit.cost * (1 + (Math.max(1, squadId) - 1) * 0.12) * mktUp(1) * getResearchCostFactor());
}
function getSquadGoldMultiplier() {
    const uniqueSquads = new Set(hiredMercenaries.map(m => m.squad)
        .filter(squadId => !isSquadOnCampaign(squadId)));
    let raiders = 0;
    for (const squadId of uniqueSquads) {
        if (getSquadBuild(squadId).role === "raider") raiders++;
    }
    return 1 + Math.min(1.2, 0.12 * raiders);
}
function squadsSuppressRegeneration() {
    return hiredMercenaries.some(m => !isSquadOnCampaign(m.squad) &&
        getSquadBuild(m.squad).kit === "ember");
}
function setSquadRole(squadId, roleId) {
    const role = SQUAD_ROLES.find(entry => entry.id === roleId);
    if (!role || structures.barracks.level < role.unlock) return false;
    getSquadBuild(squadId).role = role.id;
    saveGame();
    updateUI();
    drawKingdom();
    return true;
}
function buyOrEquipSquadKit(squadId, kitId) {
    const kit = EQUIPMENT_KITS.find(entry => entry.id === kitId);
    if (!kit || structures.blacksmith.level < kit.unlock) return false;
    const build = getSquadBuild(squadId);
    if (!build.ownedKits.includes(kit.id)) {
        const cost = squadUpgradeKitCost(squadId, kit.id);
        if (gold < cost) {
            showPopupMessage("Not enough gold for " + kit.name, false, 1000);
            return false;
        }
        gold -= cost;
        build.ownedKits.push(kit.id);
    }
    build.kit = kit.id;
    updateUI();
    drawKingdom();
    saveGame();
    return true;
}
