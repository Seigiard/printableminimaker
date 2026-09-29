import assert from 'node:assert/strict';
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { generatePDF } from './pdf.ts';
import type { Entry } from './types.ts';

let passed = 0;
const t = async (name: string, fn: () => Promise<void>) => {
  await fn();
  passed++;
  console.log(`  ok - ${name}`);
};

type Point = { x: number; y: number };
type Box = { left: number; bottom: number; right: number; top: number };
type Matrix = [number, number, number, number, number, number];
const identity: Matrix = [1, 0, 0, 1, 0, 0];
const point = (m: Matrix, x: number, y: number): Point => ({
  x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5],
});
const bounds = (points: Point[]): Box => ({
  left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
  bottom: Math.min(...points.map(p => p.y)), top: Math.max(...points.map(p => p.y)),
});

// Read geometry from the saved PDF's graphics operators, not drawing helpers.
async function inspect(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const rectangles: Box[] = [];
  const images: Box[] = [];
  const texts: { label: string; size: number; direction: number; position: Point }[] = [];
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    assert.ok(contents instanceof PDFArray);
    let matrix: Matrix = [...identity];
    const stack: Matrix[] = [];
    let path: Point[] = [];
    let textMatrix: Matrix = [...identity];
    let size = 0;
    for (let i = 0; i < contents.size(); i++) {
      const stream = contents.lookup(i, PDFRawStream);
      const source = new TextDecoder().decode(decodePDFRawStream(stream).decode());
      for (const line of source.trim().split('\n')) {
        const tokens = line.trim().split(/\s+/);
        const op = tokens.pop();
        const n = tokens.map(Number);
        if (op === 'q') stack.push([...matrix]);
        if (op === 'Q') matrix = stack.pop()!;
        if (op === 'cm') {
          const [a, b, c, d, e, f] = n;
          const [g, h, j, k] = matrix;
          const origin = point(matrix, e, f);
          matrix = [g * a + j * b, h * a + k * b, g * c + j * d, h * c + k * d, origin.x, origin.y];
        }
        if (op === 'm') path = [point(matrix, n[0], n[1])];
        if (op === 'l') path.push(point(matrix, n[0], n[1]));
        if (op === 'h') rectangles.push(bounds(path));
        if (op === 'Do') images.push(bounds([
          point(matrix, 0, 0), point(matrix, 1, 0), point(matrix, 0, 1), point(matrix, 1, 1),
        ]));
        if (op === 'Tf') size = n[1];
        if (op === 'Tm') textMatrix = n as Matrix;
        if (op === 'Tj') texts.push({
          label: Buffer.from(tokens[0].slice(1, -1), 'hex').toString(), size,
          direction: matrix[0] * textMatrix[0] + matrix[2] * textMatrix[1],
          position: point(matrix, textMatrix[4], textMatrix[5]),
        });
      }
    }
  }
  return { rectangles, images, texts, pages: pdf.getPageCount() };
}

const artwork = {
  bytes: Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64')),
  format: 'png' as const, width: 1, height: 1,
};
const entry: Entry = { image: null, artwork, size: 'tiny', count: 1 };

await t('both Tiny badges sit below the artwork in each face orientation', async () => {
  // #given
  const opts = { pageSize: 'a4', numberDuplicates: true } as const;
  // #when
  const { rectangles, images, texts } = await inspect(await generatePDF([entry], opts));
  // #then
  const [outline, front, back] = rectangles;
  assert.deepEqual({
    rectangles: rectangles.length, images: images.length,
    frontBelow: front.top < images[0].bottom,
    backBelow: back.bottom > images[1].top,
    frontInside: front.bottom > outline.bottom && front.left > outline.left && front.right < outline.right,
    backInside: back.top < outline.top && back.left > outline.left && back.right < outline.right,
    labels: texts.map(text => text.label), directions: texts.map(text => text.direction),
    readable: texts.map(text => text.size >= 6),
    textInsideBadge: texts.map((text, i) => {
      const badge = rectangles[i + 1];
      return text.position.x > badge.left && text.position.x < badge.right
        && text.position.y > badge.bottom && text.position.y < badge.top;
    }),
  }, {
    rectangles: 3, images: 2, frontBelow: true, backBelow: true,
    frontInside: true, backInside: true, labels: ['1', '1'], directions: [1, -1], readable: [true, true],
    textInsideBadge: [true, true],
  });
});

await t('height-clamped Tiny artwork keeps both badges at the right of the base', async () => {
  // #given
  const tall: Entry = { ...entry, artwork: {
    bytes: Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAABkCAYAAABHLFpgAAAAEklEQVR4nGP4z8Dwn2GUGEkEAJoCxzl9ksz2AAAAAElFTkSuQmCC', 'base64')),
    format: 'png', width: 1, height: 100,
  } };
  // #when
  const { rectangles } = await inspect(await generatePDF([tall], { pageSize: 'a4', numberDuplicates: true }));
  // #then
  const [outline, front, back] = rectangles;
  const middle = (outline.left + outline.right) / 2;
  assert.deepEqual({
    frontRight: front.left > middle && front.right < outline.right,
    backRightAfterFolding: back.right < middle && back.left > outline.left,
  }, { frontRight: true, backRightAfterFolding: true });
});

for (const marginMm of [0, 2, 8]) {
  await t(`badges stay on the sheet's minis with a ${marginMm} mm margin and leave layout unchanged`, async () => {
    // #given
    const entries: Entry[] = [{ ...entry, size: 'gargantuan' }, entry];
    const opts = { pageSize: 'a4', marginMm } as const;
    // #when
    const numbered = await inspect(await generatePDF(entries, { ...opts, numberDuplicates: true }));
    const plain = await inspect(await generatePDF(entries, { ...opts, numberDuplicates: false }));
    // #then
    assert.deepEqual({
      images: numbered.images, pages: numbered.pages,
      outlines: numbered.rectangles.filter((_, i) => i % 3 === 0),
      placement: [0, 1].map(i => {
        const [outline, front, back] = numbered.rectangles.slice(i * 3, i * 3 + 3);
        const frontImage = numbered.images[i * 2];
        const backImage = numbered.images[i * 2 + 1];
        return [front.bottom > outline.bottom, front.top < frontImage.bottom,
          back.bottom > backImage.top, back.top < outline.top];
      }),
      plainLabels: plain.texts,
    }, {
      images: plain.images, pages: plain.pages, outlines: plain.rectangles,
      placement: [[true, true, true, true], [true, true, true, true]], plainLabels: [],
    });
  });
}

await t('each copy prints its own number on both faces', async () => {
  // #given
  const copies = { ...entry, count: 12 };
  // #when
  const { texts } = await inspect(await generatePDF([copies], { pageSize: 'a4', numberDuplicates: true }));
  // #then
  assert.deepEqual(texts.map(text => text.label), [
    '1', '1', '2', '2', '3', '3', '4', '4', '5', '5', '6', '6',
    '7', '7', '8', '8', '9', '9', '10', '10', '11', '11', '12', '12',
  ]);
});

console.log(`\n${passed} passed`);
