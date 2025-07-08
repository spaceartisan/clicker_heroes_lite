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

function getStructureCost(structure) {
    return Math.floor(structure.baseCost * Math.pow(1.5, structure.level));
}

function upgradeStructure(name) {
    const s = structures[name];
    let cost = getStructureCost(s);
    if (name === "tavern" && s.level < 1) {
        cost = 0;
    }
    if (gold >= cost) {
        gold -= cost;
        s.level++;
        updateStructureUI();
        updateUI();
        drawKingdom();
    } else {
        alert("Not enough gold!");
    }
}

function updateStructureUI() {
    Object.keys(structures).forEach(name => {
        const el = document.getElementById(`${name}-lvl`);
        const costEl = document.getElementById(`${name}-cost`);
        const btn = document.getElementById(`${name}-cost`)?.closest("button");
        const nameLvl = structures[name].level * structures[name].upgradeType + structures[name].upgradeType + 1;
        const castLvl = structures.castle.level;

        if ((castLvl < nameLvl && name !== "castle")) {
            if (btn) {
                btn.classList.add("locked");
                btn.disabled = true;
            }
        } else {
            if (btn) {
                btn.classList.remove("locked");
                btn.disabled = false;
            }
        }
        if (name === "tavern" && structures.tavern.level < 1 && maxLevel >= 10) {
            if (btn) {
                btn.classList.remove("locked");
                btn.disabled = false;
            }
            console.log("tavern is unlocked")
        }
        if (el) el.textContent = structures[name].level;
        if (costEl) {
            if (btn.disabled) {
                if (name !== "tavern" || (name === "tavern" && maxLevel >= 10)) {
                    costEl.textContent = "Required Castle Level: " + (nameLvl);
                } else {
                    costEl.textContent = "Req Enemy Level: 10";
                }
            } else {
                if (name === "tavern" && structures.tavern.level < 1) {
                    costEl.textContent = "Upgrade Free";
                }
                else {
                    costEl.textContent = "Upgrade " + formatDigits(getStructureCost(structures[name]), 2, 5) + " g";
                }
            }
        }
    });

}

let persistentMiniBuildings = [];

