let deathCooldown = false;

function getEnemyHealth() {
    const type = enemyType || getEnemyType(currentLevel);
    const level=Math.max(1,Math.min(1e12,currentLevel));
    const endless=level>200?1+Math.min(2.5,Math.log10(level/200)*0.24):1;
    return Math.max(5,Math.min(1e290,Math.floor(5*Math.pow(level,1.5)*type.hp*endless)));
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
    const reg = type.frontier ? getFrontierRegion(currentLevel) : null;
    ctx.fillStyle = reg ? "#171821" : "#0f131e";
    ctx.fillRect(0,0,width,height);
    if(reg) {
        ctx.fillStyle=reg.color;
        ctx.fillRect(0,0,width,4);
        ctx.fillRect(0,height-4,width,4);
    }
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
    if(type.champion) {
        ctx.fillStyle="#efd58e";
        for(const [x,y] of [[7,7],[width-14,7],[7,height-14],[width-14,height-14]])
            ctx.fillRect(x,y,7,7);
    }
    enemyNameText.textContent = type.name + " — " + type.trait;
    const hint = document.getElementById("enemy-trait");
    if (hint) hint.textContent = type.summary;
    enemyHealth = getEnemyHealth();
    if(!isBossEnemy(type))recordMonsterSeen(currentLevel,type);
    enemyLevelText.textContent = "Stage " + currentLevel +
        (isBossEnemy(type) ? " · BOSS" : type.champion ? " · VETERAN" : "");
    updateFrontierUI(currentLevel);
    resetBossClockForSpawn();
}

// Rewards reflect enemy type, merchant upgrades, and specialized raider squads.
function handleEnemyDefeat() {
    if (deathCooldown) return;
    enemyHealth = 0;
    enemiesDefeated++;
    runEnemyDefeats++;
    const type = enemyType || getEnemyType(currentLevel);
    const defeatedStage = currentLevel;
    if (typeof recordCommissionEvent === "function") {
        recordCommissionEvent("enemy", 1, defeatedStage);
        if (isBossEnemy(type)) recordCommissionEvent("boss", 1, defeatedStage);
    }
    const firstClear = currentLevel === maxLevel;
    const level=Math.max(1,Math.min(1e12,currentLevel));
    const endless=level>200?1+Math.min(1,Math.log10(level/200)*0.12):1;
    const goldGain=Math.floor(2*Math.pow(level,1.4)*type.gold*endless);
    const marketBounty = isBossEnemy(type) ? mktUp(5) : mktUp(6);
    const royalSteward = 1 + 0.03 * Math.max(0, passiveAbilities[2].level - 1);
    let goldMult = mktUp(0) * marketBounty * getSquadGoldMultiplier() *
        royalSteward * (1 + getResearchBonus("enemyGold")) *
        (type.frontier ? 1 + getResearchBonus("frontierGold") : 1);
    goldMult*=dynastyGoldMultiplier()*getMarketCharterBonus();
    if(goldRushActive)goldMult*=2;
    goldMult*=1+getRelicBonus("gold");
    const reward=Math.min(1e290,Math.ceil(goldGain*goldMult));
    gold=Math.min(1e300,gold+reward);
    runGoldEarned=Math.min(1e300,runGoldEarned+reward);
    showGoldEarned(reward);
    recordBossVictory(defeatedStage,firstClear);
    const recordedSpecimen=!isBossEnemy(type) &&
        recordMonsterDefeat(defeatedStage,type);
    if (currentLevel === maxLevel) {
        maxLevel++;
        balanceStageCleared(defeatedStage);
    }
    bestSeasonStage=Math.max(bestSeasonStage,maxLevel);
    if (autoAdvance) currentLevel++;
    if(isBossEnemy(type)||recordedSpecimen)saveGame();
    deathCooldown = true;
    setTimeout(() => {
        drawRandomEnemy();
        updateStructureUI();
        updateUI();
        deathCooldown = false;
    }, 250);
}
