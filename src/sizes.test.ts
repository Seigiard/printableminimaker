// One-off test (no framework in this project). Run with: node src/sizes.test.ts
import assert from 'node:assert/strict';
import {
  CATEGORY_BASE_WIDTH_MM, HEIGHT_SLOTS, HEIGHT_SLOT_ORDER,
  categoryLabel, fitFigure, resolveBaseWidthMm, resolveFigureHeightMm, slotLabel,
  slotsOfCategory,
} from './sizes.ts';

let passed = 0;
const t = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
};

t('nine slots grade height across the range, each on its category’s base', () => {
  // #given
  const slots = HEIGHT_SLOT_ORDER;
  // #when
  const table = slots.map((slot) => [slot, resolveBaseWidthMm({ heightSlot: slot }), resolveFigureHeightMm({ heightSlot: slot })]);
  // #then
  assert.deepEqual(table, [
    ['tiny', 20, 11],
    ['small', 25, 17],
    ['medium-short', 25, 23],
    ['medium', 25, 30],
    ['medium-tall', 25, 37],
    ['large', 37, 48],
    ['large-tall', 37, 69],
    ['huge', 50, 95],
    ['gargantuan', 75, 111],
  ]);
});

t('a slot’s base width comes from its category, so slots sharing one cannot disagree', () => {
  // #given  three Medium slots and two Large ones
  const medium = slotsOfCategory('medium');
  const large = slotsOfCategory('large');
  // #when
  const bases = [...medium, ...large].map((slot) => resolveBaseWidthMm({ heightSlot: slot }));
  // #then
  assert.deepEqual([medium, large, bases], [
    ['medium-short', 'medium', 'medium-tall'],
    ['large', 'large-tall'],
    [CATEGORY_BASE_WIDTH_MM.medium, CATEGORY_BASE_WIDTH_MM.medium, CATEGORY_BASE_WIDTH_MM.medium,
      CATEGORY_BASE_WIDTH_MM.large, CATEGORY_BASE_WIDTH_MM.large],
  ]);
});

t('every adjacent pair of slots prints a taller figure than the one below it', () => {
  // #given  identical artwork, so only the slot decides the height
  const heights = HEIGHT_SLOT_ORDER.map((slot) =>
    fitFigure({ baseWidthMm: resolveBaseWidthMm({ heightSlot: slot }), figureHeightMm: HEIGHT_SLOTS[slot].figureHeightMm }, 100, 300).imageHeightMm);
  // #when
  const rising = heights.every((height, i) => i === 0 || heights[i - 1] < height);
  // #then  ordering holds between neighbours, not merely between categories
  assert.deepEqual([rising, heights], [true, [11, 17, 23, 30, 37, 48, 69, 95, 111]]);
});

t('Medium is unchanged from the six-row table, so an existing row prints as before', () => {
  // #given
  const entry = { heightSlot: 'medium' as const };
  // #when
  const dimensions = [resolveBaseWidthMm(entry), resolveFigureHeightMm(entry)];
  // #then
  assert.deepEqual(dimensions, [25, 30]);
});

t('a dwarf and a bugbear, both Medium, print at visibly different heights', () => {
  // #given  the same artwork in the short and tall Medium slots
  const slots = ['medium-short', 'medium-tall'] as const;
  // #when
  const heights = slots.map((heightSlot) => resolveFigureHeightMm({ heightSlot }));
  // #then  a 60% gap reads instantly on the table
  assert.deepEqual([heights, heights[1] / heights[0] > 1.5], [[23, 37], true]);
});

t('a halfling prints shorter than a dwarf, and a dwarf shorter than a human', () => {
  // #given
  const slots = ['small', 'medium-short', 'medium'] as const;
  // #when
  const heights = slots.map((heightSlot) => resolveFigureHeightMm({ heightSlot }));
  // #then
  assert.deepEqual([heights, heights[0] < heights[1] && heights[1] < heights[2]], [[17, 23, 30], true]);
});

t('a slot option names the height it stands for; its group names the base', () => {
  // #when
  const options = (['medium-short', 'medium', 'gargantuan', 'custom'] as const).map(slotLabel);
  const groups = (['medium', 'large'] as const).map(categoryLabel);
  // #then
  assert.deepEqual([options, groups], [
    [
      '4\'3" · 23 mm tall — dwarf',
      '5\'8" · 30 mm tall — human, elf, orc',
      '32\'+ · 111 mm tall — ancient dragon, kraken',
      'Custom…',
    ],
    ['Medium · 25 mm base', 'Large · 37 mm base'],
  ]);
});

