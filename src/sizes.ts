import type { DnDPresetSize, DnDSize, Entry } from './types';

export type SizeDimensionsMm = { baseWidthMm: number; figureHeightMm: number };
export type FigureFitMm = { imageWidthMm: number; imageHeightMm: number };

// ADR-0002: the two columns are tuned independently because the rules derive
// neither. A creature's space is the area it controls in combat, explicitly not
// its physical size, and no creature height appears in the rules at all.
export const SIZE_DIMENSIONS_MM: Record<DnDPresetSize, SizeDimensionsMm> = {
  tiny: { baseWidthMm: 20, figureHeightMm: 24 },
  small: { baseWidthMm: 25, figureHeightMm: 25 },
  medium: { baseWidthMm: 25, figureHeightMm: 30 },
  large: { baseWidthMm: 37, figureHeightMm: 44 },
  huge: { baseWidthMm: 50, figureHeightMm: 60 },
  gargantuan: { baseWidthMm: 75, figureHeightMm: 90 },
};

export const SIZE_NAMES: Record<DnDSize, string> = {
  tiny: 'Tiny',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  huge: 'Huge',
  gargantuan: 'Gargantuan',
  custom: 'Custom…',
};

// A dropdown option quotes both numbers, so it says what the mini will do:
// stand this tall on a base this wide. Derived from the table above so the
// label cannot drift from the geometry.
export function sizeLabel(size: DnDSize): string {
  if (size === 'custom') return SIZE_NAMES.custom;
  const { baseWidthMm, figureHeightMm } = SIZE_DIMENSIONS_MM[size];
  return `${SIZE_NAMES[size]} (${baseWidthMm} mm base / ${figureHeightMm} mm tall)`;
}

export const DEFAULT_CUSTOM_WIDTH_MM = 30;
export const DEFAULT_CUSTOM_HEIGHT_MM = 30;

export function resolveFigureHeightMm(e: Pick<Entry, 'size' | 'customHeightMm'>): number {
  if (e.size === 'custom') return validDimension(e.customHeightMm);
  return SIZE_DIMENSIONS_MM[e.size].figureHeightMm;
}

// Resolves the base/footprint width (mm) of an entry: the preset width for a
// D&D size, or the user's custom width. Returns 0 when a custom entry has no
// valid width yet, which callers treat as "not packable".
export function resolveBaseWidthMm(e: Pick<Entry, 'size' | 'customWidthMm'>): number {
  if (e.size === 'custom') return validDimension(e.customWidthMm);
  return SIZE_DIMENSIONS_MM[e.size].baseWidthMm;
}

// Resolves both columns for one entry. Returns a zero in either slot when the
// entry is not packable yet; callers check before fitting.
export function resolveSizeDimensionsMm(
  e: Pick<Entry, 'size' | 'customWidthMm' | 'customHeightMm'>,
): SizeDimensionsMm {
  return { baseWidthMm: resolveBaseWidthMm(e), figureHeightMm: resolveFigureHeightMm(e) };
}

// The dimension rule packing applies, shared so the PDF writer embeds artwork
// for exactly the entries that will be drawn. A custom entry needs both of its
// numbers: the height scales the figure, the width stands it up.
export function hasPackableDimensions(
  e: Pick<Entry, 'size' | 'customWidthMm' | 'customHeightMm'>,
): boolean {
  const { baseWidthMm, figureHeightMm } = resolveSizeDimensionsMm(e);
  return baseWidthMm > 0 && figureHeightMm > 0;
}

// A figure is capped at this multiple of its base width. Height comes from the
// size category, so width is the axis that can run away: without a cap, a
// figure spread out sideways would swallow the sheet. Hitting the cap scales
// the whole figure down rather than cropping it, so that mini prints a little
// short.
export const MAX_WIDTH_RATIO = 2;

// The one place a size category becomes millimetres of artwork. Fits a figure
// to its category's height, letting width follow the artwork's proportions,
// then scales the whole figure down if it passes the width cap. Aspect ratio is
// preserved throughout and nothing is cropped.
export function fitFigure(
  { baseWidthMm, figureHeightMm }: SizeDimensionsMm,
  imgWidthPx: number,
  imgHeightPx: number,
): FigureFitMm {
  const maxWidthMm = baseWidthMm * MAX_WIDTH_RATIO;
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
