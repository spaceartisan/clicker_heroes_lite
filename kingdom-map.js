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
        modal.style.display = "none";
        modal.setAttribute("aria-hidden","true");
        if (canvas) canvas.focus();
    }
    function openLocation(id) {
        if (!modal || !modalSections.has(id)) return;
        for (const [key, section] of modalSections) section.hidden = key !== id;
        modalTitle.textContent = locations.find(site=>site.id===id).label;
        modal.style.display = "flex";
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
        if (modalClose) modalClose.focus();
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
        const hall = (x,y,roof,light) => {
            tile(x-.25,y+.1,2.7,2.15,"#27282b");
            tile(x,y+.3,2.2,1.7,"#a2977e");
            tile(x-.18,y-.1,2.56,.62,roof);
            tile(x+.25,y+.55,.3,.5,light);
            tile(x+1.58,y+.55,.3,.5,light);
            tile(x+.86,y+1.14,.48,.85,"#373130");
        };
        hall(2.2,3.6,"#68527e","#d8c6ee");   // Academy
        tile(3.02,3.1,.55,.65,"#e5c8f1");
        hall(15.3,3.6,"#ab8646","#ffe4a2");  // Treasury
        tile(16.05,3.12,.72,.65,"#d8bb67");
        hall(1.9,15.65,"#657c79","#afd0cb"); // Archives
        tile(2.78,15.2,.38,.48,"#c3d4cc");
        hall(16.05,15.65,"#74536e","#eac1d3"); // Dynasty
        tile(16.95,15.14,.24,.59,"#edc16b");
        tile(9.18,8.7,1.65,1.55,"#3d4247"); // Relic shrine
        tile(9.35,8.85,1.31,1.18,"#939997");
        tile(9.77,8.94,.48,.63,"#67c6ab");
        tile(9.88,8.72,.26,.25,"#baf1db");
        tile(9.43,9.82,1.1,.12,"#dad6b8");
        // Keyboard focus only: outline the building, never cover its artwork.
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