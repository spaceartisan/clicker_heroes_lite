// === Game State ===
let gold = 0;
let playerLevel = 1;
let playerGearLevel = 0;
let playerUpgradeCost = 10;
let playerGearCost = 100;
let nextPlayerGearLevelReq = 10;
let playerClickDamage = 1;

let currentLevel = 1;
let maxLevel = currentLevel
let lastSubmittedScore = maxLevel;
let baseEnemyHealth = 5;
let enemyHealth = baseEnemyHealth;
let autoAdvance = true;
let scientificNotation = false;

// let maxMercenaries = 5;
// let guildLevel = 1;

let playerName = "Unnamed Hero"; // Default name
let nameConfirm = false;

const hiredMercenaries = [];
let squadBuilds = {};
let enemyType = null;
const squadAttackInterval = [];

let messageInterval = null;
let leaderboardUnsub = null;
let messageUnsub = null;

let upgradeMultiplier = 1;
let underfillEnabled = false; // Track underfill state

let totalClicks = 0; // Track total clicks for achievements
let enemiesDefeated = 0; // Track defeated enemies for achievements
let abilitiesUsed = []; // Track used abilities for achievements
let abilitiesCount = 0; // Track amount abilities used

const enemyCanvas = document.getElementById("enemy-canvas");
const ctx = enemyCanvas.getContext("2d");

const kingdomCanvas = document.getElementById("kingdom-canvas");
const kingdomCtx = kingdomCanvas.getContext("2d");

