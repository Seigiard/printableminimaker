import type { Entry, HeightSlot, MiniSize, SizeCategory } from './types';

export type SizeDimensionsMm = { baseWidthMm: number; figureHeightMm: number };
export type FigureFitMm = { imageWidthMm: number; imageHeightMm: number };

// ADR-0002: base width is a convention, not a measurement. A creature's space
// is the area it controls in combat, explicitly not its physical size, and the
// rules give no creature height at all. Its remaining jobs are to keep a tab
// wide enough to stand and to signal relative size, which the six categories
// still do well enough — so the category is what fixes it, and every slot that
// carries the category inherits the number.
export const CATEGORY_BASE_WIDTH_MM: Record<SizeCategory, number> = {
  tiny: 20,
  small: 25,
  medium: 25,
  large: 37,
  huge: 50,
  gargantuan: 75,
};

export const CATEGORY_NAMES: Record<SizeCategory, string> = {
  tiny: 'Tiny',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  huge: 'Huge',
  gargantuan: 'Gargantuan',
};

export const SIZE_CATEGORY_ORDER = [
  'tiny', 'small', 'medium', 'large', 'huge', 'gargantuan',
] as const satisfies readonly SizeCategory[];

export type HeightSlotSpec = {
  category: SizeCategory;
  grade?: 'short' | 'tall'; // set only where a category carries more than one slot
  realHeight: string; // the height the slot is graded at, as the interface states it
  typical: string; // creatures that land here, for the dropdown
  figureHeightMm: number;
};

// ADR-0002: height is the user's input and the size category follows from the
// slot, rather than the other way round. Graded on a 1.7 m human printing
// 35 mm, the scale Printable Heroes prints its own paper minis at, so ours stand
// eye to eye with theirs on one table. That works out to about 6.3 mm per foot,
// held linear from Tiny up to the tall Large slot.
//
// The top two rows leave that line, because the paper runs out before the
// creatures do. An unfolded mini costs 2h + 4×margin + 2×tab, so every extra
// millimetre of figure margin costs four of height: a row tuned to the very edge
// of the page at the default 2 mm margin falls off it the moment the user widens
// the margin to cut more comfortably. Gargantuan is therefore cut to 111 rather
// than the 206 the linear scale asks for, which leaves it printable through a
// 5 mm margin on Letter, the smaller of the two pages.
//
// Huge's own linear 124 does not fit Letter at any margin, so it is paper-bound
// too. It sits at 95 rather than just under Gargantuan, because two rows 5%
// apart read as one size on cut paper; 95 keeps a step of about 16% on either
// side, to the tall Large below and Gargantuan above. The cost is that the top
// of the scale means rank rather than height: 4 m, 6 m and 10 m+ print at 82,
// 95 and 111. Every other row is the linear value rounded.
//
// The small end stays on the line rather than being inflated as the six-row
// table inflated Tiny, because the tab gives way instead: `tabHeightMm` in
// packing.ts shrinks it under a short figure. See ADR-0002 on the tab floor.
export const HEIGHT_SLOTS: Record<HeightSlot, HeightSlotSpec> = {
  'tiny': { category: 'tiny', realHeight: '0.6 m', typical: 'familiar, imp, hawk', figureHeightMm: 12 },
  'small': { category: 'small', realHeight: '0.95 m', typical: 'halfling, gnome, wolf', figureHeightMm: 20 },
  'medium-short': { category: 'medium', grade: 'short', realHeight: '1.3 m', typical: 'dwarf', figureHeightMm: 27 },
  'medium': { category: 'medium', realHeight: '1.7 m', typical: 'human, elf, orc', figureHeightMm: 35 },
  'medium-tall': { category: 'medium', grade: 'tall', realHeight: '2.1 m', typical: 'bugbear, goliath', figureHeightMm: 43 },
  'large': { category: 'large', realHeight: '2.7 m', typical: 'ogre, troll, owlbear', figureHeightMm: 56 },
  'large-tall': { category: 'large', grade: 'tall', realHeight: '4 m', typical: 'hill giant, young dragon', figureHeightMm: 82 },
  'huge': { category: 'huge', realHeight: '6 m', typical: 'giant, adult dragon', figureHeightMm: 95 },
  'gargantuan': { category: 'gargantuan', realHeight: '10 m+', typical: 'ancient dragon, kraken', figureHeightMm: 111 },
};

// Shortest first, which is the order the dropdown and the tests both want.
export const HEIGHT_SLOT_ORDER = [
  'tiny', 'small', 'medium-short', 'medium', 'medium-tall',
  'large', 'large-tall', 'huge', 'gargantuan',
] as const satisfies readonly HeightSlot[];

export const CUSTOM_SIZE_NAME = 'Custom…';

export function slotsOfCategory(category: SizeCategory): HeightSlot[] {
  return HEIGHT_SLOT_ORDER.filter((slot) => HEIGHT_SLOTS[slot].category === category);
}

// A slot's own name: its size category, and the grade within it where the
// category carries more than one slot. Composed rather than stored, so the
// category name has one source.
export function slotName(size: HeightSlot): string {
  const { category, grade } = HEIGHT_SLOTS[size];
  return grade ? `${CATEGORY_NAMES[category]}, ${grade}` : CATEGORY_NAMES[category];
}

