let lastClickTime = 0;

function marketEffect(i) {
    const market = marketUpgrades[i];
    return market.effect(market.level);
}

function attack(isRageAttack = false) {
    const now = Date.now();
    // console.log("Attack clicked at", now - lastClickTime, "ms since last click");
    if (deathCooldown || (now - lastClickTime < 60 && !isRageAttack)) return;
    tickBossChallenge();
    if (deathCooldown || bossRetryStage === currentLevel) return; // Prevent spamming clicks
    if (!isRageAttack) lastClickTime = now;
    if (!isRageAttack && enemyType && enemyType.dodge && Math.random() < enemyType.dodge) {
        enemyNameText.textContent = enemyType.name + " — DODGE!";
        totalClicks++;
        return;
    }
    if (enemyType) enemyNameText.textContent = enemyType.name + " — " + enemyType.trait;
    let dmg = playerClickDamage * mktUp(2) * (enemyType ? enemyType.resistance : 1);
    if (doubleAttackReady) {
        dmg *= 2;
        doubleAttackReady = false;
        updateAbilityHUD(Date.now(), true);
    }
    // showDamage(dmg);
    enemyHealth -= dmg;
    if (enemyHealth <= 0) handleEnemyDefeat();
    updateUI();
    totalClicks++; // Increment total clicks for achievements
}

// === Damage and UI ===
function getPlayerClickDamage() {
    const castleBonus = 1 + Math.min(0.60, 0.015 * Math.max(0, structures.castle.level - 1));
    const decreeBonus = 1 + 0.04 * Math.max(0, passiveAbilities[1].level - 1);
    return playerLevel * safePowerOfTwo(playerGearLevel) *
        castleBonus * decreeBonus * (1 + getResearchBonus("heroDamage")) *
        (currentLevel>=101&&currentLevel<=200 ? 1+getResearchBonus("frontierHeroDamage"):1) *
        (1+getRelicBonus("hero")+(enemyType?.id==="dragon"?getRelicBonus("boss"):0));
}

// // Squad DPS is evaluated against the active enemy's defense profile.
function getAutoDamage() {
    if (hiredMercenaries.length === 0) return 0;
    const squads = new Map();
    for (let i = 0; i < hiredMercenaries.length; i++) {
        const merc = hiredMercenaries[i];
        const squadId = merc.squad || Math.floor(i / 5) + 1;
        let squad = squads.get(squadId);
        if (!squad) {
            squad = { id: squadId, damage: 0, speed: Math.max(0, merc.attackSpeedLevel || 0), members: 0 };
            squads.set(squadId, squad);
        }
        squad.damage += merc.level * safePowerOfTwo(merc.gearLevel);
        squad.members++;
    }
    const target = enemyType || getEnemyType(currentLevel);
    const attackMultiplier = mktUp(2) * mktUp(3) * (rallyActive ? 2 : 1);
    let dps = 0;
    for (const squad of squads.values()) {
        if (isSquadOnCampaign(squad.id)) continue;
        const build = getSquadBuild(squad.id);
        const role = findSquadRole(build.role);
        const kit = findEquipmentKit(build.kit);
        const teamwork = 1 + 0.1 * (squad.members - 1);
        let roleBonus = role.power;
        let kitBonus = kit.power;
        if (role.favored && role.favored === target.trait) roleBonus *= role.counter;
        if (kit.favored && kit.favored === target.trait) kitBonus *= kit.counter;
        dps += squad.damage * (squad.speed + 1) / 2 * teamwork * roleBonus * kitBonus;
    }
    let researchedBonus = 1 + getResearchBonus("squadDamage");
    if (target.trait === "armored" || target.trait === "spectral") {
        researchedBonus *= 1 + getResearchBonus("counterDamage");
    }
    if (target.id === "dragon") researchedBonus *= 1 + getResearchBonus("bossDamage");
    if (target.champion) researchedBonus *= 1 + getResearchBonus("veteranDamage");
    return Math.min(1e290,dps * attackMultiplier * mktUp(7) *
        researchedBonus * target.resistance * dynastyDamageMultiplier() *
        (1+getRelicBonus("squad")+(target.id==="dragon"?getRelicBonus("boss"):0)));
}

function upgradeSkillCost(ability, query = false) {
    return estimateUpgradeCost({
        baseLevel: ability.level,
        upgradeEquation: (lvl) => Math.floor(ability.cost * lvl ** 2 * mktUp(1) * getResearchCostFactor()),
        cap: ability.maxLevel,
        resourceAvailable: gold,
        multiplier: 1,
        underfill: underfillEnabled,
        query,
        capFunction: (lvl) => { return lvl >= ability.maxLevel }
    });
}

