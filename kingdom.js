let structures = {
    castle: { level: 1, baseCost: 30000 },
    tavern: { level: 0, baseCost: 35000, upgradeType: 4 },
    blacksmith: { level: 0, baseCost: 20000, upgradeType: 3 },
    barracks: { level: 0, baseCost: 20000, upgradeType: 3 },
    market: { level: 0, baseCost: 10000, upgradeType: 2 }
};

const structurePositions = {
    castle: { x: 9, y: 3 },
    tavern: { x: 2, y: 10 },
    blacksmith: { x: 6, y: 14 },
    barracks: { x: 12, y: 14 },
    market: { x: 16, y: 10 }
};

// Progression gates are enforced in purchases as well as the UI.
const KINGDOM_UNLOCK_STAGES = { tavern: 10, market: 20, blacksmith: 25, barracks: 25 };
function requiredCastleLevel(id, nextLevel) {
    if (id === "tavern" && nextLevel === 1) return 1;
    if (id === "market") return Math.max(1, nextLevel);
    if (id === "blacksmith" || id === "barracks") return Math.max(2, nextLevel + 1);
    return Math.max(1, nextLevel);
}
function structureLockReason(id) {
    if (!(id in structures)) return "Unknown structure";
    if (id === "castle") return "";
    const nextLevel = structures[id].level + 1;
    if (nextLevel === 1 && maxLevel <= (KINGDOM_UNLOCK_STAGES[id] || 0)) {
        return "Clear stage " + KINGDOM_UNLOCK_STAGES[id];
    }
    const required = requiredCastleLevel(id, nextLevel);
    if (structures.castle.level < required) return "Castle Lv " + required + " required";
    return "";
}
function getStructureCost(structure) {
    const id = Object.keys(structures).find(key => structures[key] === structure) || "castle";
    const growth = id === "castle" ? 1.35 : 1.45;
    const price=structure.baseCost*Math.pow(growth,Math.max(0,structure.level))*
        getStructureCostFactor(id);
    return Number.isFinite(price)?Math.max(1,Math.ceil(Math.min(1e290,price))):1e290;
}
function upgradeStructure(id) {
    const structure = structures[id];
    if (!structure) return false;
    const locked = structureLockReason(id);
    if (locked) {
        showPopupMessage(locked, false, 1500);
        return false;
    }
    const cost = id === "tavern" && structure.level === 0 ? 0 : getStructureCost(structure);
    if (gold < cost) {
        showPopupMessage("Not enough gold!", false, 900);
        return false;
    }
    gold -= cost;
    structure.level++;
    highestCastleEver=Math.max(highestCastleEver,structures.castle.level);
    updateStructureUI();
    updateUI();
    drawKingdom();
    saveGame();
    return true;
}
function updateStructureUI() {
    for (const [id, structure] of Object.entries(structures)) {
        const el = document.getElementById(id + "-lvl");
        const costEl = document.getElementById(id + "-cost");
        const button = costEl ? costEl.closest("button") : null;
        const locked = structureLockReason(id);
        if (button) {
            button.disabled = !!locked;
            button.classList.toggle("locked", !!locked);
        }
        if (el) el.textContent = structure.level;
        if (costEl) {
            const free = id === "tavern" && structure.level === 0;
            costEl.textContent = locked || (free ? "Build free" :
                "Upgrade " + formatDigits(getStructureCost(structure), 2, 0).trim() + " g");
        }
    }
    if(typeof updateTreasuryUI === "function") updateTreasuryUI();
}

let persistentMiniBuildings = [];

function drawKingdom() {
    const canvas = document.getElementById("kingdom-canvas");
    const squads = [...new Set(hiredMercenaries.map(m => m.squad))].slice(0,6);
    KingdomArt.draw(canvas.getContext("2d"), {
        levels: Object.fromEntries(Object.entries(structures).map(([id,s]) => [id,s.level])),
        stage: maxLevel,
        roles: squads.map(id => getSquadBuild(id).role)
    }, canvas.width);
}


function drawStructure(ctx, x, y, width, height, color) {
    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            ctx.fillStyle = color;
            ctx.fillRect((x + i) * 20, (y + j) * 20, 20, 20);
        }
    }
}

