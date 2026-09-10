export const CATEGORY_LABELS = Object.freeze({
    comidas: 'Comidas',
    acompanhamentos: 'Acompanhamentos',
    bebidas: 'Bebidas',
    sobremesas: 'Sobremesas'
});

export const BADGE_LABELS = Object.freeze({
    featured: 'Destaque',
    popular: 'Mais pedido',
    recommended: 'Recomendado',
    new: 'Novidade'
});

export const PAYMENT_FEES = Object.freeze({
    'Cartão de Crédito': 2,
    'Cartão de Débito': 1,
    Pix: 0,
    Dinheiro: 0
});

export const STORE_LOCATION = Object.freeze({
    lat: -8.182448717266935,
    lng: -34.92541637466083
});

export const STORE_SCHEDULE = Object.freeze({
    days: [0, 4, 5, 6],
    opensAt: 10,
    closesAt: 15,
    timezone: 'America/Recife'
});

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export function money(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

export function normalizeText(value = '') {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

export function categoryLabel(category = '') {
    const normalized = normalizeText(category);
    return CATEGORY_LABELS[normalized] || String(category).trim() || 'Outros';
}

export function badgeLabel(badge = '') {
    return BADGE_LABELS[badge] || '';
}

export function isValidHttpUrl(value = '') {
    if (!value) return true;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

export function normalizeProduct(id, raw = {}) {
    const name = String(raw.name || '').trim();
    const category = normalizeText(raw.category || '');
    const price = Number(raw.price);
    if (!name || !category || !Number.isFinite(price) || price <= 0) return null;

    const badge = BADGE_LABELS[raw.badge] ? raw.badge : '';
    return {
        id: String(id),
        name,
        category,
        price,
        description: String(raw.description || '').trim(),
        image: isValidHttpUrl(raw.image) ? String(raw.image || '').trim() : '',
        availability: raw.availability !== false,
        badge
    };
}

export function sortProducts(products, category = 'all') {
    const selected = category === 'all'
        ? [...products]
        : products.filter((product) => product.category === category);

    return selected.sort((a, b) => {
        if (a.availability !== b.availability) return a.availability ? -1 : 1;
        if (category === 'all') {
            const aFeijoada = normalizeText(a.name).includes('feijoada');
            const bFeijoada = normalizeText(b.name).includes('feijoada');
            if (aFeijoada !== bFeijoada) return aFeijoada ? -1 : 1;
            const aDrink = a.category === 'bebidas';
            const bDrink = b.category === 'bebidas';
            if (aDrink !== bDrink) return aDrink ? 1 : -1;
        }
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    });
}

export function cartSubtotal(cart) {
    return cart.reduce((total, item) => total + Number(item.price) * Math.max(0, Number(item.quantity) || 0), 0);
}

export function addCartItem(cart, product, quantity = 1) {
    const nextCart = cart.map((item) => ({ ...item }));
    const amount = Math.min(99, Math.max(1, Math.trunc(Number(quantity) || 1)));
    const existing = nextCart.find((item) => item.id === product.id);
    if (existing) existing.quantity = Math.min(99, existing.quantity + amount);
    else nextCart.push({ ...product, quantity: amount });
    return nextCart;
}

export function changeCartQuantity(cart, id, change) {
    return cart.flatMap((item) => {
        if (item.id !== id) return [{ ...item }];
        const nextQuantity = Math.min(99, item.quantity + Number(change || 0));
        return nextQuantity > 0 ? [{ ...item, quantity: nextQuantity }] : [];
    });
}

export function formatCep(value = '') {
    const digits = String(value).replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5)}`;
}

export function formatPhone(value = '') {
    const digits = String(value).replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    const prefix = digits.slice(0, 2);
    if (digits.length <= 6) return `(${prefix}) ${digits.slice(2)}`;
    const split = digits.length === 11 ? 7 : 6;
    return `(${prefix}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}

export function paymentFee(method) {
    return PAYMENT_FEES[method] || 0;
}

export function deliveryFeeFromDistance(distance) {
    const kilometers = Number(distance);
    if (!Number.isFinite(kilometers) || kilometers < 0) return null;
    if (kilometers <= 1) return 0;
    return Math.round(Math.max(5, (kilometers - 1) * 2) * 100) / 100;
}

export function deliveryFeeFromNeighborhood(neighborhood = '') {
    const fees = {
        loreto: 5,
        piedade: 5,
        'jardim piedade': 5,
        'cajueiro seco': 5,
        'dom helder': 6,
        candeias: 6,
        cadeias: 6,
        prazeres: 6,
        'barra de jangada': 8,
        'estrada de curcurana': 10,
        guararapes: 10,
        'santo amaro': 15,
        setubal: 15,
        'boa viagem': 15,
        imbiribeira: 15,
        ipsep: 15
    };
    return fees[normalizeText(neighborhood)] ?? null;
}

export function haversineKm(pointA, pointB) {
    const toRad = (value) => (value * Math.PI) / 180;
    const earthRadius = 6371;
    const deltaLat = toRad(pointB.lat - pointA.lat);
    const deltaLng = toRad(pointB.lng - pointA.lng);
    const latA = toRad(pointA.lat);
    const latB = toRad(pointB.lat);
    const value = Math.sin(deltaLat / 2) ** 2
        + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLng / 2) ** 2;
    return 2 * earthRadius * Math.asin(Math.sqrt(value));
}

function zonedParts(date, timezone) {
    const values = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date).reduce((result, part) => {
        if (part.type !== 'literal') result[part.type] = part.value;
        return result;
    }, {});
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
        day: dayMap[values.weekday],
        hour: Number(values.hour),
        minute: Number(values.minute)
    };
}

