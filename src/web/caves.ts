import { TileGridInformation } from "../TileGridGeneration/TileGridInformation";

// Width is the row count and Height the column count, as everywhere else. The
// caves are wider than they are tall because a browser window is, and small is
// the default so the board fits a phone without scrolling.
export const CAVES = {
  small: new TileGridInformation(10, 14, 16),
  medium: new TileGridInformation(14, 20, 40),
  large: new TileGridInformation(18, 28, 90),
} as const;

export type CaveName = keyof typeof CAVES;

export const DEFAULT_CAVE: CaveName = "small";

export function isCaveName(value: string): value is CaveName {
  return Object.prototype.hasOwnProperty.call(CAVES, value);
}
