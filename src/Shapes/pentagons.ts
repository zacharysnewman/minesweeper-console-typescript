import { Point } from "./geometry";
import { pairedPentagonTiling, rotateTiling, Tiling } from "./Tiling";

// Pentagon tilings, as geometry.
//
// Fifteen types of convex pentagon tile the plane; the classification was
// finished in 2017 and there is no sixteenth. Most of the fifteen are families
// rather than single shapes, so supporting a "type" means choosing one
// instance of it.
//
// These were built as constructions rather than read off the classification,
// but they no longer have to be taken on trust: pentagonTypes.ts carries the
// fifteen sets of conditions, and shapes:check measures each pentagon here
// and reports which types it satisfies. All three turn out to be canonical.

const P = (x: number, y: number): Point => ({ x, y });
const ROOT3 = Math.sqrt(3);

// A regular hexagon, circumradius 1, flat-topped.
const corner = (k: number): Point => {
  const angle = (Math.PI / 180) * (60 * k);
  return P(Math.cos(angle), Math.sin(angle));
};
const midpoint = (k: number): Point => {
  const a = corner(k);
  const b = corner((k + 1) % 6);
  return P((a.x + b.x) / 2, (a.y + b.y) / 2);
};

// The three pentagons of one hexagon, centred on the origin.
const third = (a: number, b: number, c: number, d: number): Point[] => [
  P(0, 0),
  midpoint(a),
  corner(b),
  corner(c),
  midpoint(d),
];

const shift = (polygon: Point[], dx: number, dy: number): Point[] =>
  polygon.map((p) => P(p.x + dx, p.y + dy));

// Hexagon thirds -- type 3, whose primitive unit the article gives as three
// tiles, which is exactly the three pentagons of one hexagon.
//
// A regular hexagon divides into three congruent convex pentagons: from the
// centre out to an edge midpoint, around two corners, and back to the next
// midpoint but one. Because hexagons tile, so does this, and it needs no
// appeal to the classification to be sure of -- the construction is the
// proof, and the checks confirm the pieces partition the hexagons exactly.
//
// The unit is two hexagons, not one, which is what keeps the lattice square.
// Hexagon centres sit at (1.5i, sqrt(3)j + i*sqrt(3)/2), so stepping one
// hexagon across also steps half a hexagon down, and a board indexed on that
// basis comes out as a long diagonal with a mostly empty bounding box. Taking
// every second column instead gives the basis (3, 0) and (0, sqrt(3)) -- the
// same set of hexagons, addressed so that a rectangle of cells draws as a
// rectangle.
const hexagonThirdsUpright: Tiling = {
  cells: 6,
  across: P(3, 0),
  down: P(0, ROOT3),
  unit: [
    third(5, 0, 1, 1),
    third(1, 2, 3, 3),
    third(3, 4, 5, 5),
    shift(third(5, 0, 1, 1), 1.5, ROOT3 / 2),
    shift(third(1, 2, 3, 3), 1.5, ROOT3 / 2),
    shift(third(3, 4, 5, 5), 1.5, ROOT3 / 2),
  ],
};

// Turned half a turn, so the wide pentagon of each hexagon sits at the top
// with its long edge horizontal rather than at the bottom. Only one of the
// three can have a horizontal edge -- they are 120 degree rotations of each
// other -- so this is a choice about which way that one faces, and facing up
// reads the way the triangles do. A half turn keeps the lattice axis aligned,
// so the board stays rectangular; a sixth or a twelfth of a turn would shear
// it.
export const hexagonThirds: Tiling = rotateTiling(
  hexagonThirdsUpright,
  Math.PI
);

// Hexagon halves -- type 1.
//
// Any hexagon with a centre of symmetry, cut straight from one edge midpoint
// to the opposite one, falls into two congruent pentagons -- the cut takes
// two corners off each side and leaves five. Centrally symmetric hexagons
// tile, so these do. Seven neighbours each.
const halfA: Point[] = [
  midpoint(0),
  corner(1),
  corner(2),
  corner(3),
  midpoint(3),
];
const halfB: Point[] = [
  midpoint(3),
  corner(4),
  corner(5),
  corner(0),
  midpoint(0),
];

export const hexagonHalves: Tiling = rotateTiling(
  {
    cells: 4,
    across: P(3, 0),
    down: P(0, ROOT3),
    unit: [
      halfA,
      halfB,
      shift(halfA, 1.5, ROOT3 / 2),
      shift(halfB, 1.5, ROOT3 / 2),
    ],
  },
  Math.PI
);

// House rows -- types 1 and 4.
//
// A pentagon shaped like a house, in rows, with every other one turned over
// so its point drops into the notch between two roofs. Its two upright sides
// are parallel, which is the condition the simplest family of the fifteen is
// named for.
//
// This one is not edge-to-edge: a roof meets two different neighbours along
// its length, and the corners do not line up. That is what made it worth
// having here -- it was this tiling that showed the adjacency was only
// comparing corner against corner, and reading as degree four when its cells
// share five edges.
export const houseRows: Tiling = {
  cells: 2,
  across: P(1, 0),
  down: P(0, 2.5),
  unit: [
    [P(0.5, 0), P(1, 0.5), P(1, 1.5), P(0, 1.5), P(0, 0.5)],
    [P(1, 0.5), P(1.5, 0), P(1.5, -1), P(0.5, -1), P(0.5, 0)],
  ],
};

// A peaked slab -- type 1, and built by the general route rather than by
// hand: any pentagon with two adjacent angles summing to 180 pairs with its
// own half turn into a centrally symmetric hexagon, and those always tile.
// This one's 90 and 90 at the base do it.
//
// Seven neighbours, and four cells to a unit once the lattice has been
// squared up, since the natural one leans by half a step per row.
export const pairedSlab: Tiling = pairedPentagonTiling([
  P(0, 0),
  P(4, 0),
  P(4, 1),
  P(2, 3),
  P(0, 1),
]) as Tiling;

export const pentagonTilings: { name: string; tiling: Tiling }[] = [
  { name: "hexagon thirds", tiling: hexagonThirds },
  { name: "hexagon halves", tiling: hexagonHalves },
  { name: "house rows", tiling: houseRows },
  { name: "paired slab", tiling: pairedSlab },
];
