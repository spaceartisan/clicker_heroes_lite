let currentLevel = 1;
let highestLevel = 1;

let baseHealth = 5;
let enemyHealth = getHealthForLevel(currentLevel);
let enemyMaxHealth = enemyHealth;

let gold = 0;
let clickDamage = 1;
let autoClickerCount = 0;
let autoClickerCost = 50;

let clickUpgradeLevel = 0;
let clickUpgradeCost = 10;

const mercenaryNames = ["Thud", "Zara", "Clank", "Vex", "Snip"];
let hiredMercenaries = [];

const enemyNames = [
  "Slime", "ByteBat", "Goblink", "Rasteroid", "HexWorm", "Pixel Fiend",
  "Bugbear", "NullKnight", "Cryptoad", "8-Bit Dragon"
];

const levelThemes = [
  { palette: ["#00f", "#0ff", "#88f"], name: "Frozen Sector" },
  { palette: ["#0f0", "#4f4", "#8f8"], name: "Jungle Grid" },
  { palette: ["#f00", "#800", "#faa"], name: "Flame Domain" },
  { palette: ["#ff0", "#880", "#ffa"], name: "Solar Core" },
  { palette: ["#fff", "#aaa", "#ddd"], name: "Glitch Field" }
];

// DOM
const canvas = document.getElementById('enemy-canvas');
const ctx = canvas.getContext('2d');
const enemyHealthBar = document.getElementById('health-fill');
const enemyLevelText = document.getElementById('enemy-level');
const goldText = document.getElementById('gold');
const damageText = document.getElementById('damage');
const clickUpgradeCostText = document.getElementById('click-upgrade-cost');
const autoClickerCostText = document.getElementById('auto-clicker-cost');
const autoClickerCountText = document.getElementById('auto-clicker-count');
const autoNextToggle = document.getElementById('auto-next-toggle');
const damageOverlay = document.getElementById('damage-overlay');

// Dynamic DOM elements
const enemyNameText = document.createElement("p");
document.getElementById("enemy-box").appendChild(enemyNameText);

const mercenaryText = document.createElement("p");
mercenaryText.textContent = "Mercenaries:";
document.getElementById("mercenary-shop").appendChild(mercenaryText);

function getHealthForLevel(lvl) {
  return Math.floor(baseHealth * Math.pow(1.3, lvl - 1)) + lvl * 5;
}

function updateUI() {
  goldText.textContent = gold;
  damageText.textContent = `Click: ${clickDamage}, Auto: ${getAutoDamage()}`;
  clickUpgradeCostText.textContent = clickUpgradeCost;
  autoClickerCostText.textContent = autoClickerCost;
  autoClickerCountText.textContent = autoClickerCount;
  enemyLevelText.textContent = `Level: ${currentLevel}`;
  enemyHealthBar.style.width = `${Math.max(0, enemyHealth / enemyMaxHealth) * 100}%`;
}

function getAutoDamage() {
  return hiredMercenaries.reduce((sum, m) => {
    return sum + m.level * (2 ** m.gearLevel);
  }, 0);
}


function attack() {
  showDamage(clickDamage);
  enemyHealth -= clickDamage;
  if (enemyHealth <= 0) handleEnemyDefeat();
  updateUI();
}

function handleEnemyDefeat() {
  gold += 5 * currentLevel;
  if (currentLevel === highestLevel) highestLevel++;
  if (autoNextToggle.checked && currentLevel < highestLevel) currentLevel++;
  enemyMaxHealth = getHealthForLevel(currentLevel);
  enemyHealth = enemyMaxHealth;
  drawRandomEnemy();
}

function buyClickUpgrade() {
  if (gold >= clickUpgradeCost) {
    gold -= clickUpgradeCost;
    clickUpgradeLevel++;
    clickDamage = Math.floor(1 * Math.pow(2, clickUpgradeLevel));
    clickUpgradeCost = Math.floor(clickUpgradeCost * 2.5);
    updateUI();
  }
}

