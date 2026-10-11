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
    if (isNaN(value)) value = 0;
    if (isNaN(value) || !isFinite(value)) {
        return "Overflow".padStart(padding, "\u00A0");
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
        btn.type = "button";
        btn.textContent = `×${mult}`;
        btn.setAttribute("aria-pressed", String(mult === upgradeMultiplier));
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
    const destination = ["hero", "kingdom", "army"].includes(view) ? view : "hero";
    for (const tab of ["hero", "kingdom", "army"]) {
        const selected = destination === tab;
        document.getElementById(tab + "-view").style.display = selected ? "block" : "none";
        const tabButton = document.getElementById("view-tab-" + tab);
        if (tabButton) {
            tabButton.classList.toggle("is-active", selected);
            if (typeof tabButton.setAttribute === "function")
                tabButton.setAttribute("aria-pressed", selected ? "true" : "false");
        }
    }
    if (destination === "hero") {
        updatePlayerLevelGearText();
    } else if (destination === "kingdom") {
        updateStructureUI();
        drawKingdom();
        if(typeof renderDynastyPanel==="function")renderDynastyPanel();
        if(typeof renderMonsterBestiary==="function")renderMonsterBestiary();
    } else if (typeof renderArmyView === "function") {
        renderArmyView();
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
    damageText.textContent = `Hero Damage: ${formatDigits(playerClickDamage * mktUp(2) * (enemyType ? enemyType.resistance : 1) *
        getBossHeroDamageFactor(enemyType), 2, 5)}, Merc DPS: ${formatDigits(getAutoDamage(), 2, 5)}`;
    const summary = document.getElementById("squad-summary");
    if (summary && enemyType) {
        const squads = Math.ceil(hiredMercenaries.length / 5);
        summary.textContent = squads
            ? squads + " squads · Gold bonus ×" + getSquadGoldMultiplier().toFixed(2) + " · " + enemyType.trait + " enemy"
            : "Specialize squads at the Barracks; equip them at the Blacksmith.";
    }
    const enemyMaxHealth=getEnemyHealth();
    const healthPercent = Math.max(0,Math.min(100,
        enemyMaxHealth>0 ? enemyHealth/enemyMaxHealth*100 : 0));
    healthFill.style.width = `${healthPercent}%`;
    const healthBar=document.getElementById("health-bar");
    if(healthBar)healthBar.setAttribute("aria-valuenow",String(Math.round(healthPercent)));
    document.getElementById("gold-fixed").textContent = formatDigits(gold);
    updatePlayerText();
    document.getElementById("prev-level").disabled = currentLevel <= 1;
    document.getElementById("next-level").disabled = currentLevel >= maxLevel;
    checkAchievements();
    updatePlayerLevelGearText();
}

// === Player Upgrade ===
function updatePlayerText() {
    updateAbilityHUD();
}

// Update authored controls in place. Rebuilding shop.innerHTML every time
// gold/quantity changed discarded keyboard focus and touch interaction.
function updatePlayerLevelGearText() {
    const levelButton=document.getElementById("hero-level-upgrade");
    const gearButton=document.getElementById("hero-gear-upgrade");
    const levels=document.getElementById("hero-upgrade-levels");
    if(!levelButton||!gearButton)return;
    const offers=[
        {button:levelButton,label:"Level Up",quote:levelUpPlayerCost(true)},
        {button:gearButton,label:"Upgrade Gear",quote:gearUpPlayerCost(true)}
    ];
    for(const offer of offers){
        const [cost,quantity,atCap]=offer.quote;
        const available=quantity>0&&Number.isFinite(cost)&&cost>0&&gold>=cost;
        const atLimit=quantity===0&&atCap;
        const nextLabel=atLimit ? offer.label+" · MAX" :
            offer.label+(quantity>1?" ×"+quantity:"")+" · "+formatDigits(cost,2,5)+" g";
        if(offer.button.textContent!==nextLabel)offer.button.textContent=nextLabel;
        offer.button.disabled=!available;
        offer.button.title=atLimit?"Upgrade cap reached":
            available?"Purchase "+quantity+" upgrade"+(quantity===1?"":"s"):
            "Not enough gold for this purchase";
    }
    if(levels){
        const nextLevels="Hero Lv "+formatDigits(playerLevel,2,0)+
            " · Gear Lv "+formatDigits(playerGearLevel,2,0);
        if(levels.textContent!==nextLevels)levels.textContent=nextLevels;
    }
}

function showOptions() {
    applyGameTheme(readGameTheme());
    const oldExport = document.getElementById("export-legacy-save");
    if (oldExport) oldExport.hidden = !localStorage.getItem(GAME_LEGACY_BACKUP_KEY);
    if(typeof accountControlsUpdate==="function")accountControlsUpdate();
    const optionsPopup = document.getElementById("options-popup");
    optionsPopup.style.display = "flex";
}

function closeOptions() {
    const optionsPopup = document.getElementById("options-popup");
    optionsPopup.style.display = "none";
}


function getAchievementCategory(ach) {
    if (/^(dynasty_|research_|college_|charter_|castle_)/.test(ach.id)) return "Kingdom & Dynasty";
    if (/^(ability_)/.test(ach.id)) return "Abilities";
    if (/^(merc_|speed_)/.test(ach.id) || ach.id === "gear_5" ||
        ach.id === "gear_20" || ach.id === "merc_gear_50" ||
        ach.id.startsWith("guild_")) return "Mercenaries & Gear";
    if (/^(level_|stage_)/.test(ach.id)) return "Exploration";
    return "Hero & Economy";
}

function getAchievementProgress(ach) {
    const id = ach.id;
    let current = 0, target = 1;
    const suffix = id.match(/_(\d+)$/);
    if (suffix) target = Math.max(1, Number(suffix[1]));
    if (/^gold_/.test(id)) current = gold;
    else if (/^player_/.test(id)) current = playerLevel;
    else if (/^click_/.test(id)) current = totalClicks;
    else if (/^enemy_/.test(id)) current = enemiesDefeated;
    else if (/^(level_|stage_)/.test(id)) current = getBestClearedStage();
    else if (/^merc_level_/.test(id)) current = Math.max(0, ...hiredMercenaries.map(m => m.level || 0));
    else if (/^merc_gear_/.test(id) || ["gear_5", "gear_20"].includes(id)) {
        current = Math.max(0, ...hiredMercenaries.map(m => m.gearLevel || 0));
    } else if (/^gear_/.test(id)) current = playerGearLevel;
    else if (/^speed_/.test(id)) current = Math.max(0, ...hiredMercenaries.map(m => m.attackSpeedLevel || 0));
    else if (/^merc_/.test(id)) current = hiredMercenaries.length;
    else if (/^guild_/.test(id)) current = structures.tavern.level;
    else if (/^ability_count_/.test(id)) current = abilitiesCount;
    else if (id === "ability_all") {
        current = abilities.filter(ability => abilitiesUsed.includes(ability.name)).length;
        target = abilities.length;
    } else if (id.startsWith("ability_")) {
        const lookup = {
            ability_strong: "Strong Attack", ability_rally: "Rally",
            ability_double: "Double Attack", ability_rage: "Rage", ability_gold: "Gold Rush"
        };
        current = abilitiesUsed.includes(lookup[id]) ? 1 : 0;
    } else if (/^dynasty_/.test(id)) current = dynastyCount;
    else if (/^castle_/.test(id)) current = Math.max(highestCastleEver, structures.castle.level);
    else if (/^research_/.test(id)) current = getCompletedResearchCount();
    else if (/^college_/.test(id)) current = getCollegeRanks();
    else if (/^charter_/.test(id)) current = marketCharterRank;
    else current = ach.condition() ? 1 : 0;

    return {current: Math.max(0, Number(current) || 0), target};
}

function checkAchievements() {
    const gained = [];
    for (const ach of achievements) {
        if (!unlockedAchievements.has(ach.id) && ach.condition()) {
            unlockedAchievements.add(ach.id);
            gained.push(ach);
        }
    }
    if (!gained.length) return;
    // One save and one toast, even if loading progress unlocks several at once.
    saveGame();
    showAchievementPopup(gained[0], gained.length - 1);
}

function showAchievementPopup(ach, additionalCount = 0) {
    const popup = document.getElementById("achievement-popup");
    const heading = document.createElement("strong");
    heading.textContent = ach.name;
    popup.replaceChildren(makeUIIcon("achievements"), heading,
        document.createTextNode(additionalCount
            ? " · +" + additionalCount + " more achievements"
            : " · " + ach.description));
    popup.style.display = "block";
    popup.style.opacity = "1";
    if (typeof achievementToastTimer !== "undefined" && achievementToastTimer !== null)
        clearTimeout(achievementToastTimer);
    achievementToastTimer = setTimeout(() => {
        popup.style.opacity = "0";
        achievementToastTimer = setTimeout(() => {
            popup.style.display = "none";
            achievementToastTimer = null;
        }, 350);
    }, 2700);
}

let achievementToastTimer = null;

function renderAchievements() {
    const container = document.getElementById("achievement-list");
    const summary = document.getElementById("achievement-summary");
    const selected = document.getElementById("achievement-filter").value || "all";
    const completed = achievements.filter(ach => unlockedAchievements.has(ach.id)).length;
    summary.textContent = completed + " / " + achievements.length +
        " achievements · " + Math.floor(100 * completed / achievements.length) + "% complete";
    const visible = achievements.filter(ach => selected === "all" ||
        (selected === "unlocked" ? unlockedAchievements.has(ach.id) :
            !unlockedAchievements.has(ach.id)));
    const fragment = document.createDocumentFragment();
    for (const ach of visible) {
        const owned = unlockedAchievements.has(ach.id);
        const item = document.createElement("article");
        item.className = "achievement" + (owned ? " unlocked" : "");
        const header = document.createElement("div");
        header.className = "achievement-heading";
        const name = document.createElement("strong");
        name.textContent = ach.name;
        const category = document.createElement("small");
        category.textContent = getAchievementCategory(ach);
        header.append(name, category);
        const description = document.createElement("p");
        description.textContent = ach.description;
        const progress = document.createElement("div");
        progress.className = "achievement-progress";
        const metric = getAchievementProgress(ach);
        const fraction = owned ? 1 : Math.max(0, Math.min(1, metric.current / metric.target));
        const bar = document.createElement("div");
        bar.className = "achievement-progress-track";
        const fill = document.createElement("span");
        fill.style.width = (fraction * 100).toFixed(1) + "%";
        bar.appendChild(fill);
        const number = document.createElement("small");
        number.textContent = owned ? "✓ Completed" :
            formatDigits(Math.min(metric.current, metric.target), 0, 0).trim() +
            " / " + formatDigits(metric.target, 0, 0).trim();
        progress.append(bar, number);
        item.append(header, description, progress);
        fragment.appendChild(item);
    }
    container.replaceChildren(fragment);
    if (visible.length === 0) container.textContent = "No achievements in this filter.";
}

function showAchievements() {
    renderAchievements();
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
    genHeader.replaceChildren(setIconLabel(document.createElement("h3"), "stats", "Game Stats"));
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
