import type { DnDSize, Entry, PackingEntry, SizingModel } from './types';
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
export const TAB_HEIGHT_MM = 8;
export const DEFAULT_FIGURE_MARGIN_MM = 2;

// A single placed copy of an entry, with its resolved geometry. entryIndex maps
// back to the source entry so callers (the PDF drawer, the warning UI) can
// attribute each mini to its row.
export type PackedMini = {
  entryIndex: number;
  copyIndex: number; // 0-based copy within the entry
  size: DnDSize;
  baseWidthMm: number; // tab footprint, fixed by the size category
  totalWidthMm: number; // the wider of figure and base, plus margins — reserved column, fold line, packing
  tabWidthMm: number; // drawn tab outline, centred in the reserved column
  tabOffsetXMm: number; // offset from the reserved column's left edge
  baseOffsetXMm: number; // ditto, for the base the figure and badge sit over
  marginMm: number;
  imageWidthMm: number; // drawn image width; may exceed baseWidthMm under the height model
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
  // Threaded once, here, rather than added to every signature it would reach.
  // Defaults to the shipped model; #19 removes it with the losing branch.
  sizingModel?: SizingModel;
};

// Project prepared artwork into packing geometry without changing entry indices.
export function packEntries(entries: Entry[], opts: PackOptions): PackResult {
  return packMinis(entries.map((entry) => ({
    size: entry.size,
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
// their sizing model needs are simply omitted (not yet packable) — under the
// height model that includes a custom entry with no figure height, which is why
// a row can vanish from the count with a perfectly good base width. Minis too
// large for a single page are
// reported as skipped rather than silently dropped.
export function packMinis(entries: PackingEntry[], opts: PackOptions): PackResult {
  const { w: pageWmm, h: pageHmm } = PAGE_SIZES_MM[opts.pageSize];
  const usableWmm = pageWmm - MARGIN_MM * 2;
  const usableHmm = pageHmm - MARGIN_MM * 2;
  const marginMm = opts.marginMm ?? DEFAULT_FIGURE_MARGIN_MM;
  const sizingModel = opts.sizingModel ?? 'width';

  const minis: PackedMini[] = [];
  entries.forEach((e, entryIndex) => {
    const dimensions = resolveSizeDimensionsMm(e, sizingModel);
    const { baseWidthMm } = dimensions;
    if (
      !hasPackableDimensions(e, sizingModel) ||
      e.count <= 0 ||
      e.naturalWidth == null ||
      e.naturalHeight == null ||
      e.naturalWidth <= 0 ||
      e.naturalHeight <= 0
    ) {
      return; // not packable yet
    }
    const { imageWidthMm, imageHeightMm } = fitFigure(dimensions, e.naturalWidth, e.naturalHeight, sizingModel);
    // A figure may overhang its base, so the reserved column is the wider of
    // the two. Under the width model the figure never exceeds the base and
    // this is the base width, as before.
    const contentWidthMm = Math.max(baseWidthMm, imageWidthMm);
    const totalWidthMm = contentWidthMm + marginMm * 2;
    const imageOffsetXMm = marginMm + (contentWidthMm - imageWidthMm) / 2;
    // The tab keeps the base's width so a wide pose claims no more table than
    // a narrow creature of the same category; the figure overhangs it instead.
    // Under the width model a figure never overhangs, and the tab spans the
    // whole mini as it always has. #19 drops that branch with the switch.
    const tabWidthMm = sizingModel === 'height' ? baseWidthMm : totalWidthMm;
    // Base, tab and figure share one centring rule, and all three offsets are
    // derived here rather than in the drawer: in millimetres they collapse to
    // exactly a margin and exactly zero under the width model, which the same
    // arithmetic in points does not.
    const tabOffsetXMm = (totalWidthMm - tabWidthMm) / 2;
    const baseOffsetXMm = marginMm + (contentWidthMm - baseWidthMm) / 2;
    const totalHeightMm = imageHeightMm * 2 + marginMm * 4 + TAB_HEIGHT_MM * 2;
    for (let i = 0; i < e.count; i++) {
      minis.push({
        entryIndex,
        copyIndex: i,
        size: e.size,
        baseWidthMm,
        totalWidthMm,
        tabWidthMm,
        tabOffsetXMm,
        baseOffsetXMm,
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
  // of scope. Under the width model every mini reserves its base plus the same
  // two margins, so this is the old base-width order unchanged.
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
