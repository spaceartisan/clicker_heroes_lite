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
    if (gold >= cost && hiredMercenaries.length < maxMercenaries) {
        gold -= cost;
        const name = generateName();
        hiredMercenaries.push({
            name,
            level: 1,
            gearLevel: 0,
            gearCost: 100,
            nextGearLevelReq: 10,
            attackSpeedLevel: 1,
            attackSpeedCost: 100
        });
        updateMercenaryText();
        updateUI();
        startMercAttack(hiredMercenaries.length - 1);
    }
}

function increaseMercenaryCap() {
    const guildCost = parseInt(document.getElementById("guild-cost").textContent);
    if (gold >= guildCost) {
        gold -= guildCost;
        maxMercenaries += 5; // Increase cap by 5
        guildLevel++;
        updateMercenaryText();
        updateUI();
    }
}



function levelUpMercenary(i) {
    const m = hiredMercenaries[i];
    const cost = m.upgradeCost || 20;
    if (gold >= cost) {
        gold -= cost;
        m.level++;
        m.upgradeCost = Math.floor(20 + m.level ** 2);
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