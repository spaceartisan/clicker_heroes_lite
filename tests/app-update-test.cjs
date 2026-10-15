// Exercise real worker/controller code with deterministic browser API doubles.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
let checks = 0;
function check(condition, label) { assert.ok(condition, label); checks++; }
class Events {
    constructor() { this.handlers = {}; }
    addEventListener(name, callback) { (this.handlers[name] ||= []).push(callback); }
    async emit(name, value = {}) { await Promise.all((this.handlers[name] || []).map(fn => fn(value))); }
}
async function workerChecks() {
    const base = 'https://game.example/';
    const stores = new Map([['heroes-of-click-old', new Map()], ['other-app', new Map()]]);
    const key = request => new URL(typeof request === 'string' ? request : request.url, base).href;
    let shellRequests = [], offline = false, failShell = false, skip = 0, claim = 0, fetches = 0;
    const caches = {
        async open(name) {
            if (!stores.has(name)) stores.set(name, new Map());
            const data = stores.get(name);
            return {
                async addAll(requests) {
                    shellRequests = requests;
                    if (failShell) throw Error('shell unavailable');
                    requests.forEach(request => data.set(key(request), new Response('installed:' + key(request))));
                },
                async put(request, response) { data.set(key(request), response); },
                async match(request) { return data.get(key(request))?.clone(); }
            };
        },
        async match(request) { for (const data of stores.values()) if (data.has(key(request))) return data.get(key(request)).clone(); },
        async keys() { return [...stores.keys()]; },
        async delete(name) { return stores.delete(name); }
    };
    const self = new Events();
    self.location = new URL('sw.js', base);
    self.skipWaiting = async () => { skip++; };
    self.clients = { claim: async () => { claim++; } };
    vm.runInNewContext(read('sw.js'), { self, caches, URL, Request, Response, fetch: async () => {
        fetches++;
        if (offline) throw Error('offline');
        return new Response('newer deployment');
    } });
    async function lifecycle(name, data) {
        const pending = [];
        await self.emit(name, { data, waitUntil: promise => pending.push(promise) });
        await Promise.all(pending);
    }
    async function request(url, mode = 'cors', method = 'GET') {
        let response;
        const pending = [];
        await self.emit('fetch', { request: { url: new URL(url, base).href, method, mode },
            respondWith: value => { response = value; }, waitUntil: value => pending.push(value) });
        const result = await response;
        await Promise.all(pending);
        return result;
    }
    await lifecycle('install');
    check(shellRequests.every(request => request.cache === 'reload'), 'Install bypasses stale HTTP cache');
    check(skip === 0, 'Installation does not replace an open game');
    const html = read('index.html');
    const localAssets = [...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)]
        .map(match => match[1]).filter(url => !url.startsWith('https:'));
    check(localAssets.every(url => shellRequests.some(request => request.url === new URL(url, base).href)), 'Every game script and stylesheet belongs to the offline release');
    check(shellRequests.every(request => fs.existsSync(path.join(root, new URL(request.url).pathname))), 'All shell paths exist');
    const before = fetches;
    check((await (await request('/?installed=1', 'navigate')).text()).includes('installed:'), 'Navigation with query serves the installed document');
    check((await (await request('/kingdom-map.js')).text()).includes('installed:'), 'Online deployment cannot mix new scripts into cached HTML');
    check(fetches === before, 'Installed shell does not hit the network');
    offline = true;
    check((await (await request('/menus.css')).text()).includes('installed:'), 'Cached styles work offline');
    check((await request('/missing.js')).type === 'error', 'Offline missing script is an error, never HTML');
    check(await request('/write', 'cors', 'POST') === undefined, 'Non-GET requests are untouched');
    check(await request('https://unrelated.example/app.js') === undefined, 'Unrelated origins are untouched');
    offline = false;
    check(await (await request('/tests/review.html', 'navigate')).text() === 'newer deployment', 'Review pages do not get replaced with the game');
    await lifecycle('message', { type: 'unrelated' });
    check(skip === 0, 'Unrelated messages cannot activate updates');
    await lifecycle('message', { type: 'ACTIVATE_UPDATE' });
    check(skip === 1, 'Explicit update action activates waiting release');
    await lifecycle('activate');
    check(claim === 1 && !stores.has('heroes-of-click-old') && stores.has('other-app'), 'Activation cleans only obsolete game caches');
    failShell = true;
    await assert.rejects(lifecycle('install'), /shell unavailable/);
    check(skip === 1, 'A failed shell download does not force activation');
}
function controller({ controlled = true, waiting = true, supported = true } = {}) {
    const nodes = new Map();
    for (const id of ['app-update-notice','app-update-notice-text','app-update-status','app-update-check']) {
        const node = new Events(); node.hidden = true; node.textContent = ''; nodes.set(id, node);
    }
    const reloadButtons = [new Events(), new Events()];
    reloadButtons.forEach(button => { button.hidden = true; });
    const document = new Events();
    Object.assign(document, { getElementById: id => nodes.get(id), querySelectorAll: () => reloadButtons, visibilityState: 'visible' });
    const window = new Events(), serviceWorker = new Events(), registration = new Events();
    let saves = 0, reloads = 0, updates = 0, messages = 0, failSave = false, failCheck = false, now = 100000;
    window.location = { reload() { reloads++; } };
    serviceWorker.controller = controlled ? {} : null;
    const worker = new Events();
    worker.postMessage = data => { assert.equal(data.type, 'ACTIVATE_UPDATE'); check(saves > 0, 'Progress saved before activation message'); messages++; };
    registration.waiting = waiting ? worker : null;
    registration.update = async () => { updates++; if (failCheck) throw Error('offline'); return registration; };
    serviceWorker.register = async (url, options) => { assert.equal(url, './sw.js'); assert.equal(options.updateViaCache, 'none'); return registration; };
    vm.runInNewContext(read('app-updates.js'), { document, window,
        navigator: supported ? { serviceWorker } : {}, Date: { now: () => now }, console: { warn() {} },
        saveGame: () => { if (failSave) throw Error('storage full'); saves++; }
    });
    return { nodes, reloadButtons, window, document, serviceWorker, registration, worker,
        get counts() { return { saves, reloads, updates, messages }; },
        set failSave(value) { failSave = value; }, set failCheck(value) { failCheck = value; },
        advance() { now += 61000; },
        status: () => nodes.get('app-update-status').textContent,
        load: () => window.emit('load'), apply: () => reloadButtons[0].emit('click') };
}
async function controllerChecks() {
    const c = controller(); await c.load();
    check(!c.nodes.get('app-update-notice').hidden && !c.reloadButtons[1].hidden, 'Waiting update appears in game and Config');
    check(c.counts.reloads === 0, 'Finding an update never reloads gameplay');
    c.failSave = true; await c.apply();
    check(c.counts.messages === 0 && c.status().includes('Could not save'), 'Save failure blocks activation and retains retry');
    c.failSave = false; await c.apply(); await c.apply();
    check(c.counts.messages === 1 && c.counts.reloads === 0, 'Double tap activates once and waits for controller');
    await c.serviceWorker.emit('controllerchange'); await c.serviceWorker.emit('controllerchange');
    check(c.counts.reloads === 1, 'Controller change reloads exactly once after acceptance');
    const first = controller({ controlled: false, waiting: false }); await first.load();
    first.serviceWorker.controller = {}; await first.serviceWorker.emit('controllerchange');
    check(first.counts.reloads === 0 && first.nodes.get('app-update-notice').hidden, 'First installation never reloads or offers a fake update');
    const other = controller({ waiting: false }); await other.load();
    await other.serviceWorker.emit('controllerchange');
    check(other.counts.reloads === 0 && !other.nodes.get('app-update-notice').hidden, 'Another tab activation offers a refresh without interrupting play');
    await other.apply(); check(other.counts.saves === 1 && other.counts.reloads === 1, 'Already activated update still saves before reload');
    const resume = controller({ waiting: false }); await resume.load();
    await resume.document.emit('visibilitychange');
    check(resume.counts.updates === 1, 'Repeated foreground events are throttled');
    resume.advance(); await resume.document.emit('visibilitychange');
    check(resume.counts.updates === 2, 'Resuming suspended phone app checks for an update');
    resume.failCheck = true; await resume.nodes.get('app-update-check').emit('click');
    check(resume.status().includes('Reconnect') && !resume.nodes.get('app-update-check').disabled, 'Offline check has a retryable status');
    resume.failCheck = false; await resume.window.emit('online');
    check(resume.status().includes('No new update'), 'Reconnection retries immediately');
    resume.registration.installing = resume.worker;
    await resume.registration.emit('updatefound');
    resume.worker.state = 'installed'; resume.registration.waiting = resume.worker;
    await resume.worker.emit('statechange');
    check(!resume.nodes.get('app-update-notice').hidden, 'Finishing a background download offers the update');
    const unsupported = controller({ supported: false });
    check(unsupported.nodes.get('app-update-check').disabled, 'Unsupported browsers keep game usable with clear status');
}
(async () => {
    await workerChecks(); await controllerChecks();
    console.log(`App update regression: ${checks} checks passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
