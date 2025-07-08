let lastClickTime = 0;

function marketEffect(i) {
    const market = marketUpgrades[i];
    return market.effect(market.level);
}

function attack(isRageAttack = false) {
    const now = Date.now();
    // console.log("Attack clicked at", now - lastClickTime, "ms since last click");
    if (now - lastClickTime < 100 && !isRageAttack) return; // Prevent spamming clicks
    if (!isRageAttack) lastClickTime = now;
    let dmg = playerClickDamage * mktUp(2);
    if (doubleAttackReady) {
        dmg *= 2;
        doubleAttackReady = false;
    }
    // showDamage(dmg);
    enemyHealth -= dmg;
    if (enemyHealth <= 0) handleEnemyDefeat();
    updateUI();
    totalClicks++; // Increment total clicks for achievements
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
        let base = m.level * (2 ** m.gearLevel) * (m.attackSpeedLevel+1) * mktUp(3) * mktUp(2) / 2.0;
        if (rallyActive) base *= 2;
        return sum + base;
    }, 0);
}

function upgradeSkillCost(ability) {
    const upgradeEquation = (lvl) => Math.floor(ability.cost * lvl ** 2);
    let totalCost = 0;
    return upgradeEquation(ability.level);
    // for (let i = 0; i < 1; i++) { // upgradeMultiplier is always 1 for skills
    //     totalCost += upgradeEquation(ability.level + i);
    // }
    // return totalCost;
}

function upgradeSkill(ability) {
    const cost = upgradeSkillCost(ability);
    if (gold >= cost && ability.level < ability.maxLevel) {
        gold -= cost;
        ability.level += 1; // Still unsure if I want the upgradeMultiplier here
    }
    updateUI();
}

function levelUpPlayerCost() {
    // Create the upgrade equation as a lambda function
    const upgradeEquation = (plvl) => Math.floor(10 + plvl ** 1.5);
    let totalCost = 0;
    for (let i = 0; i < upgradeMultiplier; i++) {
        totalCost += upgradeEquation(playerLevel + i);
    }
    return totalCost;
}

function levelUpPlayer() {
    // Create the upgrade equation as a lambda function
    let cost = levelUpPlayerCost();
    // 
    if (gold >= cost && structures.castle.level * 10 + 100 >= playerLevel + upgradeMultiplier) {
        gold -= cost;
        playerLevel += upgradeMultiplier;
        playerUpgradeCost = Math.floor(10 + playerLevel ** 1.5);
        updateUI();
        updatePlayerLevelGearText()
    }
}

function gearUpPlayerCost() {
    const upgradeEquation = (glvl) => Math.floor(100 * (glvl + 1) ** 2 * mktUp(1));
    let totalCost = 0;
    for (let i = 0; i < upgradeMultiplier; i++) {
        totalCost += upgradeEquation(playerGearLevel + i);
    }
    return totalCost;
}

function gearUpPlayer() {
    let cost = gearUpPlayerCost();
    if (gold >= cost && (structures.blacksmith.level - 1) * 2 + 5 >= playerGearLevel + upgradeMultiplier) {
        gold -= cost;
        playerGearLevel += upgradeMultiplier;
        nextPlayerGearLevelReq += 0;
        updateUI();
        updatePlayerLevelGearText()
    }
}

// === Mercenaries ===
function hireMercenary() {
    const cost = hireMercenaryCost();
    if (gold >= cost && hiredMercenaries.length < structures.tavern.level * 5) {
        gold -= cost;
        let length = hiredMercenaries.length;
        let squad = Math.ceil((length + 1) / 5); // Assign squad based on current length
        const name = generateName();
        hiredMercenaries.push({
            name,
            level: 1,
            gearLevel: 0,
            gearCost: 100,
            nextGearLevelReq: 10,
            attackSpeedLevel: 0,
            attackSpeedCost: 100,
            squad: squad
        });
        updateUI();
        startSquadAttack(squad);
        return true;
    }
    return false;
}

function hireMercenaryCost() {
    return Math.floor(100 * hiredMercenaries.length ** 2.0);
}

function levelUpMercenaryCost(i) {
    // Create the upgrade equation as a lambda function
    const m = hiredMercenaries[i];
    const upgradeEquation = (mlvl) => Math.floor(20 * mlvl ** 2);
    let totalCost = 0;
    for (let i = 0; i < upgradeMultiplier; i++) {
        totalCost += upgradeEquation(m.level + i);
    }
    return totalCost;
}