function checkClickLocation(event) {
    const canvas = document.getElementById("kingdom-canvas");
    const rect = canvas.getBoundingClientRect();
    const rescale_x = canvas.width / (rect.width); // Assuming canvas is 400x400
    const rescale_y = canvas.height / (rect.height); // Assuming canvas is 400x400
    const x = Math.floor((event.clientX - rect.left) / 20 * rescale_x);
    const y = Math.floor((event.clientY - rect.top) / 20 * rescale_y);

    // Check if click is on a structure
    for (const [name, element] of Object.entries(structurePositions)) {
        let deltaX = Math.abs(x - element.x);
        let deltaY = Math.abs(y - element.y);
        if (structures[name].level > 0 && deltaX <= 2 && deltaY <= 2) {
            showMenu(name);
            return;
        }
    }
}

function addLabeledParagraph(parent, label, value, className) {
    const p = document.createElement("p");
    if (label === "" && value === "") {
        p.textContent = "";
    }
    else {
        p.textContent = `${label}: ${value}`;
    }
    if (className) {
        p.className = className + "-upgrade-menu-popup";
    }
    parent.appendChild(p);
}

function updateLabeledParagraph(parent, label, value, className) {
    const p = parent.querySelector(`p.${className}-upgrade-menu-popup`);
    if (p) {
        p.textContent = `${label}: ${value}`;
    }
}

function createButton(parent, text, ...listeners) {
    const btn = document.createElement("button");
    if (text.includes("Royal Academy")) setIconLabel(btn, "research", text);
    else if (text.includes("Manage Entire Army")) setIconLabel(btn, "army", text);
    else btn.textContent = text;
    listeners.forEach(listener => btn.addEventListener("click", listener));
    parent.appendChild(btn);
}


// Combat specializations are attached to existing Barracks/Blacksmith menus,
// with a single selector per squad so large armies remain manageable on phones.
function appendSquadLoadoutUI(container, mode) {
    const squads = Math.ceil(hiredMercenaries.length / 5);
    if (squads < 1) return;

    const heading = document.createElement("h4");
    heading.textContent = mode === "role" ? "Squad specializations" : "Squad equipment";
    heading.className = "loadout-heading";
    container.appendChild(heading);

    const tip = document.createElement("p");
    tip.className = "loadout-hint";
    tip.textContent = mode === "role"
        ? "Barracks levels unlock combat roles. Match squads to enemy weaknesses."
        : "Buy a kit once per squad; switching owned equipment is free.";
    container.appendChild(tip);

    for (let squadId = 1; squadId <= squads; squadId++) {
        const id = squadId;
        const build = getSquadBuild(id);
        const row = document.createElement("div");
        row.className = "loadout-row";
        const label = document.createElement("label");
        label.textContent = "Squad " + id;
        const choices = document.createElement("select");
        choices.setAttribute("aria-label", "Squad " + id + " " + (mode === "role" ? "role" : "equipment"));
        const info = document.createElement("small");
        info.className = "loadout-hint";
        const choicesData = mode === "role" ? SQUAD_ROLES : EQUIPMENT_KITS;
        const level = mode === "role" ? structures.barracks.level : structures.blacksmith.level;

        choicesData.forEach(choice => {
            const option = document.createElement("option");
            option.value = choice.id;
            option.textContent = choice.name + (level < choice.unlock ? " · Lv " + choice.unlock : "");
            option.disabled = level < choice.unlock;
            option.title = choice.summary;
            choices.appendChild(option);
        });
        choices.value = mode === "role" ? build.role : build.kit;
        const details = () => {
            const chosen = choicesData.find(choice => choice.id === choices.value) || choicesData[0];
            if (mode === "role") {
                info.textContent = chosen.summary;
            } else {
                const owned = build.ownedKits.includes(chosen.id);
                const cost = owned ? "Owned" : formatDigits(squadUpgradeKitCost(id, chosen.id), 0, 0) + " gold";
                info.textContent = chosen.summary + " · " + cost;
            }
        };
        details();
        if (mode === "role") {
            choices.addEventListener("change", () => {
                if (!setSquadRole(id, choices.value)) choices.value = getSquadBuild(id).role;
                details();
            });
            row.append(label, choices, info);
        } else {
            const button = document.createElement("button");
            button.className = "loadout-action";
            const updateButton = () => {
                const buildNow = getSquadBuild(id);
                const owned = buildNow.ownedKits.includes(choices.value);
                button.textContent = buildNow.kit === choices.value ? "Equipped" : owned ? "Equip" : "Forge";
                button.disabled = buildNow.kit === choices.value;
                details();
            };
            choices.addEventListener("change", updateButton);
            button.addEventListener("click", () => {
                buyOrEquipSquadKit(id, choices.value);
                updateButton();
            });
            updateButton();
            row.append(label, choices, button, info);
        }
        container.appendChild(row);
    }
}

