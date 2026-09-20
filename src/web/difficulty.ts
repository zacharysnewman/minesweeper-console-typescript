import { TileGridInformation } from "../TileGridGeneration/TileGridInformation";

// The board loops treat x as the row and y as the column, so Width is the row
// count and Height the column count. Expert is therefore 16 rows of 30.
export const DIFFICULTIES = {
  beginner: new TileGridInformation(9, 9, 10),
  intermediate: new TileGridInformation(16, 16, 40),
  expert: new TileGridInformation(16, 30, 99),
} as const;

export type DifficultyName = keyof typeof DIFFICULTIES;

export const DEFAULT_DIFFICULTY: DifficultyName = "beginner";

export function isDifficultyName(value: string): value is DifficultyName {
  return Object.prototype.hasOwnProperty.call(DIFFICULTIES, value);
}
