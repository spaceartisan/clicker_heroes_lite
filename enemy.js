let deathCooldown = false;

function getEnemyHealth() {
    const type = enemyType || getEnemyType(currentLevel);
    return Math.max(5, Math.floor(5 * Math.pow(currentLevel, 1.5) * type.hp));
}

// Every archetype has a specific, hand-authored pixel silhouette.
// Render once per spawn, never once per frame (important on mobile).
function drawRandomEnemy() {
    enemyType = getEnemyType(currentLevel);
    const type = enemyType;
    const width = enemyCanvas.width;
    const height = enemyCanvas.height;
    const pixels = type.sprite;
    const cell = Math.min(width, height) / 18;
    const offX = (width - 16 * cell) * 0.5;
    const offY = (height - 16 * cell) * 0.5;

    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    // Restrained backdrop, grounding shadow, and an archetype-specific silhouette.
    ctx.fillStyle = "#0f131e";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#252538";
    ctx.fillRect(width * 0.12, height * 0.82, width * 0.76, height * 0.07);
    ctx.fillStyle = type.palette[1];
    ctx.fillRect(width * 0.2, height * 0.89, width * 0.6, height * 0.03);

    for (let row = 0; row < 16; row++) {
        const pattern = (pixels[row] || "").padEnd(16, ".").slice(0, 16);
        for (let col = 0; col < 16; col++) {
            const pixel = pattern[col];
            if (pixel === ".") continue;
            const paletteIdx = Number(pixel);
            ctx.fillStyle = type.palette[paletteIdx] || type.palette[2];
            ctx.fillRect(Math.floor(offX + col * cell), Math.floor(offY + row * cell),
                Math.ceil(cell), Math.ceil(cell));
        }
    }
    enemyNameText.textContent = type.name + " — " + type.trait;
    const hint = document.getElementById("enemy-trait");
    if (hint) hint.textContent = type.summary;
    enemyHealth = getEnemyHealth();
    enemyLevelText.textContent = "Stage " + currentLevel + (type.id === "dragon" ? " · BOSS" : "");
}

// Rewards reflect enemy type, merchant upgrades, and specialized raider squads.
function handleEnemyDefeat() {
    if (deathCooldown) return;
    enemyHealth = 0;
    enemiesDefeated++;
    const type = enemyType || getEnemyType(currentLevel);
    const goldGain = Math.floor(2 * Math.pow(currentLevel, 1.4) * type.gold);
    const marketBounty = type.id === "dragon" ? mktUp(5) : mktUp(6);
    const royalSteward = 1 + 0.03 * Math.max(0, passiveAbilities[2].level - 1);
    let goldMult = mktUp(0) * marketBounty * getSquadGoldMultiplier() *
        royalSteward * (1 + getResearchBonus("enemyGold"));
    if (goldRushActive) goldMult *= 2;
    const reward = Math.ceil(goldGain * goldMult);
    gold += reward;
    showGoldEarned(reward);
    if (currentLevel === maxLevel) maxLevel++;
    if (autoAdvance) currentLevel++;
    deathCooldown = true;
    setTimeout(() => {
        drawRandomEnemy();
        updateStructureUI();
        updateUI();
        deathCooldown = false;
    }, 250);
}