t('custom dimensions come from the entry rather than the table', () => {
  // #given
  const entry = { heightSlot: 'custom' as const, customWidthMm: 32, customHeightMm: 47 };
  // #when
  const dimensions = [resolveBaseWidthMm(entry), resolveFigureHeightMm(entry)];
  // #then
  assert.deepEqual(dimensions, [32, 47]);
});

for (const value of [undefined, 0, -1, NaN, Infinity]) {
  t(`invalid custom dimensions (${value}) are not packable`, () => {
    // #given
    const entry = { heightSlot: 'custom' as const, customWidthMm: value, customHeightMm: value };
    // #when
    const dimensions = [resolveBaseWidthMm(entry), resolveFigureHeightMm(entry)];
    // #then
    assert.deepEqual(dimensions, [0, 0]);
  });
}

// The three Medium figures from ADR-0002: a vine, a warrior with the axe held
// out sideways, an elemental spreading flame. All three sit in one slot.
t('one height slot prints one height whatever the artwork proportions', () => {
  // #given
  const proportions = [[100, 240], [100, 200], [100, 100]];
  const medium = { baseWidthMm: 25, figureHeightMm: 30 };
  // #when
  const heights = proportions.map(([w, h]) => fitFigure(medium, w, h).imageHeightMm);
  // #then
  assert.deepEqual(heights, [30, 30, 30]);
});

t('figure width follows the artwork proportions', () => {
  // #given
  const proportions = [[100, 240], [100, 100], [150, 100]];
  const medium = { baseWidthMm: 25, figureHeightMm: 30 };
  // #when
  const widths = proportions.map(([w, h]) => fitFigure(medium, w, h).imageWidthMm);
  // #then
  assert.deepEqual(widths, [12.5, 30, 45]);
});

t('a figure past the width cap is scaled down whole with its aspect intact', () => {
  // #given  a 30 mm Medium figure is capped at 45 mm wide
  const medium = { baseWidthMm: 25, figureHeightMm: 30 };
  const uncapped = medium.figureHeightMm * 4;
  // #when
  const { imageWidthMm, imageHeightMm } = fitFigure(medium, 400, 100);
  // #then
  assert.deepEqual([uncapped > imageWidthMm, imageWidthMm, imageHeightMm, imageWidthMm / imageHeightMm],
    [true, 45, 11.25, 4]);
});

// The acceptance criterion this whole ticket rests on, asserted on what prints
// rather than on the table: a capped figure used to lose its slot entirely,
// because the cap was a multiple of the base width and every slot of a category
// shares one base.
t('slots of one category stay apart when the artwork is wide enough to cap', () => {
  // #given  a dwarf and a bugbear, both Medium, on artwork three times as wide as it is tall
  const dwarf = { baseWidthMm: 25, figureHeightMm: 23 };
  const bugbear = { baseWidthMm: 25, figureHeightMm: 37 };
  // #when
  const heights = [dwarf, bugbear].map((slot) => fitFigure(slot, 300, 100).imageHeightMm);
  // #then  both are scaled down, and the bugbear still prints the taller
  assert.deepEqual([heights, heights[0] < heights[1], heights[1] / heights[0]],
    [[11.5, 18.5], true, bugbear.figureHeightMm / dwarf.figureHeightMm]);
});

t('the tallest slot’s widest figure still fits the page', () => {
  // #given  the reserved column is the figure plus a margin each side
  const gargantuan = { baseWidthMm: 75, figureHeightMm: HEIGHT_SLOTS.gargantuan.figureHeightMm };
  // #when  artwork far too wide to print uncapped
  const { imageWidthMm } = fitFigure(gargantuan, 1000, 100);
  // #then  A4 leaves 190 mm of usable width
  assert.deepEqual([imageWidthMm, imageWidthMm + 2 * 2 <= 190], [166.5, true]);
});

t('a custom size honours both of its numbers', () => {
  // #given
  const e = { heightSlot: 'custom' as const, customWidthMm: 20, customHeightMm: 45 };
  const dimensions = { baseWidthMm: resolveBaseWidthMm(e), figureHeightMm: resolveFigureHeightMm(e) };
  // #when
  const fit = fitFigure(dimensions, 100, 300);
  // #then
  assert.deepEqual([fit.imageWidthMm, fit.imageHeightMm], [15, 45]);
});

console.log(`\n${passed} passed`);