const achievements = [
    { id: "gold_100", name: "Gold Digger I", description: "Collect 100 gold", condition: () => gold >= 100 },
    { id: "gold_100000", name: "Gold Digger II", description: "Collect 100,000 gold", condition: () => gold >= 100000 },
    { id: "gold_1000000", name: "Gold Digger III", description: "Collect 1,000,000 gold", condition: () => gold >= 1000000 },
    { id: "player_10", name: "Hero's Rise I", description: "Reach player level 10", condition: () => playerLevel >= 10 },
    { id: "player_100", name: "Hero's Rise II", description: "Reach player level 100", condition: () => playerLevel >= 100 },
    { id: "player_1000", name: "Hero's Rise III", description: "Reach player level 1000", condition: () => playerLevel >= 1000 },
    { id: "gear_10", name: "Gear Up I", description: "Upgrade gear to level 10", condition: () => playerGearLevel >= 10 },
    { id: "gear_50", name: "Gear Up II", description: "Upgrade gear to level 50", condition: () => playerGearLevel >= 50 },
    { id: "gear_100", name: "Gear Up III", description: "Upgrade gear to level 100", condition: () => playerGearLevel >= 100 },
    { id: "click_100", name: "Clicker I", description: "Click 100 times", condition: () => totalClicks >= 100 },
    { id: "click_1000", name: "Clicker II", description: "Click 1,000 times", condition: () => totalClicks >= 1000 },
    { id: "click_10000", name: "Clicker III", description: "Click 10,000 times", condition: () => totalClicks >= 10000 },
    { id: "enemy_10", name: "Vanquisher I", description: "Defeat 10 enemies", condition: () => enemiesDefeated >= 10 },
    { id: "enemy_1000", name: "Vanquisher II", description: "Defeat 1000 enemies", condition: () => enemiesDefeated >= 1000 },
    { id: "enemy_10000", name: "Vanquisher III", description: "Defeat 10,000 enemies", condition: () => enemiesDefeated >= 10000 },
    { id: "level_10", name: "Explorer I", description: "Reach level 10", condition: () => currentLevel >= 10 },
    { id: "level_300", name: "Explorer II", description: "Reach level 300", condition: () => currentLevel >= 300 },
    { id: "level_1000", name: "Explorer III", description: "Reach level 1000", condition: () => currentLevel >= 1000 },
    { id: "merc_1", name: "First Hire", description: "Hire your first mercenary", condition: () => hiredMercenaries.length >= 1 },
    { id: "merc_10", name: "Mercenary Captain", description: "Hire 10 mercenaries", condition: () => hiredMercenaries.length >= 10 },
    { id: "merc_50", name: "Mercenary Commander", description: "Hire 50 mercenaries", condition: () => hiredMercenaries.length >= 50 },
    { id: "merc_100", name: "Mercenary Overlord", description: "Hire 100 mercenaries", condition: () => hiredMercenaries.length >= 100 },
    { id: "merc_level_10", name: "Veteran Fighter", description: "Level a mercenary to 10", condition: () => hiredMercenaries.some(m => m.level >= 10) },
    { id: "merc_level_50", name: "Elite Warrior", description: "Level a mercenary to 50", condition: () => hiredMercenaries.some(m => m.level >= 50) },
    { id: "gear_5", name: "Sharpened Blades", description: "Upgrade any mercenary's gear to level 5", condition: () => hiredMercenaries.some(m => m.gearLevel >= 5) },
    { id: "gear_20", name: "Forgemaster", description: "Upgrade any mercenary's gear to level 20", condition: () => hiredMercenaries.some(m => m.gearLevel >= 20) },
    { id: "gear_50", name: "Legendary Smith", description: "Upgrade any mercenary's gear to level 50", condition: () => hiredMercenaries.some(m => m.gearLevel >= 50) },
    { id: "guild_1", name: "Bar Tender", description: "Upgrade the Tavern to level 1", condition: () => structures.tavern.level >= 1 },
    { id: "guild_10", name: "Bar Keeper", description: "Upgrade the Tavern to level 10", condition: () => structures.tavern.level >= 10 },
    { id: "guild_100", name: "Tavern Owner", description: "Upgrade the Tavern to level 100", condition: () => structures.tavern.level >= 100 },
    { id: "speed_5", name: "Swift Strike I", description: "Upgrade a mercenary's attack speed to level 5", condition: () => hiredMercenaries.some(m => m.attackSpeedLevel >= 5) },
    { id: "speed_20", name: "Swift Strike II", description: "Upgrade a mercenary's attack speed to level 20", condition: () => hiredMercenaries.some(m => m.attackSpeedLevel >= 20) },
    { id: "speed_50", name: "Swift Strike III", description: "Upgrade a mercenary's attack speed to level 50", condition: () => hiredMercenaries.some(m => m.attackSpeedLevel >= 50) },
    { id: "ability_strong", name: "Strong Hero", description: "Unlock Strong Attack ability", condition: () => abilitiesUsed.includes("Strong Attack") },
    { id: "ability_rally", name: "Rallying Cry", description: "Unlock Rally ability", condition: () => abilitiesUsed.includes("Rally") },
    { id: "ability_double", name: "Double Trouble", description: "Unlock Double Attack ability", condition: () => abilitiesUsed.includes("Double Attack") },
    { id: "ability_rage", name: "Raging Fury", description: "Unlock Rage ability", condition: () => abilitiesUsed.includes("Rage") },
    { id: "ability_count_10", name: "Ability Master I", description: "Use abilities 10 times", condition: () => abilitiesCount >= 10 },
    { id: "ability_count_100", name: "Ability Master II", description: "Use abilities 100 times", condition: () => abilitiesCount >= 100 },
    { id: "ability_count_1000", name: "Ability Master III", description: "Use abilities 1000 times", condition: () => abilitiesCount >= 1000 }
];



let unlockedAchievements = new Set(); // Use localStorage to persist

const enemyNames = ["Slime", "ByteBat", "Goblink", "Rasteroid", "HexWorm", "Pixel Fiend", "Bugbear", "NullKnight", "Cryptoad", "8-Bit Dragon"];
const levelThemes = [
    { palette: ["#00f", "#0ff", "#88f"], name: "Frozen Sector" },
    { palette: ["#0f0", "#4f4", "#8f8"], name: "Jungle Grid" },
    { palette: ["#f00", "#800", "#faa"], name: "Flame Domain" },
    { palette: ["#ff0", "#880", "#ffa"], name: "Solar Core" },
    { palette: ["#fff", "#aaa", "#ddd"], name: "Glitch Field" }
];

