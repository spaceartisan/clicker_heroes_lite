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
let baseEnemyHealth = 5;
let enemyHealth = baseEnemyHealth;
let autoAdvance = true;

const hiredMercenaries = [];

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

// === DOM Elements ===
const goldText = document.getElementById("gold");
const damageText = document.getElementById("damage");
const autoClickerCountText = document.getElementById("auto-clicker-count");
const autoClickerCostText = document.getElementById("auto-clicker-cost");
const mercenaryList = document.getElementById("mercenary-shop");
const healthFill = document.getElementById("health-fill");
const enemyNameText = document.createElement("p");
const enemyLevelText = document.getElementById("enemy-level");
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

// === Click Mechanics ===
enemyCanvas.onclick = attack;

function attack() {
  let dmg = playerClickDamage;
  if (doubleAttackReady) {
    dmg *= 2;
    doubleAttackReady = false;
  }
  showDamage(dmg);
  enemyHealth -= dmg;
  if (enemyHealth <= 0) handleEnemyDefeat();
  updateUI();
}

function showDamage(dmg) {
  const text = document.createElement("div");
  text.className = "floating-damage";
  text.textContent = dmg;
  const overlay = document.getElementById("damage-overlay");
  overlay.appendChild(text);
  setTimeout(() => overlay.removeChild(text), 1000);
}

// === Enemy ===
function drawRandomEnemy() {
  const gridSize = 10;
  const cellSize = enemyCanvas.width / gridSize;
  const themeIndex = Math.floor((currentLevel - 1) / 5) % levelThemes.length;
  const theme = levelThemes[themeIndex];
  const palette = theme.palette;
  const pixels = [];

  ctx.clearRect(0, 0, enemyCanvas.width, enemyCanvas.height);

  for (let y = 0; y < gridSize; y++) {
    const row = [];
    for (let x = 0; x < gridSize / 2; x++) {
      row[x] = Math.random() < 0.5 ? palette[Math.floor(Math.random() * palette.length)] : null;
    }
    pixels.push(row.concat([...row].reverse()));
  }

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const color = pixels[y][x];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  const name = enemyNames[(currentLevel - 1) % enemyNames.length];
  enemyNameText.textContent = `${name} of the ${theme.name}`;
  enemyHealth = getEnemyHealth();
  enemyLevelText.textContent = `Level: ${currentLevel}`;
}

// === Enemy Logic ===
function handleEnemyDefeat() {
  gold += Math.floor(currentLevel * 2);
  if (currentLevel == maxLevel) maxLevel++
  if (autoAdvance) currentLevel++;
  drawRandomEnemy();
}

// === Damage and UI ===
function getPlayerClickDamage() {
  return playerLevel * (2 ** playerGearLevel);
}

function getEnemyHealth() {
  return Math.floor(baseEnemyHealth + currentLevel * 5);
}

function getAutoDamage() {
  return hiredMercenaries.reduce((sum, m) => {
    let base = m.level * (2 ** m.gearLevel);
    if (rallyActive) base *= 2;
    return sum + base;
  }, 0);
}

function updateUI() {
  goldText.textContent = gold;
  playerClickDamage = getPlayerClickDamage();
  damageText.textContent = `Click: ${playerClickDamage}, Auto: ${getAutoDamage()}`;
  healthFill.style.width = `${(enemyHealth / getEnemyHealth()) * 100}%`;
  updatePlayerText();
}

// === Player Upgrade ===
function updatePlayerText() {
  abilities.forEach(ability => {
    const state = abilityStates[ability.name];
    if (!state.unlocked && playerLevel >= ability.unlockLevel) {
      state.unlocked = true;
      const btn = state.button;
      btn.disabled = false;
      btn.classList.remove("locked");
      btn.textContent = ability.name;
    }
  });
}

