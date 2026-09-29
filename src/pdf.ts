import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
} from 'pdf-lib';
import type { PreparedArtwork, Entry } from './types';
import { hasPackableDimensions } from './sizes.ts';
import {
  GAP_MM,
  MARGIN_MM,
  PAGE_SIZES_MM,
  TAB_HEIGHT_MM,
  packEntries,
  type PackOptions,
  type PackedMini,
  type PageSizeKey,
} from './packing.ts';

export type { PageSizeKey };

const MM_TO_PT = 72 / 25.4;
const mm = (v: number) => v * MM_TO_PT;

const STROKE_MM = 0.2;
const LIGHT_GREY = rgb(0.7, 0.7, 0.7);
const DASH_ON_MM = 1;
const DASH_OFF_MM = 1;

export type GenerateOptions = PackOptions;

export async function generatePDF(
  entries: Entry[],
  opts: GenerateOptions,
): Promise<Uint8Array> {
  // The packer's own dimension rule, so a row it drops for want of a figure
  // height does not have its artwork embedded and flushed into the file
  // undrawn. The packer's other drop path — a mini too large for the page —
  // still slips through here, so an oversized row costs its bytes.
  const valid = entries.filter(
    (e) => e.artwork && e.count > 0 && hasPackableDimensions(e),
  ).map((e) => ({ ...e }));
  if (valid.length === 0) throw new Error('No valid entries to generate.');

  const pdf = await PDFDocument.create();
  pdf.setTitle('Paper Minis');
  pdf.setCreator('Paper Mini Generator');

  const font = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Embed each unique artwork once, keyed by its position in `valid` so packing's
  // entryIndex maps straight back to the embedded image.
  const images: PDFImage[] = [];
  const cache = new Map<PreparedArtwork, PDFImage>();
  for (const e of valid) {
    const artwork = e.artwork!;
    let img = cache.get(artwork);
    if (!img) {
      img = await (artwork.format === 'jpg'
        ? pdf.embedJpg(artwork.bytes)
        : pdf.embedPng(artwork.bytes));
      cache.set(artwork, img);
    }
    images.push(img);
  }

  const { pages } = packEntries(valid, opts);
  if (pages.length === 0) throw new Error('Nothing fits on a page.');

  const { w: pageWmm, h: pageHmm } = PAGE_SIZES_MM[opts.pageSize];
  for (const page of pages) {
    const pdfPage = pdf.addPage([mm(pageWmm), mm(pageHmm)]);
    let yTopMm = pageHmm - MARGIN_MM;
    for (const row of page.rows) {
      let xMm = MARGIN_MM;
      for (const mini of row.items) {
        drawMini(pdfPage, mini, images[mini.entryIndex], xMm, yTopMm, font);
        xMm += mini.totalWidthMm + GAP_MM;
      }
      yTopMm -= row.heightMm + GAP_MM;
    }
  }

  return pdf.save();
}

