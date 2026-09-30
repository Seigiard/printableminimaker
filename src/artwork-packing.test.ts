import assert from 'node:assert/strict';
import { packEntries } from './packing.ts';
import type { PreparedArtwork, Entry } from './types.ts';

let passed = 0;
const t = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
};

const square: PreparedArtwork = { bytes: new Uint8Array(), format: 'png', width: 100, height: 100 };
// Preserve the pre-margin layout contract for prepared artwork.
const opts = { pageSize: 'a4', numberDuplicates: false, marginMm: 0 } as const;
const entry = (count: number, artwork: PreparedArtwork | null = square): Entry => ({
  image: null, artwork, heightSlot: 'medium', count,
});

t('15 prepared medium squares fit one A4 sheet', () => {
  // #given
  const entries = [entry(15)];
  // #when
  const result = packEntries(entries, opts);
  // #then
  assert.deepEqual([result.miniCount, result.pageCount], [15, 1]);
});

t('16 prepared medium squares require two A4 sheets', () => {
  // #given
  const entries = [entry(16)];
  // #when
  const result = packEntries(entries, opts);
  // #then
  assert.deepEqual([result.miniCount, result.pageCount], [16, 2]);
});

t('packEntries omits entries with null artwork', () => {
  // #given
  const e = entry(29);
  // #when
  e.artwork = null;
  const result = packEntries([e], opts);
  // #then
  assert.deepEqual([result.miniCount, result.pageCount], [0, 0]);
});

t('packEntries uses the current artwork height', () => {
  // #given  16 squares need two sheets; taller art prints narrower and fits one
  const e = entry(16);
  // #when
  e.artwork = { ...square, height: 150 };
  const result = packEntries([e], opts);
  // #then
  assert.deepEqual([result.miniCount, result.pageCount], [16, 1]);
});

t('unprepared entries preserve the source indices of packed and oversized entries', () => {
  // #given
  const entries = [entry(1, null), entry(1), { ...entry(1), heightSlot: 'custom' as const, customWidthMm: 200, customHeightMm: 30 }];
  // #when
  const result = packEntries(entries, opts);
  // #then
  assert.deepEqual({ placed: result.pages[0].rows[0].items.map((mini) => mini.entryIndex),
    oversized: result.oversizedEntryIndices }, { placed: [1], oversized: [2] });
});

t('prepared artwork proportions reach fitting through packEntries', () => {
  // #given  tall art at Medium prints 35 mm tall, whatever its proportions
  const e = { ...entry(1), artwork: { ...square, width: 100, height: 350 } };
  // #when
  const mini = packEntries([e], opts).pages[0].rows[0].items[0];
  // #then
  assert.deepEqual([mini.imageHeightMm, mini.imageWidthMm], [35, 10]);
});

t('a custom entry carries both of its dimensions into the fit', () => {
  // #given
  const e: Entry = { ...entry(1), heightSlot: 'custom', customWidthMm: 30, customHeightMm: 45 };
  // #when
  const mini = packEntries([e], opts).pages[0].rows[0].items[0];
  // #then
  assert.deepEqual([mini.imageHeightMm, mini.imageWidthMm, mini.baseWidthMm], [45, 45, 30]);
});

console.log(`\n${passed} passed`);
