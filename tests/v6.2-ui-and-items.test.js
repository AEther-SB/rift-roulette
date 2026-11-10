import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchGameAsset, normalizeItems, itemIconUrl } from '../src/gameAssets.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Il catalogo oggetti prova la localizzazione italiana e poi quella inglese', async () => {
  const attempted = [];
  const get = async (url) => {
    attempted.push(url);
    if (url.includes('/it_IT/')) return { ok: false, status: 404 };
    return { ok: true, json: async () => ({ data: { '1001': { name: 'Boots', maps: { 11: true }, image: { full: '1001.png' } } } }) };
  };
  const result = await fetchGameAsset('16.22.1', 'item', undefined, get);
  assert.equal(result.locale, 'en_US');
  assert.equal(attempted.length, 2);
  assert.equal(normalizeItems(result.data)[0].id, '1001');
});

test('Il catalogo oggetti non fallisce silenziosamente se entrambe le lingue non rispondono', async () => {
  await assert.rejects(fetchGameAsset('16.22.1', 'item', undefined, async () => ({ok:false,status:503})), /HTTP 503/);
});

test('Le immagini oggetti rispettano il filename ufficiale e rifiutano path non validi', () => {
  assert.match(itemIconUrl('1001', '16.22.1', '1001.png'), /\/1001\.png$/);
  assert.match(itemIconUrl('1001', '16.22.1', '../../test.png'), /\/1001\.png$/);
  assert.equal(itemIconUrl('1001', 'unsafe', '1001.png'), '');
});

test('Non mostra oggetti nascosti o destinati ad altre mappe', () => {
  const sample = {
    data: {
      1001: { name:'Stivali', maps: {11:true}, gold: {purchasable:true}, image:{full:'1001.png'} },
      1002: { name:'Solo Arena', maps:{11:false}, image:{full:'1002.png'} },
      1003: { name:'Nascosto', maps:{11:true}, hideFromAll:true, image:{full:'1003.png'} },
    },
  };
  assert.deepEqual(normalizeItems(sample).map((item)=>item.id), ['1001']);
});

test('L’interfaccia non mostra più gli step o il vecchio titolo', () => {
  const app = read('../src/App.jsx');
  const css = read('../src/styles.css');
  assert.doesNotMatch(app, /panel-step|Una stanza, la vostra Rift\./);
  assert.doesNotMatch(css, /\.panel-step/);
  assert.match(app, /intro-champ-portraits/);
  assert.match(css, /\.compact-app \.editor-panel > \.panel-heading/);
});

test('Il selettore oggetti non taglia i risultati ai primi 160 e segnala errori', () => {
  const modal = read('../src/AdviceModal.jsx');
  assert.doesNotMatch(modal, /slice\(0,\s*160\)/);
  assert.match(modal, /assets\.itemsError/);
  assert.match(modal, /assets\.itemsLoading/);
  assert.match(modal, /filteredItems\.length/);
});