function drawKingdom() {
    let debug = false;
    const canvas = document.getElementById("kingdom-canvas");
    const ctx = canvas.getContext("2d");
    const gridSize = 20;
    const cellSize = canvas.width / gridSize;

    const grassColor = "#2d6b22";
    const castleColor = "#a0a0a0";
    const towerColor = "#666666";
    const annexColor = "#888888";
    const roadColor = "#8b7d7b"; // road color

    const structureColors = {
        tavern: "#b84f4f",
        blacksmith: "#4f4f4f",
        barracks: "#704214",
        market: "#b58900",
    };

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grass
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            ctx.fillStyle = grassColor;
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
    }


    // === Castle ===
    const castleLevel = structures.castle.level;

    // === Seedable Random Utility ===
    function seededRandom(seed) {
        let x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    // === Mini Buildings for Castle Levels 15+ ===
    if (castleLevel >= 15 || debug) {
        const structurePerTier = 3;
        const extraTiers = Math.floor((castleLevel - 15) / 5) + 1;

        const possiblePositions = [
            { x: 96, y: 42 },
            { x: 169, y: 13 },
            { x: 284, y: 181 },
            { x: 303, y: 352 },
            { x: 160, y: 200 },
            { x: 12, y: 308 },
            { x: 201, y: 10 },
            { x: 344, y: 90 },
            { x: 40, y: 108 },
            { x: 240, y: 165 },
            { x: 302, y: 120 },
            { x: 81, y: 332 },
            { x: 88, y: 114 },
            { x: 270, y: 350 },
            { x: 53, y: 159 },
            { x: 365, y: 25 },
            { x: 62, y: 359 },
            { x: 144, y: 153 },
            { x: 106, y: 158 },
            { x: 165, y: 363 },
            { x: 89, y: 305 },
            { x: 82, y: 85 },
            { x: 63, y: 50 },
            { x: 39, y: 266 },
            { x: 24, y: 136 },
            { x: 306, y: 147 },
            { x: 352, y: 305 },
            { x: 112, y: 195 },
            { x: 333, y: 176 },
            { x: 364, y: 134 },
            { x: 12, y: 345 },
            { x: 166, y: 256 },
            { x: 131, y: 361 },
            { x: 350, y: 67 },
            { x: 365, y: 350 },
            { x: 245, y: 368 },
            { x: 313, y: 75 },
            { x: 308, y: 297 },
            { x: 32, y: 61 },
            { x: 252, y: 191 },
            { x: 339, y: 19 },
            { x: 34, y: 36 },
            { x: 58, y: 300 },
            { x: 17, y: 159 },
            { x: 330, y: 353 },
            { x: 88, y: 264 },
            { x: 63, y: 26 },
            { x: 34, y: 11 },
            { x: 300, y: 322 },
            { x: 333, y: 274 },
            { x: 328, y: 118 },
            { x: 230, y: 142 },
            { x: 14, y: 195 },
            { x: 34, y: 84 },
            { x: 231, y: 12 },
            { x: 139, y: 177 },
            { x: 11, y: 231 },
            { x: 366, y: 271 },
            { x: 237, y: 255 },
            { x: 166, y: 176 },
            { x: 278, y: 256 },
            { x: 244, y: 343 },
            { x: 315, y: 39 },
            { x: 102, y: 361 },
            { x: 274, y: 156 },
            { x: 111, y: 11 },
            { x: 361, y: 171 },
            { x: 77, y: 172 },
            { x: 10, y: 280 },
            { x: 50, y: 323 },
            { x: 57, y: 132 },
            { x: 298, y: 12 },
            { x: 10, y: 34 },
            { x: 82, y: 137 },
            { x: 262, y: 13 },
            { x: 304, y: 261 },
            { x: 10, y: 113 },
            { x: 330, y: 330 },
            { x: 36, y: 361 },
            { x: 334, y: 147 }];



        let totalBuildings = Math.min(extraTiers * structurePerTier, possiblePositions.length); // max 54 buildings
        if (debug) {
            totalBuildings = possiblePositions.length; // for debugging, use all positions
        }


        const safePositions = possiblePositions.filter(pos => Math.abs(pos.x - 10) > 2);

        // Only regenerate if we need more than previously stored
        if (persistentMiniBuildings.length < totalBuildings) {
            const rng = (offset) => seededRandom(42 + offset);
            const shuffled = [...safePositions].sort((a, b) => rng(a.x + a.y) - rng(b.x + b.y));
            persistentMiniBuildings = shuffled.slice(0, totalBuildings);
        }

        const miniBuildingColor = "#8b5e3c";

        persistentMiniBuildings.forEach((pos, i) => {
            // console.log(`Mini Building ${i + 1}:`, pos);
            const size = cellSize * 1.1;
            const offset = (cellSize - size) / 2;
            const x = pos.x
            const y = pos.y

            ctx.fillStyle = miniBuildingColor;
            ctx.fillRect(x, y, size, size);

            // Optional: darker roof
            ctx.fillStyle = "#5a3b22";
            ctx.fillRect(x, y, size, size * 0.6);
        });
    }

    // === Draw main road if castle is level 13 or higher ===
    if (castleLevel >= 13 || debug) {
        ctx.fillStyle = roadColor;
        const roadX = Math.floor(gridSize / 2);
        const startY = 6;

        for (let y = startY; y < gridSize; y++) {
            ctx.fillRect((roadX - 0.5) * cellSize, y * cellSize, cellSize, cellSize);
        }
    }


    if (castleLevel >= 2 || debug) {
        const castleWidth = 4;
        const castleHeight = 4;
        const startX = Math.floor((gridSize - castleWidth) / 2);
        const startY = 2;

        ctx.fillStyle = castleColor;
        ctx.fillRect(startX * cellSize, startY * cellSize, castleWidth * cellSize, castleHeight * cellSize);

        if (castleLevel >= 4 || debug) {
            const annexWidth = 2;
            const annexHeight = 3;
            const annexY = 2 * cellSize;
            ctx.fillStyle = annexColor;
            ctx.fillRect((startX + castleWidth) * cellSize, annexY, annexWidth * cellSize, annexHeight * cellSize);
            ctx.fillRect((startX - annexWidth) * cellSize, annexY, annexWidth * cellSize, annexHeight * cellSize);
        }

        if (castleLevel >= 3 || debug) {
            ctx.fillStyle = towerColor;
            const towerSize = 1;
            const drawTower = (x, y) => {
                ctx.fillRect(Math.round(x), Math.round(y), towerSize * cellSize, towerSize * cellSize);
            };
            drawTower(startX * cellSize - towerSize * cellSize / 2, startY * cellSize - towerSize * cellSize / 2);
            drawTower((startX + castleWidth - 1) * cellSize + towerSize * cellSize / 2, startY * cellSize - towerSize * cellSize / 2);
            drawTower(startX * cellSize - towerSize * cellSize / 2, (startY + castleHeight - 1) * cellSize + towerSize * cellSize / 2);
            drawTower((startX + castleWidth - 1) * cellSize + towerSize * cellSize / 2, (startY + castleHeight - 1) * cellSize + towerSize * cellSize / 2);
        }
    }

    // === Other Structures ===
    const buildingSize = 2;
    const structurePositions = {
        tavern: { x: 2, y: 10 },
        blacksmith: { x: 6, y: 14 },
        barracks: { x: 12, y: 14 },
        market: { x: 16, y: 10 }
    };

    Object.entries(structurePositions).forEach(([name, pos]) => {
        const level = structures[name]?.level || 0;
        const { x, y } = pos;

        // === Connector Road (after building) ===
        if (level >= 6 && castleLevel >= 13 || debug) {
            ctx.fillStyle = roadColor;

            const roadX = Math.floor(gridSize / 2);
            const pathY = y + 1;
            const connectorHeight = cellSize * 0.4;
            const connectorYOffset = (cellSize - connectorHeight) / 2;

            if (x < roadX) {
                for (let i = x + 2; i <= roadX; i++) {
                    ctx.fillRect(i * cellSize, pathY * cellSize + connectorYOffset, cellSize, connectorHeight);
                }
            } else if (x > roadX) {
                for (let i = x; i >= roadX + 1; i--) {
                    ctx.fillRect(i * cellSize, pathY * cellSize + connectorYOffset, cellSize, connectorHeight);
                }
            }
        }

        // === Land plot ===
        if (level >= 1 || debug) {
            ctx.fillStyle = "#3b1e01";
            ctx.fillRect(
                x * cellSize - 3,
                y * cellSize - 3,
                buildingSize * cellSize + 6,
                buildingSize * cellSize + 6
            );
        }

        // === Building ===
        if (level >= 2 || debug) {
            const padding = 4;
            const buildingX = x * cellSize + padding;
            const buildingY = y * cellSize + padding;
            const buildingSizePx = buildingSize * cellSize - 2 * padding;

            ctx.fillStyle = structureColors[name] || "#888";
            ctx.fillRect(buildingX, buildingY, buildingSizePx, buildingSizePx);

            if (level >= 3 || debug) {
                ctx.fillStyle = "#fff";
                const doorWidth = 4;
                const doorHeight = 6;
                const doorX = buildingX + (buildingSizePx - doorWidth) / 2;
                const doorY = buildingY + buildingSizePx - doorHeight;
                ctx.fillRect(doorX, doorY, doorWidth, doorHeight);
            }

            if (level >= 8 || debug) {
                ctx.fillStyle = "#442200"; // roof color

                const roofHeight = buildingSizePx * 0.65;
                const roofY = buildingY; // aligned with top of building

                ctx.fillRect(buildingX, roofY, buildingSizePx, roofHeight);
                // === Draw shingles on roof ===
                const shingleRows = 4;
                const shingleCols = 6;
                const shinglePadding = 1;

                const shingleWidth = (buildingSizePx - (shingleCols + 1) * shinglePadding) / shingleCols;
                const shingleHeight = (roofHeight - (shingleRows + 1) * shinglePadding) / shingleRows;

                ctx.fillStyle = "#5a3c1a"; // darker color for shingles

                for (let row = 0; row < shingleRows; row++) {
                    for (let col = 0; col < shingleCols; col++) {
                        const x = buildingX + shinglePadding + col * (shingleWidth + shinglePadding);
                        const y = buildingY + shinglePadding + row * (shingleHeight + shinglePadding);
                        ctx.fillRect(x, y, shingleWidth, shingleHeight);
                    }
                }

            }



        }
    });
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
        if (levelUpMercenaryCost(i) < gold) {
            levelUpCostTextArray[i].classList.remove("locked");
            levelUpCostTextArray[i].disabled = false;
        } else {
            levelUpCostTextArray[i].classList.add("locked");
            levelUpCostTextArray[i].disabled = true;
        }
        const lvlBtn = row.querySelector("button");
        const mercStats = row.querySelector(`#merc-name-${i}`);
        lvlBtn.addEventListener("click", () => {
            lvlBtn.textContent = `Lvl Up ${formatDigits(levelUpMercenaryCost(i), 2, 5)} g`;
            mercStats.textContent = `${merc.name} (Lv ${merc.level}) — Squad ${merc.squad}`;
            if (levelUpMercenaryCost(i) < gold) {
                levelUpCostTextArray[i].classList.remove("locked");
                levelUpCostTextArray[i].disabled = false;
            } else {
                levelUpCostTextArray[i].classList.add("locked");
                levelUpCostTextArray[i].disabled = true;
            }
        });
        updateLabeledParagraph(upgradeButtons, "Hired Mercenaries", `${hiredMercenaries.length}/${structures.tavern.level * 5}`, "mercenary-count");
        updateLabeledParagraph(upgradeButtons, "Next Mercenary", `${formatDigits(hireMercenaryCost(), 2, 5)} g`, "next-mercenary");
    }

    addLabeledParagraph(upgradeButtons, "Hired Mercenaries", `${hiredMercenaries.length}/${structures.tavern.level * 5}`, "mercenary-count");
    addLabeledParagraph(upgradeButtons, "Next Mercenary", `${formatDigits(hireMercenaryCost(), 2, 5)} g`, "next-mercenary");
    addLabeledParagraph(upgradeButtons, "Max Level Cap", `${(passiveAbilities[0].level - 1) * 10 + 20}`, "max-level-cap");
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
                    if (cost < gold) {
                        levelUpCostTextArray[index].classList.remove("locked");
                        levelUpCostTextArray[index].disabled = false;
                    } else {
                        levelUpCostTextArray[index].classList.add("locked");
                        levelUpCostTextArray[index].disabled = true;
                    }
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
        if (upgradeMercenarySpeedCost(squadMercs[0]) < gold) {
            speedUpgradeCostTextArray[i].classList.remove("locked");
            speedUpgradeCostTextArray[i].disabled = false;
        } else {
            speedUpgradeCostTextArray[i].classList.add("locked");
            speedUpgradeCostTextArray[i].disabled = true;
        }
        speedBtn.addEventListener("click", () => {
            speedBtn.textContent = `Lvl Up ${formatDigits(upgradeMercenarySpeedCost(squadMercs[0]), 2, 5)} g`;
            speedText.textContent = `Squad ${i} - ${soldierRanks[Math.floor(squadMercs[0].attackSpeedLevel / 3)] || "Infinity"} Unit ${romNum(squadMercs[0].attackSpeedLevel)}`;
            speedText.parentElement.parentElement.style.borderLeft = `5px solid ${weaponQualityColors[Math.floor(squadMercs[0].attackSpeedLevel / 3)] || "#ff0000"}`; // red border color
            speedText.parentElement.parentElement.style.color = weaponQualityColors[Math.floor(squadMercs[0].attackSpeedLevel / 3)] || "#ff0000"; // Text color // red text color
            if (upgradeMercenarySpeedCost(squadMercs[0]) < gold) {
                speedUpgradeCostTextArray[i].classList.remove("locked");
                speedUpgradeCostTextArray[i].disabled = false;
            } else {
                speedUpgradeCostTextArray[i].classList.add("locked");
                speedUpgradeCostTextArray[i].disabled = true;
            }
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
                    if (cost < gold) {
                        speedUpgradeCostTextArray[index].classList.remove("locked");
                        speedUpgradeCostTextArray[index].disabled = false;
                    } else {
                        speedUpgradeCostTextArray[index].classList.add("locked");
                        speedUpgradeCostTextArray[index].disabled = true;
                    }
                }
            });
        });
    });
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
        if (upgradeMercenaryGearCost(squadMercs[0]) < gold) {
            gearUpgradeCostTextArray[i].classList.remove("locked");
            gearUpgradeCostTextArray[i].disabled = false;
        } else {
            gearUpgradeCostTextArray[i].classList.add("locked");
            gearUpgradeCostTextArray[i].disabled = true;
        }
        gearBtn.addEventListener("click", () => {
            // Modulus 3 to get the correct gear level
            console.log(10 % 3);
            gearBtn.textContent = `Lvl Up ${formatDigits(upgradeMercenaryGearCost(squadMercs[0]), 2, 5)} g`;
            gearText.textContent = `Squad ${i} - ${weaponQualities[Math.floor(squadMercs[0].gearLevel / 3)] || "Ascendant"} Gear ${romNum(squadMercs[0].gearLevel)}`;
            gearText.parentElement.parentElement.style.borderLeft = `5px solid ${weaponQualityColors[Math.floor(squadMercs[0].gearLevel / 3)] || "#ff0000"}`;
            gearText.parentElement.parentElement.style.color = weaponQualityColors[Math.floor(squadMercs[0].gearLevel / 3)] || "#ff0000"; // Text color // red text color
            if (upgradeMercenaryGearCost(squadMercs[0]) < gold) {
                gearBtn.classList.remove("locked");
                gearBtn.disabled = false;
            } else {
                gearBtn.classList.add("locked");
                gearBtn.disabled = true;
            }
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
                    if (cost < gold) {
                        gearUpgradeCostTextArray[index].classList.remove("locked");
                        gearUpgradeCostTextArray[index].disabled = false;
                    } else {
                        gearUpgradeCostTextArray[index].classList.add("locked");
                        gearUpgradeCostTextArray[index].disabled = true;
                    }
                }
            });
        });
    });
}

