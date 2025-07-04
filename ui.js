function showDamage(amount) {
    const damageText = document.createElement("div");
    damageText.className = "floating-damage";
    damageText.textContent = amount;

    const overlay = document.getElementById("damage-overlay");

    // Get enemy box size
    const canvas = document.getElementById("enemy-canvas");
    const rect = canvas.getBoundingClientRect();

    // Calculate relative position (within canvas dimensions)
    const offsetX = Math.random() * canvas.width * 0.8 + canvas.width * 0.1; // avoid edges
    const offsetY = Math.random() * canvas.height * 0.2 + canvas.height * 0.1;

    damageText.style.left = `${offsetX}px`;
    damageText.style.top = `${offsetY}px`;

    overlay.appendChild(damageText);

    setTimeout(() => {
        damageText.remove();
    }, 1000);
}

function updateUI() {
    //   goldText.textContent = gold;
    playerClickDamage = getPlayerClickDamage();
    damageText.textContent = `Hero Damage: ${playerClickDamage}, Merc DPS: ${getAutoDamage()}`;
    healthFill.style.width = `${(enemyHealth / getEnemyHealth()) * 100}%`;
    document.getElementById("gold-fixed").textContent = Math.floor(gold);
    updatePlayerText();
    document.getElementById("prev-level").disabled = currentLevel <= 1;
    document.getElementById("next-level").disabled = currentLevel >= maxLevel;
    checkAchievements();
}

// === Player Upgrade ===
function updatePlayerText() {
    abilities.forEach(ability => {
        const state = abilityStates[ability.name];
        if (!state.unlocked && playerLevel >= ability.unlockLevel) {
            state.unlocked = true;
            const btn = state.button;
            btn.disabled = false;
            btn.classList.remove("locked");
            btn.textContent = ability.name;
        }
    });
}

function updatePlayerLevelGearText() {
    const shop = document.getElementById("shop");
    shop.innerHTML = `
    <h3>Hero Upgrades</h3>
    <button onclick="levelUpPlayer()">Level Up (${levelUpPlayerCost()}g)</button>
    <button ${playerLevel < nextPlayerGearLevelReq ? 'disabled' : ''} onclick="gearUpPlayer()">Upgrade Gear (${playerGearCost}g)</button>
    <p>Player Lv: ${playerLevel}, Gear x${playerGearLevel}</p>
  `;
}

function updateMercenaryText() {
    guildCostText.textContent = Math.floor(10000 * guildLevel ** 2.0);
    autoClickerCountText.textContent = hiredMercenaries.length + "/" + maxMercenaries;
    autoClickerCostText.textContent = Math.floor(100 * hiredMercenaries.length ** 2.0);
    const mercRows = hiredMercenaries.map((m, i) => {
        const row = document.createElement("div");
        row.className = "merc-row";
        row.textContent = `${m.name} (Lv${m.level}) Gear x${m.gearLevel} Speed x${m.attackSpeedLevel}`;

        const lvlBtn = document.createElement("button");
        lvlBtn.textContent = `Lv Up (${levelUpMercenaryCost(i)}g)`;
        lvlBtn.onclick = () => levelUpMercenary(i);
        row.appendChild(lvlBtn);

        if (m.level >= m.nextGearLevelReq) {
            const gearBtn = document.createElement("button");
            gearBtn.textContent = `Gear (${m.gearCost}g)`;
            gearBtn.onclick = () => upgradeMercGear(i);
            row.appendChild(gearBtn);
        }

        const speedBtn = document.createElement("button");
        speedBtn.textContent = `Speed (${m.attackSpeedCost}g)`;
        speedBtn.onclick = () => upgradeMercSpeed(i);
        row.appendChild(speedBtn);

        return row;
    });

    mercenaryList.querySelectorAll(".merc-row").forEach(el => el.remove());
    mercRows.forEach(row => mercenaryList.appendChild(row));
}

function showOptions() {
    const optionsPopup = document.getElementById("options-popup");
    optionsPopup.style.display = "flex";
}

function closeOptions() {
    const optionsPopup = document.getElementById("options-popup");
    optionsPopup.style.display = "none";
}


function checkAchievements() {
  achievements.forEach(ach => {
    if (!unlockedAchievements.has(ach.id) && ach.condition()) {
      unlockedAchievements.add(ach.id);
      localStorage.setItem("achievements", JSON.stringify([...unlockedAchievements]));
      showAchievementPopup(ach);
    }
  });
}

function showAchievementPopup(ach) {
  const popup = document.getElementById("achievement-popup");
  popup.innerHTML = `🏅 <strong>${ach.name}</strong><br>${ach.description}`;
  popup.style.display = "block";
  popup.style.opacity = "1";

  setTimeout(() => {
    popup.style.opacity = "0";
    setTimeout(() => popup.style.display = "none", 500);
  }, 2500);
}

function showAchievements() {
  const container = document.getElementById("achievement-list");
  container.innerHTML = "";

  achievements.forEach(ach => {
    const div = document.createElement("div");
    div.classList.add("achievement");
    if (unlockedAchievements.has(ach.id)) {
      div.classList.add("unlocked");
    }

    div.innerHTML = `<strong>${ach.name}</strong><br>${ach.description}`;
    container.appendChild(div);
  });

  document.getElementById("achievement-menu").style.display = "flex";
}

function closeAchievements() {
  document.getElementById("achievement-menu").style.display = "none";
}
