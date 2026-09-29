// One-off test (no framework in this project). Run with: node src/packing.test.ts
import assert from 'node:assert/strict';
import { packMinis, GAP_MM, MARGIN_MM, PAGE_SIZES_MM, TAB_HEIGHT_MM } from './packing.ts';
import type { PackingEntry as Entry } from './types.ts';

let passed = 0;
const t = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
};

// Helper: build an entry with square art at a given size/count.
const entry = (over: Partial<Entry>): Entry => ({
  size: 'medium',
  count: 1,
  naturalWidth: 100,
  naturalHeight: 100,
  ...over,
});

const A4 = PAGE_SIZES_MM.a4;
const usableW = A4.w - MARGIN_MM * 2; // 190
const usableH = A4.h - MARGIN_MM * 2; // 277

t('default margin reserves paper around both faces without shrinking the figure', () => {
  // #given
  const entries = [entry({})];
  // #when
  const result = packMinis(entries, { pageSize: 'a4', numberDuplicates: false });
  const mini = result.pages[0].rows[0].items[0];
  // #then
  assert.deepEqual(
    [mini.baseWidthMm, mini.imageWidthMm, mini.imageHeightMm,
      mini.totalWidthMm, mini.totalHeightMm, mini.imageOffsetXMm, mini.marginMm],
    [25, 30, 30, 34, 84, 2, 2],
  );
});

// --- counting & expansion ---

t('empty input yields zero pages and zero minis', () => {
  const r = packMinis([], { pageSize: 'a4', numberDuplicates: false });
  assert.equal(r.pageCount, 0);
  assert.equal(r.miniCount, 0);
  assert.equal(r.pages.length, 0);
});

t('count expands into that many placed minis', () => {
  const r = packMinis([entry({ count: 5 })], { pageSize: 'a4', numberDuplicates: false });
  assert.equal(r.miniCount, 5);
});

t('entries without natural dimensions are not packed', () => {
  const r = packMinis(
    [entry({ naturalWidth: undefined, naturalHeight: undefined })],
    { pageSize: 'a4', numberDuplicates: false },
  );
  assert.equal(r.miniCount, 0);
  assert.equal(r.pageCount, 0);
});

t('custom entry without a valid width is not packed', () => {
  const r = packMinis(
    [entry({ size: 'custom', customWidthMm: undefined })],
    { pageSize: 'a4', numberDuplicates: false },
  );
  assert.equal(r.miniCount, 0);
});

// --- row grouping respects usable width/height ---

t('medium squares pack 6 per row, 3 rows per A4 page', () => {
  // medium = 30mm figure on a 25mm base, square art => image 30x30, reserved
  // width 30, totalHeight = 30*2 + 8*2 = 76mm.
  // width: 6*30 + 5*2 = 190 <= 190; 7 would be 222 > 190.
  // height: first row 76, each more +78; 3 rows = 76+78*2 = 232 <= 277; 4th = 310 > 277.
  const r = packMinis([entry({ count: 18 })], { pageSize: 'a4', numberDuplicates: false, marginMm: 0 });
  assert.equal(r.pageCount, 1);
  assert.equal(r.pages[0].rows.length, 3);
  for (const row of r.pages[0].rows) {
    assert.equal(row.items.length, 6);
    assert.ok(row.widthMm <= usableW, `row width ${row.widthMm} <= ${usableW}`);
  }
});

t('no row exceeds usable width and no page exceeds usable height', () => {
  const r = packMinis([entry({ count: 100 })], { pageSize: 'a4', numberDuplicates: false });
  for (const page of r.pages) {
    let totalH = 0;
    page.rows.forEach((row, i) => {
      assert.ok(row.widthMm <= usableW + 1e-9, `row width ${row.widthMm}`);
      totalH += row.heightMm + (i > 0 ? GAP_MM : 0);
    });
    assert.ok(totalH <= usableH + 1e-9, `page height ${totalH} <= ${usableH}`);
  }
});