function CastleUpgradeUI(menu, upgradeButtons, upgradeButtons2, container, container2, multContainer) {
    // Implement Castle upgrade UI elements
    addLabeledParagraph(upgradeButtons, "Active Skills", "", "active-skills-list");
    container.innerHTML = ""; // Clear previous content
    abilities.forEach((ability, index) => {
        const row = document.createElement("div");
        row.className = "upgrade-row";
        row.innerHTML = `
                        <div style="display: flex; justify-content: space-between; width: 100%;">
                            <span>${ability.name} (Required Lvl ${ability.unlockLevel})</span>
                        </div>
                        `;
        // Change the left border color
        if (playerLevel >= ability.unlockLevel) {
            row.style.borderLeft = "5px solid #4CAF50"; // Green color
            row.style.color = "#fff"; // Text color
        }
        container.appendChild(row);
    });
    addLabeledParagraph(upgradeButtons2, "Passive Skills", "", "passive-skills-list");
    container2.innerHTML = ""; // Clear previous content
    passiveAbilities.forEach((ability, index) => {
        const row = document.createElement("div");
        row.className = "upgrade-row";
        let upBtn = "";
        if (ability.maxLevel) {
            upBtn = `<span><button class="mult-btn-tiny">${formatDigits(upgradeSkillCost(ability), 2, 5)} g</button></span>`;
        }
        row.innerHTML = `
                        <div style="display: flex; justify-content: space-between; width: 100%;">
                            <span id="passive-skill-${index}">${ability.name} (Required Lvl ${ability.unlockLevel}) - ${ability.description}</span>
                            ${ability.maxLevel ? upBtn : ""}
                        </div>
                        `;
        const passiveSkillText = row.querySelector(`#passive-skill-${index}`);
        if (upBtn !== "") {
            row.querySelector(".mult-btn-tiny").onclick = () => {
                upgradeSkill(ability);
                passiveSkillText.textContent = `${ability.name} (lvl ${ability.level}) - ${ability.description}`;
                row.querySelector(".mult-btn-tiny").textContent = `${formatDigits(upgradeSkillCost(ability), 2, 5)} g`;
            };
        }
        if (playerLevel >= ability.unlockLevel) {
            row.classList.remove("locked");
            passiveSkillText.textContent = `${ability.name} (lvl ${ability.level}) - ${ability.description}`;

        } else {
            row.classList.add("locked");
        }
        if (playerLevel >= ability.unlockLevel) {
            row.style.borderLeft = "5px solid #4CAF50"; // Green color
            row.style.color = "#fff"; // Text color
        }
        container2.appendChild(row);
    });
}