function nextOpening(parts, schedule) {
    for (let offset = 0; offset <= 7; offset += 1) {
        const day = (parts.day + offset) % 7;
        if (!schedule.days.includes(day)) continue;
        if (offset === 0 && (parts.hour > schedule.opensAt || (parts.hour === schedule.opensAt && parts.minute > 0))) continue;
        return offset === 0
            ? `Hoje, às ${schedule.opensAt}h`
            : `${WEEKDAYS[day].replace(/^./, (letter) => letter.toUpperCase())}, às ${schedule.opensAt}h`;
    }
    return `Quinta-feira, às ${schedule.opensAt}h`;
}

export function getStoreStatus(date = new Date(), override = 'auto', schedule = STORE_SCHEDULE) {
    const parts = zonedParts(date, schedule.timezone);
    const scheduledDay = schedule.days.includes(parts.day);
    const scheduledTime = parts.hour >= schedule.opensAt && parts.hour < schedule.closesAt;
    const mode = override === true ? 'closed' : ['open', 'closed'].includes(override) ? override : 'auto';
    const open = mode === 'open' || (mode === 'auto' && scheduledDay && scheduledTime);

    if (open) {
        return {
            open: true,
            label: mode === 'open' ? 'Aberto manualmente' : 'Aberto agora',
            detail: mode === 'open' ? 'Pedidos liberados pelo administrador' : `Pedidos até ${schedule.closesAt}h`,
            reason: mode === 'open' ? 'manual-open' : 'open',
            nextOpening: null
        };
    }

    if (mode === 'closed') {
        return {
            open: false,
            label: 'Pedidos pausados',
            detail: 'A cozinha pausou os pedidos por agora',
            reason: 'manual',
            nextOpening: nextOpening(parts, schedule)
        };
    }

    return {
        open: false,
        label: 'Fechado agora',
        detail: `Próxima abertura: ${nextOpening(parts, schedule)}`,
        reason: 'schedule',
        nextOpening: nextOpening(parts, schedule)
    };
}

export function reconcileCart(cart, products) {
    const catalog = new Map(products.map((product) => [product.id, product]));
    return cart.flatMap((item) => {
        const product = catalog.get(String(item.id));
        if (!product) return [];
        const quantity = Math.min(99, Math.max(1, Math.trunc(Number(item.quantity) || 1)));
        return [{ ...product, quantity }];
    });
}

export function buildWhatsAppMessage({ orderId = '', customer, cart, totals, paymentMethod, changeAmount, notes }) {
    const lines = [
        orderId ? '*Atendimento sobre pedido — Feijoada da Dayse*' : '*Pedido por contingência — Feijoada da Dayse*',
        '',
        ...(orderId ? [`*Pedido:* ${orderId}`, ''] : []),
        `*Cliente:* ${customer.name}`,
        `*Telefone:* ${customer.phone}`,
        `*Entrega:* ${customer.address}`,
        '',
        '*Itens:*'
    ];

    cart.forEach((item) => {
        lines.push(`${item.quantity}x ${item.name} — ${money(item.price * item.quantity)}`);
    });

    lines.push(
        '',
        `Subtotal: ${money(totals.subtotal)}`,
        `Entrega: ${money(totals.deliveryFee)}`
    );

    if (totals.paymentFee > 0) lines.push(`Taxa do cartão: ${money(totals.paymentFee)}`);
    lines.push(`*Total: ${money(totals.total)}*`, `Pagamento: ${paymentMethod}`);

    if (paymentMethod === 'Dinheiro' && Number(changeAmount) > 0) {
        lines.push(`Troco para: ${money(Number(changeAmount))}`);
    }
    if (notes) lines.push('', `Observações: ${String(notes).trim()}`);
    lines.push('', orderId ? '_Este pedido já foi registrado no site._' : '_O sistema estava indisponível; confirme o recebimento desta mensagem._');
    return lines.join('\n');
}
