import { Point } from "./Point";

// A tiling described by its geometry rather than by a table of offsets.
//
// The three original shapes carry hand written neighbour tables, which was
// fine when each could be derived on paper and checked by eye. Pentagons
// cannot be: there are fifteen types, several are families rather than single
// shapes, and their primitive units hold up to a dozen cells with vertices
// that meet in ways no one wants to transcribe. So a tiling is given as the
// polygons themselves, and which cells touch which is computed from them.
//
// A tiling repeats a primitive unit of `cells` polygons across a lattice
// spanned by two vectors. Cells are addressed the way the rest of the project
// addresses them, x the row and y the column, by folding the index within the
// unit into the column: y = unitColumn * cells + indexInUnit. That keeps the
// board a rectangular array and leaves Coords, Tile and winLoseCheck alone.
export interface Tiling {
  // How many polygons make up one primitive unit.
  readonly cells: number;
  // Lattice step for one unit across, and one unit down. Neither has to be
  // axis aligned, so a pentagon board comes out sheared rather than square.
  readonly across: Point;
  readonly down: Point;
  // The polygons of one primitive unit, in the same space as the lattice
  // vectors, wound consistently.
  readonly unit: readonly (readonly Point[])[];
}

export interface CellAddress {
  // Lattice position of the unit, and which polygon inside it.
  readonly row: number;
  readonly unitColumn: number;
  readonly index: number;
}

// A neighbour, as a step in lattice space plus which polygon of the unit it
// lands on. This is what a hand written offset table would have held.
export interface UnitOffset {
  readonly dRow: number;
  readonly dUnitColumn: number;
  readonly index: number;
}

export function addressOf(x: number, y: number, tiling: Tiling): CellAddress {
  // Floor division, so negative columns address the unit to the left rather
  // than folding back onto the wrong one.
  const unitColumn = Math.floor(y / tiling.cells);
  const index = y - unitColumn * tiling.cells;
  return { row: x, unitColumn, index };
}

export function columnOf(
  unitColumn: number,
  index: number,
  tiling: Tiling
): number {
  return unitColumn * tiling.cells + index;
}

// Where a cell's polygon sits, in tiling space.
export function polygonAt(
  tiling: Tiling,
  address: CellAddress
): Point[] {
  const ox =
    address.unitColumn * tiling.across.x + address.row * tiling.down.x;
  const oy =
    address.unitColumn * tiling.across.y + address.row * tiling.down.y;
  return tiling.unit[address.index].map((p) => ({ x: p.x + ox, y: p.y + oy }));
}

// Two cells are neighbours when they share at least one point: an edge, or a
// single corner. Minesweeper has always counted a shared corner, which is why
// a square has eight neighbours and not four.
//
// Vertices are compared with a tolerance because the unit polygons are built
// from trigonometry, and two corners that should coincide will differ in the
// last few bits.
const TOUCH_EPSILON = 1e-7;

// Comparing corner against corner is not enough.
//
// It is enough for a tiling that is edge-to-edge, where cells meet corner to
// corner and the first three shapes all do. Most pentagon tilings are not:
// one cell's corner lands part way along another's edge, a T-junction, and
// there no corner coincides with any corner at all. A tiling of houses read
// as degree four that way, when its cells plainly share five edges.
//
// So a corner counts as touching when it lies anywhere on the other outline,
// and both directions are asked, since a T-junction is one-sided.
function onSegment(p: Point, a: Point, b: Point): boolean {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const length = Math.hypot(ex, ey);
  if (length < TOUCH_EPSILON) {
    return Math.hypot(p.x - a.x, p.y - a.y) < TOUCH_EPSILON;
  }
  // Off the line, or past either end.
  const cross = (ex * (p.y - a.y) - ey * (p.x - a.x)) / length;
  if (Math.abs(cross) > TOUCH_EPSILON) {
    return false;
  }
  const along = (ex * (p.x - a.x) + ey * (p.y - a.y)) / length;
  return along >= -TOUCH_EPSILON && along <= length + TOUCH_EPSILON;
}

function onBoundary(p: Point, polygon: readonly Point[]): boolean {
  for (let i = 0; i < polygon.length; i++) {
    if (onSegment(p, polygon[i], polygon[(i + 1) % polygon.length])) {
      return true;
    }
  }
  return false;
}

export function polygonsTouch(
  a: readonly Point[],
  b: readonly Point[]
): boolean {
  return (
    a.some((p) => onBoundary(p, b)) || b.some((q) => onBoundary(q, a))
  );
}

const touches = polygonsTouch;

// The neighbours of each polygon in the unit, as lattice offsets.
//
// Found by walking a window of surrounding units and asking the geometry.
// Two units away is further than any of these tilings reaches, and a cell
// that did reach further would show up as a broken symmetry check rather than
// as a quietly wrong board.
const SEARCH = 2;

