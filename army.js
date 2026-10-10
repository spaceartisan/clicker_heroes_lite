// Army Command: one place to manage individual squads and make fair, capped purchases.
// No animation loop: the roster is rendered only when opened or changed.
const armySelectedSquads = new Set();
const armyExpandedSquads = new Set();
const ARMY_PAGE_SIZE = 8;
let armyPage = 0;
let armySelectionInitialized = false;

function getArmySquads() {
    const byId = new Map();
    hiredMercenaries.forEach((merc, index) => {
        const squadId = Math.max(1, Number(merc.squad) || (Math.floor(index / 5) + 1));
        if (!byId.has(squadId)) byId.set(squadId, { id: squadId, indices: [] });
        byId.get(squadId).indices.push(index);
    });
    return [...byId.values()].sort((a, b) => a.id - b.id);
}

function getArmyCap(kind) {
    if (kind === "level") return Math.max(0, (passiveAbilities[0].level - 1) * 10 + 100);
    if (kind === "gear") return Math.max(0, (structures.blacksmith.level - 1) * 2 + 5);
    if (kind === "speed") return Math.max(0, (structures.barracks.level - 1) * 2 + 5);
    return 0;
}

function getArmyUnitCost(kind, currentTier) {
    if (!Number.isFinite(currentTier) || currentTier < 0) return Infinity;
    if (kind === "level") return Math.floor(10 * Math.pow(Math.max(1, currentTier), 1.6) * mktUp(1) * getResearchCostFactor());
    if (kind === "gear" || kind === "speed") {
        const power = kind === "gear" ? 6 : 4;
        return Math.floor(100 * Math.pow(currentTier + 1, power) * mktUp(1) * getResearchCostFactor());
    }
    return Infinity;
}

function getArmyTargets(squadIds, kind) {
    const allowed = new Set(squadIds.map(Number));
    const groups = getArmySquads().filter(squad => allowed.has(squad.id));
    if (kind === "level") {
        // Interleave first mercenary of every squad, then second, etc.
        // An insufficient budget is therefore spread across squads fairly.
        const targets = [];
        const maximumMembers = Math.max(0, ...groups.map(group => group.indices.length));
        for (let slot = 0; slot < maximumMembers; slot++) {
            for (const group of groups) {
                const index = group.indices[slot];
                if (index === undefined) continue;
                targets.push({ indices: [index], tier: hiredMercenaries[index].level });
            }
        }
        return targets;
    }
    if (kind === "gear" || kind === "speed") {
        const field = kind === "gear" ? "gearLevel" : "attackSpeedLevel";
        return groups.map(group => ({
            indices: group.indices,
            // Honor the highest existing tier if an imported squad has mixed stats.
            tier: Math.max(...group.indices.map(index => Number(hiredMercenaries[index][field]) || 0))
        }));
    }
    return [];
}

// Pure quote: read game state but never modify it.
// Buying is round-robin across targets, not "fully upgrade squad 1 first".
function planArmyUpgrade(squadIds, kind, amount, budget = gold) {
    const quantity = [1, 10, 100].includes(Number(amount)) ? Number(amount) : 1;
    const targets = getArmyTargets(squadIds, kind);
    const cap = getArmyCap(kind);
    const state = targets.map(target => ({
        indices: target.indices,
        tier: target.tier,
        bought: 0,
        limit: Math.min(quantity, Math.max(0, cap - target.tier))
    }));
    const maximumUnits = state.reduce((sum, item) => sum + item.limit, 0);
    const operations = [];
    let spent = 0;
    const cash = Number.isFinite(budget) ? Math.max(0, budget) : 0;

    for (let round = 0; round < quantity; round++) {
        let anyEligible = false;
        for (const item of state) {
            if (item.bought >= item.limit) continue;
            anyEligible = true;
            const cost = getArmyUnitCost(kind, item.tier);
            if (!Number.isFinite(cost) || cost < 0 || cost > cash - spent) continue;
            spent += cost;
            operations.push({ indices: item.indices, cost, kind });
            item.tier++;
            item.bought++;
        }
        if (!anyEligible) break;
    }
    return {
        kind, amount: quantity, targets: targets.length, maximumUnits,
        units: operations.length, spent, operations,
        partial: operations.length < maximumUnits,
        capped: maximumUnits === 0 && targets.length > 0
    };
}

