// Royal Commissions: three persistent, event-driven contracts per Dynasty.
// Gold rewards are fixed when issued; no daily clock, new currency or passive polling.
let royalCommissions = null;
const COMMISSION_KINDS = ['roads', 'guard', 'civic'];
const COMMISSION_TITLES = {roads:'Secure the roads', guard:'Prepare the royal guard', civic:'Invest in the kingdom'};
const COMMISSION_EVENTS = ['enemy', 'boss', 'hero', 'squad', 'gear', 'building', 'research'];
const commissionNodes = new Map();
let commissionReplacementId = null;
function commissionInteger(value, fallback = 0, cap = 1e12) {
    return Number.isFinite(value) ? Math.max(0, Math.min(cap, Math.floor(value))) : fallback;
}
function commissionBlocked() {
    return (typeof window !== 'undefined' && window.__hotcCloudRestorePending === true) ||
        (typeof sessionGuardBlocksGameplay === 'function' && sessionGuardBlocksGameplay());
}
function commissionReward(stage) {
    // Roughly six ordinary, unmodified enemy bounties at the required stage.
    const endless = stage > 200 ? 1 + Math.min(1, Math.log10(stage / 200) * .12) : 1;
    return Math.ceil(12 * Math.pow(stage, 1.4) * endless);
}
function commissionGoal(type, target) { return {type, target, progress:0}; }
function createCommission(kind, serial) {
    const stage = Math.max(1, Math.floor(Math.max(1, maxLevel - 1) * .8));
    const kills = 20 + Math.min(40, Math.floor(Math.log10(stage) * 10));
    const heroRoom = Math.max(0, structures.castle.level * 10 + 100 - playerLevel);
    const squadRoom = hiredMercenaries.reduce((sum, m) => sum + Math.max(0, (passiveAbilities[0].level - 1) * 10 + 100 - m.level), 0);
    const gearCap = (structures.blacksmith.level - 1) * 2 + 5;
    const gearRoom = playerGearLevel < gearCap || hiredMercenaries.some(m => m.gearLevel < gearCap);
    const canStudy = RESEARCH_NODES.some(node => canResearchNode(node.id)) ||
        ACADEMY_DISCIPLINES.some(college => academyDisciplines[college.id] < 10000 &&
            getResearchInsightAvailable() >= getAcademyDisciplineCost(college.id));
    const canBuild = Object.keys(structures).some(id => !structureLockReason(id) &&
        (id === 'tavern' && !structures[id].level || getStructureCost(structures[id]) <= gold));
    let goals;
    if (kind === 'roads') goals = [commissionGoal('enemy', kills),
        commissionGoal(squadRoom ? 'squad' : heroRoom ? 'hero' : 'boss', squadRoom ? Math.min(3, squadRoom) : heroRoom ? Math.min(3, heroRoom) : 2)];
    else if (kind === 'guard') goals = [commissionGoal('boss', 2),
        commissionGoal(gearRoom ? 'gear' : 'enemy', gearRoom ? 1 : kills)];
    else goals = [commissionGoal(canBuild ? 'building' : 'enemy', canBuild ? 1 : kills + 10),
        commissionGoal(canStudy ? 'research' : heroRoom ? 'hero' : squadRoom ? 'squad' : 'boss',
            canStudy ? 1 : heroRoom ? Math.min(2, heroRoom) : squadRoom ? Math.min(2, squadRoom) : 2)];
    return {id:serial, kind, stage, goals};
}
function renewRoyalCommissions() {
    const previous = royalCommissions;
    royalCommissions = {dynasty:dynastyCount, completed:previous?.completed || 0, serial:previous?.serial || 0, trackedId:null, jobs:[]};
    for (const kind of COMMISSION_KINDS) royalCommissions.jobs.push(createCommission(kind, ++royalCommissions.serial));
    commissionNodes.clear();
    renderRoyalCommissions();
}
function loadRoyalCommissions(saved) {
    royalCommissions = {dynasty:dynastyCount, completed:commissionInteger(saved?.completed),
        serial:commissionInteger(saved?.serial), trackedId:null, jobs:[]};
    if (saved?.dynasty === dynastyCount && Array.isArray(saved.jobs)) {
        const used = new Set();
        for (let index = 0; index < 3; index++) {
            const job = saved.jobs[index];
            const kind = job?.kind;
            if (!job || !COMMISSION_KINDS.includes(kind) || !Number.isSafeInteger(job.id) || job.id < 1 || job.id > 1e12 || used.has(job.id) ||
                !Number.isSafeInteger(job.stage) || job.stage < 1 || job.stage > 1e12 ||
                !Array.isArray(job.goals) || job.goals.length !== 2 ||
                job.goals.some(goal => !goal || !COMMISSION_EVENTS.includes(goal.type) ||
                    !Number.isInteger(goal.target) || goal.target < 1 || goal.target > 100)) continue;
            used.add(job.id);
            royalCommissions.serial = Math.max(royalCommissions.serial, job.id);
            royalCommissions.jobs[index] = {id:job.id, kind, stage:job.stage,
                goals:job.goals.map(goal => ({type:goal.type, target:goal.target,
                    progress:commissionInteger(goal.progress, 0, goal.target)}))};
        }
    }
    for (let index = 0; index < 3; index++) if (!royalCommissions.jobs[index])
        royalCommissions.jobs[index] = createCommission(COMMISSION_KINDS[index], ++royalCommissions.serial);
    royalCommissions.trackedId = royalCommissions.jobs.some(job => job.id === saved?.trackedId) ? saved.trackedId : null;
    commissionNodes.clear();
    renderRoyalCommissions();
}
function commissionComplete(job) { return job.goals.every(goal => goal.progress >= goal.target); }
function royalCommissionReadyCount() { return royalCommissions?.jobs.filter(commissionComplete).length || 0; }
function recordCommissionEvent(type, amount = 1, stage = 0) {
    if (!royalCommissions || commissionBlocked()) return;
    const count = commissionInteger(amount, 0, 100);
    if (!count) return;
    let changed = false;
    const ready = royalCommissionReadyCount();
    for (const job of royalCommissions.jobs) for (const goal of job.goals) {
        if (goal.type !== type || goal.progress >= goal.target ||
            (['enemy','boss'].includes(type) && stage < job.stage)) continue;
        goal.progress = Math.min(goal.target, goal.progress + count);
        changed = true;
    }
    if (changed) {
        refreshRoyalCommissions();
        const nextReady = royalCommissionReadyCount();
        if (nextReady !== ready) {
            if (typeof drawKingdom === 'function') drawKingdom();
            const live = document.getElementById('commission-live-status');
            if (live) live.textContent = nextReady + ' Royal Commission' + (nextReady === 1 ? '' : 's') + ' ready to claim.';
        }
    }
}
function commissionMessage(message) {
    const status = document.getElementById('commission-status');
    if (status) status.textContent = message;
}
function finishCommission(id, claim) {
    if (!royalCommissions || commissionBlocked()) { commissionMessage('Resume this device’s game before changing commissions.'); return false; }
    const index = royalCommissions.jobs.findIndex(job => job.id === id);
    if (index < 0) return false; // Old buttons/double taps cannot claim a new contract.
    const job = royalCommissions.jobs[index];
    if (claim && !commissionComplete(job)) return false;
    const previous = JSON.parse(JSON.stringify(royalCommissions));
    const previousGold = gold;
    const reward = claim ? commissionReward(job.stage) : 0;
    if (claim) { gold = Math.min(1e300, gold + reward); royalCommissions.completed++; }
    // Replacements alternate the two military briefs; civic work stays civic.
    const nextKind = claim ? job.kind : job.kind === 'roads' ? 'guard' : job.kind === 'guard' ? 'roads' : 'civic';
    royalCommissions.jobs[index] = createCommission(nextKind, ++royalCommissions.serial);
    if (royalCommissions.trackedId === id) royalCommissions.trackedId = royalCommissions.jobs[index].id;
    try { saveGame(); }
    catch (_) {
        royalCommissions = previous; gold = previousGold;
        renderRoyalCommissions();
        commissionMessage('Could not save. Nothing was claimed or replaced. Please try again.');
        return false;
    }
    renderRoyalCommissions(); updateUI(); drawKingdom();
    commissionMessage(claim ? 'Commission completed. ' + formatDigits(reward, 0, 0).trim() + ' gold received.' : 'Commission replaced. Its progress has been reset.');
    document.querySelector('#commission-list [data-commission-slot="' + index + '"] .commission-next')?.focus();
    return true;
}
function commissionGoalLabel(goal, job) {
    const labels = {enemy:'Defeat enemies', boss:'Defeat bosses', hero:'Buy hero levels',
        squad:'Train mercenary levels', gear:'Buy hero or squad gear levels',
        building:'Construct or upgrade a building', research:'Complete research or a College rank'};
    return labels[goal.type] + (['enemy','boss'].includes(goal.type) ? ' at stage ' + (goal.type === 'boss' ? Math.ceil(job.stage / 10) * 10 : job.stage).toLocaleString() + '+' : '');
}
function commissionElement(tag, className, text) {
    const el = document.createElement(tag); if (className) el.className = className;
    if (text) el.textContent = text; return el;
}
function renderRoyalCommissions() {
    const root = document.getElementById('commission-list');
    if (!root || !royalCommissions) return;
    root.replaceChildren(); commissionNodes.clear(); commissionReplacementId = null;
    royalCommissions.jobs.forEach((job, index) => {
        const card = commissionElement('article', 'commission-card');
        card.setAttribute('data-commission-slot', String(index));
        const heading = commissionElement('h4', '', COMMISSION_TITLES[job.kind]);
        const reward = commissionElement('p', 'commission-reward', formatDigits(commissionReward(job.stage), 0, 0).trim() + ' gold reward');
        const list = commissionElement('ul', 'commission-goals');
        const goals = job.goals.map(goal => {
            const item = commissionElement('li');
            const label = commissionElement('span', '', commissionGoalLabel(goal, job));
            const count = commissionElement('strong');
            const meter = commissionElement('progress'); meter.max = goal.target;
            meter.setAttribute('aria-label', commissionGoalLabel(goal, job));
            item.append(label, count, meter); list.append(item); return {count,meter};
        });
        const actions = commissionElement('div', 'commission-actions');
        const claim = commissionElement('button', 'commission-next', 'Continue'); claim.type = 'button';
        claim.addEventListener('click', () => commissionComplete(job) ? finishCommission(job.id, true) : continueCommission(job.id));
        const track = commissionElement('button', 'button-secondary', 'Track'); track.type = 'button';
        track.addEventListener('click', () => trackRoyalCommission(job.id));
        const replace = commissionElement('button', 'button-secondary', 'Replace'); replace.type = 'button';
        const confirmation = commissionElement('div', 'commission-replacement'); confirmation.hidden = true;
        const warning = commissionElement('p', '', 'Replace this request? Its progress will be lost.');
        const confirm = commissionElement('button', 'button-secondary', 'Replace request'); confirm.type = 'button';
        const cancel = commissionElement('button', 'button-secondary', 'Keep request'); cancel.type = 'button';
        confirm.addEventListener('click', () => { if (commissionReplacementId === job.id) finishCommission(job.id, false); });
        cancel.addEventListener('click', () => { commissionReplacementId = null; refreshRoyalCommissions(); replace.focus(); });
        replace.addEventListener('click', () => { commissionReplacementId = job.id; refreshRoyalCommissions(); cancel.focus(); });
        const confirmationActions = commissionElement('div', 'action-row'); confirmationActions.append(cancel, confirm);
        confirmation.append(warning, confirmationActions);
        actions.append(claim, track, replace); card.append(heading, reward, list, actions, confirmation); root.append(card);
        commissionNodes.set(job.id, {card,goals,claim,track,replace,confirmation,confirm,cancel});
    });
    refreshRoyalCommissions();
}
function refreshRoyalCommissions() {
    if (!royalCommissions) return;
    const ready = royalCommissionReadyCount();
    const summary = document.getElementById('commission-summary');
    if (summary) summary.textContent = ready + ' ready to claim · ' + royalCommissions.completed.toLocaleString() + ' completed across your Dynasties';
    const mapStatus = document.getElementById('kingdom-commission-status');
    if (mapStatus) mapStatus.textContent = ready ? ready + ' commission' + (ready === 1 ? '' : 's') + ' ready — visit the noticeboard beside the Castle.' : 'Royal Commissions await at the noticeboard beside the Castle.';
    const badge = document.getElementById('commission-ready-badge');
    if (badge) { badge.hidden = !ready; badge.textContent = String(ready); }
    const kingdomTab = document.getElementById('view-tab-kingdom');
    if (kingdomTab) kingdomTab.setAttribute('aria-label', ready ? 'Kingdom · ' + ready + ' commissions ready' : 'Kingdom');
    refreshCommissionTracker();
    for (const job of royalCommissions.jobs) {
        const nodes = commissionNodes.get(job.id); if (!nodes) continue;
        job.goals.forEach((goal, i) => {
            nodes.goals[i].count.textContent = goal.progress + ' / ' + goal.target;
            nodes.goals[i].meter.value = goal.progress;
        });
        const complete = commissionComplete(job);
        nodes.card.classList?.toggle('is-complete', complete);
        nodes.claim.disabled = commissionBlocked();
        nodes.claim.textContent = complete ? 'Claim reward' : commissionActionLabel(job);
        nodes.track.textContent = royalCommissions.trackedId === job.id ? 'Untrack' : 'Track';
        nodes.track.setAttribute('aria-pressed', String(royalCommissions.trackedId === job.id));
        nodes.track.disabled = commissionBlocked();
        nodes.replace.disabled = commissionBlocked();
        nodes.confirm.disabled = commissionBlocked();
        nodes.confirmation.hidden = commissionReplacementId !== job.id;
    }
}
function openRoyalCommissions() {
    renderRoyalCommissions(); commissionMessage('');
    openGameDialog('commissions-popup', () => closeGameDialog('commissions-popup'));
}

