import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDeliveryProximity } from '../functions/delivery-proximity.mjs';
const now = 100000;
const destination = { latitude: 0, longitude: 0 };
const point = { ...destination, courierId: 'courier', sampledAt: now, updatedAt: now, accuracy: 10 };
test('aceita próximo e rejeita além de 100m', () => {
  assert.equal(validateDeliveryProximity(destination, { ...point, latitude: 0.00089 }, 'courier', now).ok, true);
  assert.equal(validateDeliveryProximity(destination, { ...point, latitude: 0.00091 }, 'courier', now).ok, false);
});
test('rejeita GPS antigo, impreciso, de outra conta ou destino ausente', () => {
  for (const p of [{ ...point, sampledAt: 1 }, { ...point, accuracy: 51 }, { ...point, courierId: 'other' }, { ...point, sampledAt: now + 20000 }, { ...point, latitude: 91 }]) assert.equal(validateDeliveryProximity(destination, p, 'courier', now).ok, false);
  assert.equal(validateDeliveryProximity(null, point, 'courier', now).ok, false);
});