// What a dropdown option says. The creature's own height, in metres, is the
// thing a user recognises — a dwarf against a bugbear is 1.3 m against 2.1 m,
// where "Medium" says nothing. The millimetres the mini prints at are the
// consequence, not the choice, so they go in the tooltip below.
export function slotLabel(size: MiniSize): string {
  if (size === 'custom') return CUSTOM_SIZE_NAME;
  const { realHeight, typical } = HEIGHT_SLOTS[size];
  return `${slotName(size)} · ${realHeight} · ${typical}`;
}

// The geometry the slot resolves to, for the select's title. Derived from the
// table so it cannot drift from what prints.
export function slotGeometryLabel(size: MiniSize): string {
  if (size === 'custom') return 'Base width and figure height set per row';
  return `${resolveBaseWidthMm({ heightSlot: size })} mm base · ${HEIGHT_SLOTS[size].figureHeightMm} mm tall`;
}

export const DEFAULT_CUSTOM_WIDTH_MM = 30;
export const DEFAULT_CUSTOM_HEIGHT_MM = 30;
export const DEFAULT_HEIGHT_SLOT: MiniSize = 'medium';

export function resolveFigureHeightMm(e: Pick<Entry, 'heightSlot' | 'customHeightMm'>): number {
  if (e.heightSlot === 'custom') return validDimension(e.customHeightMm);
  return HEIGHT_SLOTS[e.heightSlot].figureHeightMm;
}

// Resolves the base/footprint width (mm) of an entry: the width the slot's
// category implies, or the user's custom width. Returns 0 when a custom entry
// has no valid width yet, which callers treat as "not packable". Custom stays
// the one escape hatch that names a base width directly — deriving it from the
// custom height would leave no way to set it at all.
export function resolveBaseWidthMm(e: Pick<Entry, 'heightSlot' | 'customWidthMm'>): number {
  if (e.heightSlot === 'custom') return validDimension(e.customWidthMm);
  return CATEGORY_BASE_WIDTH_MM[HEIGHT_SLOTS[e.heightSlot].category];
}

// Resolves both columns for one entry. Returns a zero in either slot when the
// entry is not packable yet; callers check before fitting.
export function resolveSizeDimensionsMm(
  e: Pick<Entry, 'heightSlot' | 'customWidthMm' | 'customHeightMm'>,
): SizeDimensionsMm {
  return { baseWidthMm: resolveBaseWidthMm(e), figureHeightMm: resolveFigureHeightMm(e) };
}

// The dimension rule packing applies, shared so the PDF writer embeds artwork
// for exactly the entries that will be drawn. A custom entry needs both of its
// numbers: the height scales the figure, the width stands it up.
export function hasPackableDimensions(
  e: Pick<Entry, 'heightSlot' | 'customWidthMm' | 'customHeightMm'>,
): boolean {
  const { baseWidthMm, figureHeightMm } = resolveSizeDimensionsMm(e);
  return baseWidthMm > 0 && figureHeightMm > 0;
}

// A figure is never wider than this multiple of the height its slot prints at.
// Height comes from the height slot, so width is the axis that can run away:
// without a cap, a figure spread out sideways would swallow the sheet. Hitting
// the cap scales the whole figure down rather than cropping it, so that mini
// prints short of its slot's height.
//
// The denominator is the slot's height, not the figure's printed one, so this
// does not bound the printed width-to-height ratio and is not meant to: the
// artwork's own proportions are preserved through the scale-down, which is what
// keeps the figure uncropped. A 4:1 Medium prints 52.5 × 13.125 mm — still 4:1.
//
// The cap is measured against the slot's figure height, not the base width, and
// that is load-bearing. A base-width cap contains no slot term — every slot of a
// category shares one base — so a capped figure's height collapsed to the same
// millimetres for every slot of that category, which is exactly the
// dwarf-and-bugbear-print-alike defect #24 exists to remove. Against the
// figure's own height the scale-down is proportional, so the slots stay ordered
// at every aspect ratio.
//
// 1.5 because it sits close to the 1.67 the old base-width cap gave a Medium,
// so the common case barely moves, and it leaves the page real slack: the
// tallest slot's widest figure reserves 111 × 1.5 plus two figure margins,
// against A4's 190 mm of usable width. The page would in fact hold about 1.67
// here — the number is a judgement about how far a figure may spread, not a
// limit the paper forces.
export const MAX_WIDTH_TO_SLOT_HEIGHT = 1.5;

// The one place a height slot becomes millimetres of artwork. Fits a figure to
// its slot's height, letting width follow the artwork's proportions, then scales
// the whole figure down if it passes the width cap. Aspect ratio is preserved
// throughout and nothing is cropped.
export function fitFigure(
  { figureHeightMm }: SizeDimensionsMm,
  imgWidthPx: number,
  imgHeightPx: number,
): FigureFitMm {
  const maxWidthMm = figureHeightMm * MAX_WIDTH_TO_SLOT_HEIGHT;
  const aspect = imgWidthPx / imgHeightPx;
  let imageHeightMm = figureHeightMm;
  let imageWidthMm = aspect * figureHeightMm;
  if (imageWidthMm > maxWidthMm) {
    imageWidthMm = maxWidthMm;
    imageHeightMm = maxWidthMm / aspect;
  }
  return { imageWidthMm, imageHeightMm };
}

function validDimension(value: number | undefined): number {
  return value != null && Number.isFinite(value) && value > 0 ? value : 0;
}
