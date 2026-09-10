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

test('assets locais referenciados pelo HTML existem', async () => {
    const references = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)]
        .map((match) => match[1])
        .filter((reference) => !/^(?:https?:|mailto:|tel:)/.test(reference));
    await Promise.all(references.map((reference) => access(new URL(`../${reference}`, import.meta.url))));
});
