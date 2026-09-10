import test from 'node:test';
import assert from 'node:assert/strict';
import { intersects } from '../js/game.mjs';

test('detecta colisão no jogo com margem de segurança', () => {
    const player = { x: 10, y: 10, width: 40, height: 40 };
    assert.equal(intersects(player, { x: 35, y: 20, width: 20, height: 20 }), true);
    assert.equal(intersects(player, { x: 55, y: 20, width: 20, height: 20 }), false);
    assert.equal(intersects(player, { x: 47, y: 20, width: 20, height: 20 }, 5), false);
});
