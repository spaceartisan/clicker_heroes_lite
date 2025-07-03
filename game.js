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

let maxMercenaries = 5;
let guildLevel = 1;

let playerName = "Unnamed Hero"; // Default name
let nameConfirm = false;

const hiredMercenaries = [];
const mercAttackInterval = [];

let messageInterval = null;
let leaderboardUnsub = null;
let messageUnsub = null;

const enemyCanvas = document.getElementById("enemy-canvas");
const ctx = enemyCanvas.getContext("2d");

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

// === Hero Abilities ===
const abilities = [
    { name: "Strong Attack", cooldown: 30000, duration: 0, unlockLevel: 5 },
    { name: "Rally", cooldown: 60000, duration: 30000, unlockLevel: 10 },
    { name: "Double Attack", cooldown: 60000, duration: 0, unlockLevel: 15 },
    { name: "Rage", cooldown: 60000, duration: 30000, unlockLevel: 20 }
];

let abilityStates = {};
let rallyActive = false;
let doubleAttackReady = false;
let rageInterval = null;

abilities.forEach(ability => {
    const btn = document.getElementById(ability.name.toLowerCase().replace(/ /g, '-'));
    abilityStates[ability.name] = { cooldown: false, button: btn, unlocked: false };
    btn.onclick = () => {
        if (abilityStates[ability.name].unlocked) activateAbility(ability);
    };
    btn.disabled = true;
    btn.classList.add("locked");
    btn.textContent = `${ability.name} (Unlocks at Lv ${ability.unlockLevel})`;
});

enemyCanvas.onclick = attack;

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
        guildLevel,
        maxMercenaries,
        hiredMercenaries,
        nameConfirm,
        playerName,
        lastSubmittedScore,
        lastSaved: Date.now() // <--- new

    };
    localStorage.setItem("clickerHeroSave", JSON.stringify(saveData));
}

function loadGame() {
    const saved = localStorage.getItem("clickerHeroSave");
    if (saved) {
        const data = JSON.parse(saved);

        hiredMercenaries.length = 0;
        if (Array.isArray(data.hiredMercenaries)) {
            data.hiredMercenaries.forEach((m, i) => {
                hiredMercenaries.push(m);
                startMercAttack(i);
            });
        }

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
        guildLevel = data.guildLevel ?? 0;
        maxMercenaries = data.maxMercenaries ?? 5;
        nameConfirm = data.nameConfirm ?? false;
        playerName = data.playerName || "Unnamed Hero";

        // Offline gold calc
        if (data.lastSaved) {
            const now = Date.now();
            const diffSeconds = Math.floor((now - data.lastSaved) / 1000);
            const goldPerSecond = getTotalAutoDamage(); // simple estimate
            const offlineGold = diffSeconds * goldPerSecond * 0.25; // 25% efficiency while offline

            console.log(`Offline gold earned: ${offlineGold} (calculated over ${diffSeconds} seconds) for ${goldPerSecond} gold/sec`);

            if (offlineGold > 0) {
                gold += offlineGold;
                alert(`While you were away, your mercenaries earned ${offlineGold} gold!`);
            }
        }

        if (nameConfirm) {
            disableNameInput();
        }
        console.log("Game loaded:", data);
        playerNameText.textContent = playerName;
        drawRandomEnemy();
        updateUI();
        updateMercenaryText();
        saveGame();
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

// === Init ===
const autoNextToggle = document.getElementById("auto-next-toggle");
autoAdvance = autoNextToggle.checked; // ensure variable matches UI
document.getElementById("auto-next-toggle").onchange = e => autoAdvance = e.target.checked;

window.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("clickerHeroSave")) {
        loadGame();
    } else {
        drawRandomEnemy(); // fresh start
        updateUI();
    }
    updatePlayerLevelGearText();
});

setInterval(() => {
    saveGame();
    showAutosaveIndicator();
}, 60000); // every 60 seconds