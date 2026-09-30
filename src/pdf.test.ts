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

const PT_PER_MM = 72 / 25.4;
const asMm = (pt: number) => Math.round(pt / PT_PER_MM * 1e6) / 1e6;
const widthMm = (box: Box) => asMm(box.right - box.left);
const inside = (inner: Box, outer: Box) =>
  inner.left > outer.left && inner.right < outer.right
  && inner.bottom > outer.bottom && inner.top < outer.top;

// A tab is the width of its base, not of its mini, so nothing here may address
// a shape by its position in the stream. Every shape carries the role the PDF
// itself reveals: a stroked closed path is a tab outline, a filled one a
// badge, a two-point stroke the fold line, and a negative CTM marks the back
// face. Assertions name those roles.
type Role = 'tab' | 'badge' | 'fold' | 'image' | 'text';
type Text = { label: string; size: number; direction: number; position: Point };
type Shape = { role: Role; flipped: boolean; box: Box; text?: Text };

type Face = { image: Box; badge?: Box; text?: Text };
type Mini = { bottomTab: Box; topTab: Box; fold: Box; extent: Box; front: Face; back: Face };

// Read geometry from the saved PDF's graphics operators, not drawing helpers.
async function read(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const shapes: Shape[] = [];
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    assert.ok(contents instanceof PDFArray);
    let matrix: Matrix = [...identity];
    const stack: Matrix[] = [];
    let path: Point[] = [];
    let closed = false;
    let textMatrix: Matrix = [...identity];
    let size = 0;
    for (let i = 0; i < contents.size(); i++) {
      const stream = contents.lookup(i, PDFRawStream);
      const source = new TextDecoder().decode(decodePDFRawStream(stream).decode());
      for (const line of source.trim().split('\n')) {
        const tokens = line.trim().split(/\s+/);
        const op = tokens.pop();
        const n = tokens.map(Number);
        const flipped = matrix[0] < 0;
        if (op === 'q') stack.push([...matrix]);
        if (op === 'Q') matrix = stack.pop()!;
        if (op === 'cm') {
          const [a, b, c, d, e, f] = n;
          const [g, h, j, k] = matrix;
          const origin = point(matrix, e, f);
          matrix = [g * a + j * b, h * a + k * b, g * c + j * d, h * c + k * d, origin.x, origin.y];
        }
        if (op === 'm') { path = [point(matrix, n[0], n[1])]; closed = false; }
        if (op === 'l') path.push(point(matrix, n[0], n[1]));
        if (op === 'h') closed = true;
        // Painting ends a path and names it: filled and stroked is a badge,
        // stroked and closed a tab outline, a stroked segment the fold line.
        if (op === 'S' || op === 'B') {
          const role: Role = op === 'B' ? 'badge' : closed ? 'tab' : 'fold';
          shapes.push({ role, flipped, box: bounds(path) });
          path = [];
          closed = false;
        }
        if (op === 'Do') shapes.push({ role: 'image', flipped, box: bounds([
          point(matrix, 0, 0), point(matrix, 1, 0), point(matrix, 0, 1), point(matrix, 1, 1),
        ]) });
        if (op === 'Tf') size = n[1];
        if (op === 'Tm') textMatrix = n as Matrix;
        if (op === 'Tj') {
          const position = point(matrix, textMatrix[4], textMatrix[5]);
          shapes.push({
            role: 'text', flipped, box: bounds([position]),
            text: {
              label: Buffer.from(tokens[0].slice(1, -1), 'hex').toString(), size,
              direction: matrix[0] * textMatrix[0] + matrix[2] * textMatrix[1],
              position,
            },
          });
        }
      }
    }
  }
  return {
    shapes,
    minis: minis(shapes),
    texts: shapes.filter(s => s.role === 'text').map(s => s.text!),
    pages: pdf.getPageCount(),
  };
}

// drawMini emits one mini's shapes in a run that the fold line closes, so the
// fold is the separator. Within a run, role and face place every shape.
function minis(shapes: Shape[]): Mini[] {
  const runs: Shape[][] = [];
  let run: Shape[] = [];
  for (const shape of shapes) {
    run.push(shape);
    if (shape.role === 'fold') { runs.push(run); run = []; }
  }
  return runs.map((group) => {
    const pick = (role: Role, flipped: boolean) => group.find(s => s.role === role && s.flipped === flipped);
    const tabs = group.filter(s => s.role === 'tab').sort((a, b) => a.box.bottom - b.box.bottom);
    assert.equal(tabs.length, 2, 'a mini draws two tab outlines');
    const [bottomTab, topTab] = tabs.map(s => s.box);
    const fold = pick('fold', false)!.box;
    const face = (flipped: boolean): Face => ({
      image: pick('image', flipped)!.box,
      badge: pick('badge', flipped)?.box,
      text: pick('text', flipped)?.text,
    });
    return {
      bottomTab, topTab, fold,
      // The mini's own extent: the fold line runs the full reserved column,
      // while the tabs mark its bottom and top.
      extent: { left: fold.left, right: fold.right, bottom: bottomTab.bottom, top: topTab.top },
      front: face(false), back: face(true),
    };
  });
}