function TavernUpgradeUI(menu, upgradeButtons, container, multContainer) {
    levelUpCostTextArray = [];

    function UpdateMercenaryList(merc, i) {
        const row = document.createElement("div");
        if (hiredMercenaries.length > 0) {
            container.style.display = "block";
            document.getElementById("upgrade-empty-message").style.display = "none";
        }
        row.className = "upgrade-row";
        row.innerHTML = `
                        <div style="display: flex; justify-content: space-between; width: 100%;">
                            <span id="merc-name-${i}">${merc.name} (Lv ${merc.level}) — Squad ${merc.squad}</span>
                            <span><button class="mult-btn-tiny" onclick="levelUpMercenary(${i})">Lvl Up ${formatDigits(levelUpMercenaryCost(i), 2, 5)} g</button></span>
                        </div>
                        `;
        row.style.borderLeft = "5px solid #4CAF50"; // Green color
        row.style.color = "#fff"; // Text color
        container.appendChild(row);
        levelUpCostTextArray[i] = row.querySelector("button");
        const lvlBtn = row.querySelector("button");
        const mercStats = row.querySelector(`#merc-name-${i}`);
        lvlBtn.addEventListener("click", () => {
            lvlBtn.textContent = `Lvl Up ${formatDigits(levelUpMercenaryCost(i), 2, 5)} g`;
            mercStats.textContent = `${merc.name} (Lv ${merc.level}) — Squad ${merc.squad}`;
        });
        updateLabeledParagraph(upgradeButtons, "Hired Mercenaries", `${hiredMercenaries.length}/${structures.tavern.level * 5}`, "mercenary-count");
        updateLabeledParagraph(upgradeButtons, "Next Mercenary", `${formatDigits(hireMercenaryCost(), 2, 5)} g`, "next-mercenary");
    }

    addLabeledParagraph(upgradeButtons, "Hired Mercenaries", `${hiredMercenaries.length}/${structures.tavern.level * 5}`, "mercenary-count");
    addLabeledParagraph(upgradeButtons, "Next Mercenary", `${formatDigits(hireMercenaryCost(), 2, 5)} g`, "next-mercenary");
    addLabeledParagraph(upgradeButtons, "Max Level Cap", `${(passiveAbilities[0].level - 1) * 10 + 100}`, "max-level-cap");
    createButton(upgradeButtons, "Hire",
        () => {
            let success = hireMercenary();
            if (success) {
                const lastMerc = hiredMercenaries[hiredMercenaries.length - 1];
                UpdateMercenaryList(lastMerc, hiredMercenaries.length - 1);
            }
        }
    );


    hiredMercenaries.forEach((merc, i) => {
        UpdateMercenaryList(merc, i);
    });

    // Add a listener to the multiplier buttons
    const multButtons = multContainer.querySelectorAll(".mult-btn");
    multButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            levelUpCostTextArray.forEach((costText, index) => {
                const merc = hiredMercenaries[index];
                if (merc) {
                    const cost = levelUpMercenaryCost(index);
                    costText.textContent = `Lvl Up ${formatDigits(cost, 2, 5)} g`;
                }
            });
        });
    });
}

