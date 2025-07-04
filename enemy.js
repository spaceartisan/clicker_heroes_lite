function drawRandomEnemy() {
    const gridSize = 10;
    const cellSize = enemyCanvas.width / gridSize;
    const themeIndex = Math.floor((currentLevel - 1) / 5) % levelThemes.length;
    const theme = levelThemes[themeIndex];
    const palette = theme.palette;
    const pixels = [];

    ctx.clearRect(0, 0, enemyCanvas.width, enemyCanvas.height);

    for (let y = 0; y < gridSize; y++) {
        const row = [];
        for (let x = 0; x < gridSize / 2; x++) {
            row[x] = Math.random() < 0.5 ? palette[Math.floor(Math.random() * palette.length)] : null;
        }
        pixels.push(row.concat([...row].reverse()));
    }

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const color = pixels[y][x];
            if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    const name = enemyNames[(currentLevel - 1) % enemyNames.length];
    enemyNameText.textContent = `${name} of the ${theme.name}`;
    enemyHealth = getEnemyHealth();
    enemyLevelText.textContent = `Level: ${currentLevel}`;
}

// === Enemy Logic ===
function handleEnemyDefeat() {
    enemiesDefeated++;
    gold += Math.floor(currentLevel * 2);
    if (currentLevel == maxLevel) maxLevel++
        if (autoAdvance) currentLevel++;
    drawRandomEnemy();
}