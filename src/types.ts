export type DnDPresetSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
export type DnDSize = DnDPresetSize | 'custom';

export type Entry = {
  image: File | null;
  artwork: PreparedArtwork | null;
  normalizationWarning?: string;
  size: DnDSize;
  customWidthMm?: number;
  count: number;
};

export type PreparedArtwork = {
  readonly bytes: Uint8Array;
  readonly format: 'png' | 'jpg';
  readonly width: number; // pixels in the prepared bytes
  readonly height: number;
};

// Geometry-only input keeps packing independent of image preparation.
export type PackingEntry = Pick<Entry, 'size' | 'customWidthMm' | 'count'> & {
  naturalWidth?: number;
  naturalHeight?: number;
};
