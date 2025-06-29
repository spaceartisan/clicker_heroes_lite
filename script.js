let currentLevel = 1;
let highestLevel = 1;

let baseHealth = 5;
let enemyHealth = getHealthForLevel(currentLevel);
let enemyMaxHealth = enemyHealth;

let gold = 0;

let clickDamage = 1;
let autoClickDamage = 1;

let clickUpgradeLevel = 0;
let autoClickUpgradeLevel = 0;

let clickUpgradeCost = 10;
let autoClickUpgradeCost = 20;

let autoClickerCount = 0;
let autoClickerCost = 50;

// DOM Elements
const enemy = document.getElementById('enemy');
const enemyHealthBar = document.getElementById('health-fill');
const enemyLevelText = document.getElementById('enemy-level');
const goldText = document.getElementById('gold');
const damageText = document.getElementById('damage');
const clickUpgradeCostText = document.getElementById('click-upgrade-cost');
const autoUpgradeCostText = document.getElementById('auto-upgrade-cost');
const autoClickerCostText = document.getElementById('auto-clicker-cost');
const autoClickerCountText = document.getElementById('auto-clicker-count');
const autoNextToggle = document.getElementById('auto-next-toggle');
const clickButton = document.getElementById('click-button');
const damageOverlay = document.getElementById('damage-overlay');

function getHealthForLevel(lvl) {
  return Math.floor(baseHealth * Math.pow(1.3, lvl - 1)) + lvl * 5;
}

function attack() {
  showDamage(clickDamage);
  enemyHealth -= clickDamage;
  if (enemyHealth <= 0) {
    handleEnemyDefeat();
  }
  updateUI();
}

function handleEnemyDefeat() {
  gold += 5 * currentLevel;
  if (currentLevel === highestLevel) highestLevel++;
  if (autoNextToggle.checked && currentLevel < highestLevel) currentLevel++;
  enemyMaxHealth = getHealthForLevel(currentLevel);
  enemyHealth = enemyMaxHealth;
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

function buyAutoClickUpgrade() {
  if (gold >= autoClickUpgradeCost) {
    gold -= autoClickUpgradeCost;
    autoClickUpgradeLevel++;
    autoClickDamage = Math.floor(1 * Math.pow(2, autoClickUpgradeLevel));
    autoClickUpgradeCost = Math.floor(autoClickUpgradeCost * 2.5);
    updateUI();
  }
}

function buyAutoClicker() {
  if (gold >= autoClickerCost) {
    gold -= autoClickerCost;
    autoClickerCount++;
    autoClickerCost = Math.floor(autoClickerCost * 1.5);
    updateUI();
  }
}

function goToNextLevel() {
  if (currentLevel < highestLevel) {
    currentLevel++;
    enemyMaxHealth = getHealthForLevel(currentLevel);
    enemyHealth = enemyMaxHealth;
    updateUI();
  }
}

function goToPrevLevel() {
  if (currentLevel > 1) {
    currentLevel--;
    enemyMaxHealth = getHealthForLevel(currentLevel);
    enemyHealth = enemyMaxHealth;
    updateUI();
  }
}

function updateUI() {
  goldText.textContent = gold;
  damageText.textContent = `Click: ${clickDamage}, Auto: ${autoClickDamage}`;
  clickUpgradeCostText.textContent = clickUpgradeCost;
  autoUpgradeCostText.textContent = autoClickUpgradeCost;
  autoClickerCostText.textContent = autoClickerCost;
  autoClickerCountText.textContent = autoClickerCount;
  enemyLevelText.textContent = `Level: ${currentLevel}`;
  let hpRatio = Math.max(0, enemyHealth) / enemyMaxHealth;
  enemyHealthBar.style.width = `${hpRatio * 100}%`;
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

enemy.onclick = attack;
clickButton.onclick = attack;

setInterval(() => {
  if (autoClickerCount > 0) {
    const totalDamage = autoClickerCount * autoClickDamage;
    showDamage(totalDamage);
    enemyHealth -= totalDamage;
    if (enemyHealth <= 0) handleEnemyDefeat();
    updateUI();
  }
}, 1000);

updateUI();