function hireMercenary() {
  if (gold >= autoClickerCost && hiredMercenaries.length < 5) {
    gold -= autoClickerCost;
    const name = mercenaryNames[hiredMercenaries.length % mercenaryNames.length];
    hiredMercenaries.push({
        name,
        level: 1,
        upgradeCost: 30,
        gearLevel: 0,
        gearCost: 100,
        nextGearLevelReq: 10
    });

    autoClickerCount++;
    autoClickerCost = Math.floor(autoClickerCost * 1.5);
    updateMercenaryText();
    updateUI();
  }
}

function levelUpMercenaries() {
  hiredMercenaries.forEach(m => m.level++);
  updateMercenaryText();
}

function updateMercenaryText() {
  const shopDiv = document.getElementById("mercenary-shop");

  // Remove old rows (except first 3 static ones)
  [...shopDiv.querySelectorAll(".merc-row")].forEach(e => e.remove());

  if (hiredMercenaries.length === 0) {
    const p = document.createElement("p");
    p.className = "merc-row";
    p.textContent = "Mercenaries: None";
    shopDiv.appendChild(p);
    return;
  }

  hiredMercenaries.forEach((merc, i) => {
    const row = document.createElement("div");
    row.className = "merc-row";

    const label = document.createElement("span");
    label.textContent = `${merc.name} (Lv${merc.level}, Gear x${2 ** merc.gearLevel})`;

    const lvlBtn = document.createElement("button");
    lvlBtn.textContent = `Level Up (${merc.upgradeCost}g)`;
    lvlBtn.onclick = () => upgradeMercenary(i);

    row.appendChild(label);
    row.appendChild(lvlBtn);

    // Gear button
    if (merc.level >= merc.nextGearLevelReq) {
    const gearBtn = document.createElement("button");
    gearBtn.textContent = `Upgrade Gear (${merc.gearCost}g)`;
    gearBtn.onclick = () => upgradeMercGear(i);
    row.appendChild(gearBtn);
    } else {
    const gearNote = document.createElement("span");
    gearNote.textContent = ` (Gear unlocks at Lv${merc.nextGearLevelReq})`;
    row.appendChild(gearNote);
    }

    shopDiv.appendChild(row);

  });
}

function showDamage(amount) {
  const dmg = document.createElement("div");
  dmg.className = "floating-damage";
  dmg.textContent = `-${amount}`;
  dmg.style.left = `${Math.random() * 80 + 10}px`;
  dmg.style.top = `50%`;
  damageOverlay.appendChild(dmg);
  setTimeout(() => dmg.remove(), 1000);
}

function getRandomColor(palette) {
  return palette[Math.floor(Math.random() * palette.length)];
}

function drawRandomEnemy() {
  const gridSize = 10;
  const cellSize = canvas.width / gridSize;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  const theme = levelThemes[(currentLevel - 1) % levelThemes.length];
  const palette = theme.palette;

  const pixels = [];
  for (let y = 0; y < gridSize; y++) {
    const row = [];
    for (let x = 0; x < gridSize / 2; x++) {
      row[x] = Math.random() < 0.5 ? getRandomColor(palette) : null;
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

}

function upgradeMercenary(index) {
  const merc = hiredMercenaries[index];
  if (gold >= merc.upgradeCost) {
    gold -= merc.upgradeCost;
    merc.level++;
    merc.upgradeCost = Math.floor(merc.upgradeCost * 1.5);
    updateMercenaryText();
    updateUI();
  }
}

function upgradeMercGear(index) {
  const merc = hiredMercenaries[index];
  if (merc.level >= merc.nextGearLevelReq && gold >= merc.gearCost) {
    gold -= merc.gearCost;
    merc.gearLevel++;
    merc.gearCost = Math.floor(merc.gearCost * 2);
    merc.nextGearLevelReq += 40; // 10 → 50 → 90 → ...
    updateUI();
    updateMercenaryText();
  }
}


canvas.onclick = attack;

setInterval(() => {
  const dmg = getAutoDamage();
  if (dmg > 0) {
    showDamage(dmg);
    enemyHealth -= dmg;
    if (enemyHealth <= 0) handleEnemyDefeat();
    updateUI();
  }
}, 1000);

drawRandomEnemy();
updateUI();
