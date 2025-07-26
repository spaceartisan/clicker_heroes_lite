let lastClickTime = 0;

function marketEffect(i) {
    const market = marketUpgrades[i];
    return market.effect(market.level);
}

function attack(isRageAttack = false) {
    const now = Date.now();
    // console.log("Attack clicked at", now - lastClickTime, "ms since last click");
    if (now - lastClickTime < 60 && !isRageAttack) return; // Prevent spamming clicks
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

// function getAutoDamage() {
//     return hiredMercenaries.reduce((sum, m) => {
//         let base = m.level * (2 ** m.gearLevel) * (m.attackSpeedLevel + 1) * mktUp(3) * mktUp(2) / 2.0;
//         if (rallyActive) base *= 2;
//         return sum + base;
//     }, 0);
// }

function getAutoDamage(query = false) {
    let squads = Math.ceil(hiredMercenaries.length / 5);
    let totalDmg = 0
    let topSpeed = 2000;
    let curSpeed = 0;
    for (let i = 1; i <= squads; i++) {
        let squadMercs = hiredMercenaries.filter(m => m.squad === i);
        let dmg = squadMercs.reduce((sum, m) => {
            return sum + (m.level * (2 ** m.gearLevel));
        }, 0);
        if (rallyActive) dmg *= 2;
        let m = squadMercs[0]; // Use the first mercenary in the squad for attack speed
        totalDmg += dmg * (m.attackSpeedLevel + 1) * mktUp(3) * mktUp(2) * squadMercs.length * 1.5 / 2.0; // Double check this value.
        if (query) {
            curSpeed = Math.floor(2000 / (squadMercs[0].attackSpeedLevel + 1) / mktUp(3) / squadMercs.length);
            if (curSpeed < topSpeed) {
                topSpeed = curSpeed;
            }
        }
    }
    if (query) {
        return [totalDmg, topSpeed];
    }
    return totalDmg;
}

function upgradeSkillCost(ability, query = false) {
    return estimateUpgradeCost({
        baseLevel: ability.level,
        upgradeEquation: (lvl) => Math.floor(ability.cost * lvl ** 2),
        cap: structures.castle.level || ability.maxLevel <= 10,
        resourceAvailable: gold,
        multiplier: 1,
        underfill: underfillEnabled,
        query,
        capFunction: (lvl) => { return lvl >= ability.maxLevel }
    });
}

function upgradeSkill(ability) {
    const cost = upgradeSkillCost(ability, true);
    if (cost[0] > 0 && gold >= cost[0]) {
        gold -= cost[0];
        ability.level += 1; // Still unsure if I want the upgradeMultiplier here
    } else if (cost[2]) {
        showPopupMessage("You have reached the level cap!", null, 700);
    } else {
        showPopupMessage("Not enough gold!", null, 700);
    }
    updateUI();
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
    } else if (gold < cost) {
        showPopupMessage("Not enough gold!", null, 500);
    } else if (hiredMercenaries.length + 1 >= structures.tavern.level * 5) {
        showPopupMessage("You have reached the maximum number of mercenaries!", null, 500);
    }
    return false;
}

function hireMercenaryCost() {
    return Math.floor(100 * hiredMercenaries.length ** 2.0);
}