const mercenaryNames = ["Thud", "Zara", "Clank", "Vex", "Snip"];

function generateName() {
    const starts = ["Al", "Ka", "Th", "Ma", "El", "Bry", "Li", "Ro", "Ny", "So"];
    const middles = ["a", "e", "o", "i", "y", "ae"];
    const ends = ["n", "ric", "ra", "el", "ra", "in", "a", "ar", "or", "is"];

    let name = "";
    while (name.length === 0 || name.length > 6) {
        const s = starts[Math.floor(Math.random() * starts.length)];
        const m = middles[Math.floor(Math.random() * middles.length)];
        const e = ends[Math.floor(Math.random() * ends.length)];
        name = s + m + e;
    }

    return name.charAt(0).toUpperCase() + name.slice(1);
}

// === DOM Elements ===
const goldText = document.getElementById("gold");
const damageText = document.getElementById("damage");
const autoClickerCountText = document.getElementById("auto-clicker-count");
const autoClickerCostText = document.getElementById("auto-clicker-cost");
const guildLevelText = document.getElementById("guild-level");
const mercenaryList = document.getElementById("mercenary-shop");
const healthFill = document.getElementById("health-fill");
const enemyNameText = document.createElement("p");
const enemyLevelText = document.getElementById("enemy-level");
const guildCostText = document.getElementById("guild-cost");
const playerNameText = document.getElementById("player-name");
const nameInput = document.getElementById("player-name");
const statusSpan = document.getElementById("name-status");
const nameConfirmButton = document.getElementById("confirm-button");
const messageBody = document.getElementById("message-body");
const messageStatusSpan = document.getElementById("msg-status");
document.getElementById("enemy-box").appendChild(enemyNameText);
const scientificCheckbox = document.getElementById("use-scientific");
const underfillCheckbox = document.getElementById("underfill-toggle");

// === Hero Abilities ===
const abilities = [
    { name: "Strong Attack", cooldown: 30000, duration: 0, unlockLevel: 5, description: "Deal five times hero click damage once." },
    { name: "Rally", cooldown: 60000, duration: 30000, unlockLevel: 10, description: "Increase attack damage for all mercenaries." },
    { name: "Gold Rush", cooldown: 60000, duration: 30000, unlockLevel: 12, description: "Double gold gained from defeated enemies." },
    { name: "Double Attack", cooldown: 60000, duration: 0, unlockLevel: 15, description: "Attack twice in one click." },
    { name: "Rage", cooldown: 60000, duration: 30000, unlockLevel: 20, description: "Enter a rage state, dealing constant damage." }
];

const passiveAbilities = [
    { name: "Leadership", description: "Increases mercenary level cap.", level: 1, maxLevel: 10, unlockLevel: 10, castleLevel: 1, cost: 1000 },
    { name: "Royal Guard", description: "+4% hero click damage per purchased level.", level: 1, maxLevel: 8, unlockLevel: 20, castleLevel: 2, cost: 1500 },
    { name: "Crown Steward", description: "+3% gold from defeated enemies per purchased level.", level: 1, maxLevel: 8, unlockLevel: 40, castleLevel: 3, cost: 2000 }
];

let marketUpgrades = {
    mkt1: { name: "Treasure Hunter", description: "Increases gold gained from enemies.", cost: 1000, level: 0, maxLevel: 10, unlockLevel: 1 }, // 10% per level
    mkt2: { name: "Bargain Hunter", description: "Reduces upgrade costs.", cost: 500, level: 0, maxLevel: 10, unlockLevel: 1 }, // 5% per level
    mkt3: { name: "Blacksmith's Touch", description: "Adds 5% mercenary DPS per level.", cost: 2000, level: 0, maxLevel: 10, unlockLevel: 5 }, // 10% per level
    mkt4: { name: "Better Bunks", description: "Adds 5% mercenary DPS per level.", cost: 1500, level: 0, maxLevel: 10, unlockLevel: 5 }, // 5% per level
    mkt5: { name: "Offline Gold", description: "Increases gold earned while offline.", cost: 3000, level: 0, maxLevel: 10, unlockLevel: 3 },
    mkt6: { name: "Bounty Contracts", description: "+10% boss gold per level.", cost: 1700, level: 0, maxLevel: 10, unlockLevel: 3 },
    mkt7: { name: "Caravan Logistics", description: "+6% normal-enemy gold per level.", cost: 2500, level: 0, maxLevel: 10, unlockLevel: 4 },
    mkt8: { name: "War Supplies", description: "+4% mercenary DPS per level.", cost: 3400, level: 0, maxLevel: 10, unlockLevel: 5 },
};

