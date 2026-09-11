import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const html = await readFile(new URL('../Index.html', import.meta.url), 'utf8');

test('documento tem estrutura única e IDs sem duplicação', () => {
    assert.equal((html.match(/<\/html>/gi) || []).length, 1);
    assert.equal((html.match(/<\/body>/gi) || []).length, 1);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    assert.deepEqual(duplicates, []);
});

test('documento não usa handlers inline nem o monólito antigo', () => {
    assert.equal(/\son[a-z]+\s*=/i.test(html), false);
    assert.equal(html.includes('script.js'), false);
    assert.match(html, /type="module" src="js\/app\.mjs(?:\?v=[^"]+)?"/);
});

test('metadados, idioma, viewport e navegação acessível estão presentes', () => {
    assert.match(html, /<html lang="pt-BR">/);
    assert.match(html, /name="description"/);
    assert.match(html, /property="og:title"/);
    assert.match(html, /name="theme-color"/);
    assert.match(html, /class="skip-link"/);
    assert.match(html, /aria-modal="true"/);
});

test('admin pode escolher funcionamento automático, aberto ou fechado', () => {
    assert.match(html, /data-store-mode="auto"[^>]*>Automático/);
    assert.match(html, /data-store-mode="open"[^>]*>Abrir agora/);
    assert.match(html, /data-store-mode="closed"[^>]*>Pausar pedidos/);
});

test('admin tem acesso no cabeçalho e financeiro detalhado', () => {
    assert.match(html, /id="adminHeaderBtn"/);
    assert.match(html, /id="adminCourierPerformance"/);
    assert.match(html, /id="adminDailyPerformance"/);
});

test('acompanhamento carrega mapa interativo', () => {
    assert.match(html, /leaflet@1\.9\.4\/dist\/leaflet\.css/);
    assert.match(html, /leaflet@1\.9\.4\/dist\/leaflet\.js/);
    assert.match(html, /id="orderTrackingDialog"/);
});

test('interface usa o sistema de ícones ilustrados sem pictogramas improvisados', () => {
    assert.match(html, /imagens\/icones-site-atlas\.png/);
    assert.match(html, /imagens\/icones-controles-atlas\.png/);
    assert.match(html, /imagens\/jogo-itens-atlas\.png/);
    assert.equal(/[♨⚙⌂♡♥🛵◷]/u.test(html), false);
    assert.equal(/<svg|\.svg|data:image\/svg/i.test(html), false);
});

test('assets locais referenciados pelo HTML existem', async () => {
    const references = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)]
        .map((match) => match[1])
        .filter((reference) => !/^(?:https?:|mailto:|tel:)/.test(reference));
    await Promise.all(references.map((reference) => access(new URL(`../${reference}`, import.meta.url))));
});
