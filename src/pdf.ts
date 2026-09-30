import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  PrintScaling,
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

// The scale check printed in each sheet's top margin. A print dialog left on
// "Fit to page" shrinks the whole sheet by a few per cent, which no amount of
// care in the layout can undo, so the sheet has to let the user see it happen.
// 100 mm makes a 3% shrink a 3 mm shortfall, visible against any ruler. It sits
// in the top margin, clear of the first row, because a printer's unprintable
// strip is narrower at the top than at the bottom on most home printers.
export const SCALE_BAR_MM = 100;
const SCALE_BAR_Y_FROM_TOP_MM = 5.5;
const SCALE_BAR_THICKNESS_MM = 0.4;
const SCALE_TICK_MM = 1.5;
const SCALE_MAJOR_TICK_MM = 2.5;
const SCALE_TICK_WIDTH_MM = 0.3;
const SCALE_TEXT_PT = 7;
export const SCALE_BAR_NOTE = 'Must measure 100 mm. If shorter, print at Actual size (100%).';

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
  // A hint, not a guarantee: Acrobat opens its print dialog at actual size,
  // while Chrome, Firefox and Preview ignore it — hence the scale bar as well.
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);

  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const noteFont = await pdf.embedFont(StandardFonts.Helvetica);

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
    drawScaleBar(pdfPage, pageHmm, noteFont);
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
  const tab = mm(mini.tabHeightMm);
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

  // Front label — below the image, extending into the tab if the margin is
  // narrow. The tab shrinks under a short figure, so the badge is told how much
  // room it has rather than assuming a full one.
  const labelRoomMm = mini.marginMm + mini.tabHeightMm;
  if (mini.label) {
    drawLabelBadge(
      pdfPage,
      mini.label,
      font,
      mini.baseWidthMm,
      labelRoomMm,
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
    drawLabelBadge(pdfPage, mini.label, font, mini.baseWidthMm, labelRoomMm, baseFromImageX, 0);
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

// Filled shapes only, drawn after the minis: a stroke would read as a fold line.
function drawScaleBar(pdfPage: PDFPage, pageHmm: number, font: PDFFont) {
  const barY = pageHmm - SCALE_BAR_Y_FROM_TOP_MM;
  const color = rgb(0, 0, 0);
  pdfPage.drawRectangle({
    x: mm(MARGIN_MM),
    y: mm(barY - SCALE_BAR_THICKNESS_MM / 2),
    width: mm(SCALE_BAR_MM),
    height: mm(SCALE_BAR_THICKNESS_MM),
    color,
  });
  for (let tickMm = 0; tickMm <= SCALE_BAR_MM; tickMm += 10) {
    const length = tickMm % 50 === 0 ? SCALE_MAJOR_TICK_MM : SCALE_TICK_MM;
    // The end ticks sit inside the bar's ends, so the bar's own length is the
    // measurement and the ticks never add to it.
    const x = MARGIN_MM + Math.min(Math.max(tickMm - SCALE_TICK_WIDTH_MM / 2, 0),
      SCALE_BAR_MM - SCALE_TICK_WIDTH_MM);
    pdfPage.drawRectangle({
      x: mm(x),
      y: mm(barY - length),
      width: mm(SCALE_TICK_WIDTH_MM),
      height: mm(length),
      color,
    });
  }
  pdfPage.drawText(SCALE_BAR_NOTE, {
    x: mm(MARGIN_MM + SCALE_BAR_MM + 3),
    y: mm(barY - SCALE_MAJOR_TICK_MM),
    size: SCALE_TEXT_PT,
    font,
    color,
  });
}

// Draws a white number badge below the base's right edge. boxX is the base's
// left edge and boxY is the image's bottom, in pt and face-local coordinates.
// `roomMm` is the paper below the image — the figure margin plus the tab — and
// the badge shrinks to stay inside it, clear of the cut edge at both ends.
// Without that a Tiny at zero margin would hang its badge off the mini. The
// clearance yields with the room for the same reason: held at a flat 0.8 mm it
// eats a fifth of a shrunken tab, and the digit inside drops below the 6 pt
// this file's tests treat as the floor for a readable number.
function drawLabelBadge(
  pdfPage: PDFPage,
  label: string,
  font: PDFFont,
  widthMm: number,
  roomMm: number,
  boxX: number,
  boxY: number,
) {
  const badgeWmm = clamp(widthMm * 0.22, 4, 7);
  const padMm = Math.min(0.8, widthMm * 0.04, roomMm * 0.1);
  const badgeHmm = Math.min(badgeWmm * 0.85, roomMm - padMm * 2);
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