const marketUpgradeEquation = [
    (level) => Math.pow(1.15, level), // Treasure Hunter
    (level) => Math.pow(0.92, level), // Bargain Hunter
    (level) => Math.pow(1.05, level), // Blacksmith's Touch
    (level) => Math.pow(1.05, level), // Better Bunks
    (level) => Math.pow(1.05, level), // Offline Gold
    (level) => Math.pow(1.10, level), // Bounty Contracts
    (level) => Math.pow(1.06, level), // Caravan Logistics
    (level) => Math.pow(1.04, level) // War Supplies
]

let abilityStates = {};
let rallyActive = false;
let doubleAttackReady = false;
let rageInterval = null;
let goldRushActive = false;
let goldRushInterval = null;

abilities.forEach(ability => {
    const btn = document.getElementById(ability.name.toLowerCase().replace(/ /g, '-'));
    abilityStates[ability.name] = { cooldown: false, button: btn, unlocked: false };
    btn.onclick = () => {
        // console.log(`Activating ability: ${ability.name}`);
        if (abilityStates[ability.name].unlocked) activateAbility(ability);
    };
    btn.disabled = true;
    btn.classList.add("locked");
    btn.textContent = `${ability.name} (Unlocks at Lv ${ability.unlockLevel})`;
});

// === Level Controls ===
function goToNextLevel() {
    if (currentLevel < maxLevel) {
        currentLevel++;
        drawRandomEnemy();
        updateUI();
    }
}

function goToPrevLevel() {
    if (currentLevel > 1) {
        currentLevel--;
        drawRandomEnemy();
        updateUI();
    }
}

function mktUp(idx) {
    const key = Object.keys(marketUpgrades)[idx];
    if (!key || !marketUpgradeEquation[idx]) return 1;
    return marketUpgradeEquation[idx](marketUpgrades[key].level);
}

// Idle earnings are capped to protect against huge stale timestamps and runaway saves.
// This is intentionally a quarter of live DPS, consistent with previous offline rewards.
function awardOfflineGold(seconds) {
    if (!Number.isFinite(seconds) || seconds < 2) return 0;
    const effectiveSeconds = Math.min(seconds, 24 * 60 * 60);
    const reward = Math.floor(effectiveSeconds * getAutoDamage() * 0.25 * mktUp(4) * (1 + getResearchBonus("offlineGold")));
    if (reward > 0 && Number.isFinite(reward)) {
        gold += reward;
        showPopupMessage(`Offline earnings: ${formatDigits(reward, 2, 0)} gold`, false, 3500);
        return reward;
    }
    return 0;
}

function saveGame() {
    submitScore();
    const saveData = {
        gold,
        playerLevel,
        playerGearLevel,
        playerUpgradeCost,
        playerGearCost,
        nextPlayerGearLevelReq,
        currentLevel,
        maxLevel,
        baseEnemyHealth,
        // guildLevel,
        // maxMercenaries,
        hiredMercenaries,
        squadBuilds,
        researchState,
        nameConfirm,
        playerName,
        lastSubmittedScore,
        totalClicks,
        enemiesDefeated,
        abilitiesUsed, // convert Set to Array
        abilitiesCount,
        structures,
        marketUpgrades,
        passiveAbilities,
        unlockedAchievements: Array.from(unlockedAchievements), // convert Set to Array
        lastSaved: Date.now(),
        scientificNotation,
        autoAdvance,
        underfillEnabled
    };
    localStorage.setItem("clickerHeroSave", JSON.stringify(saveData));
}