function updatePlayerLevelGearText() {
  const shop = document.getElementById("shop");
  shop.innerHTML = `
    <h3>Hero Upgrades</h3>
    <button onclick="levelUpPlayer()">Level Up (${playerUpgradeCost}g)</button>
    <button ${playerLevel < nextPlayerGearLevelReq ? 'disabled' : ''} onclick="gearUpPlayer()">Upgrade Gear (${playerGearCost}g)</button>
    <p>Player Lv: ${playerLevel}, Gear x${2 ** playerGearLevel}</p>
  `;
}

function levelUpPlayer() {
  if (gold >= playerUpgradeCost) {
    gold -= playerUpgradeCost;
    playerLevel++;
    playerUpgradeCost = Math.floor(10 + playerLevel ** 1.5);
    updateUI();
    updatePlayerLevelGearText()
  }
}

function gearUpPlayer() {
  if (gold >= playerGearCost && playerLevel >= nextPlayerGearLevelReq) {
    gold -= playerGearCost;
    playerGearLevel++;
    playerGearCost = Math.floor(playerGearCost * 2);
    nextPlayerGearLevelReq += 40;
    updateUI();
    updatePlayerLevelGearText()
  }
}

// === Mercenaries ===
function hireMercenary() {
  const cost = parseInt(autoClickerCostText.textContent);
  if (gold >= cost && hiredMercenaries.length < 5) {
    gold -= cost;
    const name = mercenaryNames[hiredMercenaries.length % mercenaryNames.length];
    hiredMercenaries.push({
      name,
      level: 1,
      gearLevel: 0,
      gearCost: 100,
      nextGearLevelReq: 10,
      attackSpeedLevel: 1,
      attackSpeedCost: 100
    });
    autoClickerCostText.textContent = Math.floor(cost * 1.5);
    autoClickerCountText.textContent = hiredMercenaries.length;
    updateMercenaryText();
    updateUI();
    startMercAttack(hiredMercenaries.length - 1);
  }
}

function updateMercenaryText() {
  const mercRows = hiredMercenaries.map((m, i) => {
    const row = document.createElement("div");
    row.className = "merc-row";
    row.textContent = `${m.name} (Lv${m.level}) Gear x${2 ** m.gearLevel} Speed x${m.attackSpeedLevel}`;

    const lvlBtn = document.createElement("button");
    lvlBtn.textContent = `Lv Up (${m.upgradeCost || 20}g)`;
    lvlBtn.onclick = () => levelUpMercenary(i);
    row.appendChild(lvlBtn);

    if (m.level >= m.nextGearLevelReq) {
      const gearBtn = document.createElement("button");
      gearBtn.textContent = `Gear (${m.gearCost}g)`;
      gearBtn.onclick = () => upgradeMercGear(i);
      row.appendChild(gearBtn);
    }

    const speedBtn = document.createElement("button");
    speedBtn.textContent = `Speed (${m.attackSpeedCost}g)`;
    speedBtn.onclick = () => upgradeMercSpeed(i);
    row.appendChild(speedBtn);

    return row;
  });

  mercenaryList.querySelectorAll(".merc-row").forEach(el => el.remove());
  mercRows.forEach(row => mercenaryList.appendChild(row));
}

function levelUpMercenary(i) {
  const m = hiredMercenaries[i];
  const cost = m.upgradeCost || 20;
  if (gold >= cost) {
    gold -= cost;
    m.level++;
    m.upgradeCost = Math.floor(cost * 1.5);
    updateUI();
    updateMercenaryText();
  }
}

function upgradeMercGear(i) {
  const m = hiredMercenaries[i];
  if (gold >= m.gearCost) {
    gold -= m.gearCost;
    m.gearLevel++;
    m.gearCost = Math.floor(m.gearCost * 2);
    m.nextGearLevelReq += 40;
    updateUI();
    updateMercenaryText();
  }
}

function upgradeMercSpeed(i) {
  const m = hiredMercenaries[i];
  if (gold >= m.attackSpeedCost) {
    gold -= m.attackSpeedCost;
    m.attackSpeedLevel++;
    m.attackSpeedCost = Math.floor(m.attackSpeedCost * 2);
    startMercAttack(i)
    updateUI();
    updateMercenaryText();
  }
}

