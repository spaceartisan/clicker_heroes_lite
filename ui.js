const romanNumerals = [
    "I",  // 1
    "II", // 2
    "III", // 3
    "IV", // 4
    "V",  // 5
    "VI", // 6
    "VII", // 7
    "VIII", // 8
    "IX", // 9
    "X",  // 10
];

const weaponQualities = [
    "Crude",        // 0
    "Common",       // 1
    "Uncommon",     // 2
    "Rare",         // 3
    "Epic",         // 4
    "Legendary",    // 5
    "Mythic",       // 6
    "Divine",       // 7
    "Ethereal",     // 8
    "Godforged"     // 9
];

const weaponQualityColors = [
    "#888888", // Crude (gray)
    "#ffffff", // Common (white)
    "#1eff00", // Uncommon (green)
    "#0070dd", // Rare (blue)
    "#a335ee", // Epic (purple)
    "#ff8000", // Legendary (orange)
    "#e5cc80", // Mythic (light gold)
    "#00ffff", // Divine (cyan)
    "#ff69b4", // Ethereal (pink)
    "#ff0000"  // Godforged (red)
];

const soldierRanks = [
    "Recruit",       // raw new soldier
    "Footman",       // basic infantry
    "Guard",         // lightly trained, city or garrison duty
    "Veteran",       // seen battle, reliable
    "Seasoned",      // hardened in multiple campaigns
    "Elite",         // among the best regular troops
    "Champion",      // stands out even among elites
    "Commander",     // leads squads, tactical mind
    "Warlord",       // battlefield dominance, fearsome reputation
    "Paragon"        // mythical figure, symbol of martial perfection
];


function formatDigits(value, digits = 2, padding = 10) {
    if (isNaN(value)) {
        gold = 0;
        value = 0;
    }
    if (isNaN(value) || !isFinite(value)) {
        return "Infinity".padStart(padding, "\u00A0");
    }
    const useScientificNotation = scientificNotation ?? false;

    if (useScientificNotation && value >= 1e3) {
        // Use scientific notation (e.g., 1.23e+12)
        const expFormatted = value.toExponential(digits);
        return expFormatted.padStart(padding, "\u00A0");
    }

    const suffixes = [
        "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc",
        "Ud", "Dd", "Td", "Qad", "Qid", "Sxd", "Spd", "Ocd", "Nod", "Vg",
        "Uvg", "Dvg", "Tvg", "Qavg", "Qivg", "Sxvg", "Spvg", "Ocvg", "Novg", "Tg",
        // After this, we switch to 2-letter base-26 system
    ];

    let tier = 0;

    while (value >= 1000) {// && tier < suffixes.length - 1) {
        value /= 1000;
        tier++;
    }

    // Dynamically generate suffixes like 'aa', 'ab', ... if needed
    if (tier >= suffixes.length) {
        const baseTier = tier - suffixes.length;
        const alphabet = "abcdefghijklmnopqrstuvwxyz";
        const first = alphabet[Math.floor(baseTier / 26) % 26];
        const second = alphabet[baseTier % 26];
        suffixes[tier] = first + second;
        // console.log(first, second, suffixes[tier]);
    }

    // if (value > 1e165) {
    //     console.log("value: ", value, " - Suffix: ", suffixes.length, " - Tier: ", tier);
    // }
    // if (tier === 0) {
    //     digits = 0;
    // }

    const formatted = value.toFixed(digits);
    const display = formatted + suffixes[tier];
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
            setUpgradeMultiplier(menu, mult);
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
    // TODO: playerClickDamage should not be calculated here, but rather somewhere else
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
    <button onclick="levelUpPlayer()">Level Up ${formatDigits(levelUpPlayerCost(), 2, 5)} g</button>
    <button onclick="gearUpPlayer()">Upgrade Gear ${formatDigits(gearUpPlayerCost(), 2, 5)} g</button>
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

function closeGeneralMenu() {
    document.getElementById("general-menu").style.display = "none";
}

function generalMenu(menuType) {
    const menu = document.getElementById("general-menu");
    const content = menu.querySelector(".popup-content");
    const genHeader = menu.querySelector("#general-menu-header");
    const genBody = menu.querySelector("#general-menu-content"); 
    genHeader.innerHTML = ""; // Clear previous content
    genBody.innerHTML = ""; // Clear previous content
    if (menuType === 'stats') {
        statsMenu(menu, content, genHeader, genBody);
    }
    menu.style.display = "flex";
}

function statsMenu(menu, content, genHeader, genBody) {
    genHeader.innerHTML = `<h3>📊 Game Stats</h3>`;
    genBody.innerHTML = `
        <p>Player Level: ${formatDigits(playerLevel, 2, 0)}</p>
        <p>Gear Level: ${formatDigits(playerGearLevel, 2, 0)}</p>
        <p>Gold: ${formatDigits(gold, 2, 0)}</p>
        <p>Ability Count: ${abilitiesCount}</p>
        <p>Enemies Defeated: ${formatDigits(enemiesDefeated, 2, 0)}</p>
        <p>Total Clicks: ${formatDigits(totalClicks, 2, 0)}</p>
        <h3></h3>`;
    // Add a small asterisk to mention some stats may be inaccurate for older saves. Decrease font size and italicize it
    genBody.innerHTML += `<p style="font-size: 0.8em; font-style: italic;">* Some stats may be inaccurate for older saves</p>`;
}

function showPopupMessage(message, showCloseButton = true, autoDismissTime = null, zorder = 20000) {
    // Create popup container
    const popup = document.createElement("div");
    popup.className = "popup-message";
    popup.textContent = message;
    popup.style.zIndex = zorder;

    // Add close button if requested
    if (showCloseButton) {
        const linebreak = document.createElement("h3");
        popup.appendChild(linebreak);
        const closeBtn = document.createElement("button");
        closeBtn.className = "popup-close-btn";
        closeBtn.textContent = "Close";
        closeBtn.onclick = () => popup.remove();
        popup.appendChild(closeBtn);
    }

    // Append to body
    document.body.appendChild(popup);

    if (autoDismissTime) {
        setTimeout(() => fadeAndRemove(popup), autoDismissTime);
    }
}

function fadeAndRemove(element) {
    element.classList.add("fade-out");
    setTimeout(() => element.remove(), 400); // Match CSS transition time
}