export function deriveOffsets(tiling: Tiling): UnitOffset[][] {
  const table: UnitOffset[][] = [];
  for (let index = 0; index < tiling.cells; index++) {
    const self = polygonAt(tiling, { row: 0, unitColumn: 0, index });
    const found: UnitOffset[] = [];
    for (let dRow = -SEARCH; dRow <= SEARCH; dRow++) {
      for (let dUnitColumn = -SEARCH; dUnitColumn <= SEARCH; dUnitColumn++) {
        for (let other = 0; other < tiling.cells; other++) {
          if (dRow === 0 && dUnitColumn === 0 && other === index) {
            continue;
          }
          const candidate = polygonAt(tiling, {
            row: dRow,
            unitColumn: dUnitColumn,
            index: other,
          });
          if (touches(self, candidate)) {
            found.push({ dRow, dUnitColumn, index: other });
          }
        }
      }
    }
    table[index] = found;
  }
  return table;
}

// The bounding box of one primitive unit's polygons, used to size a board.
export function unitBounds(tiling: Tiling): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of tiling.unit) {
    for (const p of polygon) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

// Does this unit actually tile the plane?
//
// The question matters because nothing else catches a mis-specified lattice.
// A triangle unit given the wrong row step derives a symmetric neighbour
// table of the wrong degree, and its polygons still sum to the right area --
// it just leaves gaps and overlaps that no other check looks at. The first
// triangle tiling written here was exactly that.
//
// So: sample the fundamental domain, and require every point to fall inside
// exactly one cell across a window of translates. A gap gives zero, an
// overlap gives two.
export interface TilingCoverage {
  readonly ok: boolean;
  readonly gaps: number;
  readonly overlaps: number;
  readonly samples: number;
}

function inside(point: Point, polygon: readonly Point[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      hit = !hit;
    }
  }
  return hit;
}

export function checkCoverage(
  tiling: Tiling,
  random: () => number = Math.random,
  samples = 4000
): TilingCoverage {
  // Every translate that could reach the fundamental domain.
  const window: CellAddress[] = [];
  for (let row = -SEARCH; row <= SEARCH; row++) {
    for (let unitColumn = -SEARCH; unitColumn <= SEARCH; unitColumn++) {
      for (let index = 0; index < tiling.cells; index++) {
        window.push({ row, unitColumn, index });
      }
    }
  }
  const polygons = window.map((a) => polygonAt(tiling, a));

  let gaps = 0;
  let overlaps = 0;
  for (let n = 0; n < samples; n++) {
    // A random point of the fundamental domain, in lattice coordinates, so
    // the test does not care how the unit is shaped or where it sits.
    const s = random();
    const t = random();
    const point: Point = {
      x: s * tiling.across.x + t * tiling.down.x,
      y: s * tiling.across.y + t * tiling.down.y,
    };
    let covers = 0;
    for (const polygon of polygons) {
      if (inside(point, polygon)) {
        covers++;
      }
    }
    if (covers === 0) {
      gaps++;
    } else if (covers > 1) {
      overlaps++;
    }
  }
  return { ok: gaps === 0 && overlaps === 0, gaps, overlaps, samples };
}

// The area a primitive unit must fill: one fundamental domain of the lattice.
export function fundamentalArea(tiling: Tiling): number {
  return Math.abs(
    tiling.across.x * tiling.down.y - tiling.across.y * tiling.down.x
  );
}

// The same tiling, turned.
//
// Orientation is a presentation choice, not a property of the tiling, and the
// fifteen pentagons will each want a sensible one. Rotating the unit polygons
// and the lattice vectors together keeps the tiling identical -- adjacency,
// coverage and degree are all unchanged, which the checks confirm.
//
// A board stays rectangular only while the lattice stays axis aligned, so
// quarter turns are free and anything else wants a fresh basis.
export function rotateTiling(tiling: Tiling, radians: number): Tiling {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const turn = (p: Point): Point => ({
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  });
  let across = turn(tiling.across);
  let down = turn(tiling.down);
  // A quarter turn swaps which vector is the horizontal one. Put them back
  // the way round the board expects, so rows still run across the screen.
  if (Math.abs(across.x) < Math.abs(down.x)) {
    const swap = across;
    across = down;
    down = swap;
  }
  // Keep both pointing the way a board grows: right, and down the screen.
  if (across.x < 0) {
    across = { x: -across.x, y: -across.y };
  }
  if (down.y < 0) {
    down = { x: -down.x, y: -down.y };
  }
  return {
    cells: tiling.cells,
    across,
    down,
    unit: tiling.unit.map((polygon) => polygon.map(turn)),
  };
}
