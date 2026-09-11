import test from 'node:test';
import assert from 'node:assert/strict';
import {
    friendlyOrderId,
    financialSummary,
    loyaltyLevel,
    orderBeverages,
    plausibleGameScore,
    publicName,
    rankEntries,
    reorderFromHistory,
    validNextStatuses
} from '../js/account-core.mjs';

test('máquina de estados só oferece a próxima etapa válida ou cancelamento', () => {
    assert.deepEqual(validNextStatuses('received'), ['confirmed', 'cancelled']);
    assert.deepEqual(validNextStatuses('ready'), ['out_for_delivery', 'cancelled']);
    assert.deepEqual(validNextStatuses('out_for_delivery'), ['arrived', 'cancelled']);
    assert.deepEqual(validNextStatuses('arrived'), ['delivered', 'cancelled']);
    assert.deepEqual(validNextStatuses('ready', 'pickup'), ['cancelled']);
    assert.deepEqual(validNextStatuses('delivered'), []);
});

test('financeiro considera somente pedidos entregues e soma valores sem erro de centavos', () => {
    const summary = financialSummary([
        { status: 'delivered', updatedAt: new Date('2026-09-08T12:00:00Z'), paymentMethod: 'Pix', courierId: 'c1', courier: { name: 'João' }, totals: { subtotal: 30.10, total: 35.10, deliveryFee: 5, paymentFee: 0 }, items: [{ productId: 'a', name: 'Feijoada', price: 30.10, quantity: 1 }] },
        { status: 'delivered', updatedAt: new Date('2026-09-08T13:00:00Z'), paymentMethod: 'Dinheiro', courierId: 'c1', courier: { name: 'João' }, totals: { subtotal: 20.20, total: 20.20, deliveryFee: 0, paymentFee: 0 }, items: [{ productId: 'b', name: 'Bebida', price: 10.10, quantity: 2 }] },
        { status: 'cancelled', updatedAt: new Date('2026-09-08T14:00:00Z'), paymentMethod: 'Pix', totals: { total: 999 }, items: [] }
    ]);
    assert.equal(summary.orders, 2);
    assert.equal(summary.revenue, 55.30);
    assert.equal(summary.averageTicket, 27.65);
    assert.equal(summary.productSales, 50.30);
    assert.equal(summary.itemsSold, 3);
    assert.equal(summary.cancelledOrders, 1);
    assert.equal(summary.payments[0].method, 'Pix');
    assert.equal(summary.products[0].quantity, 2);
    assert.deepEqual(summary.couriers.map(({ name, orders }) => ({ name, orders })), [{ name: 'João', orders: 2 }]);
    assert.equal(summary.days[0].orders, 2);
});

test('repetir pedido usa catálogo e preços atuais e separa ausentes', () => {
    const result = reorderFromHistory([
        { productId: 'a', name: 'Antigo', price: 10, quantity: 2 },
        { productId: 'b', name: 'Pausado', quantity: 1 },
        { productId: 'c', name: 'Removido', quantity: 1 }
    ], [
        { id: 'a', name: 'Atual', price: 15, availability: true },
        { id: 'b', name: 'Pausado', price: 8, availability: false }
    ]);
    assert.equal(result.cart[0].price, 15);
    assert.deepEqual(result.unavailable, ['Pausado']);
    assert.deepEqual(result.removed, ['Removido']);
});

test('ranking ordena sem expor identificador como nome', () => {
    const ranked = rankEntries([
        { uid: '2', publicName: 'Bia', score: 300 },
        { uid: '1', publicName: 'Ana', score: 500 }
    ], '2');
    assert.equal(ranked[0].publicName, 'Ana');
    assert.equal(ranked[1].isCurrent, true);
    assert.equal(publicName({ displayName: 'Douglas Miranda de Souza' }), 'Douglas Miranda');
});

test('validação proporcional rejeita pontuação impossível', () => {
    assert.equal(plausibleGameScore({ score: 500, durationMs: 60_000, collections: 20 }), true);
    assert.equal(plausibleGameScore({ score: 999999999, durationMs: 10_000, collections: 1 }), false);
    assert.equal(plausibleGameScore({ score: -1, durationMs: 10_000, collections: 1 }), false);
});

test('fidelidade e identificador amigável têm limites claros', () => {
    assert.equal(loyaltyLevel(0).label, 'Chegando agora');
    assert.equal(loyaltyLevel(10).label, 'Fã da feijoada');
    assert.equal(friendlyOrderId('abc123456789'), 'FD-456789');
});

test('lembrete de saída reconhece bebidas novas e pedidos antigos', () => {
    const drinks = orderBeverages([
        { name: 'Feijoada', category: 'comidas', quantity: 1 },
        { name: 'Coca cola lata', category: 'bebidas', quantity: 2 },
        { name: 'Suco de 300ml', quantity: 1 }
    ]);
    assert.deepEqual(drinks.map((item) => item.name), ['Coca cola lata', 'Suco de 300ml']);
});
