import assert from 'node:assert/strict';
import { findFigureBounds } from './figure-bounds.ts';

let passed = 0;
const t = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
};

function rgba(alpha: number[]): Uint8ClampedArray {
  return new Uint8ClampedArray(alpha.flatMap((a) => [120, 60, 30, a]));
}

t('transparent margins leave the exact figure rectangle', () => {
  // #given
  const pixels = rgba([
    0, 0, 0, 0,
    0, 255, 255, 0,
    0, 255, 255, 0,
    0, 0, 0, 0,
  ]);
  // #when
  const bounds = findFigureBounds(pixels, 4, 4);
  // #then
  assert.deepEqual(bounds, { x: 1, y: 1, width: 2, height: 2 });
});

t('fully opaque artwork has no alpha-detected figure', () => {
  // #given
  const pixels = rgba([255, 255, 255, 255]);
  // #when
  const bounds = findFigureBounds(pixels, 2, 2);
  // #then
  assert.equal(bounds, null);
});

t('alpha 8 is background while alpha 9 belongs to the figure', () => {
  // #given
  const pixels = rgba([0, 8, 9, 8, 0]);
  // #when
  const bounds = findFigureBounds(pixels, 5, 1);
  // #then
  assert.deepEqual(bounds, { x: 2, y: 0, width: 1, height: 1 });
});

t('a tight figure touching all edges keeps the full rectangle', () => {
  // #given
  const pixels = rgba([0, 255, 0, 255, 255, 255, 0, 255, 0]);
  // #when
  const bounds = findFigureBounds(pixels, 3, 3);
  // #then
  assert.deepEqual(bounds, { x: 0, y: 0, width: 3, height: 3 });
});

t('fully transparent artwork has no figure', () => {
  // #given
  const pixels = rgba([0, 0, 0, 0]);
  // #when
  const bounds = findFigureBounds(pixels, 2, 2);
  // #then
  assert.equal(bounds, null);
});

t('a barely visible halo alone has no figure', () => {
  // #given
  const pixels = rgba([1, 8, 3, 0]);
  // #when
  const bounds = findFigureBounds(pixels, 2, 2);
  // #then
  assert.equal(bounds, null);
});

t('a custom threshold excludes pixels at that threshold', () => {
  // #given
  const pixels = rgba([20, 21, 20]);
  // #when
  const bounds = findFigureBounds(pixels, 3, 1, 20);
  // #then
  assert.deepEqual(bounds, { x: 1, y: 0, width: 1, height: 1 });
});

console.log(`\n${passed} passed`);
