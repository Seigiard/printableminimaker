// One-off test (no framework in this project). Run with: node src/sizes.test.ts
import assert from 'node:assert/strict';
import {
  fitFigure, MAX_WIDTH_RATIO, SIZE_DIMENSIONS_MM, sizeLabel,
  resolveBaseWidthMm, resolveFigureHeightMm,
} from './sizes.ts';

let passed = 0;
const t = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
};

t('preset dimensions match the six tuned pairs in ADR-0002', () => {
  // #given
  const sizes = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const;
  // #when
  const dimensions = sizes.map((size) => [resolveBaseWidthMm({ size }), resolveFigureHeightMm({ size })]);
  // #then
  assert.deepEqual(dimensions, [[20, 24], [25, 25], [25, 30], [37, 44], [50, 60], [75, 90]]);
});

t('a size label quotes both of the numbers it will print at', () => {
  // #given
  const sizes = ['medium', 'large', 'custom'] as const;
  // #when
  const labels = sizes.map(sizeLabel);
  // #then
  assert.deepEqual(labels, [
    'Medium (25 mm base / 30 mm tall)', 'Large (37 mm base / 44 mm tall)', 'Custom…',
  ]);
});

t('custom dimensions come from the entry rather than the table', () => {
  // #given
  const entry = { size: 'custom' as const, customWidthMm: 32, customHeightMm: 47 };
  // #when
  const dimensions = [resolveBaseWidthMm(entry), resolveFigureHeightMm(entry)];
  // #then
  assert.deepEqual(dimensions, [32, 47]);
});

for (const value of [undefined, 0, -1, NaN, Infinity]) {
  t(`invalid custom dimensions (${value}) are not packable`, () => {
    // #given
    const entry = { size: 'custom' as const, customWidthMm: value, customHeightMm: value };
    // #when
    const dimensions = [resolveBaseWidthMm(entry), resolveFigureHeightMm(entry)];
    // #then
    assert.deepEqual(dimensions, [0, 0]);
  });
}

// The three Medium figures from ADR-0002: a vine, a warrior with the axe held
// out sideways, an elemental spreading flame. On the table they are all Medium.
t('one size category prints one height whatever the artwork proportions', () => {
  // #given
  const proportions = [[100, 240], [100, 200], [100, 100]];
  // #when
  const heights = proportions.map(([w, h]) => fitFigure(SIZE_DIMENSIONS_MM.medium, w, h).imageHeightMm);
  // #then
  assert.deepEqual(heights, [30, 30, 30]);
});

t('figure width follows the artwork proportions', () => {
  // #given
  const proportions = [[100, 240], [100, 100], [150, 100]];
  // #when
  const widths = proportions.map(([w, h]) => fitFigure(SIZE_DIMENSIONS_MM.medium, w, h).imageWidthMm);
  // #then
  assert.deepEqual(widths, [12.5, 30, 45]);
});

t('a figure past the width cap is scaled down whole with its aspect intact', () => {
  // #given  a Medium base of 25 mm caps the figure at 50 mm wide
  const uncapped = SIZE_DIMENSIONS_MM.medium.figureHeightMm * 4;
  // #when
  const { imageWidthMm, imageHeightMm } = fitFigure(SIZE_DIMENSIONS_MM.medium, 400, 100);
  // #then
  assert.deepEqual([uncapped > imageWidthMm, imageWidthMm, imageHeightMm, imageWidthMm / imageHeightMm],
    [true, SIZE_DIMENSIONS_MM.medium.baseWidthMm * MAX_WIDTH_RATIO, 12.5, 4]);
});

t('small prints shorter than medium for identical artwork', () => {
  // #given
  const sizes = ['small', 'medium'] as const;
  // #when
  const heights = sizes.map((size) => fitFigure(SIZE_DIMENSIONS_MM[size], 100, 300).imageHeightMm);
  // #then
  assert.deepEqual([heights, heights[0] < heights[1]], [[25, 30], true]);
});

t('a custom size honours both of its numbers', () => {
  // #given
  const e = { size: 'custom' as const, customWidthMm: 20, customHeightMm: 45 };
  const dimensions = { baseWidthMm: resolveBaseWidthMm(e), figureHeightMm: resolveFigureHeightMm(e) };
  // #when
  const fit = fitFigure(dimensions, 100, 300);
  // #then
  assert.deepEqual([fit.imageWidthMm, fit.imageHeightMm], [15, 45]);
});

console.log(`\n${passed} passed`);