const artwork = {
  bytes: Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64')),
  format: 'png' as const, width: 1, height: 1,
};
const entry: Entry = { image: null, artwork, heightSlot: 'tiny', count: 1 };

// 3x2 px at Medium: the figure prints 45 mm wide at its 30 mm height, over a
// 25 mm base, overhanging it and staying under the width cap.
const wide: Entry = { ...entry, heightSlot: 'medium', artwork: {
  bytes: Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAADklEQVR4nGNwgAEGOAsALRQEgQjZfUEAAAAASUVORK5CYII=', 'base64')),
  format: 'png', width: 3, height: 2,
} };

await t('both Tiny badges sit below the artwork in each face orientation', async () => {
  // #given
  const opts = { pageSize: 'a4', numberDuplicates: true } as const;
  // #when
  const sheet = await read(await generatePDF([entry], opts));
  // #then
  const [mini] = sheet.minis;
  assert.deepEqual({
    minis: sheet.minis.length, shapes: sheet.shapes.length,
    frontBelow: mini.front.badge!.top < mini.front.image.bottom,
    backBelow: mini.back.badge!.bottom > mini.back.image.top,
    frontInside: inside(mini.front.badge!, mini.extent),
    backInside: inside(mini.back.badge!, mini.extent),
    labels: sheet.texts.map(text => text.label), directions: sheet.texts.map(text => text.direction),
    readable: sheet.texts.map(text => text.size >= 6),
    textInsideBadge: [mini.front, mini.back].map((face) =>
      face.text!.position.x > face.badge!.left && face.text!.position.x < face.badge!.right
      && face.text!.position.y > face.badge!.bottom && face.text!.position.y < face.badge!.top),
  }, {
    minis: 1, shapes: 9, // two tabs, two images, two badges, two labels, one fold
    frontBelow: true, backBelow: true, frontInside: true, backInside: true,
    labels: ['1', '1'], directions: [1, -1], readable: [true, true],
    textInsideBadge: [true, true],
  });
});

await t('a sliver of Tiny artwork keeps both badges at the right of the base', async () => {
  // #given
  const tall: Entry = { ...entry, artwork: {
    bytes: Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAABkCAYAAABHLFpgAAAAEklEQVR4nGP4z8Dwn2GUGEkEAJoCxzl9ksz2AAAAAElFTkSuQmCC', 'base64')),
    format: 'png', width: 1, height: 100,
  } };
  // #when
  const { minis } = await read(await generatePDF([tall], { pageSize: 'a4', numberDuplicates: true }));
  // #then
  const [mini] = minis;
  const middle = (mini.extent.left + mini.extent.right) / 2;
  assert.deepEqual({
    frontRight: mini.front.badge!.left > middle && mini.front.badge!.right < mini.extent.right,
    backRightAfterFolding: mini.back.badge!.right < middle && mini.back.badge!.left > mini.extent.left,
  }, { frontRight: true, backRightAfterFolding: true });
});

for (const marginMm of [0, 2, 8]) {
  await t(`badges stay on the sheet's minis with a ${marginMm} mm margin and leave layout unchanged`, async () => {
    // #given
    const entries: Entry[] = [{ ...entry, heightSlot: 'large-tall' }, entry];
    const opts = { pageSize: 'a4', marginMm } as const;
    // #when
    const numbered = await read(await generatePDF(entries, { ...opts, numberDuplicates: true }));
    const plain = await read(await generatePDF(entries, { ...opts, numberDuplicates: false }));
    // #then
    assert.deepEqual({
      pages: numbered.pages,
      // Numbering adds badges and labels and moves nothing else.
      layout: numbered.shapes.filter(s => s.role !== 'badge' && s.role !== 'text'),
      placement: numbered.minis.map((mini) => [
        mini.front.badge!.bottom > mini.extent.bottom,
        mini.front.badge!.top < mini.front.image.bottom,
        mini.back.badge!.bottom > mini.back.image.top,
        mini.back.badge!.top < mini.extent.top,
      ]),
      // A Tiny's tab shrinks with its figure, so the badge clamp bites hardest
      // at 0 mm — where nothing else pins how small the digit may get.
      readable: numbered.texts.map(text => text.size >= 6),
      plainLabels: plain.texts,
    }, {
      pages: plain.pages, layout: plain.shapes,
      placement: [[true, true, true, true], [true, true, true, true]],
      readable: [true, true, true, true], plainLabels: [],
    });
  });
}

