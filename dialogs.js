/* One foreground dialog, with explicit return context for nested menus. */
const GameDialogs = (() => {
    const stack = [];
    const inertBefore = new Map();
    let overflowBefore = "";
    const focusSelector = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],summary,[tabindex]:not([tabindex="-1"])';
    const focusables = el => [...el.querySelectorAll(focusSelector)].filter(node =>
        !node.closest('[hidden],[inert]') && node.getClientRects().length);

    function prepare(el) {
        if (el.dataset.dialogReady) return;
        const content = el.querySelector('.popup-content');
        if (!content) return;
        el.dataset.dialogReady = 'true';
        // Research used to live inside game-container, below the Court's stacking context.
        document.body.append(el);
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        const header = document.createElement('header');
        header.className = 'dialog-header';
        const title = el.querySelector('#general-menu-header') || content.querySelector('h3,h2');
        if (title) {
            if (!title.id) title.id = el.id + '-title';
            el.setAttribute('aria-labelledby', title.id);
            header.append(title);
        }
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'dialog-close button-secondary';
        close.textContent = 'Close';
        close.setAttribute('aria-label', 'Close dialog');
        close.onclick = () => dismiss();
        header.append(close);
        // Existing close actions share the same controller, including map landmarks.
        content.querySelectorAll('.modal-close,#close-upgrade-menu,#kingdom-location-close,.research-popup-header button').forEach(node => node.remove());
        const body = document.createElement('div');
        body.className = 'dialog-body';
        while (content.firstChild) body.append(content.firstChild);
        content.classList.add('dialog-shell');
        content.append(header, body);
    }
    function sync() {
        for (const [node, wasInert] of inertBefore) node.inert = wasInert;
        inertBefore.clear();
        const active = stack[stack.length - 1];
        for (const entry of stack) {
            const selected = entry === active;
            entry.el.style.display = selected ? 'flex' : 'none';
            entry.el.setAttribute('aria-hidden', String(!selected));
        }
        if (active) {
            for (const node of document.body.children) {
                if (node === active.el || ['SCRIPT','STYLE','LINK'].includes(node.tagName)) continue;
                inertBefore.set(node, node.inert);
                node.inert = true;
            }
            document.body.style.overflow = 'hidden';
        } else document.body.style.overflow = overflowBefore;
    }
    function focusEntry(entry, preferred) {
        if (preferred?.isConnected && !preferred.closest('[hidden],[inert]') && preferred.getClientRects().length && !preferred.disabled) preferred.focus();
        else (focusables(entry.el)[0] || entry.el).focus();
    }
    function open(id, onDismiss) {
        const el = document.getElementById(id);
        if (!el) return;
        prepare(el);
        const existing = stack.find(entry => entry.el === el);
        if (existing) return; // A purchase may redraw the current menu; preserve its return path.
        if (!stack.length) overflowBefore = document.body.style.overflow;
        const entry = {el, onDismiss, opener: document.activeElement};
        stack.push(entry);
        sync();
        const body = el.querySelector('.dialog-body');
        if (body) body.scrollTop = 0;
        focusEntry(entry);
    }
    function close(id) {
        const index = stack.findIndex(entry => entry.el.id === id);
        if (index < 0) { const el = document.getElementById(id); if (el) el.style.display = 'none'; return; }
        const entry = stack[index];
        // Closing a parent invalidates its descendants as well.
        for (const removed of stack.splice(index)) {
            removed.el.style.display = 'none';
            removed.el.setAttribute('aria-hidden', 'true');
        }
        sync();
        const parent = stack[stack.length - 1];
        if (parent) focusEntry(parent, entry.opener);
        else if (entry.opener?.isConnected && entry.opener.getClientRects().length) entry.opener.focus();
    }
    function dismiss() {
        const entry = stack[stack.length - 1];
        if (!entry) return;
        if (entry.onDismiss) entry.onDismiss();
        else close(entry.el.id);
    }
    document.addEventListener('keydown', event => {
        const entry = stack[stack.length - 1];
        if (!entry) return;
        if (event.key === 'Escape') {
            event.preventDefault(); event.stopImmediatePropagation(); dismiss();
        } else if (event.key === 'Tab') {
            const nodes = focusables(entry.el);
            const index = nodes.indexOf(document.activeElement);
            if (!nodes.length) { event.preventDefault(); return; }
            if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === nodes.length - 1)) {
                event.preventDefault(); nodes[event.shiftKey ? nodes.length - 1 : 0].focus();
            }
        }
    }, true);
    document.addEventListener('focusin', event => {
        const entry = stack[stack.length - 1];
        if (entry && !entry.el.contains(event.target)) focusEntry(entry);
    });
    return {open, close, dismiss, current: () => stack[stack.length - 1]?.el.id || null};
})();
