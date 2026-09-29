import type { DnDPresetSize, DnDSize, Entry, SizingModel } from './types';

export type SizeDimensionsMm = { baseWidthMm: number; figureHeightMm: number };
export type FigureFitMm = { imageWidthMm: number; imageHeightMm: number };

// ADR-0002: independently tuned dimensions for the height-driven model.
export const SIZE_DIMENSIONS_MM: Record<DnDPresetSize, SizeDimensionsMm> = {
  tiny: { baseWidthMm: 20, figureHeightMm: 24 },
  small: { baseWidthMm: 25, figureHeightMm: 25 },
  medium: { baseWidthMm: 25, figureHeightMm: 30 },
  large: { baseWidthMm: 37, figureHeightMm: 44 },
  huge: { baseWidthMm: 50, figureHeightMm: 60 },
  gargantuan: { baseWidthMm: 75, figureHeightMm: 90 },
};

// Legacy widths remain the default until the comparison is complete (#19).
export const SIZE_WIDTH_MM: Record<DnDPresetSize, number> = {
  tiny: 12.5,
  small: 25,
  medium: 25,
  large: 50,
  huge: 75,
  gargantuan: 100,
};

export const SIZE_LABELS: Record<DnDSize, string> = {
  tiny: 'Tiny (12.5 mm)',
  small: 'Small (25 mm)',
  medium: 'Medium (25 mm)',
  large: 'Large (50 mm)',
  huge: 'Huge (75 mm)',
  gargantuan: 'Gargantuan (100 mm)',
  custom: 'Custom…',
};

export const DEFAULT_CUSTOM_WIDTH_MM = 30;
export const DEFAULT_CUSTOM_HEIGHT_MM = 30;

export function resolveFigureHeightMm(e: Pick<Entry, 'size' | 'customHeightMm'>): number {
  if (e.size === 'custom') return validDimension(e.customHeightMm);
  return SIZE_DIMENSIONS_MM[e.size].figureHeightMm;
}

// Resolves the base/footprint width (mm) of an entry: the preset width for a
// D&D size, or the user's custom width. Returns 0 when a custom entry has no
// valid width yet, which callers treat as "not packable".
export function resolveBaseWidthMm(e: Pick<Entry, 'size' | 'customWidthMm'>, model: SizingModel = 'width'): number {
  if (e.size === 'custom') return validDimension(e.customWidthMm);
  return model === 'height' ? SIZE_DIMENSIONS_MM[e.size].baseWidthMm : SIZE_WIDTH_MM[e.size];
}

// Resolves both columns for one entry under one model. Returns a zero in
// either slot when the entry is not packable yet; callers check before fitting.
export function resolveSizeDimensionsMm(
  e: Pick<Entry, 'size' | 'customWidthMm' | 'customHeightMm'>,
  model: SizingModel = 'width',
): SizeDimensionsMm {
  return {
    baseWidthMm: resolveBaseWidthMm(e, model),
    // The height column has no meaning under the width model, where the figure
    // is scaled from the base width alone.
    figureHeightMm: model === 'height' ? resolveFigureHeightMm(e) : 0,
  };
}

// The dimension rule packing applies, shared so the PDF writer embeds artwork
// for exactly the entries that will be drawn. A custom entry needs both of its
// numbers before the height model can size it.
export function hasPackableDimensions(
  e: Pick<Entry, 'size' | 'customWidthMm' | 'customHeightMm'>,
  model: SizingModel = 'width',
): boolean {
  const { baseWidthMm, figureHeightMm } = resolveSizeDimensionsMm(e, model);
  return baseWidthMm > 0 && (model !== 'height' || figureHeightMm > 0);
}

function validDimension(value: number | undefined): number {
  return value != null && Number.isFinite(value) && value > 0 ? value : 0;
}

// A mini's image height is capped at this multiple of its base width. The base
// width is the grid footprint and is fixed by the size category; without a cap,
// a tall image scaled to that width grows unbounded in height, so a Small
// creature with a portrait can tower over a Large one with a landscape image.
// Tying the cap to base width keeps the height monotonic with size: a larger
// base always permits a taller figure.
export const MAX_HEIGHT_RATIO = 1.5;

// A figure is capped at this multiple of its base width. Under the
// height-driven model the runaway axis is width, the mirror of what
// MAX_HEIGHT_RATIO guards: without a cap, a figure spread out sideways would
// swallow the sheet. Hitting the cap scales the whole figure down rather than
// cropping it, so that mini prints a little short.
export const MAX_WIDTH_RATIO = 2;

// The one place the height-versus-width decision lives. Callers resolve both
// dimensions and the model, and never branch on the model themselves.
// Remove the model parameter with the losing branch in #19.
export function fitFigure(
  dimensions: SizeDimensionsMm,
  imgWidthPx: number,
  imgHeightPx: number,
  model: SizingModel = 'width',
): FigureFitMm {
  return model === 'height'
    ? fitFigureHeight(dimensions, imgWidthPx, imgHeightPx)
    : fitImageBox(dimensions.baseWidthMm, imgWidthPx, imgHeightPx);
}

// Fits a figure to its category's height, letting width follow the artwork's
// proportions, then scales the whole figure down if it passes the width cap.
// Aspect ratio is preserved throughout and nothing is cropped.
function fitFigureHeight(
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

// Fits an image inside the per-size box (baseWidth × baseWidth*MAX_HEIGHT_RATIO),
// preserving aspect ratio. Wide/short images fill the full base width. Tall
// images are clamped to the max height and become narrower than the base (the
// caller centers them horizontally over the footprint). No cropping.
// Legacy width-driven model; #19 removes it with the switch.
export function fitImageBox(
  baseWidthMm: number,
  imgWidthPx: number,
  imgHeightPx: number,
): FigureFitMm {
  const maxHeightMm = baseWidthMm * MAX_HEIGHT_RATIO;
  const aspect = imgHeightPx / imgWidthPx;
  let imageWidthMm = baseWidthMm;
  let imageHeightMm = aspect * baseWidthMm;
  if (imageHeightMm > maxHeightMm) {
    imageHeightMm = maxHeightMm;
    imageWidthMm = maxHeightMm / aspect;
  }
  return { imageWidthMm, imageHeightMm };
}
