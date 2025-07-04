let structures = {
    castle: { level: 1, baseCost: 50000 },
    tavern: { level: 0, baseCost: 35000, upgradeType: 4 },
    blacksmith: { level: 0, baseCost: 20000, upgradeType: 3 },
    barracks: { level: 0, baseCost: 20000, upgradeType: 3 },
    market: { level: 0, baseCost: 10000, upgradeType: 2 }
};

function getStructureCost(structure) {
    return Math.floor(structure.baseCost * Math.pow(1.5, structure.level));
}

function upgradeStructure(name) {
    const s = structures[name];
    const cost = getStructureCost(s);
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

        if (castLvl < nameLvl && name !== "castle") {
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
        if (el) el.textContent = structures[name].level;
        if (costEl) {
            if (btn.disabled) {
                costEl.textContent = "Required Level: " + (nameLvl);
            } else {
                costEl.textContent = "Upgrade (" + formatDigits(getStructureCost(structures[name]), 2, 5) + "g)";
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
            console.log(`Mini Building ${i + 1}:`, pos);
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