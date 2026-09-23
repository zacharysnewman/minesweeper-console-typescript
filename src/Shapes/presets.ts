import { BoardInfo } from "./BoardInfo";
import { Shape } from "./Shape";

// Board sizes per shape.
//
// Two things have to be re-derived when the tiling changes:
//
// Density. How hard a board reads comes from the mean nearby-bomb count, which
// is density x degree. Classic expert is 99 bombs in 480 square cells: 20.6%
// against 8 neighbours, a mean clue of 1.65. Holding that mean fixed means
// scaling density by 1/degree, so hex boards want more bombs and triangle
// boards fewer. (Hex expert lands at 27.5% -- the same mean clue, but far more
// flags to place. That is inherent to the shape, not a tuning mistake.)
//
// Proportion. A triangle advances only half a cell per column, so a triangle
// board is about half as wide as a square board with the same column count.
// The triangle presets double the columns to come out a comparable shape on
// screen.
//
// The bomb counts fall out identical across the three shapes, which is a
// consequence of scaling cells and density by reciprocal factors rather than
// something aimed at.
export const PRESETS: Record<Shape, Record<string, BoardInfo>> = {
  [Shape.square]: {
    beginner: new BoardInfo(9, 9, 10, Shape.square),
    intermediate: new BoardInfo(16, 16, 40, Shape.square),
    expert: new BoardInfo(16, 30, 99, Shape.square),
  },
  [Shape.hex]: {
    beginner: new BoardInfo(9, 9, 13, Shape.hex),
    intermediate: new BoardInfo(16, 16, 53, Shape.hex),
    expert: new BoardInfo(16, 30, 132, Shape.hex),
  },
  [Shape.triangle]: {
    beginner: new BoardInfo(9, 18, 13, Shape.triangle),
    intermediate: new BoardInfo(16, 32, 53, Shape.triangle),
    expert: new BoardInfo(16, 60, 132, Shape.triangle),
  },
  // Pentagons come six to a primitive unit and the unit is two hexagons wide,
  // so a column is a third the width of a row is tall. The columns are chosen
  // to come out roughly square on screen, and every one of them is a multiple
  // of six because a board cannot hold part of a unit.
  [Shape.pentagonThirds]: {
    beginner: new BoardInfo(6, 18, 18, Shape.pentagonThirds),
    intermediate: new BoardInfo(9, 30, 56, Shape.pentagonThirds),
    expert: new BoardInfo(12, 42, 139, Shape.pentagonThirds),
  },
  // Seven neighbours, so it wants fewer mines than the six-neighbour boards
  // for the same mean clue. Columns come in fours.
  [Shape.pentagonHalves]: {
    beginner: new BoardInfo(8, 20, 23, Shape.pentagonHalves),
    intermediate: new BoardInfo(12, 28, 60, Shape.pentagonHalves),
    expert: new BoardInfo(16, 36, 136, Shape.pentagonHalves),
  },
  // A row of houses is only a cell tall and a cell and a half wide, so these
  // are wide and short in cells to come out square on screen.
  [Shape.pentagonHouses]: {
    beginner: new BoardInfo(4, 20, 13, Shape.pentagonHouses),
    intermediate: new BoardInfo(6, 30, 37, Shape.pentagonHouses),
    expert: new BoardInfo(8, 40, 88, Shape.pentagonHouses),
  },
};

export const PRESET_NAMES = ["beginner", "intermediate", "expert"];

export const DEFAULT_PRESET = "beginner";

export function presetFor(shape: Shape, name: string): BoardInfo {
  const forShape = PRESETS[shape];
  return Object.prototype.hasOwnProperty.call(forShape, name)
    ? forShape[name]
    : forShape[DEFAULT_PRESET];
}