function applyArmyUpgradePlan(plan) {
    if (!plan || !plan.operations.length || !Number.isFinite(plan.spent) ||
        plan.spent > gold || plan.spent < 0 ||
        plan.operations.some(operation => !["level", "gear", "speed"].includes(operation.kind) ||
            operation.indices.some(index => !hiredMercenaries[index]))) return false;
    for (const operation of plan.operations) {
        for (const index of operation.indices) {
            const merc = hiredMercenaries[index];
            if (!merc) return false;
            if (operation.kind === "level") {
                merc.level++;
                merc.upgradeCost = Math.floor(10 * Math.pow(merc.level, 1.6));
            } else if (operation.kind === "gear") {
                merc.gearLevel = (merc.gearLevel || 0) + 1;
                merc.gearCost = Math.floor((merc.gearCost || 100) * 2);
                merc.nextGearLevelReq = (merc.nextGearLevelReq || 10) + 40;
            } else if (operation.kind === "speed") {
                merc.attackSpeedLevel = (merc.attackSpeedLevel || 0) + 1;
                merc.attackSpeedCost = Math.floor((merc.attackSpeedCost || 100) * 2);
            }
        }
    }
    gold -= plan.spent;
    updateUI();
    saveGame();
    return true;
}

function purchaseArmyUpgrades(squadIds, kind, amount) {
    const plan = planArmyUpgrade(squadIds, kind, amount, gold);
    if (plan.units === 0) {
        showPopupMessage(plan.capped ? "Selected units have reached their level cap." :
            "Not enough gold for the selected upgrades.", false, 1700);
        return false;
    }
    if (!applyArmyUpgradePlan(plan)) return false;
    if (plan.partial) showPopupMessage("Purchased " + plan.units + " affordable upgrades.", false, 1700);
    renderArmyView();
    return true;
}

function armySelectAll() {
    for (const squad of getArmySquads()) armySelectedSquads.add(squad.id);
    armySelectionInitialized = true;
    renderArmyView();
}

function armyClearSelection() {
    armySelectedSquads.clear();
    armySelectionInitialized = true;
    renderArmyView();
}

function armySelectedExisting() {
    const active = getArmySquads().map(squad => squad.id);
    const valid = new Set(active);
    for (const squadId of armySelectedSquads) if (!valid.has(squadId)) armySelectedSquads.delete(squadId);
    if (!armySelectionInitialized) {
        active.forEach(id => armySelectedSquads.add(id));
        armySelectionInitialized = true;
    }
    return [...armySelectedSquads].sort((a, b) => a - b);
}

function updateArmyQuote() {
    const ids = armySelectedExisting();
    const type = document.getElementById("army-upgrade-type").value;
    const amount = Number(document.getElementById("army-amount").value);
    const quote = planArmyUpgrade(ids, type, amount);
    const target = document.getElementById("army-quote");
    const btn = document.getElementById("army-upgrade-selected");
    if (!ids.length) {
        target.textContent = "Select one or more squads to preview a purchase.";
        btn.disabled = true;
        return;
    }
    if (quote.capped) {
        target.textContent = "Selected squads are at the current " + type + " cap.";
        btn.disabled = true;
        return;
    }
    const noun = type === "level" ? "mercenary levels" : "squad " + type + " tiers";
    target.textContent = quote.units + " / " + quote.maximumUnits + " " + noun +
        " · Cost " + formatDigits(quote.spent, 0, 0).trim() + " gold" +
        (quote.partial ? " · Partial purchase (remaining gold insufficient)" : "");
    btn.disabled = quote.units === 0;
    btn.textContent = quote.units ? "Purchase " + quote.units + " upgrades" : "Not enough gold";
}