function BarracksUpgradeUI(menu, upgradeButtons, container, multContainer) {
    function romNum(num) {
        let val = weaponQualities[Math.floor(num / 3)] || -1;
        if (val === -1) return num - weaponQualities.length * 3;
        return romanNumerals[num % 3];
    }

    speedUpgradeCostTextArray = [];

    const totalSquads = Math.ceil(hiredMercenaries.length / 5);
    if (totalSquads === 0) {
        addLabeledParagraph(upgradeButtons, "", "", "total-squads");
    } else {
        addLabeledParagraph(upgradeButtons, "Total Squads", `${totalSquads}`, "total-squads");
    }
    const merc = hiredMercenaries;
    for (let i = 1; i <= totalSquads; i++) {
        const squadMercs = merc.filter(m => m.squad === i);
        if (squadMercs.length === 0) continue;
        const row = document.createElement("div");
        row.className = "upgrade-row";
        row.innerHTML = `
                        <div style="display: flex; justify-content: space-between; width: 100%;">
                            <span id="squad-${i}-speed">Squad ${i} - ${soldierRanks[Math.floor(squadMercs[0].attackSpeedLevel / 3)] || "Infinity"} Unit ${romNum(squadMercs[0].attackSpeedLevel)}</span>
                            <span><button class="mult-btn-tiny" onclick="upgradeMercSpeed(${i})">Lvl Up ${formatDigits(upgradeMercenarySpeedCost(squadMercs[0]), 2, 5)} g</button></span>
                        </div>
                        `;
        row.style.borderLeft = `5px solid ${weaponQualityColors[Math.floor(squadMercs[0].attackSpeedLevel / 3)] || "#ff0000"}`; // red border color
        row.style.color = weaponQualityColors[Math.floor(squadMercs[0].attackSpeedLevel / 3)] || "#ff0000"; // Text color // red text color
        const speedBtn = row.querySelector("button");
        const speedText = row.querySelector(`#squad-${i}-speed`);
        speedUpgradeCostTextArray[i] = speedBtn;
        speedBtn.addEventListener("click", () => {
            speedBtn.textContent = `Lvl Up ${formatDigits(upgradeMercenarySpeedCost(squadMercs[0]), 2, 5)} g`;
            speedText.textContent = `Squad ${i} - ${soldierRanks[Math.floor(squadMercs[0].attackSpeedLevel / 3)] || "Infinity"} Unit ${romNum(squadMercs[0].attackSpeedLevel)}`;
            speedText.parentElement.parentElement.style.borderLeft = `5px solid ${weaponQualityColors[Math.floor(squadMercs[0].attackSpeedLevel / 3)] || "#ff0000"}`; // red border color
            speedText.parentElement.parentElement.style.color = weaponQualityColors[Math.floor(squadMercs[0].attackSpeedLevel / 3)] || "#ff0000"; // Text color // red text color
        });
        container.appendChild(row);
    }

    addLabeledParagraph(upgradeButtons, "Max Speed", `${(structures.barracks.level - 1) * 2 + 5}`, "max-speed-cap");
    // Add a listener to the multiplier buttons
    const multButtons = multContainer.querySelectorAll(".mult-btn");
    multButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            speedUpgradeCostTextArray.forEach((costText, index) => {
                const squadMercs = hiredMercenaries.filter(m => m.squad === index);
                if (squadMercs.length > 0) {
                    const cost = upgradeMercenarySpeedCost(squadMercs[0]);
                    costText.textContent = `Lvl Up ${formatDigits(cost, 2, 5)} g`;
                }
            });
        });
    });
    appendSquadLoadoutUI(container, "role");

}