t('19 medium squares spill onto a second page', () => {
  const r = packMinis([entry({ count: 19 })], { pageSize: 'a4', numberDuplicates: false, marginMm: 0 });
  assert.equal(r.pageCount, 2);
});

// --- oversized reporting ---

t('mini wider than the page is reported as skipped, not silently dropped', () => {
  const r = packMinis(
    // 200 mm base, 204 mm including margins > 190 usable width
    [entry({ size: 'custom', customWidthMm: 200, customHeightMm: 30 })],
    { pageSize: 'a4', numberDuplicates: false },
  );
  assert.equal(r.miniCount, 0);
  assert.equal(r.pageCount, 0);
  assert.equal(r.skipped.length, 1);
  assert.equal(r.skipped[0].entryIndex, 0);
  assert.deepEqual(r.oversizedEntryIndices, [0]);
});

t('mini taller than the page is reported as skipped', () => {
  // custom 140mm base and 140mm figure: image 140x140, totalHeight = 140*2 + 2*4 + 16 = 304 > 277.
  const r = packMinis(
    [entry({ size: 'custom', customWidthMm: 140, customHeightMm: 140 })],
    { pageSize: 'a4', numberDuplicates: false },
  );
  assert.equal(r.miniCount, 0);
  assert.equal(r.skipped.length, 1);
  assert.ok(r.skipped[0].totalHeightMm > usableH);
});

t('oversized entry is skipped while a fitting entry in the same batch is placed', () => {
  const r = packMinis(
    [entry({ count: 2 }), entry({ size: 'custom', customWidthMm: 300, customHeightMm: 30 }), entry({ count: 3 })],
    { pageSize: 'a4', numberDuplicates: false },
  );
  assert.equal(r.miniCount, 5); // 2 + 3 placed
  assert.deepEqual(r.oversizedEntryIndices, [1]);
});

// --- sort by base width descending ---

t('minis are placed sorted by base width descending', () => {
  const r = packMinis(
    [entry({ size: 'small' }), entry({ size: 'huge' }), entry({ size: 'large' })],
    { pageSize: 'a4', numberDuplicates: false },
  );
  const widths = r.pages[0].rows.flatMap((row) => row.items.map((m) => m.baseWidthMm));
  const sorted = [...widths].sort((a, b) => b - a);
  assert.deepEqual(widths, sorted);
  assert.equal(widths[0], 50); // huge first
});

// --- gap/margin math at boundaries ---

t('a row exactly filling usable width packs as one row', () => {
  // Widths that exactly hit the boundary: a 62mm base under a 62mm figure,
  // 3 of them: 3*62 + 2*2 = 190.
  const r = packMinis(
    [entry({ size: 'custom', customWidthMm: 62, customHeightMm: 62, count: 3 })],
    { pageSize: 'a4', numberDuplicates: false, marginMm: 0 },
  );
  assert.equal(r.pages[0].rows[0].items.length, 3);
  assert.ok(Math.abs(r.pages[0].rows[0].widthMm - 190) < 1e-9);
});

t('one mm over the boundary wraps to a second row on the same page', () => {
  // custom 62.5mm: 3*62.5 + 2*2 = 191.5 > 190 => third wraps. Use landscape art
  // under a short figure, so the 60mm image stays inside the base and the
  // wrapped row still fits on the first page.
  const r = packMinis(
    [entry({ size: 'custom', customWidthMm: 62.5, customHeightMm: 20, count: 3, naturalWidth: 300, naturalHeight: 100 })],
    { pageSize: 'a4', numberDuplicates: false, marginMm: 0 },
  );
  assert.equal(r.pageCount, 1);
  assert.equal(r.pages[0].rows[0].items.length, 2);
  assert.equal(r.pages[0].rows[1].items.length, 1);
});

// --- labels ---

t('numberDuplicates labels copies 1..N per entry', () => {
  const r = packMinis([entry({ count: 3 })], { pageSize: 'a4', numberDuplicates: true });
  const labels = r.pages[0].rows.flatMap((row) => row.items.map((m) => m.label));
  assert.deepEqual([...labels].sort(), ['1', '2', '3']);
});