function armyUpgradeSelected() {
    const ids = armySelectedExisting();
    const type = document.getElementById("army-upgrade-type").value;
    const amount = Number(document.getElementById("army-amount").value);
    return purchaseArmyUpgrades(ids, type, amount);
}

function armyRecruitFive() {
    let hired = 0;
    for (let i = 0; i < 5; i++) {
        if (hiredMercenaries.length >= structures.tavern.level * 5) break;
        if (hireMercenaryCost() > gold) break;
        if (!hireMercenary()) break;
        hired++;
    }
    if (!hired) {
        showPopupMessage("Upgrade the Tavern or earn more gold to recruit.", false, 1800);
    } else {
        const latest = getArmySquads().at(-1);
        if (latest) armySelectedSquads.add(latest.id);
        saveGame();
    }
    renderArmyView();
}

function getArmySquadDps(group,neutral=false) {
    if (!group.indices.length || isSquadOnCampaign(group.id)) return 0;
    const members=group.indices.map(index=>hiredMercenaries[index]);
    const build=getSquadBuild(group.id),role=findSquadRole(build.role);
    const kit=findEquipmentKit(build.kit);
    const target=neutral?{id:"",trait:"",resistance:1,champion:false}:
        (enemyType||getEnemyType(currentLevel));
    const raw=members.reduce((sum,merc)=>sum+merc.level*safePowerOfTwo(merc.gearLevel),0);
    const speed=Math.max(0,members[0].attackSpeedLevel||0);
    const teamwork=1+0.1*(members.length-1);
    let roleBonus=role.power,kitBonus=kit.power;
    if(role.favored&&role.favored===target.trait)roleBonus*=role.counter;
    if(kit.favored&&kit.favored===target.trait)kitBonus*=kit.counter;
    let research=1+getResearchBonus("squadDamage");
    if(target.trait==="armored"||target.trait==="spectral")
        research*=1+getResearchBonus("counterDamage");
    if(target.id==="dragon")research*=1+getResearchBonus("bossDamage");
    if(target.champion)research*=1+getResearchBonus("veteranDamage");
    return Math.min(1e290,raw*(speed+1)/2*teamwork*roleBonus*kitBonus*
        mktUp(2)*mktUp(3)*(rallyActive?2:1)*mktUp(7)*research*
        target.resistance*dynastyDamageMultiplier()*
        (1+getRelicBonus("squad")+(target.id==="dragon"?getRelicBonus("boss"):0)));
}

function createArmyButton(text, click, className = "") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = text;
    if (className) btn.className = className;
    btn.addEventListener("click", click);
    return btn;
}