function BlacksmithUpgradeUI(menu, upgradeButtons, container, multContainer) {
    function romNum(num) {

        let val = weaponQualities[Math.floor(num / 3)] || -1;
        if (val === -1) return num - weaponQualities.length * 3;
        return romanNumerals[num % 3];
    }

    gearUpgradeCostTextArray = [];

    const totalSquads = Math.ceil(hiredMercenaries.length / 5);
    if (totalSquads === 0) {
        addLabeledParagraph(upgradeButtons, "", "", "total-squads");
    } else {
        addLabeledParagraph(upgradeButtons, "Total Squads", `${totalSquads}`, "total-squads");
    }

    const merc = hiredMercenaries;
    for (let i = 1; i <= totalSquads; i++) {
        const squadMercs = merc.filter(m => m.squad === i);
        if (squadMercs.length === 0) continue;
        const row = document.createElement("div");
        row.className = "upgrade-row";
        row.innerHTML = `
                        <div style="display: flex; justify-content: space-between; width: 100%;">
                            <span id="squad-${i}-gear">Squad ${i} - ${weaponQualities[Math.floor(squadMercs[0].gearLevel / 3)] || "Ascendant"} Gear ${romNum(squadMercs[0].gearLevel)}</span>
                            <span><button class="mult-btn-tiny" onclick="upgradeMercGear(${i})">Lvl Up ${formatDigits(upgradeMercenaryGearCost(squadMercs[0]), 2, 5)} g</button></span>
                        </div>
                        `;
        row.style.borderLeft = `5px solid ${weaponQualityColors[Math.floor(squadMercs[0].gearLevel / 3)] || "#ff0000"}`; // red border color
        row.style.color = weaponQualityColors[Math.floor(squadMercs[0].gearLevel / 3)] || "#ff0000"; // Text color // red text color
        const gearBtn = row.querySelector("button");
        const gearText = row.querySelector(`#squad-${i}-gear`);
        gearUpgradeCostTextArray[i] = gearBtn;
        gearBtn.addEventListener("click", () => {
            // Modulus 3 to get the correct gear level
            gearBtn.textContent = `Lvl Up ${formatDigits(upgradeMercenaryGearCost(squadMercs[0]), 2, 5)} g`;
            gearText.textContent = `Squad ${i} - ${weaponQualities[Math.floor(squadMercs[0].gearLevel / 3)] || "Ascendant"} Gear ${romNum(squadMercs[0].gearLevel)}`;
            gearText.parentElement.parentElement.style.borderLeft = `5px solid ${weaponQualityColors[Math.floor(squadMercs[0].gearLevel / 3)] || "#ff0000"}`;
            gearText.parentElement.parentElement.style.color = weaponQualityColors[Math.floor(squadMercs[0].gearLevel / 3)] || "#ff0000"; // Text color // red text color
        });
        container.appendChild(row);
    }

    addLabeledParagraph(upgradeButtons, "Max Gear Tier", `${(structures.blacksmith.level - 1) * 2 + 5}`, "max-gear-cap");
    // Add a listener to the multiplier buttons
    const multButtons = multContainer.querySelectorAll(".mult-btn");
    multButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            gearUpgradeCostTextArray.forEach((costText, index) => {
                const squadMercs = hiredMercenaries.filter(m => m.squad === index);
                if (squadMercs.length > 0) {
                    const cost = upgradeMercenaryGearCost(squadMercs[0]);
                    costText.textContent = `Lvl Up ${formatDigits(cost, 2, 5)} g`;
                }
            });
        });
    });
    appendSquadLoadoutUI(container, "kit");

}

function isRoyalSkillUnlocked(ability) {
    return playerLevel >= ability.unlockLevel &&
        structures.castle.level >= (ability.castleLevel || 1);
}
function CastleUpgradeUI(menu, upgradeButtons, upgradeButtons2, container, container2) {
    // Rebuild the whole Castle panel on purchase, never append another Court header.
    upgradeButtons.replaceChildren();
    upgradeButtons2.replaceChildren();
    container.replaceChildren();
    container2.replaceChildren();

    const summary = document.createElement("p");
    summary.className = "castle-intro";
    summary.textContent = "Castle levels raise your hero cap and add up to +60% click damage.";
    upgradeButtons.appendChild(summary);

    const research = document.createElement("button");
    research.className = "castle-research-button";
    setIconLabel(research, "research", "Open Royal Academy");
    research.addEventListener("click", openResearchTree);
    upgradeButtons.appendChild(research);

    const insight = document.createElement("p");
    insight.className = "castle-insight";
    insight.textContent = formatDigits(getResearchInsightAvailable(), 0, 0).trim() +
        " Insight available · Earn more from bosses and Castle milestones";
    upgradeButtons.appendChild(insight);

    // Abilities are reference text, not primary upgrade actions. Keep collapsed.
    const abilitiesPanel = document.createElement("details");
    abilitiesPanel.className = "castle-abilities";
    const abilitiesSummary = document.createElement("summary");
    abilitiesSummary.textContent = "Hero abilities (" + abilities.length + ")";
    abilitiesPanel.appendChild(abilitiesSummary);
    for (const ability of abilities) {
        const item = document.createElement("p");
        item.className = "castle-skill-summary";
        item.textContent = ability.name + " · Hero Lv " + ability.unlockLevel +
            " · " + ability.description;
        abilitiesPanel.appendChild(item);
    }
    container.appendChild(abilitiesPanel);

    const heading = document.createElement("h4");
    heading.className = "castle-decrees-heading";
    heading.textContent = "Royal Decrees";
    upgradeButtons2.appendChild(heading);
    const help = document.createElement("p");
    help.className = "castle-decrees-help";
    help.textContent = "Permanent royal upgrades. Higher ranks require hero and Castle levels.";
    upgradeButtons2.appendChild(help);

    for (const ability of passiveAbilities) {
        const row = document.createElement("article");
        row.className = "upgrade-row castle-decree";
        const info = document.createElement("div");
        info.className = "castle-decree-info";
        const title = document.createElement("strong");
        title.textContent = ability.name;
        const rank = document.createElement("small");
        rank.className = "castle-decree-rank";
        rank.textContent = "Rank " + ability.level + "/" + ability.maxLevel;
        const description = document.createElement("p");
        description.textContent = ability.description;
        info.append(title, rank, description);

        const button = document.createElement("button");
        const unlocked = isRoyalSkillUnlocked(ability);
        const capped = ability.level >= ability.maxLevel;
        const quote = upgradeSkillCost(ability, true);
        button.textContent = capped ? "Max rank" : !unlocked
            ? "Requires Hero " + ability.unlockLevel + " · Castle " + (ability.castleLevel || 1)
            : "Upgrade · " + formatDigits(quote[0], 2, 0).trim() + " gold";
        button.disabled = capped || !unlocked || !quote[1] || gold < quote[0];
        button.onclick = () => {
            if (upgradeSkill(ability)) {
                CastleUpgradeUI(menu, upgradeButtons, upgradeButtons2, container, container2);
            }
        };
        row.append(info, button);
        container2.appendChild(row);
    }
}