function marketUpgradeCost(m) {
    const key = Object.keys(marketUpgrades)[m];
    let totalCost = 0;
    const base = marketUpgrades[key].cost;
    for (let i = 0; i < upgradeMultiplier; i++) {
        totalCost += Math.ceil(base * Math.pow(2, marketUpgrades[key].level + 1));
    }
    return totalCost;
}

function upgradeMarket(i) {
    const key = Object.keys(marketUpgrades)[i];
    const cost = marketUpgradeCost(i);
    let s = marketUpgrades[key];
    if (gold >= cost && structures.market.level >= s.unlockLevel && s.level < s.maxLevel) {
        gold -= cost;
        s.level++;
    }
}

function MarketUpgradeUI(menu, upgradeButtons, container, multContainer) {
    marketUpgradeCostTextArray = [];

    addLabeledParagraph(upgradeButtons, "Market Research", "", "active-skills-list");
    container.innerHTML = ""; // Clear previous content
    Object.entries(marketUpgrades).forEach(([key, market], index) => {
        const row = document.createElement("div");
        row.className = "upgrade-row";
        row.innerHTML = `
                        <div style="display: flex; justify-content: space-between; width: 100%;">
                            <span id="market-upgrade-${index}">${market.name} (Required Lvl ${market.unlockLevel}) - ${market.description}</span>
                            <span><button class="mult-btn-tiny" onclick="upgradeMarket(${index})">${formatDigits(marketUpgradeCost(index), 2, 5)} g</button></span>
                        </div>
                        `;
        const costBtn = row.querySelector("button");
        const marketText = row.querySelector(`#market-upgrade-${index}`);
        costBtn.textContent = `${formatDigits(marketUpgradeCost(index), 2, 5)} g`;
        if (structures.market.level >= market.unlockLevel) {
            row.style.borderLeft = "5px solid #4CAF50"; // Green color
            row.style.color = "#fff"; // Text color
        }
        let isLocked = false;
        if (structures.market.level > market.level && structures.market.level >= market.unlockLevel) {
            marketText.textContent = `${market.name} (Level ${market.level}) - ${market.description}`;
        } else {
            let val = market.level + 1;
            if (structures.market.level < market.unlockLevel) {
                val = market.unlockLevel;
            }
            marketText.textContent = `${market.name} (Required Lvl ${val}) - ${market.description}`;
            isLocked = true;
        }
        marketUpgradeCostTextArray[index] = costBtn;
        if (marketUpgradeCost(index) < gold && !isLocked) {
            marketUpgradeCostTextArray[index].classList.remove("locked");
            marketUpgradeCostTextArray[index].disabled = false;
        } else {
            marketUpgradeCostTextArray[index].classList.add("locked");
            marketUpgradeCostTextArray[index].disabled = true;
        }
        costBtn.addEventListener("click", () => {
            costBtn.textContent = `${formatDigits(marketUpgradeCost(index), 2, 5)} g`;
            if (structures.market.level >= market.unlockLevel) {
                row.style.borderLeft = "5px solid #4CAF50"; // Green color
                row.style.color = "#fff"; // Text color
            }
            let islocked = false;
            if (structures.market.level > market.level && structures.market.level >= market.unlockLevel) {
                marketText.textContent = `${market.name} (Level ${market.level}) - ${market.description}`;
            } else {
                let val = market.level + 1;
                if (structures.market.level < market.unlockLevel) {
                    val = market.unlockLevel;
                }
                marketText.textContent = `${market.name} (Required Lvl ${val}) - ${market.description}`;
                islocked = true;
            }
            if (marketUpgradeCost(index) < gold && !islocked) {
                costBtn.classList.remove("locked");
                costBtn.disabled = false;
            } else {
                costBtn.classList.add("locked");
                costBtn.disabled = true;
            }
            if (market.name === "Better Bunks") {
                // For each squad restart attack interval
                for (let i = 1; i <= Math.ceil(hiredMercenaries.length / 5); i++) {
                    startSquadAttack(i);
                }
            }
        });
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

