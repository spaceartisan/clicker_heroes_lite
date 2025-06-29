// Game state variables
let currentLevel = 1;
let highestLevel = 1;

let baseHealth = 5;
let enemyHealth = getHealthForLevel(currentLevel);
let enemyMaxHealth = enemyHealth;

let gold = 0;

// Click & Auto Damage
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
const enemyHealthText = document.getElementById('enemy-health');
const enemyLevelText = document.getElementById('enemy-level');
const goldText = document.getElementById('gold');
const damageText = document.getElementById('damage');
const clickUpgradeCostText = document.getElementById('click-upgrade-cost');
const autoUpgradeCostText = document.getElementById('auto-upgrade-cost');
const autoClickerCostText = document.getElementById('auto-clicker-cost');
const autoClickerCountText = document.getElementById('auto-clicker-count');
const autoNextToggle = document.getElementById('auto-next-toggle');
const clickButton = document.getElementById('click-button');

// Health scaling function
function getHealthForLevel(lvl) {
  return Math.floor(baseHealth * Math.pow(1.3, lvl - 1)) + lvl * 5;
}

// Manual attack
function attack() {
  enemyHealth -= clickDamage;
  if (enemyHealth <= 0) {
    handleEnemyDefeat();
  }
  updateUI();
}

// Auto attack
setInterval(() => {
  if (autoClickerCount > 0) {
    enemyHealth -= autoClickerCount * autoClickDamage;
    if (enemyHealth <= 0) {
      handleEnemyDefeat();
    }
    updateUI();
  }
}, 1000);

// Handle enemy defeat logic
function handleEnemyDefeat() {
  gold += 5 * currentLevel;
  if (currentLevel === highestLevel) {
    highestLevel++;
  }
  if (autoNextToggle.checked && currentLevel < highestLevel) {
    currentLevel++;
  }
  enemyHealth = getHealthForLevel(currentLevel);
}

// Buy click upgrade
function buyClickUpgrade() {
  if (gold >= clickUpgradeCost) {
    gold -= clickUpgradeCost;
    clickUpgradeLevel++;
    clickDamage = Math.floor(1 * Math.pow(2, clickUpgradeLevel));
    clickUpgradeCost = Math.floor(clickUpgradeCost * 2.5);
    updateUI();
  }
}

// Buy auto click upgrade
function buyAutoClickUpgrade() {
  if (gold >= autoClickUpgradeCost) {
    gold -= autoClickUpgradeCost;
    autoClickUpgradeLevel++;
    autoClickDamage = Math.floor(1 * Math.pow(2, autoClickUpgradeLevel));
    autoClickUpgradeCost = Math.floor(autoClickUpgradeCost * 2.5);
    updateUI();
  }
}

// Buy auto clicker unit
function buyAutoClicker() {
  if (gold >= autoClickerCost) {
    gold -= autoClickerCost;
    autoClickerCount++;
    autoClickerCost = Math.floor(autoClickerCost * 1.5);
    updateUI();
  }
}

// Level controls
function goToNextLevel() {
  if (currentLevel < highestLevel) {
    currentLevel++;
    enemyHealth = getHealthForLevel(currentLevel);
    updateUI();
  }
}

function goToPrevLevel() {
  if (currentLevel > 1) {
    currentLevel--;
    enemyHealth = getHealthForLevel(currentLevel);
    updateUI();
  }
}

// Update the user interface
function updateUI() {
  enemyHealthText.textContent = `Health: ${Math.max(0, Math.floor(enemyHealth))}`;
  enemyLevelText.textContent = `Level: ${currentLevel}`;
  goldText.textContent = gold;
  damageText.textContent = `Click: ${clickDamage}, Auto: ${autoClickDamage}`;
  clickUpgradeCostText.textContent = clickUpgradeCost;
  autoUpgradeCostText.textContent = autoClickUpgradeCost;
  autoClickerCostText.textContent = autoClickerCost;
  autoClickerCountText.textContent = autoClickerCount;
}

// Event bindings
clickButton.onclick = attack;
enemy.onclick = attack;

// Initial draw
updateUI();