function getMarketUpgradeLockReason(index) {
    const key = Object.keys(marketUpgrades)[index];
    const market = marketUpgrades[key];
    if (!market) return "Unknown upgrade";
    if (structures.market.level < market.unlockLevel) return "Market Lv " + market.unlockLevel;
    if (market.level >= market.maxLevel) return "Max rank";
    if (market.level >= structures.market.level) return "Upgrade Market building";
    return "";
}
function marketUpgradeCost(index, query = false) {
    const key = Object.keys(marketUpgrades)[index];
    const market = marketUpgrades[key];
    if (!market) return query ? [0,0,true] : 0;
    const isLocked = !!getMarketUpgradeLockReason(index);
    if (isLocked) return query ? [0,0,true] : 0;
    // Earlier 2^level prices made high Market ranks effectively inaccessible.
    // The new 1.65 growth remains steep, but keeps 5-10 ranks in reachable ranges.
    const raw = market.cost * 2 * Math.pow(1.65, market.level);
    const price = Math.max(1, Math.ceil(raw * mktUp(1) * getResearchCostFactor()));
    return query ? [price,1,false] : price;
}
function upgradeMarket(index) {
    const key = Object.keys(marketUpgrades)[index];
    const market = marketUpgrades[key];
    const locked = getMarketUpgradeLockReason(index);
    if (locked) {
        showPopupMessage(locked,false,1500);
        return false;
    }
    const cost = marketUpgradeCost(index);
    if (!(cost > 0) || gold < cost) {
        showPopupMessage("Not enough gold!",false,900);
        return false;
    }
    gold -= cost;
    market.level++;
    updateUI();
    saveGame();
    return true;
}
function MarketUpgradeUI(menu, upgradeButtons, container) {
    upgradeButtons.replaceChildren();
    const heading = document.createElement("h4");
    heading.textContent = "Merchant Guild";
    const hint = document.createElement("p");
    hint.textContent = "Upgrade Market buildings to open more guild projects. Research lowers some expenses and increases rewards.";
    upgradeButtons.append(heading,hint);
    createButton(upgradeButtons,"Royal Academy research", () => openResearchTree());
    container.replaceChildren();
    const guild=document.createElement("article");
    guild.className="market-charter";
    const name=document.createElement("strong");
    name.textContent="Long-term Guild Charters · Rank "+marketCharterRank;
    const desc=document.createElement("p");
    desc.textContent="Repeatable investments · +"+
        Math.round((getMarketCharterBonus()-1)*100)+"% monster gold";
    const invest=document.createElement("button");
    invest.textContent=structures.market.level<4?"Requires Market Lv 4":
      "Invest "+formatDigits(getMarketCharterCost(),2,0).trim()+" gold";
    invest.disabled=structures.market.level<4||gold<getMarketCharterCost();
    invest.addEventListener("click",()=>{
        if(purchaseMarketCharter())MarketUpgradeUI(menu,upgradeButtons,container);
    });
    guild.append(name,desc,invest);
    container.appendChild(guild);
    Object.entries(marketUpgrades).forEach(([key, market], index) => {
        const row = document.createElement("article");
        row.className = "upgrade-row market-project";
        const description = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = market.name + " · Rank " + market.level + "/" + market.maxLevel;
        const detail = document.createElement("p");
        detail.textContent = market.description;
        description.append(name,detail);
        const button = document.createElement("button");
        const locked = getMarketUpgradeLockReason(index);
        const cost = marketUpgradeCost(index);
        button.disabled = !!locked || gold < cost;
        button.textContent = locked || "Buy " + formatDigits(cost, 2, 0).trim() + " g";
        button.onclick = () => {
            if (upgradeMarket(index)) MarketUpgradeUI(menu,upgradeButtons,container);
        };
        row.append(description,button);
        container.appendChild(row);
    });
}

