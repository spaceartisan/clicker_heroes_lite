let structures = {
    castle: { level: 1, baseCost: 50000 },
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
    const base = Math.floor(structure.baseCost * Math.pow(growth, Math.max(0, structure.level)));
    return Math.max(1, Math.ceil(base * getStructureCostFactor(id)));
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
}

let persistentMiniBuildings = [];

function drawKingdom() {
    const canvas = document.getElementById("kingdom-canvas");
    const ctx = canvas.getContext("2d");
    const unit = canvas.width / 20;
    const paint = (x, y, w, h, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const tile = (x, y, w, h, color) => paint(x * unit, y * unit, w * unit, h * unit, color);
    const roof = (x, y, w, h, main, edge) => {
        tile(x, y, w, h, "#20202a");
        tile(x + .12, y + .12, w - .24, h - .24, main);
        tile(x + .12, y + .12, w - .24, .32, edge);
        tile(x + .15, y + h - .37, w - .3, .17, edge);
    };
    const banner = (x, y, color) => {
        tile(x, y, .12, 1.1, "#e4cfa4");
        tile(x + .13, y + .08, .52, .42, color);
        tile(x + .51, y + .38, .14, .12, color);
    };

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    // Consistent, low-cost pixel landscape: no animation or external images.
    tile(0, 0, 20, 20, "#365b35");
    for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
            const n = ((x * 89 + y * 47 + x * y * 13) % 17);
            if (n <= 4) tile(x + .1, y + .2, .72, .5, n % 2 ? "#456b40" : "#3d6339");
            if (n === 6) tile(x + .3, y + .62, .28, .14, "#73934b");
        }
    }

    // River, embankments, old stones, orchard.
    tile(0, 0, 2.1, 5.6, "#284956");
    tile(.2, 0, 1.45, 5.6, "#356b78");
    tile(.45, .5, .8, 2.2, "#438595");
    tile(.5, 3.4, .78, 1.6, "#438595");
    for (const tree of [[2,1],[3,3],[16,2],[18,4],[1,17],[18,17],[2,7],[17,7],[4,18]]) {
        tile(tree[0] + .34, tree[1] + .7, .25, .45, "#5d4230");
        tile(tree[0], tree[1] - .06, 1, .9, "#24442e");
        tile(tree[0] + .15, tree[1] + .1, .72, .62, "#4d8743");
        tile(tree[0] + .28, tree[1] + .14, .25, .17, "#79a95b");
    }
    for (const stone of [[4,6],[15,5],[18,14],[1,13]]) {
        tile(stone[0],stone[1],.8,.4,"#798478");
        tile(stone[0]+.15,stone[1],.5,.15,"#adb1a2");
    }

    // Roads gain detail as the castle expands, and connect all built structures.
    const castleLevel = structures.castle.level;
    tile(9.5, 6.3, 1.5, 13.7, "#73634e");
    tile(9.72, 6.3, 1.06, 13.7, "#a99365");
    for (let i = 7; i < 20; i += 2) {
        tile(9.72, i, 1.04, .12, "#d1b27e");
    }
    const built = [["tavern",2,10],["blacksmith",6,14],["barracks",12,14],["market",16,10]];
    for (const item of built) {
        const [id,x,y] = item;
        if (structures[id].level === 0) continue;
        const from = x < 10 ? x + 2 : 10.8;
        const to = x < 10 ? 9.8 : x;
        tile(from, y + .95, Math.max(.25, to - from), .56, "#baa077");
        tile(from, y + 1.17, Math.max(.25, to - from), .14, "#d6b787");
    }

    // Castle becomes an expanding visible keep, not a single flat gray square.
    tile(7.55, 2.15, 5.1, 4.8, "#2c302c");
    tile(7.8, 2.35, 4.64, 4.35, "#8c8d7c");
    tile(8, 2.55, 4.2, 3.85, "#b0a994");
    roof(8.35, 3.0, 3.55, 2.75, "#667282", "#9eabb0");
    tile(9.73, 4.45, .7, 1.32, "#2b292e");
    tile(9.85, 4.65, .45, 1.1, "#493d34");
    banner(11.85, 2.05, "#eec65e");
    if (castleLevel >= 2) {
        for (const xy of [[7.5,2],[11.9,2],[7.5,5.8],[11.9,5.8]]) {
            tile(xy[0],xy[1],.8,.8,"#343845");
            tile(xy[0]+.09,xy[1]+.07,.62,.55,"#acb5ae");
            tile(xy[0]+.16,xy[1]+.12,.22,.18,"#d5dbcb");
        }
    }
    if (castleLevel >= 4) {
        roof(6.7,3.4,1.7,1.7,"#687e81","#c0cfc6");
        roof(11.65,3.4,1.7,1.7,"#687e81","#c0cfc6");
        banner(7.2,2.4,"#af4944");
    }
    if (castleLevel >= 8) {
        tile(8.2,5.9,3.7,.4,"#44424a");
        for (let i = 0; i < 4; i++) tile(8.3 + i*.95,5.6,.64,.56,"#d0ccb6");
    }
    if (castleLevel >= 12) {
        // Outer ward with additional housing and a bustling wall.
        tile(6.45,1.7,7.2,.25,"#b4b4a1");
        tile(6.45,6.85,7.2,.25,"#b4b4a1");
        roof(5.5,7.7,1.5,1.2,"#94563e","#e09e64");
        roof(13.2,7.7,1.5,1.2,"#7e5c46","#c08c66");
    }
    if (castleLevel >= 20) {
        for (const xy of [[4.3,8.4],[15.0,8.8],[5.2,5.8],[14.3,5.4]]) {
            roof(xy[0],xy[1],1.2,1,"#a56f48","#deb481");
        }
    }

    // All sites remain legible before construction; each upgraded building
    // acquires recognizable decorations representing its gameplay purpose.
    for (const [id,x,y] of built) {
        const lvl = structures[id].level;
        tile(x-.12,y-.12,2.24,2.28,"#2b2925");
        tile(x,y,2,2,lvl > 0 ? "#9b8765" : "#545947");
        if (lvl === 0) {
            tile(x+.25,y+.27,1.5,1.48,"#5b614e");
            tile(x+.4,y+.45,1.2,.12,"#a4a187");
            tile(x+.5,y+1.3,1,.12,"#8f907b");
            continue;
        }
        if (id === "tavern") {
            roof(x+.16,y+.17,1.68,1.5,"#995449","#db9470");
            tile(x+.72,y+1.18,.47,.56,"#403329");
            tile(x+.08,y+1.7,.55,.18,"#e5c16d");
            tile(x+1.5,y+1.65,.28,.25,"#ffca60");
            if (lvl >= 3) {
                tile(x-.6,y+.3,.54,.56,"#ae6d4f");
                tile(x-.5,y+.46,.32,.15,"#e7bd7c");
            }
            if (lvl >= 6) {
                tile(x+2.15,y+.35,.52,.4,"#99714b");
                tile(x+2.18,y+.22,.46,.15,"#e7af77");
            }
        } else if (id === "blacksmith") {
            roof(x+.12,y+.21,1.72,1.53,"#5e5657","#958782");
            tile(x+.35,y+1.0,.46,.68,"#27242a");
            tile(x+.45,y+1.16,.27,.3,"#e98539");
            tile(x+1.47,y-.56,.3,1.0,"#544448");
            tile(x+1.43,y-.61,.4,.18,"#a2998e");
            tile(x+1.16,y+1.7,.5,.17,"#b5afac");
            if (lvl >= 2) {
                tile(x-.5,y+1.3,.42,.37,"#a1a2a1");
                tile(x-.39,y+1.08,.20,.33,"#d4d8d3");
            }
            if (lvl >= 4) {
                tile(x+1.9,y+.6,.22,.43,"#ef843f");
                tile(x+1.84,y+.7,.30,.19,"#ffd36a");
            }
            if (lvl >= 6) banner(x+1.63,y-1.15,"#8d6bda");
        } else if (id === "barracks") {
            roof(x+.18,y+.15,1.65,1.57,"#3e6680","#77adc4");
            tile(x+.73,y+1.24,.42,.49,"#3a3330");
            banner(x+1.51,y-.97,"#6ca5c6");
            if (lvl >= 2) {
                tile(x+2.15,y+.32,.17,.7,"#e7c494");
                tile(x+1.99,y+.42,.48,.13,"#c8a77d");
                tile(x+2.17,y+1.23,.15,.54,"#d8b589");
            }
            if (lvl >= 4) banner(x-.56,y-.85,"#ba8fe4");
            if (lvl >= 6) banner(x+2.25,y-.8,"#d0a856");
            // Selected army composition appears on the training field.
            const colors = { vanguard:"#d38768", ranger:"#7eae81", mystic:"#c1a3e6", raider:"#efc56a" };
            const squads = [...new Set(hiredMercenaries.map(m => m.squad))].slice(0,6);
            for (let i = 0; i < squads.length; i++) {
                tile(x-.6+i*.37,y+2.1,.25,.24,colors[getSquadBuild(squads[i]).role] || "#ddd");
            }
        } else if (id === "market") {
            roof(x+.11,y+.24,1.75,1.32,"#a9853d","#ecc065");
            tile(x+.2,y+1.4,1.58,.2,"#543d2e");
            tile(x+.4,y+1.62,.25,.23,"#d4673d");
            tile(x+.78,y+1.62,.25,.23,"#e9bd63");
            tile(x+1.15,y+1.62,.25,.23,"#74a34e");
            if (lvl >= 2) {
                roof(x+2.22,y+.8,.95,.65,"#a75547","#e8a75a");
            }
            if (lvl >= 5) {
                roof(x+2.2,y+1.7,.93,.65,"#7b5f9c","#c9afdf");
            }
        }
        if (lvl >= 10) {
            tile(x-.16,y-.16,.28,.28,"#ead382");
            tile(x+1.88,y-.16,.28,.28,"#ead382");
        }
    }
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
    btn.textContent = text;
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
    const heading = document.createElement("h4");
    heading.textContent = "Royal Court";
    upgradeButtons.appendChild(heading);
    const help = document.createElement("p");
    help.textContent = "The Castle raises your hero level cap and increases click damage by 1.5% per Castle level (up to +60%).";
    upgradeButtons.appendChild(help);
    createButton(upgradeButtons, "📚 Open Royal Academy · Research Tree", () => openResearchTree());
    const insight = document.createElement("p");
    insight.textContent = getResearchInsightAvailable() + " Insight available. First-time boss clears and Castle milestones earn Insight.";
    upgradeButtons.appendChild(insight);
    container.replaceChildren();
    const activeLabel = document.createElement("h4");
    activeLabel.textContent = "Hero abilities";
    container.appendChild(activeLabel);
    for (const ability of abilities) {
        const p = document.createElement("p");
        p.className = "castle-skill-summary";
        p.textContent = ability.name + " · Hero Lv " + ability.unlockLevel + " · " + ability.description;
        container.appendChild(p);
    }

    upgradeButtons2.replaceChildren();
    const title = document.createElement("h4");
    title.textContent = "Royal Decrees";
    upgradeButtons2.appendChild(title);
    const note = document.createElement("p");
    note.textContent = "Permanent passive upgrades. Each requires an appropriate Castle and hero level.";
    upgradeButtons2.appendChild(note);
    container2.replaceChildren();
    for (const ability of passiveAbilities) {
        const row = document.createElement("article");
        row.className = "upgrade-row castle-decree";
        const info = document.createElement("div");
        const heading = document.createElement("strong");
        heading.textContent = ability.name + " · Rank " + ability.level + "/" + ability.maxLevel;
        const effect = document.createElement("p");
        effect.textContent = ability.description;
        info.append(heading,effect);
        const button = document.createElement("button");
        const unlocked = isRoyalSkillUnlocked(ability);
        const capped = ability.level >= ability.maxLevel;
        const cost = upgradeSkillCost(ability, true);
        button.textContent = capped ? "Max rank" : !unlocked ?
            "Hero Lv " + ability.unlockLevel + " · Castle Lv " + (ability.castleLevel || 1) :
            "Upgrade " + formatDigits(cost[0], 2, 0).trim() + " g";
        button.disabled = capped || !unlocked || !cost[1] || gold < cost[0];
        button.onclick = () => {
            if (!upgradeSkill(ability)) return;
            CastleUpgradeUI(menu,upgradeButtons,upgradeButtons2,container,container2);
        };
        row.append(info,button);
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
    createButton(upgradeButtons,"📚 Royal Academy research", () => openResearchTree());
    container.replaceChildren();
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

function showMenu(name) {
    const menu = document.getElementById("upgrade-menu");
    menu.style.display = "flex";
    const upgradeName = document.getElementById("upgrade-name");
    upgradeName.textContent = `${name.charAt(0).toUpperCase() + name.slice(1)} Upgrade`;
    const popupContent = document.querySelector("#upgrade-menu .popup-content");

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

    if (hiredMercenaries.length > 0) {
        emptyMessage.style.display = "none";
    } else {
        emptyMessage.style.display = "block";
    }

    if (["tavern", "barracks", "blacksmith"].includes(name)) {
        createButton(upgradeButtons, "⚔️ Manage Entire Army", () => {
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

    if (!document.getElementById("close-upgrade-menu")) {
        const closeButton = document.createElement("button");
        closeButton.textContent = "Close";
        closeButton.id = "close-upgrade-menu";
        closeButton.onclick = () => closeMenu(name);
        popupContent.appendChild(closeButton);
    }


}

function closeMenu(name) {
    const menu = document.getElementById("upgrade-menu");
    const closeButton = document.getElementById("close-upgrade-menu");

    if (closeButton && closeButton.parentElement) {
        closeButton.parentElement.removeChild(closeButton);
    }

    menu.style.display = "none";
}

