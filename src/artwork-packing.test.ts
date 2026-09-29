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
  image: null, artwork, size: 'medium', count,
});

t('28 prepared medium squares fit one A4 sheet', () => {
  // #given
  const entries = [entry(28)];
  // #when
  const result = packEntries(entries, opts);
  // #then
  assert.deepEqual([result.miniCount, result.pageCount], [28, 1]);
});

t('29 prepared medium squares require two A4 sheets', () => {
  // #given
  const entries = [entry(29)];
  // #when
  const result = packEntries(entries, opts);
  // #then
  assert.deepEqual([result.miniCount, result.pageCount], [29, 2]);
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
  // #given
  const e = entry(28);
  // #when
  e.artwork = { ...square, height: 150 };
  const result = packEntries([e], opts);
  // #then
  assert.deepEqual([result.miniCount, result.pageCount], [28, 2]);
});

t('unprepared entries preserve the source indices of packed and oversized entries', () => {
  // #given
  const entries = [entry(1, null), entry(1), { ...entry(1), size: 'custom' as const, customWidthMm: 200 }];
  // #when
  const result = packEntries(entries, opts);
  // #then
  assert.deepEqual({ placed: result.pages[0].rows[0].items.map((mini) => mini.entryIndex),
    oversized: result.oversizedEntryIndices }, { placed: [1], oversized: [2] });
});

console.log(`\n${passed} passed`);