t('no labels when numberDuplicates is off', () => {
  const r = packMinis([entry({ count: 3 })], { pageSize: 'a4', numberDuplicates: false });
  const anyLabel = r.pages[0].rows.some((row) => row.items.some((m) => m.label != null));
  assert.equal(anyLabel, false);
});

t('totalHeight matches the front+back image plus two tabs', () => {
  const r = packMinis([entry({ size: 'medium' })], { pageSize: 'a4', numberDuplicates: false, marginMm: 0 });
  const m = r.pages[0].rows[0].items[0];
  assert.equal(m.totalHeightMm, m.imageHeightMm * 2 + TAB_HEIGHT_MM * 2);
});

t('2 mm margins fit 15 medium squares per A4 sheet with 2 mm gaps', () => {
  // #given
  const entries = [entry({ count: 16 })];
  // #when
  const result = packMinis(entries, { pageSize: 'a4', numberDuplicates: false, marginMm: 2 });
  // #then
  assert.deepEqual(result.pages.map((page) => ({
    height: page.heightMm,
    rows: page.rows.map((row) => [row.items.length, row.widthMm, row.heightMm]),
  })), [
    { height: 256, rows: [[5, 178, 84], [5, 178, 84], [5, 178, 84]] },
    { height: 84, rows: [[1, 34, 84]] },
  ]);
});

t('margin alone can make a mini too wide or too tall for A4', () => {
  // #given
  const entries = [
    // 187 + two margins = 191 > 190 wide; 128*2 + two margins = 280 > 277 tall
    entry({ size: 'custom', customWidthMm: 187, customHeightMm: 18, naturalWidth: 1000 }),
    entry({ size: 'custom', customWidthMm: 128, customHeightMm: 128 }),
  ];
  // #when
  const result = packMinis(entries, { pageSize: 'a4', numberDuplicates: false, marginMm: 2 });
  // #then
  assert.deepEqual([result.pageCount, result.miniCount, result.oversizedEntryIndices], [0, 0, [0, 1]]);
});

t('fractional margins keep a 2 mm gap at the row boundary and cause page overflow', () => {
  // #given
  const entries = [entry({ size: 'custom', customWidthMm: 59, customHeightMm: 59, count: 7 })];
  // #when
  const result = packMinis(entries, { pageSize: 'a4', numberDuplicates: false, marginMm: 1.5 });
  // #then
  assert.deepEqual(result.pages.map((page) => ({
    height: page.heightMm,
    rows: page.rows.map((row) => [row.items.length, row.widthMm, row.heightMm]),
  })), [
    { height: 140, rows: [[3, 190, 140]] },
    { height: 140, rows: [[3, 190, 140]] },
    { height: 140, rows: [[1, 62, 140]] },
  ]);
});

t('shared tall artwork keeps each size centred within the same margin', () => {
  // #given
  const artwork = { naturalWidth: 100, naturalHeight: 200 };
  const entries = [entry({ ...artwork, size: 'tiny' }), entry({ ...artwork, size: 'large' })];
  // #when
  const result = packMinis(entries, { pageSize: 'a4', numberDuplicates: false, marginMm: 3 });
  // #then
  assert.deepEqual(result.pages.flatMap((page) => page.rows.flatMap((row) => row.items.map((mini) => [
    mini.baseWidthMm, mini.imageWidthMm, mini.imageHeightMm,
    mini.totalWidthMm, mini.totalHeightMm, mini.imageOffsetXMm, mini.marginMm,
  ]))), [
    [37, 22, 44, 43, 116, 10.5, 3],
    [20, 12, 24, 26, 76, 7, 3],
  ]);
});

t('a numbered mini at zero margin centres its tab and base under the figure', () => {
  // #given  square art at Medium prints 30 mm tall, overhanging its 25 mm base
  const entries = [entry({})];
  // #when
  const result = packMinis(entries, { pageSize: 'a4', numberDuplicates: true, marginMm: 0 });
  // #then
  assert.deepEqual(result.pages, [{ heightMm: 76, rows: [{
    widthMm: 30, heightMm: 76, items: [{
      entryIndex: 0, copyIndex: 0, size: 'medium', baseWidthMm: 25,
      imageWidthMm: 30, imageHeightMm: 30, imageOffsetXMm: 0,
      totalWidthMm: 30, tabWidthMm: 25, tabOffsetXMm: 2.5, baseOffsetXMm: 2.5,
      totalHeightMm: 76, marginMm: 0, label: '1',
    }],
  }] }]);
});

