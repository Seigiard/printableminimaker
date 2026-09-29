import type { Entry, MiniSize, PackingEntry } from './types';
import { fitFigure, hasPackableDimensions, resolveSizeDimensionsMm } from './sizes.ts';

// Page and layout constants. These live here (not in pdf.ts) so the packing
// math is a pure, DOM/PDF-free module that both the live page-count estimate
// and the PDF generator share.
export const PAGE_SIZES_MM = {
  a4: { w: 210, h: 297 },
  letter: { w: 216, h: 279 },
} as const;

export type PageSizeKey = keyof typeof PAGE_SIZES_MM;

export const MARGIN_MM = 10;
export const GAP_MM = 2;
export const DEFAULT_FIGURE_MARGIN_MM = 2;

// The tab a figure gets once it is tall enough to carry one, and the floor
// below which the fold has nothing to grip.
export const TAB_HEIGHT_MM = 8;
export const MIN_TAB_HEIGHT_MM = 4;

// ADR-0002, the tab floor: a tab is this share of the figure standing on it,
// until MIN_TAB_HEIGHT_MM takes over. Below a 10 mm printed figure the floor
// wins and the proportion no longer holds — a wide Tiny scaled down by the width
// cap can end up shorter than its own 4 mm tab. The grip the fold needs is a
// fixed physical thing, so it does not scale away; the six-row table had the
// same corner, more often, with a fixed 8 mm tab. The height slots are graded true to scale at the small end —
// a Tiny is 11 mm — and a fixed 8 mm tab under an 11 mm figure is the "strip of
// paper with a dot on top" #20's story 10 was written against. Shrinking the
// tab under a short figure keeps the figure scale honest instead of inflating
// Tiny and Small back over true scale, which would re-compress the very
// halfling-versus-dwarf gap #24 opened.
export const MAX_TAB_HEIGHT_RATIO = 0.4;

// Measured from the figure's printed height, not its slot's nominal one, so a
// figure scaled down by the width cap gets the tab it actually stands on. Any
// figure printing 20 mm or taller keeps the full tab, which at nominal height is
// every slot from the short Medium up — but wide artwork can drop one of those
// below 20 mm, and then it shrinks like any other short figure.
export function tabHeightMm(figureHeightMm: number): number {
  const proportional = figureHeightMm * MAX_TAB_HEIGHT_RATIO;
  if (proportional >= TAB_HEIGHT_MM) return TAB_HEIGHT_MM;
  return Math.max(proportional, MIN_TAB_HEIGHT_MM);
}

// A single placed copy of an entry, with its resolved geometry. entryIndex maps
// back to the source entry so callers (the PDF drawer, the warning UI) can
// attribute each mini to its row.
export type PackedMini = {
  entryIndex: number;
  copyIndex: number; // 0-based copy within the entry
  heightSlot: MiniSize;
  baseWidthMm: number; // tab footprint, fixed by the slot's size category
  totalWidthMm: number; // the wider of figure and base, plus margins — reserved column, fold line, packing
  tabWidthMm: number; // drawn tab outline, centred in the reserved column
  tabOffsetXMm: number; // offset from the reserved column's left edge
  baseOffsetXMm: number; // ditto, for the base the figure and badge sit over
  tabHeightMm: number; // drawn tab height, shrunk under a figure too short for a full one
  marginMm: number;
  imageWidthMm: number; // drawn image width; may exceed baseWidthMm
  imageHeightMm: number;
  imageOffsetXMm: number; // offset from the outline's left edge, including margin and centering
  totalHeightMm: number;
  label?: string;
};

export type PackedRow = { items: PackedMini[]; widthMm: number; heightMm: number };
export type PackedPage = { rows: PackedRow[]; heightMm: number };

// A mini that cannot fit a single page at all, attributed to its entry.
export type SkippedMini = {
  entryIndex: number;
  copyIndex: number;
  baseWidthMm: number;
  totalHeightMm: number;
};

export type PackResult = {
  pages: PackedPage[];
  pageCount: number;
  miniCount: number; // minis actually placed (what will print)
  skipped: SkippedMini[];
  oversizedEntryIndices: number[]; // distinct entries with >=1 skipped mini
};

export type PackOptions = {
  pageSize: PageSizeKey;
  numberDuplicates: boolean;
  marginMm?: number;
};

// Project prepared artwork into packing geometry without changing entry indices.
export function packEntries(entries: Entry[], opts: PackOptions): PackResult {
  return packMinis(entries.map((entry) => ({
    heightSlot: entry.heightSlot,
    customWidthMm: entry.customWidthMm,
    customHeightMm: entry.customHeightMm,
    count: entry.count,
    naturalWidth: entry.artwork?.width,
    naturalHeight: entry.artwork?.height,
  })), opts);
}