let activeKingdomMenu = null;
function showMenu(name) {
    activeKingdomMenu = name;
    const menu = document.getElementById("upgrade-menu");

    menu.classList.toggle("castle-menu", name === "castle");
    const upgradeName = document.getElementById("upgrade-name");
    upgradeName.textContent = name === "castle" ? "Royal Court" :
        `${name.charAt(0).toUpperCase() + name.slice(1)} Upgrade`;
    const popupContent = document.querySelector("#upgrade-menu .popup-content");
    popupContent.scrollTop = 0;

    const upgradeButtons = document.getElementById("upgrade-buttons");
    upgradeButtons.innerHTML = ""; // Clear previous buttons
    const container = document.getElementById("upgrade-list");
    container.innerHTML = "";
    const upgradeButtons2 = document.getElementById("upgrade-buttons-2");
    upgradeButtons2.innerHTML = ""; // Clear previous buttons
    const container2 = document.getElementById("upgrade-list-2");
    container.innerHTML = "";

    const multContainer = AddMultiplierButtons(menu);
    container.style.display = "block";
    multContainer.style.display = "block";

    const emptyMessage = document.getElementById("upgrade-empty-message");

    emptyMessage.style.display = (name === "castle" || name === "market" ||
        hiredMercenaries.length > 0) ? "none" : "block";

    if (["tavern", "barracks", "blacksmith"].includes(name)) {
        createButton(upgradeButtons, "Manage Entire Army", () => {
            closeMenu(name);
            switchView("army");
        });
    }
    if (name === "tavern") {
        // Hide container2
        container2.style.display = "none";
        if (hiredMercenaries.length === 0) {
            container.style.display = "none";
        }
        TavernUpgradeUI(menu, upgradeButtons, container, multContainer);
    }
    else if (name === "barracks") {
        container2.style.display = "none";
        if (hiredMercenaries.length === 0) {
            container.style.display = "none";
        }
        BarracksUpgradeUI(menu, upgradeButtons, container, multContainer);
    }
    else if (name === "blacksmith") {
        container2.style.display = "none";
        if (hiredMercenaries.length === 0) {
            container.style.display = "none";
        }
        BlacksmithUpgradeUI(menu, upgradeButtons, container, multContainer);
    }
    else if (name === "castle") {
        // Show container2
        container2.style.display = "block";
        multContainer.style.display = "none";
        CastleUpgradeUI(menu, upgradeButtons, upgradeButtons2, container, container2, multContainer);
    }
    else if (name === "market") {
        emptyMessage.style.display = "none";
        container2.style.display = "none";
        multContainer.style.display = "none";
        MarketUpgradeUI(menu, upgradeButtons, container, "multContainer");
    }

    if (typeof GameDialogs === "undefined" && !document.getElementById("close-upgrade-menu")) {
        const closeButton = document.createElement("button");
        closeButton.textContent = "Close";
        closeButton.id = "close-upgrade-menu";
        closeButton.onclick = () => closeMenu(name);
        popupContent.appendChild(closeButton);
    }
    openGameDialog("upgrade-menu", () => closeMenu(activeKingdomMenu));
}

function closeMenu(name) {
    activeKingdomMenu = null;
    const menu = document.getElementById("upgrade-menu");
    const closeButton = document.getElementById("close-upgrade-menu");

    if (closeButton && closeButton.parentElement) {
        closeButton.parentElement.removeChild(closeButton);
    }

    closeGameDialog("upgrade-menu");
    menu.classList.remove("castle-menu");
}

