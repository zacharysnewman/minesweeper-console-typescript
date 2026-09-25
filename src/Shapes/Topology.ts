import { Coords } from "../State/Coords";
import { Shape } from "./Shape";
import {
  hexagonHalves,
  hexagonThirds,
  houseRows,
  pairedSlab,
  type10,
  type11,
  type12,
  type13,
  type14,
  type15,
  type2Glide,
  type4Ears,
  type5Fan,
  type6Pairs,
  type7,
  type8,
  type9,
} from "./pentagons";
import { addressOf, columnOf, deriveOffsets, Tiling } from "./Tiling";

// A tiling's adjacency, and nothing else.
//
// All three shapes store in the same rectangular rows x cols array, so
// enumerating the cells and bounds checking them are shape independent and
// live on Board. The only thing that varies between a square board, a hex
// board and a triangle board is which coordinates touch which -- so that is
// the whole of this interface, and the whole of the seam the rules are written
// against.
export interface Topology {
  readonly shape: Shape;
  // The most neighbours any cell has: 8, 6 or 12 for the first three. Kept as
  // the maximum rather than the count, because a tiling whose primitive unit
  // holds several different pentagons need not give them all the same number.
  readonly degree: number;
  // How many neighbours this particular cell has, away from the edges.
  degreeAt(coords: Coords): number;
  // Every coordinate touching this one. Some may be off the board; Board
  // filters them, the way Mining's step() leaves bounds to its caller.
  neighbours(coords: Coords): Coords[];
}

// x is the row and y the column, matching the rest of the project.
type Offset = [number, number];

function offsetsToCoords(coords: Coords, offsets: Offset[]): Coords[] {
  return offsets.map(([dx, dy]) => new Coords(coords.x + dx, coords.y + dy));
}

// --- square: 8 --------------------------------------------------------------
// Every cell that shares an edge or a corner. This is the classic rule.
const squareOffsets: Offset[] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

// --- hex: 6 -----------------------------------------------------------------
// Flat-top hexes in odd-q offset: odd columns sit half a cell down, which is
// why the columns either side shift with the parity of y. Hexes have no
// vertex-only contact, so these six are both the edge neighbours and the
// whole neighbourhood.
const hexEvenColumnOffsets: Offset[] = [
  [-1, -1], [0, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1],
];
const hexOddColumnOffsets: Offset[] = [
  [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [0, 1], [1, 1],
];

// --- triangle: 12 -----------------------------------------------------------
// Rows of triangles alternating point-up and point-down; (x + y) even is
// up-pointing. Six triangles meet at every vertex, so a cell touches
// 3 vertices x 5 others = 15, less the 3 edge neighbours counted twice = 12.
//
// An up-pointing cell reaches three cells in the row above (they meet only at
// its apex), four in its own row, and five in the row below (its whole base
// edge lies on that boundary). A down-pointing cell is the vertical mirror.
const triangleUpOffsets: Offset[] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -2], [0, -1], [0, 1], [0, 2],
  [1, -2], [1, -1], [1, 0], [1, 1], [1, 2],
];
const triangleDownOffsets: Offset[] = [
  [-1, -2], [-1, -1], [-1, 0], [-1, 1], [-1, 2],
  [0, -2], [0, -1], [0, 1], [0, 2],
  [1, -1], [1, 0], [1, 1],
];

// True when the triangle at these coordinates points up.
export function pointsUp(coords: Coords): boolean {
  return (coords.x + coords.y) % 2 === 0;
}

const square: Topology = {
  shape: Shape.square,
  degree: 8,
  degreeAt: () => 8,
  neighbours: (coords) => offsetsToCoords(coords, squareOffsets),
};

const hex: Topology = {
  shape: Shape.hex,
  degree: 6,
  degreeAt: () => 6,
  neighbours: (coords) =>
    offsetsToCoords(
      coords,
      coords.y % 2 === 0 ? hexEvenColumnOffsets : hexOddColumnOffsets
    ),
};

const triangle: Topology = {
  shape: Shape.triangle,
  degree: 12,
  degreeAt: () => 12,
  neighbours: (coords) =>
    offsetsToCoords(
      coords,
      pointsUp(coords) ? triangleUpOffsets : triangleDownOffsets
    ),
};

// A topology whose neighbour table was computed from the tiling's geometry
// rather than written out. The derivation runs once, here, and what it
// produces is the same kind of offset table the three above carry by hand.
export function topologyFromTiling(shape: Shape, tiling: Tiling): Topology {
  const offsets = deriveOffsets(tiling);
  const degrees = offsets.map((row) => row.length);
  return {
    shape,
    degree: Math.max(...degrees),
    degreeAt: (coords) => degrees[addressOf(coords.x, coords.y, tiling).index],
    neighbours: (coords) => {
      const at = addressOf(coords.x, coords.y, tiling);
      return offsets[at.index].map(
        (o) =>
          new Coords(
            at.row + o.dRow,
            columnOf(at.unitColumn + o.dUnitColumn, o.index, tiling)
          )
      );
    },
  };
}

// The tilings that are given as geometry instead of as an offset table.
//
// Thunks, not tilings: building one means solving a pentagon and replaying
// how its copies were laid, and a page plays one shape at a time. Asking for
// all of them at import cost most of a second before anything was drawn.
const TILING_BUILDERS: Partial<Record<Shape, () => Tiling>> = {
  [Shape.pentagonThirds]: () => hexagonThirds,
  [Shape.pentagonHalves]: () => hexagonHalves,
  [Shape.pentagonHouses]: () => houseRows,
  [Shape.pentagonSlab]: () => pairedSlab,
  [Shape.pentagonEars]: type4Ears,
  [Shape.pentagonFan]: type5Fan,
  [Shape.pentagonGlide]: type2Glide,
  [Shape.pentagonPairs]: type6Pairs,
  [Shape.pentagonType7]: type7,
  [Shape.pentagonType8]: type8,
  [Shape.pentagonType9]: type9,
  [Shape.pentagonType10]: type10,
  [Shape.pentagonType13]: type13,
  [Shape.pentagonType15]: type15,
  [Shape.pentagonType11]: type11,
  [Shape.pentagonType12]: type12,
  [Shape.pentagonType14]: type14,
};

const tilings = new Map<Shape, Tiling>();

export function tilingFor(shape: Shape): Tiling | undefined {
  const already = tilings.get(shape);
  if (already !== undefined) return already;
  const build = TILING_BUILDERS[shape];
  if (build === undefined) return undefined;
  const tiling = build();
  tilings.set(shape, tiling);
  return tiling;
}

// Hand tables for the first three; everything else is derived from its
// tiling the first time that shape is played.
const handmade: Partial<Record<Shape, Topology>> = {
  [Shape.square]: square,
  [Shape.hex]: hex,
  [Shape.triangle]: triangle,
};

const derived = new Map<Shape, Topology>();

export function topologyFor(shape: Shape): Topology {
  const hand = handmade[shape];
  if (hand !== undefined) return hand;
  const already = derived.get(shape);
  if (already !== undefined) return already;
  const tiling = tilingFor(shape);
  if (tiling === undefined) {
    throw new Error(`no topology for shape ${shape}`);
  }
  const topology = topologyFromTiling(shape, tiling);
  derived.set(shape, topology);
  return topology;
}