function drawMini(
  pdfPage: PDFPage,
  mini: PackedMini,
  pdfImage: PDFImage,
  xMm: number,
  yTopMm: number,
  font: PDFFont,
) {
  const yBottomMm = yTopMm - mini.totalHeightMm;
  const x = mm(xMm);
  const yBottom = mm(yBottomMm);
  const w = mm(mini.totalWidthMm);
  const iw = mm(mini.imageWidthMm);
  const tabW = mm(mini.tabWidthMm);
  const offX = mm(mini.imageOffsetXMm);
  const totalH = mm(mini.totalHeightMm);
  const tab = mm(TAB_HEIGHT_MM);
  const imgH = mm(mini.imageHeightMm);
  const margin = mm(mini.marginMm);
  const stroke = mm(STROKE_MM);

  // Bottom-up: tab, margin, front image, margin, fold,
  // margin, rotated back image, margin, tab.

  // Cut guides for both tabs; cut around the figures freehand. A tab is the
  // base's width, so a figure may overhang it on both sides.
  const baseX = x + mm(mini.baseOffsetXMm);
  const tabX = x + mm(mini.tabOffsetXMm);
  for (const y of [yBottom, yBottom + totalH - tab]) {
    pdfPage.drawRectangle({
      x: tabX,
      y,
      width: tabW,
      height: tab,
      borderColor: LIGHT_GREY,
      borderWidth: stroke,
    });
  }

  // Front image — centered horizontally over the base footprint.
  pdfPage.drawImage(pdfImage, {
    x: x + offX,
    y: yBottom + tab + margin,
    width: iw,
    height: imgH,
  });

  // Front label — below the image, extending into the tab if the margin is narrow.
  if (mini.label) {
    drawLabelBadge(
      pdfPage,
      mini.label,
      font,
      mini.baseWidthMm,
      baseX,
      yBottom + tab + margin,
    );
  }

  // Back image — rotated 180° (= mirror horizontal + flip vertical), centered.
  // CTM [-1 0 0 -1 e f] maps (px,py) → (e-px, f-py).
  // For an image drawn at (0,0) sized iw×imgH, the four corners map to a
  // rectangle from (e-iw, f-imgH) to (e, f), one margin below the top tab.
  const backTop = yBottom + tab + imgH * 2 + margin * 3;
  pdfPage.pushOperators(pushGraphicsState());
  pdfPage.pushOperators(
    concatTransformationMatrix(-1, 0, 0, -1, x + offX + iw, backTop),
  );
  pdfPage.drawImage(pdfImage, { x: 0, y: 0, width: iw, height: imgH });
  // Back label — same local coords as front so it lands on the visual
  // bottom-right of the back face after folding + walking around.
  if (mini.label) {
    // The same centring as `baseOffsetXMm`, but measured from the image's own
    // origin, which is where the flipped frame puts zero.
    const baseFromImageX = mm((mini.imageWidthMm - mini.baseWidthMm) / 2);
    drawLabelBadge(pdfPage, mini.label, font, mini.baseWidthMm, baseFromImageX, 0);
  }
  pdfPage.pushOperators(popGraphicsState());

  // Fold line — dotted, at the unfolded mini's vertical centre. It spans the
  // reserved column rather than the tab: the crease has to cross every part of
  // the cut-out piece, an overhanging figure's wings included.
  const foldY = yBottom + tab + imgH + margin * 2;
  pdfPage.drawLine({
    start: { x, y: foldY },
    end: { x: x + w, y: foldY },
    thickness: stroke,
    color: LIGHT_GREY,
    dashArray: [mm(DASH_ON_MM), mm(DASH_OFF_MM)],
  });
}

// Draws a white number badge below the base's right edge. boxX is the base's
// left edge and boxY is the image's bottom, in pt and face-local coordinates.
// The tab provides room when the figure margin is small.
function drawLabelBadge(
  pdfPage: PDFPage,
  label: string,
  font: PDFFont,
  widthMm: number,
  boxX: number,
  boxY: number,
) {
  const badgeWmm = clamp(widthMm * 0.22, 4, 7);
  const badgeHmm = badgeWmm * 0.85;
  const padMm = Math.min(0.8, widthMm * 0.04);
  const fontSize = mm(badgeHmm * 0.65);

  const bw = mm(badgeWmm);
  const bh = mm(badgeHmm);
  const pad = mm(padMm);
  const bx = boxX + mm(widthMm) - bw - pad;
  const by = boxY - bh - pad;

  pdfPage.drawRectangle({
    x: bx,
    y: by,
    width: bw,
    height: bh,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.4, 0.4, 0.4),
    borderWidth: mm(0.2),
  });

  const textW = font.widthOfTextAtSize(label, fontSize);
  const textH = font.heightAtSize(fontSize, { descender: false });
  pdfPage.drawText(label, {
    x: bx + (bw - textW) / 2,
    y: by + (bh - textH) / 2,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  });
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function buildFilename(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `paper-minis-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.pdf`;
}