function upgradeSkill(ability) {
    if (!isRoyalSkillUnlocked(ability)) {
        showPopupMessage("Upgrade hero and Castle to unlock this decree.",false,1300);
        return false;
    }
    const quote = upgradeSkillCost(ability, true);
    if (quote[1] > 0 && quote[0] > 0 && gold >= quote[0]) {
        gold -= quote[0];
        ability.level++;
        updateUI();
        saveGame();
        return true;
    }
    showPopupMessage(ability.level >= ability.maxLevel ? "Maximum decree rank." : "Not enough gold.",false,900);
    return false;
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

// Fixed-rate elapsed-time combat prevents very fast upgrades from overheating phones.
const AUTO_COMBAT_TICK_MS = 250;
// Stage-clear throughput matters even when enemies die from a single tick.
// Do not slow the actual combat timer in Battery Saver mode.
const BATTERY_SAVER_HUD_INTERVAL_MS = 500;
let autoCombatTimer = null;
let lastAutoCombatTick = 0;
let lastCombatHudTick = 0;
function getCombatTickIntervalMs() {
    return AUTO_COMBAT_TICK_MS;
}

function startSquadAttack() {
    if (autoCombatTimer !== null || hiredMercenaries.length === 0 || document.hidden) return;
    lastAutoCombatTick = performance.now();
    lastCombatHudTick = lastAutoCombatTick;
    const tickMs = getCombatTickIntervalMs();
    autoCombatTimer = setInterval(() => {
        const now = performance.now();
        // The original four-combat-ticks-per-second cap remains in both modes,
        // preserving rapid one-shot stage clearing as well as elapsed-time DPS.
        const elapsed = Math.min(tickMs / 500, Math.max(0, (now - lastAutoCombatTick) / 1000));
        lastAutoCombatTick = now;
        if (deathCooldown || hiredMercenaries.length === 0 || document.hidden) return;
        tickBossChallenge();
        runCombatSeconds += elapsed;
        const maxHealth = getEnemyHealth();
        if (enemyType && enemyType.regen && !squadsSuppressRegeneration()) {
            enemyHealth = Math.min(maxHealth, enemyHealth + maxHealth * enemyType.regen * elapsed);
        }
        const damage = getAutoDamage() * elapsed;
        if (damage <= 0 || !Number.isFinite(damage)) return;
        enemyHealth -= damage;
        if (enemyHealth <= 0) handleEnemyDefeat();
        // Fewer layout/text updates on touch devices; combat keeps its
        // original per-second damage and enemy defeat semantics.
        if (!batterySaverEnabled || now - lastCombatHudTick >= BATTERY_SAVER_HUD_INTERVAL_MS) {
            lastCombatHudTick = now;
            updateUI();
        }
    }, tickMs);
}

function stopSquadAttack() {
    if (autoCombatTimer !== null) clearInterval(autoCombatTimer);
    autoCombatTimer = null;
}

// === Hero Abilities ===
// Only one once-per-second HUD timer for all unlocked abilities.
// Cooldowns run from wall-clock deadlines, so a backgrounded phone does not
// extend effects or accumulate independent countdown intervals.
let abilityHudTimer = null;
let abilityHudLastSecond = -1;
let abilityHudLastLevel = -1;
let abilityHudLastCharge = false;

function updateAbilityHUD(now = Date.now(), force = false) {
    const second = Math.floor(now / 1000);
    if (!force && second === abilityHudLastSecond &&
        playerLevel === abilityHudLastLevel && doubleAttackReady === abilityHudLastCharge) return;
    abilityHudLastSecond = second;
    abilityHudLastLevel = playerLevel;
    abilityHudLastCharge = doubleAttackReady;
    const bar = document.getElementById("ability-bar");
    const activeSummary = document.getElementById("ability-active-status");
    let anyUnlocked = false;
    let pending = false;
    const activeLabels = [];

    for (const ability of abilities) {
        const state = abilityStates[ability.name];
        const unlocked = playerLevel >= ability.unlockLevel;
        state.unlocked = unlocked;
        state.button.hidden = !unlocked;
        if (!unlocked) {
            state.button.disabled = true;
            state.button.classList.add("locked");
            continue;
        }
        anyUnlocked = true;
        state.button.classList.remove("locked");

        if (state.activeUntil && now >= state.activeUntil) {
            state.activeUntil = 0;
            if (ability.name === "Rally") rallyActive = false;
            if (ability.name === "Gold Rush") goldRushActive = false;
            if (ability.name === "Rage") {
                if (rageInterval !== null) clearInterval(rageInterval);
                rageInterval = null;
            }
        }

        const remainingCooldown = Math.max(0, Math.ceil((state.cooldownUntil - now) / 1000));
        const remainingActive = Math.max(0, Math.ceil((state.activeUntil - now) / 1000));
        const prepared = ability.name === "Double Attack" && doubleAttackReady;
        state.cooldown = remainingCooldown > 0;

        state.button.disabled = state.cooldown;
        state.button.classList.toggle("ability-active", remainingActive > 0 || prepared);
        state.button.classList.toggle("ability-cooling", state.cooldown);
        let label = ability.name;
        if (remainingActive > 0) {
            label += " · ACTIVE " + remainingActive + "s";
            activeLabels.push(ability.name + " " + remainingActive + "s");
        } else if (prepared) {
            label += " · READY CHARGE";
            activeLabels.push("Double Attack ready");
        }
        if (state.cooldown) label += " · CD " + remainingCooldown + "s";
        state.button.textContent = label;
        state.button.setAttribute("aria-label", label);
        if (state.cooldown || remainingActive > 0) pending = true;
    }

    bar.hidden = !anyUnlocked;
    activeSummary.hidden = activeLabels.length === 0;
    activeSummary.textContent = activeLabels.length ? "Active: " + activeLabels.join(" · ") : "";

    if (pending && abilityHudTimer === null) {
        abilityHudTimer = setInterval(() => updateAbilityHUD(), 1000);
    } else if (!pending && abilityHudTimer !== null) {
        clearInterval(abilityHudTimer);
        abilityHudTimer = null;
    }
}

function resetAbilityEffects() {
    if (abilityHudTimer !== null) clearInterval(abilityHudTimer);
    abilityHudTimer = null;
    abilityHudLastSecond = -1;
    abilityHudLastLevel = -1;
    if (rageInterval !== null) clearInterval(rageInterval);
    rageInterval = null;
    rallyActive = false;
    goldRushActive = false;
    doubleAttackReady = false;
    for (const ability of abilities) {
        const state = abilityStates[ability.name];
        state.cooldown = false;
        state.cooldownUntil = 0;
        state.activeUntil = 0;
    }
    updateAbilityHUD(Date.now(), true);
}

function activateAbility(ability) {
    const state = abilityStates[ability.name];
    if (!state || playerLevel < ability.unlockLevel ||
        Date.now() < state.cooldownUntil) return false;

    const now = Date.now();
    state.cooldownUntil = now + ability.cooldown;
    state.activeUntil = ability.duration > 0 ? now + ability.duration : 0;
    if (!abilitiesUsed.includes(ability.name)) abilitiesUsed.push(ability.name);
    abilitiesCount++;

    if (ability.name === "Strong Attack") {
        strongAttack();
    } else if (ability.name === "Rally") {
        rallyActive = true;
    } else if (ability.name === "Gold Rush") {
        goldRushActive = true;
    } else if (ability.name === "Double Attack") {
        doubleAttackReady = true;
    } else if (ability.name === "Rage") {
        if (rageInterval !== null) clearInterval(rageInterval);
        rageInterval = setInterval(() => {
            if (!document.hidden && Date.now() < state.activeUntil) attack(true);
            else if (Date.now() >= state.activeUntil) updateAbilityHUD();
        }, 500);
    }

    updateAbilityHUD(now, true);
    updateUI();
    return true;
}

function strongAttack() {
    let dmg = playerClickDamage * 5 * (enemyType ? enemyType.resistance : 1);
    if (doubleAttackReady) {
        dmg *= 2;
        doubleAttackReady = false;
        updateAbilityHUD();
    }
    // showDamage(dmg);
    enemyHealth -= dmg;
    if (enemyHealth <= 0) handleEnemyDefeat();
    updateUI();
}


// Attempt to refactor the cost functions

function estimateUpgradeCost({ baseLevel, upgradeEquation, cap, resourceAvailable, multiplier, underfill = false, query = false, capFunction = null }) {
    let totalCost = 0;
    let unitsAffordable = 0;
    let capReached = false;
    for (let i = 0; i < multiplier; i++) {
        if (baseLevel + i >= cap) {
            capReached = true;
            break;
        }
        if (capFunction && capFunction(baseLevel + i)) {
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
        upgradeEquation: (lvl) => Math.floor(10 + lvl ** 1.5 * mktUp(1) * getResearchCostFactor()),
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
    const _upgradeMultiplier = costReturn[1]; // only charge and grant the priced levels
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
        upgradeEquation: (lvl) => Math.floor(100 * (lvl + 1) ** 2 * mktUp(1) * getResearchCostFactor()),
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
        upgradeEquation: (mlvl) => Math.floor(10 * mlvl ** 1.6 * mktUp(1) * getResearchCostFactor()), //Math.floor(10 + lvl ** 1.5),
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
        upgradeEquation: (glvl) => Math.floor(100 * ((glvl + 1) ** 6) * mktUp(1) * getResearchCostFactor()),
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
        upgradeEquation: (mlvl) => Math.floor(100 * (mlvl + 1) ** 4 * mktUp(1) * getResearchCostFactor()),
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