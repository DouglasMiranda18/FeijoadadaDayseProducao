const ICONS = Object.freeze({
    home: 'house', menu: 'utensils', game: 'gamepad-2', account: 'user-round', bag: 'shopping-bag',
    bell: 'bell', gear: 'settings', clock: 'clock-3', location: 'map-pin', heart: 'heart',
    success: 'circle-check', warning: 'triangle-alert', phone: 'phone', chat: 'message-circle',
    courier: 'bike', arrow: 'arrow-right', close: 'x', plus: 'plus', minus: 'minus',
    up: 'arrow-up', left: 'arrow-left', down: 'arrow-down', right: 'arrow-right'
});

let scheduled = false;

function iconName(element) {
    const prefix = element.classList.contains('control-icon') ? 'control-icon--' : 'site-icon--';
    const className = [...element.classList].find((name) => name.startsWith(prefix));
    return className ? ICONS[className.slice(prefix.length)] : '';
}

function upgradeIcons() {
    scheduled = false;
    if (!window.lucide?.createIcons) return;
    document.querySelectorAll('span.site-icon, span.control-icon').forEach((element) => {
        const name = iconName(element);
        if (name) element.dataset.lucide = name;
    });
    window.lucide.createIcons({ attrs: { 'aria-hidden': 'true', focusable: 'false', 'stroke-width': 2.15 } });
    document.documentElement.classList.add('has-lucide');
}

function scheduleUpgrade() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(upgradeIcons);
}

scheduleUpgrade();
window.addEventListener('load', scheduleUpgrade, { once: true });
new MutationObserver((mutations) => {
    if (mutations.some((mutation) => [...mutation.addedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE && (node.matches?.('span.site-icon, span.control-icon') || node.querySelector?.('span.site-icon, span.control-icon'))))) scheduleUpgrade();
}).observe(document.body, { childList: true, subtree: true });