const sheetOpts = { pageSize: 'a4', numberDuplicates: false } as const;

t('a mini reserves the greater of figure width and base width, plus margins', () => {
  // #given  wide art overhangs a Medium base; tall art stays well inside it
  const entries = [
    entry({ naturalWidth: 150, naturalHeight: 100 }),
    entry({ naturalWidth: 100, naturalHeight: 300 }),
  ];
  // #when
  const result = packMinis(entries, { ...sheetOpts, marginMm: 2 });
  // #then
  assert.deepEqual(result.pages[0].rows[0].items.map((mini) => [
    mini.baseWidthMm, mini.imageWidthMm, mini.imageHeightMm, mini.totalWidthMm, mini.imageOffsetXMm,
  ]), [
    [25, 45, 30, 49, 2],
    [25, 10, 30, 29, 9.5],
  ]);
});

t('overhanging figures never overlap their neighbours', () => {
  // #given  four wide Medium figures, each overhanging its base
  const entries = [entry({ naturalWidth: 150, naturalHeight: 100, count: 4 })];
  // #when
  const result = packMinis(entries, { ...sheetOpts, marginMm: 2 });
  // #then  walk each row the way the PDF drawer does
  const rows = result.pages.flatMap((page) => page.rows).map((row) => {
    let xMm = 0;
    return row.items.map((mini) => {
      const left = xMm + mini.imageOffsetXMm;
      xMm += mini.totalWidthMm + GAP_MM;
      return [left, left + mini.imageWidthMm];
    });
  });
  assert.deepEqual({
    figures: rows.flat().length,
    overhanging: rows.flat().every(([left, right]) => right - left === 45),
    overlapping: rows.some((figures) =>
      figures.some(([, right], i) => i + 1 < figures.length && right > figures[i + 1][0])),
  }, { figures: 4, overhanging: true, overlapping: false });
});

t('a custom entry without a figure height is not packable', () => {
  // #given  a base width alone does not say how tall the figure prints
  const entries = [entry({ size: 'custom', customWidthMm: 30 })];
  // #when
  const result = packMinis(entries, sheetOpts);
  // #then
  assert.deepEqual([result.miniCount, result.pageCount], [0, 0]);
});

t('a tab keeps its base width while the figure overhangs it', () => {
  // #given  wide art overhangs a Medium base, narrow art stays inside it
  const entries = [
    entry({ naturalWidth: 150, naturalHeight: 100 }),
    entry({ naturalWidth: 100, naturalHeight: 300 }),
  ];
  // #when
  const result = packMinis(entries, { ...sheetOpts, marginMm: 2 });
  // #then  both tabs are the category's base width, whatever the figure does
  assert.deepEqual(result.pages[0].rows[0].items.map((mini) => [
    mini.tabWidthMm, mini.baseWidthMm, mini.imageWidthMm, mini.totalWidthMm,
  ]), [
    [25, 25, 45, 49],
    [25, 25, 10, 29],
  ]);
});

t('minis are placed sorted by reserved width descending', () => {
  // #given  a narrow Large figure reserves less paper than a wide Medium one
  const entries = [
    entry({ size: 'medium', naturalWidth: 150, naturalHeight: 100 }),
    entry({ size: 'large', naturalWidth: 100, naturalHeight: 300 }),
  ];
  // #when
  const result = packMinis(entries, { ...sheetOpts, marginMm: 2 });
  // #then
  const widths = result.pages[0].rows.flatMap((row) => row.items.map((mini) => mini.totalWidthMm));
  assert.deepEqual(widths, [...widths].sort((a, b) => b - a));
});

console.log(`\n${passed} passed`);
