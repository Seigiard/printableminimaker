// One-off test (no framework in this project). Run with: node src/sizes.test.ts
import assert from 'node:assert/strict';
import {
  fitFigure, fitImageBox, MAX_HEIGHT_RATIO, MAX_WIDTH_RATIO,
  SIZE_DIMENSIONS_MM, SIZE_WIDTH_MM, resolveBaseWidthMm, resolveFigureHeightMm,
} from './sizes.ts';

let passed = 0;
const t = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
};

// A wide (landscape) image fills the full base width; height stays small.
t('landscape image fills base width', () => {
  const { imageWidthMm, imageHeightMm } = fitImageBox(50, 1500, 500); // aspect 1/3
  assert.equal(imageWidthMm, 50);
  assert.ok(Math.abs(imageHeightMm - 50 / 3) < 1e-9);
});

// A near-square image is unaffected (height under the cap).
t('square image fits to width', () => {
  const { imageWidthMm, imageHeightMm } = fitImageBox(25, 1000, 1000);
  assert.equal(imageWidthMm, 25);
  assert.equal(imageHeightMm, 25);
});

// A tall portrait is clamped to the per-size max height and becomes narrower
// than the base (centered later), instead of running away in height.
t('tall portrait is clamped to max height', () => {
  const base = 25;
  const { imageWidthMm, imageHeightMm } = fitImageBox(base, 500, 1500); // aspect 3
  const maxH = base * MAX_HEIGHT_RATIO;
  assert.equal(imageHeightMm, maxH);
  assert.ok(imageWidthMm < base, 'tall image should be narrower than the base');
  // aspect preserved
  assert.ok(Math.abs(imageHeightMm / imageWidthMm - 3) < 1e-9);
});

// The core bug: a Small creature with a tall image must never end up taller
// than a Large creature with the same tall image.
t('large is never shorter than small for identical tall art', () => {
  const small = fitImageBox(SIZE_WIDTH_MM.small, 500, 1500);
  const large = fitImageBox(SIZE_WIDTH_MM.large, 500, 1500);
  assert.ok(
    large.imageHeightMm >= small.imageHeightMm,
    `large (${large.imageHeightMm}) should be >= small (${small.imageHeightMm})`,
  );
});

t('height model selects the tuned base width without changing the default', () => {
  // #given
  const entry = { size: 'large' as const };
  // #when
  const widths = [resolveBaseWidthMm(entry), resolveBaseWidthMm(entry, 'height')];
  // #then
  assert.deepEqual(widths, [50, 37]);
});

t('custom dimensions stay independent in either model', () => {
  // #given
  const entry = { size: 'custom' as const, customWidthMm: 32, customHeightMm: 47 };
  // #when
  const dimensions = [resolveBaseWidthMm(entry), resolveBaseWidthMm(entry, 'height'), resolveFigureHeightMm(entry)];
  // #then
  assert.deepEqual(dimensions, [32, 32, 47]);
});

t('preset dimensions match the six tuned pairs in ADR-0002', () => {
  // #given
  const sizes = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const;
  // #when
  const dimensions = sizes.map((size) => [
    resolveBaseWidthMm({ size }, 'height'), resolveFigureHeightMm({ size }),
  ]);
  // #then
  assert.deepEqual(dimensions, [[20, 24], [25, 25], [25, 30], [37, 44], [50, 60], [75, 90]]);
});

for (const value of [undefined, 0, -1, NaN, Infinity]) {
  t(`invalid custom dimensions (${value}) are not packable`, () => {
    // #given
    const entry = { size: 'custom' as const, customWidthMm: value, customHeightMm: value };
    // #when
    const dimensions = [resolveBaseWidthMm(entry), resolveBaseWidthMm(entry, 'height'), resolveFigureHeightMm(entry)];
    // #then
    assert.deepEqual(dimensions, [0, 0, 0]);
  });
}

// --- height-driven model (#17) ---

// The three Medium figures from ADR-0002: a vine, a warrior with the axe held
// out sideways, an elemental spreading flame. On the table they are all Medium.
t('one size category prints one height whatever the artwork proportions', () => {
  // #given
  const proportions = [[100, 240], [100, 200], [100, 100]];
  // #when
  const heights = proportions.map(([w, h]) => fitFigure(SIZE_DIMENSIONS_MM.medium, w, h, 'height').imageHeightMm);
  // #then
  assert.deepEqual(heights, [30, 30, 30]);
});

t('figure width follows the artwork proportions', () => {
  // #given
  const proportions = [[100, 240], [100, 100], [150, 100]];
  // #when
  const widths = proportions.map(([w, h]) => fitFigure(SIZE_DIMENSIONS_MM.medium, w, h, 'height').imageWidthMm);
  // #then
  assert.deepEqual(widths, [12.5, 30, 45]);
});

t('a figure past the width cap is scaled down whole with its aspect intact', () => {
  // #given  a Medium base of 25 mm caps the figure at 50 mm wide
  const uncapped = SIZE_DIMENSIONS_MM.medium.figureHeightMm * 4;
  // #when
  const { imageWidthMm, imageHeightMm } = fitFigure(SIZE_DIMENSIONS_MM.medium, 400, 100, 'height');
  // #then
  assert.deepEqual([uncapped > imageWidthMm, imageWidthMm, imageHeightMm, imageWidthMm / imageHeightMm],
    [true, SIZE_DIMENSIONS_MM.medium.baseWidthMm * MAX_WIDTH_RATIO, 12.5, 4]);
});

t('small prints shorter than medium for identical artwork', () => {
  // #given
  const sizes = ['small', 'medium'] as const;
  // #when
  const heights = sizes.map((size) => fitFigure(SIZE_DIMENSIONS_MM[size], 100, 300, 'height').imageHeightMm);
  // #then
  assert.deepEqual([heights, heights[0] < heights[1]], [[25, 30], true]);
});

t('a custom size honours both of its numbers', () => {
  // #given
  const e = { size: 'custom' as const, customWidthMm: 20, customHeightMm: 45 };
  const dimensions = {
    baseWidthMm: resolveBaseWidthMm(e, 'height'), figureHeightMm: resolveFigureHeightMm(e),
  };
  // #when
  const fit = fitFigure(dimensions, 100, 300, 'height');
  // #then
  assert.deepEqual([fit.imageWidthMm, fit.imageHeightMm], [15, 45]);
});

t('the width model ignores the figure height column', () => {
  // #given
  const medium = SIZE_DIMENSIONS_MM.medium;
  // #when
  const fit = fitFigure(medium, 500, 1500, 'width');
  // #then
  assert.deepEqual(fit, fitImageBox(medium.baseWidthMm, 500, 1500));
});

console.log(`\n${passed} passed`);
