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
        summary: "Boss every 10 stages: massive armor and rich rewards",
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
    if (lvl % 10 === 0) return ENEMY_TYPES[5];
    return ENEMY_TYPES[(lvl - 1) % 5];
}
function squadUpgradeKitCost(squadId, kitId) {
    const kit = findEquipmentKit(kitId);
    return Math.floor(kit.cost * (1 + (Math.max(1, squadId) - 1) * 0.12) * mktUp(1));
}
function getSquadGoldMultiplier() {
    const uniqueSquads = new Set(hiredMercenaries.map(m => m.squad));
    let raiders = 0;
    for (const squadId of uniqueSquads) {
        if (getSquadBuild(squadId).role === "raider") raiders++;
    }
    return 1 + Math.min(1.2, 0.12 * raiders);
}
function squadsSuppressRegeneration() {
    return hiredMercenaries.some(m => getSquadBuild(m.squad).kit === "ember");
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
