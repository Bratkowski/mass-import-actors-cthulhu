import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseActors, parseBlock, splitBlocks } from '../scripts/parser.js';

test('PL i EN trafiają do pól CoC7, a jawne zasoby wyłączają auto', () => {
  const [pl, en] = parseActors('Jan\nSIŁ 50 KON 60 BC 55 ZR 60 WYG 65 INT 70 MOC 60 WYK 75\nPW 11 PM 12 POC 60 RUCH 8\n---\nAlex\nSTR 65 CON 60 SIZ 60 DEX 50 APP 50 INT 60 POW 50 EDU 60');
  assert.deepEqual(pl.errors, []);
  assert.deepEqual(en.errors, []);
  assert.equal(pl.actor.system.characteristics.str.value, 50);
  assert.deepEqual(pl.actor.system.attribs.hp, { value: 11, max: 11, auto: false });
  assert.equal(en.actor.system.characteristics.str.value, 65);
});

test('wielu aktorów bez separatora nie łączy się po cichu', () => {
  const result = parseBlock('Jan\nSTR 50 CON 60 SIZ 55\nAlex\nSTR 80 CON 65 SIZ 60');
  assert.ok(result.errors.some(e => e.includes('Powtórzona')));
});

test('polskie skróty z importera systemowego S i P są obsługiwane', () => {
  const result = parseBlock('Jan\nS 75 KON 60 BC 80 ZR 70 WYG 60 INT 80 MOC 50 WYK 85 P 55\nSzczęście 40');
  assert.deepEqual(result.errors, []);
  assert.equal(result.actor.system.characteristics.str.value, 75);
  assert.equal(result.actor.system.attribs.san.value, 55);
  assert.equal(result.actor.system.attribs.lck.value, 40);
});

test('zwykły tekst i blok bez nazwy są blokowane', () => {
  assert.ok(parseBlock('To jest opis, bez statystyk.').errors.length);
  assert.ok(parseBlock('STR 50 CON 60 SIZ 55').errors.length);
  assert.throws(() => parseActors(''), /Wklej tekst/);
});

test('notatki nie wykonują HTML z PDF i zachowują nierozpoznane dane', () => {
  const result = parseBlock('Jan\nSTR 50 CON 60 SIZ 55\n<script>alert(1)</script>\nBroń: nóż');
  assert.ok(result.actor.system.description.keeper.includes('&lt;script&gt;'));
  assert.ok(result.actor.system.description.keeper.includes('Broń: nóż'));
  assert.equal(result.actor.system.description.keeper.includes('<script>'), false);
});

test('puste linie i granice stron nie rozdzielają postaci', () => {
  assert.equal(splitBlocks('Jan\nSTR 50\n\nCON 50\n\n\nSIZ 50').length, 1);
  assert.equal(parseBlock('Stworzenie\nSTR 80 CON 80 SIZ 90', 'creature').actor.type, 'creature');
});