// Expands entries into individual minis with resolved geometry, sorted by
// reserved width descending, then bin-packs them into rows and pages within the
// usable area. Entries lacking an image's natural dimensions or the dimensions
// sizing needs are simply omitted (not yet packable) — that includes a custom
// entry with no figure height, which is why a row can vanish from the count
// with a perfectly good base width. Minis too large for a single page are
// reported as skipped rather than silently dropped.
export function packMinis(entries: PackingEntry[], opts: PackOptions): PackResult {
  const { w: pageWmm, h: pageHmm } = PAGE_SIZES_MM[opts.pageSize];
  const usableWmm = pageWmm - MARGIN_MM * 2;
  const usableHmm = pageHmm - MARGIN_MM * 2;
  const marginMm = opts.marginMm ?? DEFAULT_FIGURE_MARGIN_MM;

  const minis: PackedMini[] = [];
  entries.forEach((e, entryIndex) => {
    const dimensions = resolveSizeDimensionsMm(e);
    const { baseWidthMm } = dimensions;
    if (
      !hasPackableDimensions(e) ||
      e.count <= 0 ||
      e.naturalWidth == null ||
      e.naturalHeight == null ||
      e.naturalWidth <= 0 ||
      e.naturalHeight <= 0
    ) {
      return; // not packable yet
    }
    const { imageWidthMm, imageHeightMm } = fitFigure(dimensions, e.naturalWidth, e.naturalHeight);
    // A figure may overhang its base, so the reserved column is the wider of
    // the two.
    const contentWidthMm = Math.max(baseWidthMm, imageWidthMm);
    const totalWidthMm = contentWidthMm + marginMm * 2;
    const imageOffsetXMm = marginMm + (contentWidthMm - imageWidthMm) / 2;
    // The tab keeps the base's width so a wide pose claims no more table than
    // a narrow creature of the same category; the figure overhangs it instead.
    const tabWidthMm = baseWidthMm;
    // Base, tab and figure share one centring rule. These two offsets are
    // derived here in millimetres rather than in the drawer, because the same
    // arithmetic in points does not land on the same numbers. `drawMini` still
    // derives the back badge's own offset, inside the flipped frame, from this
    // rule — change it here and change it there.
    const tabOffsetXMm = (totalWidthMm - tabWidthMm) / 2;
    const baseOffsetXMm = marginMm + (contentWidthMm - baseWidthMm) / 2;
    const tabHMm = tabHeightMm(imageHeightMm);
    const totalHeightMm = imageHeightMm * 2 + marginMm * 4 + tabHMm * 2;
    for (let i = 0; i < e.count; i++) {
      minis.push({
        entryIndex,
        copyIndex: i,
        heightSlot: e.heightSlot,
        baseWidthMm,
        totalWidthMm,
        tabWidthMm,
        tabOffsetXMm,
        baseOffsetXMm,
        tabHeightMm: tabHMm,
        marginMm,
        imageWidthMm,
        imageHeightMm,
        imageOffsetXMm,
        totalHeightMm,
        label: opts.numberDuplicates ? String(i + 1) : undefined,
      });
    }
  });

  // Sort by reserved width descending so wide minis lead each row — reordering
  // rows in the UI has no effect on output, which is why drag-to-reorder is out
  // of scope. A narrow figure of a large category can reserve less than a wide
  // one of a small category, so this is not base-width order.
  minis.sort((a, b) => b.totalWidthMm - a.totalWidthMm);

  const pages: PackedPage[] = [];
  const skipped: SkippedMini[] = [];
  const oversized = new Set<number>();
  let placed = 0;

  let page: PackedPage = { rows: [], heightMm: 0 };
  let row: PackedRow = { items: [], widthMm: 0, heightMm: 0 };

  const flushRow = () => {
    if (row.items.length === 0) return;
    const addedHeight = row.heightMm + (page.rows.length > 0 ? GAP_MM : 0);
    if (page.heightMm + addedHeight > usableHmm) {
      if (page.rows.length > 0) pages.push(page);
      page = { rows: [row], heightMm: row.heightMm };
    } else {
      page.rows.push(row);
      page.heightMm += addedHeight;
    }
    row = { items: [], widthMm: 0, heightMm: 0 };
  };

  for (const mini of minis) {
    if (mini.totalWidthMm > usableWmm || mini.totalHeightMm > usableHmm) {
      skipped.push({
        entryIndex: mini.entryIndex,
        copyIndex: mini.copyIndex,
        baseWidthMm: mini.baseWidthMm,
        totalHeightMm: mini.totalHeightMm,
      });
      oversized.add(mini.entryIndex);
      continue;
    }
    const isFirst = row.items.length === 0;
    const addedWidth = mini.totalWidthMm + (isFirst ? 0 : GAP_MM);
    if (row.widthMm + addedWidth > usableWmm) {
      flushRow();
    }
    const firstNow = row.items.length === 0;
    row.widthMm += mini.totalWidthMm + (firstNow ? 0 : GAP_MM);
    row.items.push(mini);
    if (mini.totalHeightMm > row.heightMm) row.heightMm = mini.totalHeightMm;
    placed++;
  }
  flushRow();
  if (page.rows.length > 0) pages.push(page);

  return {
    pages,
    pageCount: pages.length,
    miniCount: placed,
    skipped,
    oversizedEntryIndices: [...oversized],
  };
}