await t('each copy prints its own number on both faces', async () => {
  // #given
  const copies = { ...entry, count: 12 };
  // #when
  const { texts } = await read(await generatePDF([copies], { pageSize: 'a4', numberDuplicates: true }));
  // #then
  assert.deepEqual(texts.map(text => text.label), [
    '1', '1', '2', '2', '3', '3', '4', '4', '5', '5', '6', '6',
    '7', '7', '8', '8', '9', '9', '10', '10', '11', '11', '12', '12',
  ]);
});

await t('a height slot prints one figure height for artworks of different proportions', async () => {
  // #given  a square and a 1x100 sliver, both Tiny
  const sliver: Entry = { ...entry, artwork: {
    bytes: Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAABkCAYAAABHLFpgAAAAEklEQVR4nGP4z8Dwn2GUGEkEAJoCxzl9ksz2AAAAAElFTkSuQmCC', 'base64')),
    format: 'png', width: 1, height: 100,
  } };
  // #when
  const { minis } = await read(await generatePDF([entry, sliver], {
    pageSize: 'a4', numberDuplicates: false, marginMm: 0,
  }));
  // #then  Tiny is 11 mm tall in ADR-0002's graded table, front and back, both entries
  assert.deepEqual(
    minis.flatMap(mini => [mini.front.image, mini.back.image]).map(box => asMm(box.top - box.bottom)),
    [11, 11, 11, 11],
  );
});

await t('a tab keeps its base width while the figure overhangs it', async () => {
  // #when
  const { minis } = await read(await generatePDF([wide], {
    pageSize: 'a4', numberDuplicates: true, marginMm: 0,
  }));
  // #then  Medium's 25 mm base, with the figure's 45 mm spread centred over it
  const [mini] = minis;
  assert.deepEqual({
    bottomTab: widthMm(mini.bottomTab), topTab: widthMm(mini.topTab),
    figure: widthMm(mini.front.image),
    overhangLeft: asMm(mini.bottomTab.left - mini.front.image.left),
    overhangRight: asMm(mini.front.image.right - mini.bottomTab.right),
    tabsAligned: mini.bottomTab.left === mini.topTab.left,
    // The badge marks the base, so it stays over the tab rather than drifting
    // out to the overhanging figure's edge.
    badgeOverBase: [mini.front.badge!, mini.back.badge!].map(badge =>
      badge.left > mini.bottomTab.left && badge.right < mini.bottomTab.right),
  }, {
    bottomTab: 25, topTab: 25, figure: 45, overhangLeft: 10, overhangRight: 10,
    tabsAligned: true, badgeOverBase: [true, true],
  });
});

await t('the fold line spans the reserved column, overhang and margins included', async () => {
  // #when
  const { minis } = await read(await generatePDF([wide], {
    pageSize: 'a4', numberDuplicates: false, marginMm: 2,
  }));
  // #then  the crease has to cross every part of the cut-out, not just the base
  const [mini] = minis;
  assert.deepEqual({
    fold: widthMm(mini.fold), tab: widthMm(mini.bottomTab), figure: widthMm(mini.front.image),
    crossesFigure: mini.fold.left < mini.front.image.left && mini.fold.right > mini.front.image.right,
    atVerticalCentre: asMm(mini.fold.bottom - mini.extent.bottom)
      === asMm(mini.extent.top - mini.fold.top),
  }, { fold: 49, tab: 25, figure: 45, crossesFigure: true, atVerticalCentre: true });
});

await t('the badge marks the base, a fixed step inside it', async () => {
  // #when  square art at Medium prints 30 mm wide, so the 25 mm base sits
  // 2.5 mm inside the figure and 4.5 mm inside the mini's own left edge
  const { minis } = await read(await generatePDF([{ ...entry, heightSlot: 'medium' }], {
    pageSize: 'a4', numberDuplicates: true, marginMm: 2,
  }));
  // #then
  const [mini] = minis;
  const badge = mini.front.badge!;
  assert.deepEqual({
    baseLeftInset: asMm(badge.right + 0.8 * PT_PER_MM - mini.extent.left - 25 * PT_PER_MM),
    badgeWidth: widthMm(badge),
    badgeHeight: asMm(badge.top - badge.bottom),
  }, { baseLeftInset: 4.5, badgeWidth: 5.5, badgeHeight: 4.675 });
});

console.log(`\n${passed} passed`);
