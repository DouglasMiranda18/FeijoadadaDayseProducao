export const ORDER_STATUSES = Object.freeze({
    received: { label: 'Pedido recebido', tone: 'waiting' },
    confirmed: { label: 'Confirmado', tone: 'waiting' },
    preparing: { label: 'Em preparo', tone: 'cooking' },
    ready: { label: 'Pronto', tone: 'ready' },
    out_for_delivery: { label: 'Saiu para entrega', tone: 'delivery' },
    arrived: { label: 'Entregador chegou', tone: 'delivery' },
    ready_for_pickup: { label: 'Pronto para retirada', tone: 'ready' },
    delivered: { label: 'Entregue', tone: 'done' },
    cancelled: { label: 'Cancelado', tone: 'cancelled' }
});

const DELIVERY_FLOW = ['received', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'arrived', 'delivered'];
const PICKUP_FLOW = ['received', 'confirmed', 'preparing', 'ready_for_pickup', 'delivered'];

export function orderFlow(fulfillment = 'delivery') {
    return fulfillment === 'pickup' ? [...PICKUP_FLOW] : [...DELIVERY_FLOW];
}

export function validNextStatuses(status, fulfillment = 'delivery') {
    if (status === 'cancelled' || status === 'delivered') return [];
    const flow = orderFlow(fulfillment);
    const index = flow.indexOf(status);
    const next = index >= 0 && index < flow.length - 1 ? [flow[index + 1]] : [];
    return [...next, 'cancelled'];
}

export function statusLabel(status) {
    return ORDER_STATUSES[status]?.label || 'Status desconhecido';
}

export function publicName(profile = {}) {
    const chosen = String(profile.publicName || profile.displayName || '').trim();
    if (!chosen) return 'Cliente da casa';
    return chosen.split(/\s+/).slice(0, 2).join(' ').slice(0, 40);
}

export function loyaltyLevel(completedOrders = 0) {
    const total = Math.max(0, Number(completedOrders) || 0);
    if (total >= 20) return { id: 'panela', label: 'Da panela', nextAt: null };
    if (total >= 10) return { id: 'fan', label: 'Fã da feijoada', nextAt: 20 };
    if (total >= 3) return { id: 'friend', label: 'Amigo da casa', nextAt: 10 };
    return { id: 'new', label: 'Chegando agora', nextAt: 3 };
}

export function reorderFromHistory(items = [], products = []) {
    const catalog = new Map(products.map((product) => [String(product.id), product]));
    const cart = [];
    const unavailable = [];
    const removed = [];
    items.forEach((oldItem) => {
        const product = catalog.get(String(oldItem.productId || oldItem.id));
        if (!product) {
            removed.push(oldItem.name || 'Item removido');
            return;
        }
        if (!product.availability) {
            unavailable.push(product.name);
            return;
        }
        cart.push({ ...product, quantity: Math.min(99, Math.max(1, Number(oldItem.quantity) || 1)) });
    });
    return { cart, unavailable, removed };
}

export function rankEntries(entries = [], currentUid = '') {
    return [...entries]
        .filter((entry) => entry && entry.publicName && Number.isFinite(Number(entry.score)))
        .sort((a, b) => Number(b.score) - Number(a.score) || String(a.publicName).localeCompare(String(b.publicName), 'pt-BR'))
        .map((entry, index) => ({ ...entry, score: Number(entry.score), position: index + 1, isCurrent: entry.uid === currentUid }));
}

export function plausibleGameScore({ score, durationMs, collections = 0, powerUps = 0 }) {
    const points = Number(score);
    const duration = Number(durationMs);
    if (!Number.isInteger(points) || points < 0 || !Number.isFinite(duration) || duration < 1000 || duration > 30 * 60 * 1000) return false;
    const maximum = Math.floor(duration / 300) * 50 + Math.max(0, Number(powerUps) || 0) * 100;
    const eventMaximum = Math.max(0, Number(collections) || 0) * 400 + Math.max(0, Number(powerUps) || 0) * 100;
    return points <= maximum && points <= eventMaximum;
}

export function unreadCount(notifications = []) {
    return notifications.reduce((total, item) => total + (item.read ? 0 : 1), 0);
}

export function friendlyOrderId(id = '') {
    return `FD-${String(id).replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase() || 'NOVO'}`;
}

function orderDate(order) {
    const value = order.deliveredAt || order.updatedAt || order.createdAt;
    const date = value?.toDate?.() || (value ? new Date(value) : null);
    return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function financialSummary(orders = [], { start = null, end = null } = {}) {
    const completed = orders.filter((order) => {
        if (order?.status !== 'delivered') return false;
        const date = orderDate(order);
        if (!date) return false;
        return (!start || date >= start) && (!end || date <= end);
    });
    const cents = (value) => Math.round((Number(value) || 0) * 100);
    const totalCents = completed.reduce((sum, order) => sum + cents(order.totals?.total || order.total), 0);
    const deliveryCents = completed.reduce((sum, order) => sum + cents(order.totals?.deliveryFee), 0);
    const payments = new Map();
    const products = new Map();
    completed.forEach((order) => {
        const method = String(order.paymentMethod || 'Não informado');
        const payment = payments.get(method) || { method, orders: 0, totalCents: 0 };
        payment.orders += 1; payment.totalCents += cents(order.totals?.total || order.total); payments.set(method, payment);
        (order.items || []).forEach((item) => {
            const key = String(item.productId || item.name || 'produto');
            const product = products.get(key) || { productId: key, name: item.name || 'Produto', quantity: 0, totalCents: 0 };
            product.quantity += Number(item.quantity) || 0;
            product.totalCents += cents(item.price) * (Number(item.quantity) || 0);
            products.set(key, product);
        });
    });
    return {
        orders: completed.length,
        revenue: totalCents / 100,
        averageTicket: completed.length ? totalCents / completed.length / 100 : 0,
        deliveryFees: deliveryCents / 100,
        payments: [...payments.values()].map((item) => ({ ...item, total: item.totalCents / 100 })).sort((a, b) => b.total - a.total),
        products: [...products.values()].map((item) => ({ ...item, total: item.totalCents / 100 })).sort((a, b) => b.quantity - a.quantity || b.total - a.total)
    };
}