function loadGame() {
    const saved = localStorage.getItem("clickerHeroSave");
    if (saved) {
        const data = JSON.parse(saved);

        stopSquadAttack();
        hiredMercenaries.length = 0;
        squadBuilds = data.squadBuilds && typeof data.squadBuilds === "object" && !Array.isArray(data.squadBuilds) ? data.squadBuilds : {};
        researchState = {};
        if (data.researchState && typeof data.researchState === "object") {
            for (const node of RESEARCH_NODES) {
                if (data.researchState[node.id] === true) researchState[node.id] = true;
            }
        }
        if (Array.isArray(data.hiredMercenaries)) {
            data.hiredMercenaries.forEach((m, i) => {
                hiredMercenaries.push(m);
                // startMercAttack(i);
                // Check to see is mercenary has a squad, if not assign one
                if (!m.squad) {
                    m.squad = Math.ceil((hiredMercenaries.length) / 5); // Assign squad based on current length
                }
            });
        }

        // Restore progression before restarting the single combat timer.
        // restore everything else...
        gold = data.gold ?? 0;
        playerLevel = data.playerLevel ?? 1;
        playerGearLevel = data.playerGearLevel ?? 0;
        playerUpgradeCost = data.playerUpgradeCost ?? 10;
        playerGearCost = data.playerGearCost ?? 100;
        nextPlayerGearLevelReq = data.nextPlayerGearLevelReq ?? 10;
        currentLevel = data.currentLevel ?? 1;
        maxLevel = data.maxLevel ?? currentLevel;
        lastSubmittedScore = data.lastSubmittedScore ?? maxLevel;
        baseEnemyHealth = data.baseEnemyHealth ?? 5;
        // guildLevel = data.guildLevel ?? 0;
        // maxMercenaries = data.maxMercenaries ?? 5;
        nameConfirm = data.nameConfirm ?? false;
        playerName = data.playerName || "Unnamed Hero";
        totalClicks = data.totalClicks || 0; // restore total clicks for achievements
        enemiesDefeated = data.enemiesDefeated || 0; // restore defeated enemies for achievement
        abilitiesUsed = data.abilitiesUsed || []; // restore used abilities
        abilitiesCount = data.abilitiesCount || 0; // restore ability usage count
        unlockedAchievements = new Set(data.unlockedAchievements || []); // restore achievements
        scientificNotation = data.scientificNotation ?? false;
        autoAdvance = data.autoAdvance ?? autoAdvance;
        underfillEnabled = data.underfillEnabled ?? false;
        autoNextToggle.checked = autoAdvance;
        scientificCheckbox.checked = scientificNotation;
        underfillCheckbox.checked = underfillEnabled; // restore scientific notation preference
        // Transfer purchased levels onto the current definitions; don't discard
        // new upgrades when loading a save from an earlier release.
        if (data.structures && typeof data.structures === "object") {
            for (const [key, definition] of Object.entries(structures)) {
                const previous = data.structures[key];
                if (previous && Number.isFinite(previous.level)) {
                    definition.level = Math.max(key === "castle" ? 1 : 0, Math.floor(previous.level));
                }
            }
        }
        if (data.marketUpgrades && typeof data.marketUpgrades === "object") {
            for (const [key, definition] of Object.entries(marketUpgrades)) {
                const previous = data.marketUpgrades[key];
                if (previous && Number.isFinite(previous.level)) {
                    definition.level = Math.max(0, Math.min(definition.maxLevel, Math.floor(previous.level)));
                }
            }
        }
        if (data.passiveAbilities) {
            Object.keys(data.passiveAbilities).forEach((key) => {
                const ability = data.passiveAbilities[key];
                if (passiveAbilities[key] && Number.isFinite(ability.level)) {
                    passiveAbilities[key].level = Math.max(1, Math.min(passiveAbilities[key].maxLevel, Math.floor(ability.level)));
                }
            });
        }
        // console.log(marketUpgrades);
        // Restore equation for market upgrades

        // Old save files used a timestamp 60 seconds in the future; a negative
        // elapsed time simply means no offline reward yet.
        if (typeof data.lastSaved === "number") {
            awardOfflineGold(Math.max(0, (Date.now() - data.lastSaved) / 1000));
        }

        if (nameConfirm) {
            disableNameInput();
        }
        // console.log("Game loaded:", data);
        playerNameText.textContent = playerName;
        drawRandomEnemy();
        updateUI();
        updateStructureUI();
        startSquadAttack();
        saveGame();
        if (typeof resetArmySelection === "function") resetArmySelection();
    }
}