function levelUpMercenary(i) {
    const m = hiredMercenaries[i];
    const cost = levelUpMercenaryCost(i);
    if (gold >= cost && (passiveAbilities[0].level - 1) * 10 + 20 >= m.level + upgradeMultiplier) {
        gold -= cost;
        m.level += upgradeMultiplier;
        m.upgradeCost = Math.floor(20 + m.level ** 2);
        updateUI();
    }
}

function upgradeMercenaryGearCost(m) {
    const upgradeEquation = (glvl) => Math.floor(100 * ((glvl + 1) ** 2) * mktUp(1));
    let totalCost = 0;
    for (let i = 0; i < upgradeMultiplier; i++) {
        totalCost += upgradeEquation(m.gearLevel + i);
    }
    return totalCost;
}

function upgradeMercGear(i) {
    const squadMercs = hiredMercenaries.filter(m => m.squad === i);
    if (squadMercs.length === 0) return; // No mercenaries in this squad
    const m = squadMercs[0]; // Use the first mercenary in the squad for cost
    const cost = upgradeMercenaryGearCost(m);
    if (gold >= cost && (structures.blacksmith.level - 1) * 2 + 5 >= m.gearLevel + upgradeMultiplier) {
        gold -= cost;
        for (let _m of squadMercs) {
            _m.gearLevel += upgradeMultiplier;
            _m.gearCost = Math.floor(_m.gearCost * 2);
            _m.nextGearLevelReq += 40;
        }
        updateUI();
    }
}

function upgradeMercenarySpeedCost(m) {
    const upgradeEquation = (slvl) => Math.floor(100 * slvl ** 2);
    let totalCost = 0;
    for (let i = 0; i < upgradeMultiplier; i++) {
        totalCost += upgradeEquation(m.attackSpeedLevel + i);
    }
    return totalCost;
}

function upgradeMercSpeed(i) {
    // Get all mercenaries who share the same squad
    const squadMercs = hiredMercenaries.filter(m => m.squad === i);
    if (squadMercs.length === 0) return; // No mercenaries in this squad
    const m = squadMercs[0]; // Use the first mercenary in the squad for cost
    const cost = upgradeMercenarySpeedCost(m);
    if (gold >= cost && (structures.barracks.level - 1) * 2 + 5 >= m.attackSpeedLevel + upgradeMultiplier) {
        gold -= cost;
        for (let _m of squadMercs) {
            {
                _m.attackSpeedLevel += upgradeMultiplier;
                _m.attackSpeedCost = Math.floor(_m.attackSpeedCost * 2);
            }
        }
        startSquadAttack(i)
        updateUI();
    }
}


function startSquadAttack(i) {
    const squadMercs = hiredMercenaries.filter(m => m.squad === i);
    if (squadAttackInterval[i]) {
        clearInterval(squadAttackInterval[i]);
    }
    squadAttackInterval[i] = setInterval(() => {
        let dmg = 0
        squadMercs.forEach((m, idx) => {
            dmg += m.level * (2 ** m.gearLevel) * (rallyActive ? 2 : 1) * mktUp(2);
        });
        enemyHealth -= dmg;
        // showDamage(dmg);
        if (enemyHealth <= 0) handleEnemyDefeat();
        updateUI();
    }, Math.floor(2000 / (squadMercs[0].attackSpeedLevel + 1) / mktUp(3))); // Adjust attack speed based on the first mercenary in the squad
}

// === Hero Abilities ===
function activateAbility(ability) {
    const state = abilityStates[ability.name];
    if (state.cooldown) return;

    const btn = state.button;
    btn.disabled = true;
    state.cooldown = true;

    if (!abilitiesUsed.includes(ability.name)) {
        abilitiesUsed.push(ability.name);
    }
    abilitiesCount++;

    if (ability.name === "Strong Attack") strongAttack();
    else if (ability.name === "Rally") {
        rallyActive = true;
        setTimeout(() => rallyActive = false, ability.duration);
    } else if (ability.name === "Double Attack") {
        doubleAttackReady = true;
    } else if (ability.name === "Rage") {
        rageInterval = setInterval(() => attack(true), 500);
        setTimeout(() => clearInterval(rageInterval), ability.duration);
    } else if (ability.name === "Gold Rush") {
        goldRushActive = true;
        setTimeout(() => clearInterval(goldRushInterval), ability.duration);
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
    // showDamage(dmg);
    enemyHealth -= dmg;
    if (enemyHealth <= 0) handleEnemyDefeat();
    updateUI();
}