function commissionNextGoal(job) { return job.goals.find(goal => goal.progress < goal.target); }
function commissionActionLabel(job) {
    const labels = {enemy:'Fight enemies',boss:'Fight bosses',hero:'Open Hero',squad:'Open Army',
        gear:playerGearLevel < (structures.blacksmith.level - 1) * 2 + 5 ? 'Open Hero' : 'Open Blacksmith',
        building:'View structures',research:'Open Academy'};
    return labels[commissionNextGoal(job)?.type] || 'View request';
}
function trackRoyalCommission(id, force = false) {
    if (!royalCommissions || commissionBlocked() || !royalCommissions.jobs.some(job => job.id === id)) return false;
    const previous = royalCommissions.trackedId;
    royalCommissions.trackedId = previous === id && !force ? null : id;
    try { saveGame(); }
    catch (_) { royalCommissions.trackedId = previous; commissionMessage('Could not save your tracked request. Please try again.'); return false; }
    refreshRoyalCommissions();
    return true;
}
function continueCommission(id) {
    const job = royalCommissions?.jobs.find(job => job.id === id);
    if (!job || commissionBlocked()) return false;
    if (commissionComplete(job)) { openRoyalCommissions(); return true; }
    if (!trackRoyalCommission(id, true)) return false;
    const goal = commissionNextGoal(job);
    if (goal.type === 'research') openResearchTree();
    else if (goal.type === 'building') {
        const available = Object.keys(structures).filter(key => !structureLockReason(key));
        const cost = key => key === 'tavern' && !structures[key].level ? 0 : getStructureCost(structures[key]);
        available.sort((a,b) => cost(a) - cost(b));
        closeGameDialog('commissions-popup');
        switchView('kingdom');
        document.getElementById((available[0] || 'castle') + '-structure-upgrade')?.focus();
    } else if (goal.type === 'gear' && playerGearLevel >= (structures.blacksmith.level - 1) * 2 + 5) {
        showMenu('blacksmith');
    } else {
        closeGameDialog('commissions-popup');
        const view = goal.type === 'squad' ? 'army' : 'hero';
        switchView(view);
        const target = document.getElementById(goal.type === 'hero' ? 'hero-level-upgrade' :
            goal.type === 'gear' ? 'hero-gear-upgrade' : view === 'army' ? 'view-tab-army' : 'enemy-canvas');
        if (target && !target.disabled) target.focus();
        else document.getElementById('view-tab-' + view)?.focus();
    }
    return true;
}
function refreshCommissionTracker() {
    const tracker = document.getElementById('commission-tracker');
    if (!tracker) return;
    const job = royalCommissions?.jobs.find(job => job.id === royalCommissions.trackedId);
    tracker.hidden = !job;
    if (!job) return;
    const title = document.getElementById('commission-tracker-title');
    const detail = document.getElementById('commission-tracker-detail');
    const action = document.getElementById('commission-tracker-action');
    if (title) title.textContent = COMMISSION_TITLES[job.kind];
    const goal = commissionNextGoal(job);
    if (detail) detail.textContent = goal ? commissionGoalLabel(goal, job) + ' · ' + goal.progress + ' / ' + goal.target : 'Complete — your reward is ready.';
    if (action) { action.textContent = goal ? commissionActionLabel(job) : 'View reward'; action.disabled = commissionBlocked(); }
}
function continueTrackedCommission() {
    if (royalCommissions?.trackedId) continueCommission(royalCommissions.trackedId);
}
