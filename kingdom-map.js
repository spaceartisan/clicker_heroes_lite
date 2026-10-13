// Map-first Kingdom: click illustrated buildings; details open in game-style dialogs.
// This layer never changes progression data or cloud-save formats.
(function () {
    "use strict";
    // All hit areas use the same 20x20 coordinate grid as the pixel-art canvas.
    // They enclose the actual artwork, not the roads or the space between sites.
    const locations = [
        {id:"academy", label:"Royal Academy", bounds:[2.0,3.0,5.0,6.4], description:"Royal research"},
        {id:"castle", label:"Castle", bounds:[7.4,2.0,12.8,6.9], description:"Royal Court and decrees"},
        {id:"treasury", label:"Royal Treasury", bounds:[15.0,3.1,18.3,6.6], description:"Milestones and bounties"},
        {id:"tavern", label:"Tavern", bounds:[1.5,9.35,4.5,12.5], description:"Mercenary hiring"},
        {id:"relics", label:"Relic Vault", bounds:[8.6,8.4,11.4,10.7], description:"Craft and equip relics"},
        {id:"market", label:"Market", bounds:[15.5,9.5,18.65,12.5], description:"Merchant Guild"},
        {id:"archives", label:"Royal Archives", bounds:[1.5,15.1,4.9,18.2], description:"Monster and boss field guides"},
        {id:"blacksmith", label:"Blacksmith", bounds:[5.4,13.6,8.4,16.55], description:"Forge squad equipment"},
        {id:"barracks", label:"Barracks", bounds:[11.65,13.3,14.75,16.6], description:"Train and specialize squads"},
        {id:"dynasty", label:"Dynasty Estate", bounds:[15.65,15.2,19.0,18.2], description:"Legacy and dynasty investments"}
    ];
    const buildingNames = {
        castle:"Castle", tavern:"Tavern", blacksmith:"Blacksmith",
        barracks:"Barracks", market:"Market"
    };
    const buildingHelp = {
        castle:"Raise the hero cap and strengthen the Royal Court.",
        tavern:"Expand mercenary hiring and your company.",
        blacksmith:"Improve equipment and forge squad kits.",
        barracks:"Train stronger mercenaries and specialize squads.",
        market:"Expand monster-gold income and merchant charters."
    };
    const modalContents = {
        treasury:["royal-treasury"],
        relics:["relic-vault"],
        archives:["monster-bestiary","boss-bestiary"],
        dynasty:["dynasty-panel"]
    };
    const originalShowMenu = showMenu;
    const originalDrawKingdom = drawKingdom;
    let keyboardIndex = -1;
    let canvas = null;
    let modal = null;
    let modalTitle = null;
    let modalClose = null;
    let modalSections = new Map();

    function node(tag, className, label) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (label) el.textContent = label;
        return el;
    }
    function locationAt(x, y) {
        return locations.find(site => x >= site.bounds[0] && x <= site.bounds[2] &&
            y >= site.bounds[1] && y <= site.bounds[3]) || null;
    }
    function canvasPoint(event) {
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        return {
            x:(event.clientX - rect.left) * 20 / rect.width,
            y:(event.clientY - rect.top) * 20 / rect.height
        };
    }
    function locationLabel(site) {
        if (Object.prototype.hasOwnProperty.call(buildingNames,site.id)) {
            const building = structures[site.id];
            const lock = structureLockReason(site.id);
            return site.label + " · " + (lock || (building.level ?
                "Level " + building.level : "Ready to construct"));
        }
        return site.label + " · " + site.description;
    }
    function addBuildingAction(id) {
        const target = document.getElementById("upgrade-buttons");
        const structure = structures[id];
        if (!target || !structure) return;
        // The original menu clears this section on every opening.
        const locked = structureLockReason(id);
        const price = id === "tavern" && structure.level === 0 ?
            0 : getStructureCost(structure);
        const section = node("section","kingdom-construction");
        section.append(node("strong","",buildingNames[id] + " · Level " + structure.level));
        section.append(node("p","",buildingHelp[id]));
        const action = node("button","",
            locked ? "Locked · " + locked :
            (structure.level ? "Upgrade" : "Construct") + " · " +
                (price ? formatDigits(price,2,0).trim() + " gold" : "Free"));
        action.type = "button";
        action.disabled = !!locked || (!locked && gold < price);
        if (!locked && gold < price) action.title = "Not enough gold";
        action.addEventListener("click", () => {
            if (upgradeStructure(id)) {
                showMenu(id);
                const next = document.querySelector("#upgrade-buttons .kingdom-construction button");
                if (next) next.focus();
            }
        });
        section.append(action);
        target.prepend(section);
    }
    // Other systems still call showMenu directly; preserve the standard popup.
    showMenu = function (id) {
        originalShowMenu(id);
        if (Object.prototype.hasOwnProperty.call(buildingNames,id)) addBuildingAction(id);
    };
    function closeLocation() {
        if (!modal || modal.style.display === "none") return;
        closeGameDialog("kingdom-location-popup");
        modal.setAttribute("aria-hidden","true");
        if (canvas) canvas.focus();
    }
    function openLocation(id) {
        if (!modal || !modalSections.has(id)) return;
        for (const [key, section] of modalSections) section.hidden = key !== id;
        modalTitle.textContent = locations.find(site=>site.id===id).label;
        openGameDialog("kingdom-location-popup", closeLocation);
        modal.setAttribute("aria-hidden","false");
        const content = modal.querySelector(".popup-content");
        if (content) content.scrollTop = 0;
        const body = document.getElementById("kingdom-location-body");
        if (body) body.scrollTop = 0;
        if (id === "archives") {
            for (const key of modalContents.archives) {
                const details = document.getElementById(key);
                if (details) details.open = true;
            }
            if (typeof renderMonsterBestiary === "function") renderMonsterBestiary();
            if (typeof renderBossBestiary === "function") renderBossBestiary();
        } else if (id === "dynasty" && typeof renderDynastyPanel === "function") {
            renderDynastyPanel();
        } else if (id === "relics" && typeof renderRelicVault === "function") {
            renderRelicVault();
        } else if (id === "treasury" && typeof updateTreasuryUI === "function") {
            updateTreasuryUI();
        }
        if (modalClose && modalClose.isConnected) modalClose.focus();
    }
    function activate(site) {
        if (!site) return;
        if (site.id === "academy") {
            openResearchTree();
        } else if (Object.prototype.hasOwnProperty.call(buildingNames,site.id)) {
            showMenu(site.id);
        } else {
            openLocation(site.id);
        }
    }
    function focusLocation(index) {
        keyboardIndex = (index + locations.length) % locations.length;
        const site = locations[keyboardIndex];
        canvas.setAttribute("aria-label",
            "Kingdom map. " + locationLabel(site) +
            ". Use arrow keys to choose a location; Enter to open.");
        canvas.title = locationLabel(site);
        drawKingdom();
    }
    function paintLandmarks() {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const unit = canvas.width / 20;
        const tile = (x,y,w,h,color) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.round(x*unit),Math.round(y*unit),
                Math.round(w*unit),Math.round(h*unit));
        };
        // The original buildings are seen FROM ABOVE. Keep nearly all of
        // each sprite occupied by its roof, with just a narrow stone/wood
        // foundation at the south edge. No front-facing facade or windows.
        const roofFromAbove = (x,y,w,h,p) => {
            tile(x-.16,y-.08,w+.32,h+.27,"#29272a");           // ground shadow
            tile(x-.08,y-.07,w+.16,h+.17,p.wall);              // thin foundation
            tile(x-.16,y-.19,w+.32,h+.20,p.eaves);             // northern eaves
            tile(x-.16,y-.12,.18,h+.10,p.eaves);               // west eave
            tile(x+w-.02,y-.12,.18,h+.10,p.eaves);             // east eave
            tile(x+.03,y+.02,w-.06,h*.48,p.upper);             // north roof slope
            tile(x+.03,y+h*.49,w-.06,h*.42,p.lower);           // south roof slope
            tile(x+.09,y+h*.475,w-.18,.13,p.ridge);            // roof ridge
            tile(x+.11,y+.09,w-.22,.12,p.highlight);          // sunlit upper edge
            tile(x+.07,y+h-.20,w-.14,.11,p.eaves);             // tiny south fascia
        };
        // Academy: violet slate pitched roof and clerestory skylights.
        // The pale panes lie ON the roof, not on a front-facing wall.
        roofFromAbove(2.16,3.58,2.52,2.06,{
            wall:"#b0a392",eaves:"#3a3644",upper:"#716a84",
            lower:"#57536d",ridge:"#ac9fbd",highlight:"#918ba1"
        });
        tile(2.52,3.38,.37,.38,"#484252");                     // square chimney
        tile(2.60,3.42,.20,.20,"#b9aebf");
        tile(3.04,4.22,.38,.37,"#292b39");                     // roof skylights
        tile(3.10,4.27,.26,.25,"#dfd4b1");
        tile(3.65,4.22,.38,.37,"#292b39");
        tile(3.71,4.27,.26,.25,"#dfd4b1");
        tile(4.12,5.21,.30,.20,"#dbc68f");                     // academic crest
        // Treasury: broad warm stone roof with a secured golden ridge.
        roofFromAbove(15.32,3.60,2.47,2.04,{
            wall:"#b0a081",eaves:"#554735",upper:"#a68b56",
            lower:"#806a43",ridge:"#e1bd6d",highlight:"#d4b27c"
        });
        tile(15.53,3.32,.43,.42,"#514633");                    // fortified corner
        tile(15.62,3.40,.25,.21,"#c2ac78");
        for (const ox of [15.90,16.43,16.96]) {
            tile(ox,4.42,.23,.23,"#56482f");                   // coin-shaped roof rivets
            tile(ox+.05,4.46,.13,.13,"#e6c36a");
        }
        tile(16.29,5.29,.52,.14,"#e3c16d");                    // small brass threshold
        // Royal Archives: dark teal pitched roof with roof hatches and a stack.
        roofFromAbove(1.98,15.65,2.46,2.02,{
            wall:"#a7a99b",eaves:"#303e42",upper:"#647d80",
            lower:"#485e65",ridge:"#a1b6b2",highlight:"#91a5a2"
        });
        tile(2.15,15.39,.44,.39,"#394345");                    // chimney viewed above
        tile(2.23,15.45,.26,.21,"#c0c0a9");
        for (const ox of [2.50,3.16,3.82]) {
            tile(ox,16.22,.34,.38,"#343b40");                  // narrow skylights
            tile(ox+.07,16.29,.20,.23,"#c0d4cc");
        }
        tile(2.91,17.36,.49,.10,"#b5baa8");
        // Dynasty estate: roof-first manor with corner turrets and a pennant.
        roofFromAbove(16.03,15.67,2.34,2.02,{
            wall:"#baa18d",eaves:"#433440",upper:"#826475",
            lower:"#644d65",ridge:"#c7a589",highlight:"#ad8c9d"
        });
        for (const corner of [[15.85,15.43],[18.22,15.43]]) {
            tile(corner[0],corner[1],.40,.42,"#382e39");       // turret caps
            tile(corner[0]+.08,corner[1]+.07,.24,.25,"#af8a9c");
        }
        tile(16.90,16.22,.54,.52,"#493644");                   // inset heraldic skylight
        tile(17.04,16.34,.25,.26,"#e7bd69");
        tile(17.10,16.27,.12,.10,"#f3d993");
        tile(18.36,15.07,.12,.63,"#d9c69e");                   // pennant
        tile(18.49,15.12,.40,.25,"#b7785e");
        // Relic Vault: a ROOFLESS top-down stone shrine at the crossroads,
        // with corner pillars and a gem in its central open courtyard.
        tile(9.00,8.48,2.05,2.02,"#292d31");
        tile(9.13,8.61,1.79,1.73,"#a2a397");
        tile(9.30,8.79,1.45,1.34,"#5b6967");
        tile(9.47,8.96,1.12,1.01,"#8a968c");
        for (const corner of [[9.12,8.58],[10.64,8.58],[9.12,10.05],[10.64,10.05]]) {
            tile(corner[0],corner[1],.32,.32,"#4d5252");
            tile(corner[0]+.06,corner[1]+.05,.20,.17,"#d5d2b8");
        }
        tile(9.88,9.14,.31,.62,"#2b4748");
        tile(9.96,9.05,.16,.69,"#67cfb7");                     // gem viewed from above
        tile(9.84,9.36,.39,.18,"#89e1cc");
        tile(10.02,9.18,.10,.12,"#d2fff0");
        // Keyboard outline remains a temporary 2px outline, never a label/card.
        if (keyboardIndex >= 0 && document.activeElement === canvas) {
            const b = locations[keyboardIndex].bounds;
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#ffdc83";
            ctx.strokeRect(Math.round(b[0]*unit),Math.round(b[1]*unit),
                Math.round((b[2]-b[0])*unit),Math.round((b[3]-b[1])*unit));
        }
    }
        drawKingdom = function (...args) {
        const result = originalDrawKingdom(...args);
        paintLandmarks();
        return result;
    };
    function setupPopup() {
        modal = document.getElementById("kingdom-location-popup");
        modalTitle = document.getElementById("kingdom-location-title");
        modalClose = document.getElementById("kingdom-location-close");
        const body = document.getElementById("kingdom-location-body");
        if (!modal || !modalTitle || !modalClose || !body) return false;
        for (const [id, originalIds] of Object.entries(modalContents)) {
            const section = node("section","kingdom-modal-section");
            section.hidden = true;
            for (const originalId of originalIds) {
                const source = document.getElementById(originalId);
                if (source) section.appendChild(source); // keep listeners and save logic
            }
            body.appendChild(section);
            modalSections.set(id,section);
        }
        modalClose.addEventListener("click",closeLocation);
        modal.addEventListener("click",event => {
            if (event.target === modal) closeLocation();
        });
        modal.addEventListener("keydown",event => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeLocation();
            } else if (event.key === "Tab") {
                const focusables = [...modal.querySelectorAll(
                    "button:not([disabled]),select:not([disabled]),input:not([disabled])," +
                    "a[href],[tabindex]:not([tabindex='-1'])")].filter(el =>
                        !el.closest("[hidden]") && el.getClientRects().length);
                if (!focusables.length) return;
                const first = focusables[0], last = focusables[focusables.length-1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();first.focus();
                }
            }
        });
        return true;
    }
    function initialize() {
        const kingdom = document.getElementById("kingdom-view");
        const map = document.getElementById("kingdom-box");
        canvas = document.getElementById("kingdom-canvas");
        if (!kingdom || !map || !canvas || !setupPopup()) return;
        const heading = node("p","kingdom-map-kicker","THE ROYAL DOMAIN");
        map.before(heading);
        const legacy = kingdom.querySelector(".structure-list");
        if (legacy && legacy.previousElementSibling?.tagName === "H3")
            legacy.previousElementSibling.classList.add("kingdom-legacy-heading");
        const caption = kingdom.querySelector(".map-caption");
        if (caption) caption.textContent = "Tap a building or landmark to manage it. " +
            "Your Royal Academy, Treasury, relics, archives and dynasty are part of the map.";
        canvas.setAttribute("tabindex","0");
        canvas.setAttribute("role","button");
        canvas.setAttribute("aria-label",
            "Kingdom map. Use arrow keys to choose a location; Enter to open.");
        canvas.onclick = event => {
            const point = canvasPoint(event);
            if (point) activate(locationAt(point.x,point.y));
        };
        canvas.addEventListener("mousemove",event => {
            const point = canvasPoint(event);
            const site = point && locationAt(point.x,point.y);
            canvas.style.cursor = site ? "pointer" : "default";
            canvas.title = site ? locationLabel(site) : "Choose a building or landmark";
        });
        canvas.addEventListener("mouseleave",() => {
            canvas.style.cursor = "default";
            canvas.title = "Choose a building or landmark";
        });
        canvas.addEventListener("keydown",event => {
            if (["ArrowRight","ArrowDown","ArrowLeft","ArrowUp","Home","End"].includes(event.key)) {
                event.preventDefault();
                const next = event.key === "Home" ? 0 :
                    event.key === "End" ? locations.length-1 :
                    keyboardIndex < 0 ? 1 : keyboardIndex +
                        (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1);
                focusLocation(next);
            } else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (!event.repeat) activate(locations[keyboardIndex >= 0 ? keyboardIndex : 1]);
            }
        });
        canvas.addEventListener("blur",() => drawKingdom());
        kingdom.classList.add("kingdom-map-ready");
        drawKingdom();
    }
    document.addEventListener("DOMContentLoaded",initialize);
})();