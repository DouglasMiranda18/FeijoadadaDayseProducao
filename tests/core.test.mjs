import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addCartItem,
    buildWhatsAppMessage,
    cartSubtotal,
    changeCartQuantity,
    deliveryFeeFromDistance,
    deliveryFeeFromNeighborhood,
    formatCep,
    formatPhone,
    getStoreStatus,
    normalizeProduct,
    paymentFee,
    reconcileCart,
    sortProducts
} from '../js/core.mjs';

test('normaliza um produto legado sem exigir os campos novos', () => {
    assert.deepEqual(normalizeProduct('p1', {
        name: ' Feijoada individual ',
        category: 'Comidas',
        price: '30',
        availability: true
    }), {
        id: 'p1',
        name: 'Feijoada individual',
        category: 'comidas',
        price: 30,
        description: '',
        image: '',
        availability: true,
        badge: ''
    });
    assert.equal(normalizeProduct('bad', { name: 'Sem preço', category: 'comidas' }), null);
});

test('ordena produtos disponíveis e prioriza feijoada sem alterar a lista original', () => {
    const products = [
        { id: 'b', name: 'Água', category: 'bebidas', availability: true },
        { id: 'c', name: 'Dobradinha', category: 'comidas', availability: true },
        { id: 'a', name: 'Feijoada', category: 'comidas', availability: true },
        { id: 'd', name: 'Bife', category: 'comidas', availability: false }
    ];
    assert.deepEqual(sortProducts(products).map((product) => product.id), ['a', 'c', 'b', 'd']);
    assert.equal(products[0].id, 'b');
});

test('calcula subtotal, taxas de cartão e entrega', () => {
    assert.equal(cartSubtotal([{ price: 30, quantity: 2 }, { price: 5.5, quantity: 1 }]), 65.5);
    assert.equal(paymentFee('Cartão de Crédito'), 2);
    assert.equal(paymentFee('Pix'), 0);
    assert.equal(deliveryFeeFromDistance(0.8), 0);
    assert.equal(deliveryFeeFromDistance(2), 5);
    assert.equal(deliveryFeeFromDistance(4), 6);
    assert.equal(deliveryFeeFromNeighborhood('Piedade'), 5);
    assert.equal(deliveryFeeFromNeighborhood('Candeias'), 6);
    assert.equal(deliveryFeeFromNeighborhood('bairro desconhecido'), null);
});

test('adiciona, limita, altera e remove itens da sacola sem mutar a entrada', () => {
    const original = [{ id: '1', name: 'Feijoada', price: 30, quantity: 1 }];
    const increased = addCartItem(original, original[0], 2);
    assert.equal(increased[0].quantity, 3);
    assert.equal(original[0].quantity, 1);
    assert.equal(addCartItem(increased, original[0], 200)[0].quantity, 99);
    assert.equal(changeCartQuantity(increased, '1', -2)[0].quantity, 1);
    assert.deepEqual(changeCartQuantity(increased, '1', -3), []);
});

test('formata CEP e telefones brasileiros durante a digitação', () => {
    assert.equal(formatCep('54410123'), '54.410-123');
    assert.equal(formatPhone('81999999999'), '(81) 99999-9999');
    assert.equal(formatPhone('8133334444'), '(81) 3333-4444');
});

test('status respeita o horário real e a pausa manual', () => {
    const open = getStoreStatus(new Date('2026-09-10T14:00:00Z'), false);
    assert.equal(open.open, true);
    assert.equal(open.label, 'Aberto agora');

    const beforeOpening = getStoreStatus(new Date('2026-09-10T11:00:00Z'), false);
    assert.equal(beforeOpening.open, false);
    assert.match(beforeOpening.detail, /Hoje, às 10h/);

    const manual = getStoreStatus(new Date('2026-09-10T14:00:00Z'), true);
    assert.equal(manual.open, false);
    assert.equal(manual.reason, 'manual');

    const forcedOpen = getStoreStatus(new Date('2026-09-10T03:00:00Z'), 'open');
    assert.equal(forcedOpen.open, true);
    assert.equal(forcedOpen.reason, 'manual-open');

    const forcedClosed = getStoreStatus(new Date('2026-09-10T14:00:00Z'), 'closed');
    assert.equal(forcedClosed.open, false);
    assert.equal(forcedClosed.reason, 'manual');
});

test('reconcilia a sacola com preço e disponibilidade atuais', () => {
    const cart = [{ id: '1', name: 'Antigo', price: 10, quantity: 3 }, { id: 'apagado', quantity: 1 }];
    const products = [{ id: '1', name: 'Atual', price: 12, quantity: 0, availability: false }];
    assert.deepEqual(reconcileCart(cart, products), [{ id: '1', name: 'Atual', price: 12, quantity: 3, availability: false }]);
});

test('mensagem do WhatsApp identifica que é apenas apoio para pedido registrado', () => {
    const message = buildWhatsAppMessage({
        orderId: 'FD-ABC123',
        customer: { name: 'Cliente', phone: '(81) 99999-9999', address: 'Rua A, 10 - Piedade' },
        cart: [{ name: 'Feijoada', price: 30, quantity: 2 }],
        totals: { subtotal: 60, deliveryFee: 5, paymentFee: 0, total: 65 },
        paymentMethod: 'Pix',
        changeAmount: 0,
        notes: ''
    });
    assert.match(message, /2x Feijoada/);
    assert.match(message, /Total: R\$\s?65,00/);
    assert.match(message, /Pedido:\* FD-ABC123/);
    assert.match(message, /já foi registrado no site/);
});