function exportGame() {
    const saveData = localStorage.getItem("clickerHeroSave");
    if (saveData) {
        const encoded = btoa(unescape(encodeURIComponent(saveData))); // base64 encode
        const blob = new Blob([encoded], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "clicker_hero_save.chs"; // use custom extension
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
    } else {
        alert("No save data found to export.");
    }
}

function importGame() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".chs,.txt"; // custom extension
    input.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const decoded = decodeURIComponent(escape(atob(event.target.result)));
                    const data = JSON.parse(decoded);

                    // Simple structure check (can add more)
                    if (!data || typeof data !== "object" || !("gold" in data && "playerLevel" in data)) {
                        throw new Error("Invalid save structure");
                    }

                    localStorage.setItem("clickerHeroSave", JSON.stringify(data));
                    loadGame();
                    updateUI();
                    updatePlayerLevelGearText();
                    updateStructureUI();
                    drawKingdom();
                    alert("Game imported successfully!");
                } catch (error) {
                    console.error("Failed to import game:", error);
                    alert("Invalid or corrupted save file.");
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function setUpgradeMultiplier(menu, x) {
    upgradeMultiplier = x;
    menu.querySelectorAll('.upgrade-multiplier button').forEach(btn => {
        btn.classList.remove('active');
    });
    const btn = Array.from(menu.querySelectorAll('.upgrade-multiplier button'))
        .find(b => b.textContent.trim() === `×${x}`);
    if (btn) btn.classList.add('active');
    updateUI();
    updatePlayerLevelGearText();
}

// Mobile browsers may throttle background tabs; stop combat completely while hidden.
let hiddenAt = null;
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        hiddenAt = Date.now();
        stopSquadAttack();
        saveGame();
    } else {
        if (hiddenAt !== null) {
            awardOfflineGold((Date.now() - hiddenAt) / 1000);
            hiddenAt = null;
            updateUI();
            saveGame();
        }
        startSquadAttack();
    }
});
window.addEventListener("pagehide", () => saveGame());

// === Init ===
enemyCanvas.onclick = () => attack(false);
kingdomCanvas.onclick = (event) => checkClickLocation(event);
const autoNextToggle = document.getElementById("auto-next-toggle");
autoAdvance = autoNextToggle.checked; // ensure variable matches UI
scientificNotation = scientificCheckbox.checked; // ensure variable matches UI
autoNextToggle.onchange = e => autoAdvance = e.target.checked;
scientificCheckbox.onchange = e => scientificNotation = e.target.checked;
scientificCheckbox.addEventListener("change", () => {updateUI();});
underfillEnabled = underfillCheckbox.checked; // ensure variable matches UI
underfillCheckbox.onchange = e => underfillEnabled = e.target.checked;

window.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("clickerHeroSave")) {
        loadGame();
    } else {
        drawRandomEnemy(); // fresh start
        updateUI();
    }
    updatePlayerLevelGearText();
    updateStructureUI();
    drawKingdom();
    setUpgradeMultiplier(document.getElementById("shop"), upgradeMultiplier);
});

setInterval(() => {
    if (document.hidden) return;
    saveGame();
    showAutosaveIndicator();
}, 60000); // once per minute, and only in the foreground