function buildArmyCard(group) {
    const mercs = group.indices.map(index => hiredMercenaries[index]);
    const build = getSquadBuild(group.id);
    const deployed = isSquadOnCampaign(group.id);
    const average = Math.floor(mercs.reduce((sum, merc) => sum + merc.level, 0) / mercs.length);
    const gear = Math.max(...mercs.map(merc => merc.gearLevel || 0));
    const speed = Math.max(...mercs.map(merc => merc.attackSpeedLevel || 0));
    const outer = document.createElement("article");
    outer.className = "army-card";
    const head = document.createElement("div");
    head.className = "army-card-head";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = armySelectedSquads.has(group.id);
    checkbox.setAttribute("aria-label", "Select Squad " + group.id);
    checkbox.addEventListener("change", () => {
        if (checkbox.checked) armySelectedSquads.add(group.id);
        else armySelectedSquads.delete(group.id);
        updateArmyQuote();
        document.getElementById("army-selected-count").textContent =
            armySelectedSquads.size + " selected";
        outer.classList.toggle("army-card-selected", checkbox.checked);
    });
    const title = document.createElement("div");
    title.className = "army-card-name";
    const strong = document.createElement("strong");
    strong.textContent = "Squad " + group.id;
    const secondary = document.createElement("small");
    secondary.textContent = mercs.length + "/5 mercs · " + findSquadRole(build.role).name;
    title.append(strong, secondary);
    const dps = document.createElement("div");
    dps.className = "army-dps";
    const opponent=enemyType||getEnemyType(currentLevel);
    const baseline=formatDigits(getArmySquadDps(group,true),1,0).trim();
    const effective=formatDigits(getArmySquadDps(group),1,0).trim();
    dps.textContent=deployed?"ON CAMPAIGN · 0 combat DPS":
        "Neutral "+baseline+" DPS · Vs "+opponent.name+" "+effective+" DPS";
    head.append(checkbox, title, dps);
    outer.appendChild(head);
    outer.classList.toggle("army-card-selected", checkbox.checked);

    const stats = document.createElement("div");
    stats.className = "army-stat-row";
    stats.textContent = "Average Lv " + average + " · Gear " + gear + " · Speed " + speed;
    outer.appendChild(stats);

    const quick = document.createElement("div");
    quick.className = "army-quick-actions";
    for (const [kind, label] of [["level", "Level mercs"], ["gear", "Gear"], ["speed", "Speed"]]) {
        const quote = planArmyUpgrade([group.id], kind, 1);
        const button = createArmyButton(label + " +1", () => purchaseArmyUpgrades([group.id], kind, 1));
        button.disabled = quote.units === 0;
        button.title = quote.units ? "Spend " + formatDigits(quote.spent, 0, 0).trim() + " gold" :
            "At cap or not enough gold";
        quick.appendChild(button);
    }
    outer.appendChild(quick);

    const details = document.createElement("details");
    details.className = "army-card-details";
    details.open = armyExpandedSquads.has(group.id);
    details.addEventListener("toggle", () => {
        if (details.open) armyExpandedSquads.add(group.id);
        else armyExpandedSquads.delete(group.id);
    });
    const summary = document.createElement("summary");
    summary.textContent = "Role, equipment & mercenaries";
    details.appendChild(summary);

    const roleWrap = document.createElement("label");
    roleWrap.className = "army-field";
    roleWrap.appendChild(document.createTextNode("Role"));
    const roleSelect = document.createElement("select");
    for (const role of SQUAD_ROLES) {
        const option = document.createElement("option");
        option.value = role.id;
        option.disabled = structures.barracks.level < role.unlock;
        option.textContent = role.name + (option.disabled ? " (Barracks Lv " + role.unlock + ")" : "");
        roleSelect.appendChild(option);
    }
    roleSelect.value = build.role;
    roleSelect.addEventListener("change", () => {
        if (!setSquadRole(group.id, roleSelect.value)) roleSelect.value = getSquadBuild(group.id).role;
        renderArmyView();
    });
    roleWrap.appendChild(roleSelect);

    const kitWrap = document.createElement("label");
    kitWrap.className = "army-field";
    kitWrap.appendChild(document.createTextNode("Weapon kit"));
    const kitSelect = document.createElement("select");
    for (const kit of EQUIPMENT_KITS) {
        const option = document.createElement("option");
        option.value = kit.id;
        option.disabled = structures.blacksmith.level < kit.unlock;
        option.textContent = kit.name + (option.disabled ? " (Forge Lv " + kit.unlock + ")" : "");
        kitSelect.appendChild(option);
    }
    kitSelect.value = build.kit;
    kitWrap.appendChild(kitSelect);
    const kitButton = createArmyButton("Equipped", () => {
        if (buyOrEquipSquadKit(group.id, kitSelect.value)) renderArmyView();
    }, "army-kit-button");
    function updateKitButton() {
        const kitId = kitSelect.value;
        const chosen = EQUIPMENT_KITS.find(kit => kit.id === kitId);
        const owned = build.ownedKits.includes(kitId);
        kitButton.textContent = build.kit === kitId ? "Equipped" : owned ? "Equip" :
            "Forge " + formatDigits(squadUpgradeKitCost(group.id, kitId), 0, 0).trim() + "g";
        kitButton.disabled = build.kit === kitId || !chosen ||
            (!owned && gold < squadUpgradeKitCost(group.id, kitId));
    }
    kitSelect.addEventListener("change", updateKitButton);
    updateKitButton();

    const fields = document.createElement("div");
    fields.className = "army-fields";
    fields.append(roleWrap, kitWrap, kitButton);
    details.appendChild(fields);
    const roster = document.createElement("p");
    roster.className = "army-roster";
    roster.textContent = mercs.map(merc => (merc.name || "Mercenary") + " Lv " + merc.level).join(" · ");
    details.appendChild(roster);
    outer.appendChild(details);
    return outer;
}

