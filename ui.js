function formatDigits(value, digits = 2, padding = 10) {
    const suffixes = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
    let tier = 0;

    while (value >= 1000 && tier < suffixes.length - 1) {
        value /= 1000;
        tier++;
    }

    if (tier === 0) {
        digits = 0;
    }
    const formatted = value.toFixed(digits);
    const display = formatted + suffixes[tier];

    // Pad to 7 characters using non-breaking space
    return display.padStart(padding, "\u00A0");
}

function AddMultiplierButtons(menu) {
    const multContainer = menu.querySelector(".upgrade-multiplier");
    if (!multContainer) return;

    multContainer.innerHTML = ""; // Clear previous buttons

    const multipliers = [1, 10, 100];
    multipliers.forEach(mult => {
        const btn = document.createElement("button");
        btn.className = "mult-btn";
        btn.textContent = `×${mult}`;
        btn.onclick = () => {
            setUpgradeMultiplier(menu,mult);
        };
        multContainer.appendChild(btn);
        if (mult === upgradeMultiplier) {
            btn.classList.add("active");
        }
    });
    return multContainer;
}

function switchView(view) {
    document.getElementById("hero-view").style.display = view === "hero" ? "block" : "none";
    document.getElementById("kingdom-view").style.display = view === "kingdom" ? "block" : "none";
    if (view === "hero") {
        updatePlayerLevelGearText();
    } else {
        updateStructureUI();
    }
}

function showDamage(amount) {
    const damageText = document.createElement("div");
    damageText.className = "floating-damage";
    damageText.textContent = formatDigits(amount, 0, 5);

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

function showGoldEarned(amount) {
    const damageText = document.createElement("div");
    damageText.className = "floating-gold-earned";
    damageText.textContent = formatDigits(amount, 0, 5);

    const overlay = document.getElementById("gold-earned-overlay");

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
    damageText.textContent = `Hero Damage: ${formatDigits(playerClickDamage, 2, 5)}, Merc DPS: ${formatDigits(getAutoDamage(), 2, 5)}`;
    healthFill.style.width = `${(enemyHealth / getEnemyHealth()) * 100}%`;
    document.getElementById("gold-fixed").textContent = formatDigits(gold);
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
    shop.innerHTML = ""; // Clear previous content
    shop.innerHTML = `
    <h3>Hero Upgrades</h3>
    <button onclick="levelUpPlayer()">Level Up (${formatDigits(levelUpPlayerCost(), 2, 5)}g)</button>
    <button onclick="gearUpPlayer()">Upgrade Gear (${formatDigits(gearUpPlayerCost(), 2, 5)}g)</button>
    <p>Player Lv: ${formatDigits(playerLevel, 2, 0)}, Gear x${formatDigits(playerGearLevel, 2, 0)}</p>
    <div class="upgrade-multiplier"></div>
  `;
    AddMultiplierButtons(shop);
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
