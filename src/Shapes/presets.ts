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
  // A slab is one unit wide and eight tall, so these run very wide in cells
  // to come out square on screen. Seven neighbours, columns in fours.
  [Shape.pentagonSlab]: {
    beginner: new BoardInfo(6, 48, 41, Shape.pentagonSlab),
    intermediate: new BoardInfo(8, 64, 91, Shape.pentagonSlab),
    expert: new BoardInfo(10, 80, 189, Shape.pentagonSlab),
  },
  // Type 4's lattice is square -- four cells in a box as wide as it is tall
  // -- so a board that is square on screen has four times as many columns as
  // rows. Seven neighbours, like the halves and the slab.
  [Shape.pentagonEars]: {
    beginner: new BoardInfo(6, 24, 20, Shape.pentagonEars),
    intermediate: new BoardInfo(8, 32, 46, Shape.pentagonEars),
    expert: new BoardInfo(11, 44, 114, Shape.pentagonEars),
  },
  // Type 5 packs twelve cells into a unit barely wider than it is tall, so a
  // column of the array covers a twelfth of that width and the boards run
  // very wide indeed: about twenty-one columns per row to square up.
  //
  // Squaring type 5's lattice takes two rows of six stacked into the unit,
  // because the natural basis turns by a sixth and leans. That drift is
  // invisible in the middle of a board and shows at its edges, so these keep
  // at least four rows: at three the ragged fringe was most of the board and
  // it read as a leaning parallelogram rather than a tiling.
  //
  // Eight neighbours, the same as a square, so these are the classic
  // densities unscaled -- and expert comes out at exactly 99 mines in 480
  // cells, which is classic expert in another shape.
  [Shape.pentagonFan]: {
    beginner: new BoardInfo(4, 72, 35, Shape.pentagonFan),
    intermediate: new BoardInfo(4, 84, 52, Shape.pentagonFan),
    expert: new BoardInfo(5, 96, 99, Shape.pentagonFan),
  },
  // Type 2's unit is nearly twice as tall as it is wide, so a board that is
  // square on screen runs about seven columns per row. Seven neighbours.
  [Shape.pentagonGlide]: {
    beginner: new BoardInfo(5, 36, 25, Shape.pentagonGlide),
    intermediate: new BoardInfo(6, 44, 47, Shape.pentagonGlide),
    expert: new BoardInfo(8, 56, 105, Shape.pentagonGlide),
  },
  // Type 6's lattice leans: its row step carries a third of a column
  // sideways, and the drift is not a simple enough fraction for squareUp to
  // stack it away, so the board is a parallelogram rather than a rectangle.
  // Seven neighbours.
  [Shape.pentagonPairs]: {
    beginner: new BoardInfo(6, 32, 27, Shape.pentagonPairs),
    intermediate: new BoardInfo(8, 40, 57, Shape.pentagonPairs),
    expert: new BoardInfo(10, 52, 122, Shape.pentagonPairs),
  },
  // The six found by laying a patch rather than by turning copies. Columns
  // are always a multiple of the unit's cell count, since a board cannot hold
  // part of a unit, and the row-to-column ratio comes from the unit's own box
  // so each comes out roughly square on screen. Seven neighbours except type
  // 15, which has eight and so takes the classic densities unscaled.
  [Shape.pentagonType7]: {
    beginner: new BoardInfo(4, 48, 27, Shape.pentagonType7),
    intermediate: new BoardInfo(5, 56, 50, Shape.pentagonType7),
    expert: new BoardInfo(6, 72, 102, Shape.pentagonType7),
  },
  [Shape.pentagonType8]: {
    beginner: new BoardInfo(4, 40, 23, Shape.pentagonType8),
    intermediate: new BoardInfo(5, 56, 50, Shape.pentagonType8),
    expert: new BoardInfo(7, 72, 118, Shape.pentagonType8),
  },
  [Shape.pentagonType9]: {
    beginner: new BoardInfo(3, 48, 20, Shape.pentagonType9),
    intermediate: new BoardInfo(4, 56, 40, Shape.pentagonType9),
    expert: new BoardInfo(6, 88, 124, Shape.pentagonType9),
  },
  // Six cells to a unit rather than eight, and the one lattice here that
  // leans -- its rows carry a quarter of a column sideways.
  [Shape.pentagonType10]: {
    beginner: new BoardInfo(5, 30, 21, Shape.pentagonType10),
    intermediate: new BoardInfo(7, 48, 60, Shape.pentagonType10),
    expert: new BoardInfo(9, 60, 127, Shape.pentagonType10),
  },
  // A unit a third as wide as it is tall, so these run twenty-four columns
  // to the row.
  [Shape.pentagonType13]: {
    beginner: new BoardInfo(3, 72, 30, Shape.pentagonType13),
    intermediate: new BoardInfo(4, 96, 68, Shape.pentagonType13),
    expert: new BoardInfo(5, 120, 141, Shape.pentagonType13),
  },
  // Twelve cells in a unit barely a quarter as wide as it is tall: about
  // forty-nine columns to the row, the widest board here by far.
  [Shape.pentagonType15]: {
    beginner: new BoardInfo(3, 96, 35, Shape.pentagonType15),
    intermediate: new BoardInfo(3, 144, 67, Shape.pentagonType15),
    expert: new BoardInfo(3, 192, 119, Shape.pentagonType15),
  },
  // The last three, all needing a corner-anchored placement to reach. Seven
  // neighbours, except type 12 which has six -- the same as a hexagon, and
  // the only one of the later types with as few, so it takes the hex
  // densities.
  [Shape.pentagonType11]: {
    beginner: new BoardInfo(5, 40, 28, Shape.pentagonType11),
    intermediate: new BoardInfo(6, 56, 60, Shape.pentagonType11),
    expert: new BoardInfo(7, 64, 105, Shape.pentagonType11),
  },
  [Shape.pentagonType12]: {
    beginner: new BoardInfo(5, 40, 33, Shape.pentagonType12),
    intermediate: new BoardInfo(6, 56, 70, Shape.pentagonType12),
    expert: new BoardInfo(7, 64, 123, Shape.pentagonType12),
  },
  // Its lattice leans: a row carries two fifths of a column sideways.
  [Shape.pentagonType14]: {
    beginner: new BoardInfo(6, 30, 25, Shape.pentagonType14),
    intermediate: new BoardInfo(8, 42, 60, Shape.pentagonType14),
    expert: new BoardInfo(10, 48, 113, Shape.pentagonType14),
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