function renderArmyView() {
    const list = document.getElementById("army-squad-list");
    if (!list) return;
    const squads = getArmySquads();
    armySelectedExisting();

    const sort = document.getElementById("army-sort").value;
    if (sort === "weakest") squads.sort((a, b) =>
        getArmySquadDps(a) - getArmySquadDps(b) || a.id - b.id);
    else if (sort === "strongest") squads.sort((a, b) =>
        getArmySquadDps(b) - getArmySquadDps(a) || a.id - b.id);
    else if (sort === "level") squads.sort((a, b) =>
        Math.min(...a.indices.map(i => hiredMercenaries[i].level)) -
        Math.min(...b.indices.map(i => hiredMercenaries[i].level)) || a.id - b.id);

    const pageCount = Math.max(1, Math.ceil(squads.length / ARMY_PAGE_SIZE));
    armyPage = Math.min(Math.max(0, armyPage), pageCount - 1);
    const visible = squads.slice(armyPage * ARMY_PAGE_SIZE, (armyPage + 1) * ARMY_PAGE_SIZE);
    const fragment = document.createDocumentFragment();
    for (const squad of visible) fragment.appendChild(buildArmyCard(squad));
    list.replaceChildren(fragment);
    if (!squads.length) list.textContent = "Recruit mercenaries from the Tavern to create your first squad.";

    const count = document.getElementById("army-selected-count");
    count.textContent = armySelectedSquads.size + " selected";
    const opponent=enemyType||getEnemyType(currentLevel);
    const neutral=squads.reduce((sum,group)=>sum+getArmySquadDps(group,true),0);
    document.getElementById("army-stats").textContent =
        squads.length+" squads · "+hiredMercenaries.length+" mercenaries · "+
        formatDigits(neutral,1,0).trim()+" neutral DPS · "+
        formatDigits(getAutoDamage(),1,0).trim()+" effective DPS vs "+
        opponent.name+" ("+opponent.trait+")";
    document.getElementById("army-page-status").textContent =
        "Page " + (armyPage + 1) + " of " + pageCount;
    document.getElementById("army-prev").disabled = armyPage === 0;
    document.getElementById("army-next").disabled = armyPage >= pageCount - 1;
    document.getElementById("army-recruit").disabled =
        structures.tavern.level * 5 <= hiredMercenaries.length || hireMercenaryCost() > gold;
    updateArmyQuote();
    renderSquadCampaigns();
}

function resetArmySelection() {
    armySelectedSquads.clear();
    armyExpandedSquads.clear();
    armySelectionInitialized = false;
    armyPage = 0;
    const view = document.getElementById("army-view");
    if (view && view.style.display !== "none") renderArmyView();
}

function initArmyManager() {
    document.getElementById("army-select-all").addEventListener("click", armySelectAll);
    document.getElementById("army-clear").addEventListener("click", armyClearSelection);
    document.getElementById("army-upgrade-selected").addEventListener("click", armyUpgradeSelected);
    document.getElementById("army-recruit").addEventListener("click", armyRecruitFive);
    document.getElementById("army-upgrade-type").addEventListener("change", updateArmyQuote);
    document.getElementById("army-amount").addEventListener("change", updateArmyQuote);
    document.getElementById("army-sort").addEventListener("change", () => {
        armyPage = 0;
        renderArmyView();
    });
    document.getElementById("army-prev").addEventListener("click", () => {
        armyPage--;
        renderArmyView();
    });
    document.getElementById("army-next").addEventListener("click", () => {
        armyPage++;
        renderArmyView();
    });
}
document.addEventListener("DOMContentLoaded", initArmyManager);