function startMercAttack(i) {
  const m = hiredMercenaries[i];
  setInterval(() => {
    const dmg = m.level * (2 ** m.gearLevel) * (rallyActive ? 2 : 1);
    enemyHealth -= dmg;
    showDamage(dmg);
    if (enemyHealth <= 0) handleEnemyDefeat();
    updateUI();
  }, 2000 / m.attackSpeedLevel);
}

// === Hero Abilities ===
function activateAbility(ability) {
  const state = abilityStates[ability.name];
  if (state.cooldown) return;

  const btn = state.button;
  btn.disabled = true;
  state.cooldown = true;

  if (ability.name === "Strong Attack") strongAttack();
  else if (ability.name === "Rally") {
    rallyActive = true;
    setTimeout(() => rallyActive = false, ability.duration);
  } else if (ability.name === "Double Attack") {
    doubleAttackReady = true;
  } else if (ability.name === "Rage") {
    rageInterval = setInterval(() => attack(), 500);
    setTimeout(() => clearInterval(rageInterval), ability.duration);
  }

  let timeLeft = ability.cooldown / 1000;
  btn.textContent = `${ability.name} (${timeLeft})`;
  const interval = setInterval(() => {
    timeLeft--;
    btn.textContent = `${ability.name} (${timeLeft})`;
    if (timeLeft <= 0) {
      clearInterval(interval);
      btn.textContent = ability.name;
      btn.disabled = false;
      state.cooldown = false;
    }
  }, 1000);
}

function strongAttack() {
  let dmg = playerClickDamage * 5;
  if (doubleAttackReady) {
    dmg *= 2;
    doubleAttackReady = false;
  }
  showDamage(dmg);
  enemyHealth -= dmg;
  if (enemyHealth <= 0) handleEnemyDefeat();
  updateUI();
}

// === Level Controls ===
function goToNextLevel() {
    if (currentLevel < maxLevel) 
    {
        currentLevel++;
        drawRandomEnemy();
    }
}

function goToPrevLevel() {
  if (currentLevel > 1) currentLevel--;
  drawRandomEnemy();
}

function saveGame() {
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
    hiredMercenaries,
    lastSaved: Date.now()  // <--- new
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
    // Offline gold calc
    if (data.lastSaved) {
      const now = Date.now();
      const diffSeconds = Math.floor((now - data.lastSaved) / 1000);
      const goldPerSecond = getTotalAutoDamage(); // simple estimate
      const offlineGold = diffSeconds * goldPerSecond;

      console.log(`Offline gold earned: ${offlineGold} (calculated over ${diffSeconds} seconds) for ${goldPerSecond} gold/sec`);

      if (offlineGold > 0) {
        gold += offlineGold;
        alert(`While you were away, your mercenaries earned ${offlineGold} gold!`);
      }
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
    baseEnemyHealth = data.baseEnemyHealth ?? 5;

    drawRandomEnemy();
    updateUI();
    updateMercenaryText();
  }
}

function getTotalAutoDamage() {
    console.log("Calculating total auto damage from mercenaries...");
  return hiredMercenaries.reduce((sum, m) => {
    const base = m.level * (2 ** m.gearLevel);
    const speed = m.attackSpeedLevel || 1;
    console.log(`Mercenary ${m.name} - Level: ${m.level}, Gear: ${m.gearLevel}, Speed: ${m.attackSpeedLevel}, Base Damage: ${base}`);
    return sum + (base * speed / 2); // assuming 2s base interval
  }, 0);
}

// === Init ===
document.getElementById("auto-next-toggle").onchange = e => autoAdvance = e.target.checked;

window.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("clickerHeroSave")) {
    loadGame();
  } else {
    drawRandomEnemy();  // fresh start
    updateUI();
  }
  updatePlayerLevelGearText();
});

setInterval(() => {
  saveGame();
}, 15000); // every 30 seconds

function deleteSave() {
  if (confirm("Are you sure you want to delete your save?")) {
    localStorage.removeItem("clickerHeroSave");
    alert("Save deleted.");
    location.reload();
  }
}