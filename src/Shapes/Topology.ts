import { Coords } from "../State/Coords";
import { Shape } from "./Shape";
import { hexagonThirds } from "./pentagons";
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
// Odd-r offset: odd rows sit half a cell to the right, which is why the row
// above and below shift with the parity of x. Hexes have no vertex-only
// contact, so these six are both the edge neighbours and the whole
// neighbourhood.
const hexEvenRowOffsets: Offset[] = [
  [-1, -1], [-1, 0],
  [0, -1], [0, 1],
  [1, -1], [1, 0],
];
const hexOddRowOffsets: Offset[] = [
  [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, 0], [1, 1],
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
      coords.x % 2 === 0 ? hexEvenRowOffsets : hexOddRowOffsets
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
export const TILINGS: Partial<Record<Shape, Tiling>> = {
  [Shape.pentagon]: hexagonThirds,
};

const pentagon: Topology = topologyFromTiling(Shape.pentagon, hexagonThirds);

const topologies: Record<Shape, Topology> = {
  [Shape.square]: square,
  [Shape.hex]: hex,
  [Shape.triangle]: triangle,
  [Shape.pentagon]: pentagon,
};

export function topologyFor(shape: Shape): Topology {
  return topologies[shape];
}