function startSquadAttack(i) {
    // const squadMercs = hiredMercenaries.filter(m => m.squad === i);
    let getAuto = getAutoDamage(true);
    if (squadAttackInterval[0]) {
        clearInterval(squadAttackInterval[0]);
    }
    squadAttackInterval[0] = setInterval(() => {
        let dmg = getAutoDamage();
        // squadMercs.forEach((m, idx) => {
        //     dmg += m.level * (2 ** m.gearLevel) * (rallyActive ? 2 : 1) * mktUp(2);
        // });
        enemyHealth -= dmg;
        // showDamage(dmg);
        if (enemyHealth <= 0) handleEnemyDefeat();
        updateUI();
        // console.log(`Squad ${i} attacked for ${dmg} damage. Enemy health: ${enemyHealth}`);
    }, getAuto[1]);
    // Math.floor(2000 / (squadMercs[0].attackSpeedLevel + 1) / mktUp(3) / squadMercs.length)); // Adjust attack speed based on the first mercenary in the squad
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
        setTimeout(() => {
            clearInterval(goldRushInterval);
            goldRushActive = false;
        }, ability.duration);
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


// Attempt to refactor the cost functions

function estimateUpgradeCost({ baseLevel, upgradeEquation, cap, resourceAvailable, multiplier, underfill = false, query = false, capFunction = null }) {
    let totalCost = 0;
    let unitsAffordable = multiplier;
    let capReached = false;
    for (let i = 0; i < multiplier; i++) {
        if (baseLevel + i >= cap) {
            capReached = true;
            break;
        }
        if (capFunction && capFunction(baseLevel)) {
            capReached = true;
            break;
        }
        const cost = upgradeEquation(baseLevel + i);
        if (underfill && query && totalCost + cost > resourceAvailable) {
            break;
        }
        totalCost += cost;
        unitsAffordable = i + 1;
    }

    return query ? [totalCost, unitsAffordable, capReached] : totalCost;
}

function levelUpPlayerCost(query = false) {
    return estimateUpgradeCost({
        baseLevel: playerLevel,
        upgradeEquation: (lvl) => Math.floor(10 + lvl ** 1.5 * mktUp(1)),
        cap: structures.castle.level * 10 + 100,
        resourceAvailable: gold,
        multiplier: upgradeMultiplier,
        underfill: underfillEnabled,
        query
    });
}

function levelUpPlayer() {
    // Create the upgrade equation as a lambda function
    let costReturn = levelUpPlayerCost(true);
    let cost = costReturn[0];
    let _upgradeMultiplier = upgradeMultiplier;
    if (underfillEnabled && costReturn[1] > 0) {
        _upgradeMultiplier = costReturn[1];
    }
    // 
    // if (gold >= cost && structures.castle.level * 10 + 100 >= playerLevel + _upgradeMultiplier) {
    if (cost > 0 && gold >= cost) {
        gold -= cost;
        playerLevel += _upgradeMultiplier;
        playerUpgradeCost = Math.floor(10 + playerLevel ** 1.5);
        updateUI();
        updatePlayerLevelGearText();
    } else if (costReturn[2]) {
        showPopupMessage("You have reached the level cap!", null, 500);
    } else {
        showPopupMessage("Not enough gold!", null, 500);
    }
}

function gearUpPlayerCost(query = false) {
    return estimateUpgradeCost({
        baseLevel: playerGearLevel,
        upgradeEquation: (lvl) => Math.floor(100 * (lvl + 1) ** 2 * mktUp(1)),
        cap: (structures.blacksmith.level - 1) * 2 + 5,
        resourceAvailable: gold,
        multiplier: upgradeMultiplier,
        underfill: underfillEnabled,
        query
    });
}

function gearUpPlayer() {
    let cost = gearUpPlayerCost(true);
    if (cost[0] > 0 && gold >= cost[0]) {
        gold -= cost[0];
        playerGearLevel += cost[1];
        nextPlayerGearLevelReq += 0;
        updateUI();
        updatePlayerLevelGearText()
    } else if (cost[2]) {
        showPopupMessage("You have reached the gear cap!", null, 500);
    } else {
        showPopupMessage("Not enough gold!", null, 500);

    }
}


function levelUpMercenaryCost(i, query = false) {
    const m = hiredMercenaries[i];
    return estimateUpgradeCost({
        baseLevel: m.level,
        upgradeEquation: (mlvl) => Math.floor(10 * mlvl ** 1.6), //Math.floor(10 + lvl ** 1.5),
        cap: (passiveAbilities[0].level - 1) * 10 + 100,
        resourceAvailable: gold,
        multiplier: upgradeMultiplier,
        underfill: underfillEnabled,
        query
    });
}

function levelUpMercenary(i) {
    const m = hiredMercenaries[i];
    const cost = levelUpMercenaryCost(i, true);
    if (cost[0] > 0 && gold >= cost[0]) {
        gold -= cost[0];
        m.level += cost[1];
        m.upgradeCost = Math.floor(10 * m.level ** 1.6);
        updateUI();
    } else if (cost[2]) {
        showPopupMessage("You have reached the level cap!", null, 700);
    } else {
        showPopupMessage("Not enough gold!", null, 700);
    }
}

function upgradeMercenaryGearCost(m, query = false) {
    // const m = hiredMercenaries[i];
    return estimateUpgradeCost({
        baseLevel: m.gearLevel,
        upgradeEquation: (glvl) => Math.floor(100 * ((glvl + 1) ** 8) * mktUp(1)),
        cap: (structures.blacksmith.level - 1) * 2 + 5,
        resourceAvailable: gold,
        multiplier: upgradeMultiplier,
        underfill: underfillEnabled,
        query
    });
}

function upgradeMercGear(i) {
    const squadMercs = hiredMercenaries.filter(m => m.squad === i);
    if (squadMercs.length === 0) return; // No mercenaries in this squad
    const m = squadMercs[0]; // Use the first mercenary in the squad for cost
    const cost = upgradeMercenaryGearCost(m, true);
    if (cost[0] > 0 && gold >= cost[0]) {
        gold -= cost[0];
        for (let _m of squadMercs) {
            _m.gearLevel += cost[1];
            _m.gearCost = Math.floor(_m.gearCost * 2);
            _m.nextGearLevelReq += 40;
        }
        updateUI();
    } else if (cost[2]) {
        showPopupMessage("You have reached the gear cap!", null, 700);
    } else {
        showPopupMessage("Not enough gold!", null, 700);
    }
}

function upgradeMercenarySpeedCost(m, query = false) {
    // const m = hiredMercenaries[i];
    return estimateUpgradeCost({
        baseLevel: m.attackSpeedLevel,
        upgradeEquation: (mlvl) => Math.floor(100 * (mlvl + 1) ** 8 * mktUp(1)),
        cap: (structures.barracks.level - 1) * 2 + 5,
        resourceAvailable: gold,
        multiplier: upgradeMultiplier,
        underfill: underfillEnabled,
        query
    });
}

function upgradeMercSpeed(i) {
    // Get all mercenaries who share the same squad
    const squadMercs = hiredMercenaries.filter(m => m.squad === i);
    if (squadMercs.length === 0) return; // No mercenaries in this squad
    const m = squadMercs[0]; // Use the first mercenary in the squad for cost
    const cost = upgradeMercenarySpeedCost(m, true);
    if (cost[0] > 0 && gold >= cost[0]) {
        gold -= cost[0];
        for (let _m of squadMercs) {
            {
                _m.attackSpeedLevel += cost[1];
                _m.attackSpeedCost = Math.floor(_m.attackSpeedCost * 2);
            }
        }
        startSquadAttack(i)
        updateUI();
    } else if (cost[2]) {
        showPopupMessage("You have reached the speed cap!", null, 700);
    } else {
        showPopupMessage("Not enough gold!", null, 700);
    }
}



function testSquadValue(i) {
    const squadMercs = hiredMercenaries.filter(m => m.squad === i);
    let dmg = 0
    squadMercs.forEach((m, idx) => {
        dmg += m.level * (2 ** m.gearLevel) * (rallyActive ? 2 : 1) * mktUp(2);
    });
    return dmg / 2000 * 1000 * (squadMercs[0].attackSpeedLevel + 1) * mktUp(3) * squadMercs.length * 1.5;
}

function Cheatin() {
    gold += 1000000;
    playerLevel += 1000;
    playerGearLevel += 10;
    structures.castle.level = 100;
    structures.blacksmith.level = 100;
    structures.barracks.level = 100;
    structures.tavern.level = 400;
    structures.market.level = 100;
    for (let i = 0; i < 3000; i++) {
        hireMercenary();
    }
    hiredMercenaries.forEach(m => {
        m.level = 100;
        m.gearLevel = 40;
        m.attackSpeedLevel = 40;
    });
    updateUI();
    showPopupMessage("Cheat activated!", null, 500);
}

function spendGold(amount) {
    if (!isFinite(amount)) gold = 0;
    else if (!isFinite(gold)) gold = 0;
    else
    {
        gold -= amount;
    }
}