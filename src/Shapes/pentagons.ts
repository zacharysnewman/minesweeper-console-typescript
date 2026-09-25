import { Point } from "./geometry";
import { pairedPentagonTiling, rotateTiling, Tiling } from "./Tiling";
import { buildArrangement, Recipe } from "./arrange";
import { solvePentagon, Spec } from "./pentagonShapes";

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

// Two more, built the other way round.
//
// The four above were constructed -- a hexagon cut up, a pentagon paired with
// its own half turn -- and then measured to see which of the fifteen types
// they turned out to be. These two start from the type instead: its
// conditions say what shape the pentagon is, pentagonShapes solves for one,
// and arrange.ts searches for how the copies sit. Neither the shape nor the
// arrangement is written down here, which is the point: a transcription can
// be wrong in a way that still looks like a pentagon, and a solved one
// cannot.
//
// What is written down is the recipe the search found, because searching
// takes seconds and replaying takes milliseconds. shapes:check runs the
// search again and fails if the recipe is no longer what it finds.
function fromType(spec: Spec, recipe: Recipe): Tiling {
  const cell = solvePentagon(spec);
  if (cell === undefined) {
    throw new Error("pentagon does not close");
  }
  const tiling = buildArrangement(cell, recipe);
  if (tiling === undefined) {
    throw new Error("arrangement does not tile");
  }
  return tiling;
}

// The solved shapes, as one table.
//
// Each carries the conditions its pentagon is solved from and the recipe the
// search found for it -- and nothing else, because a transcribed pentagon can
// be wrong in a way that still looks like a pentagon. shapes:check reads this
// same table, so the conditions cannot drift apart from what is checked.
export interface SolvedPentagon {
  readonly name: string;
  // Which of the fifteen. The checks demand each one measure as this and
  // nothing else, since a too-symmetric choice of the free parameters
  // satisfies a neighbouring type's conditions too.
  readonly type: number;
  readonly spec: Spec;
  readonly recipe: Recipe;
  // How many cells the arrangement has, so a recipe that replays into some
  // other tiling is caught rather than quietly shipped.
  readonly cells: number;
}

export const SOLVED_PENTAGONS: SolvedPentagon[] = [
  // Its four cells are a single orbit, but the orbit is pgg: two of the four
  // are turned over, so no arrangement of turns alone reaches it however long
  // it is searched for. A half turn paired with a glide is the whole of what
  // it needed.
  {
    name: "type 2 glide",
    cells: 4,
    type: 2,
    spec: (t, s) => ({ angles: [120, 100, 130, 80, 110], lengths: [t, 1, s, 1, s] }),
    recipe: {
      kind: "orbit",
      group: {
        kind: "pgg",
        centre: { at: "corner", index: 1 },
        glide: { against: 0, baseEdge: 0, cellEdge: 2, flip: true, swap: true },
      },
      seeds: [],
    },
  },
  // Two right-isosceles ears, from b = c and d = e with B = D = 90. A quarter
  // turn about the corner between one ear's equal sides carries one onto the
  // other, so four copies close up around it -- four right angles make 360
  // exactly, and that is the whole arrangement.
  {
    name: "type 4 ears",
    cells: 4,
    type: 4,
    spec: (t, s) => ({ angles: [130, 90, 110, 90, 120], lengths: [t, 1, 1, s, s] }),
    recipe: {
      kind: "orbit",
      group: { kind: "cyclic", centre: { at: "corner", index: 1 }, order: 4 },
      seeds: [],
    },
  },
  // Six copies turned about the 60 degree corner close around it, which is
  // where its six-fold symmetry comes from; squaring the lattice up then
  // takes two rows of six.
  //
  // Twelve cells to a unit and eight neighbours -- the most crowded board
  // here, and the only one of these that matches the square's eight.
  {
    name: "type 5 fan",
    cells: 12,
    type: 5,
    spec: (t, s) => ({ angles: [60, 100, 150, 120, 110], lengths: [1, 1, s, t, t] }),
    recipe: {
      kind: "orbit",
      group: { kind: "cyclic", centre: { at: "corner", index: 0 }, order: 6 },
      seeds: [],
    },
  },
  // p2, and four cells -- the same size the plain half-turn family builds --
  // and still unreachable by it, because those four cells are *two* orbits
  // rather than one. It is the clearest case for seeding the group with more
  // than one cell: nothing about the group or the size was the obstacle.
  {
    name: "type 6 pairs",
    cells: 4,
    type: 6,
    spec: (t, s) => ({ angles: [200 - t, t, 160 - t, 180 - t, 2 * t], lengths: [1, s, s, 1, 1] }),
    recipe: {
      kind: "orbit",
      group: { kind: "cyclic", centre: { at: "edge", index: 1 }, order: 2 },
      seeds: [{ against: 0, baseEdge: 0, cellEdge: 1, flip: false, swap: true }],
    },
  },

  // Kershner, 1968. Four equal edges with B + 2E = 360 and 2C + D = 360.
  // Two orbits of four, and its turning centres are nowhere on the cell, so
  // there was nothing for the group families to enumerate.
  {
    name: "type 7",
    cells: 8,
    type: 7,
    spec: (t, s) => ({ angles: [s - 46, 360 - 2 * s, 134, 92, s], lengths: [t, 1, 1, 1, 1] }),
    recipe: {"kind": "patch", "placements": [{"against": 0, "baseEdge": 0, "cellEdge": 0, "flip": false, "swap": true}, {"against": 1, "baseEdge": 1, "cellEdge": 2, "flip": false, "swap": true}, {"against": 0, "baseEdge": 4, "cellEdge": 4, "flip": true, "swap": true}, {"against": 1, "baseEdge": 4, "cellEdge": 4, "flip": true, "swap": true}, {"against": 0, "baseEdge": 1, "cellEdge": 2, "flip": false, "swap": true}, {"against": 1, "baseEdge": 2, "cellEdge": 2, "flip": false, "swap": true}, {"against": 2, "baseEdge": 4, "cellEdge": 4, "flip": true, "swap": true}, {"against": 1, "baseEdge": 3, "cellEdge": 1, "flip": false, "swap": true}, {"against": 4, "baseEdge": 1, "cellEdge": 3, "flip": true, "swap": false}, {"against": 2, "baseEdge": 0, "cellEdge": 3, "flip": true, "swap": true}, {"against": 3, "baseEdge": 2, "cellEdge": 1, "flip": true, "swap": false}, {"against": 0, "baseEdge": 2, "cellEdge": 2, "flip": false, "swap": true}, {"against": 0, "baseEdge": 3, "cellEdge": 1, "flip": false, "swap": true}, {"against": 4, "baseEdge": 2, "cellEdge": 0, "flip": false, "swap": false}, {"against": 7, "baseEdge": 1, "cellEdge": 0, "flip": true, "swap": false}, {"against": 7, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": false}, {"against": 9, "baseEdge": 2, "cellEdge": 0, "flip": true, "swap": false}, {"against": 11, "baseEdge": 3, "cellEdge": 0, "flip": false, "swap": false}, {"against": 8, "baseEdge": 4, "cellEdge": 0, "flip": false, "swap": true}]},
  },
  // Kershner, 1968. The same four equal edges, a different pair of angle
  // sums, and a different tiling: eight cells again, in a squarer box.
  {
    name: "type 8",
    cells: 8,
    type: 8,
    spec: (t, s) => ({ angles: [s - 70, 110, 140, 360 - 2 * s, s], lengths: [t, 1, 1, 1, 1] }),
    recipe: {"kind": "patch", "placements": [{"against": 0, "baseEdge": 0, "cellEdge": 1, "flip": false, "swap": true}, {"against": 1, "baseEdge": 2, "cellEdge": 3, "flip": true, "swap": true}, {"against": 0, "baseEdge": 4, "cellEdge": 4, "flip": true, "swap": true}, {"against": 1, "baseEdge": 3, "cellEdge": 3, "flip": false, "swap": true}, {"against": 0, "baseEdge": 1, "cellEdge": 1, "flip": false, "swap": true}, {"against": 2, "baseEdge": 1, "cellEdge": 1, "flip": true, "swap": false}, {"against": 1, "baseEdge": 4, "cellEdge": 4, "flip": true, "swap": true}, {"against": 0, "baseEdge": 3, "cellEdge": 2, "flip": true, "swap": true}, {"against": 5, "baseEdge": 3, "cellEdge": 1, "flip": false, "swap": true}, {"against": 0, "baseEdge": 2, "cellEdge": 0, "flip": false, "swap": true}, {"against": 3, "baseEdge": 2, "cellEdge": 0, "flip": false, "swap": false}, {"against": 6, "baseEdge": 4, "cellEdge": 2, "flip": false, "swap": false}, {"against": 7, "baseEdge": 2, "cellEdge": 0, "flip": true, "swap": false}, {"against": 2, "baseEdge": 0, "cellEdge": 0, "flip": false, "swap": false}, {"against": 4, "baseEdge": 1, "cellEdge": 0, "flip": false, "swap": true}]},
  },
  // Rice, 1976. The one edge-to-edge tiling among Rice's four.
  {
    name: "type 9",
    cells: 8,
    type: 9,
    spec: (t, s) => ({ angles: [110, s - 70, 140, 360 - 2 * s, s], lengths: [t, 1, 1, 1, 1] }),
    recipe: {"kind": "patch", "placements": [{"against": 0, "baseEdge": 4, "cellEdge": 4, "flip": true, "swap": true}, {"against": 0, "baseEdge": 0, "cellEdge": 1, "flip": false, "swap": true}, {"against": 0, "baseEdge": 3, "cellEdge": 3, "flip": false, "swap": true}, {"against": 2, "baseEdge": 3, "cellEdge": 2, "flip": true, "swap": true}, {"against": 0, "baseEdge": 1, "cellEdge": 1, "flip": false, "swap": true}, {"against": 1, "baseEdge": 1, "cellEdge": 0, "flip": true, "swap": false}, {"against": 2, "baseEdge": 0, "cellEdge": 2, "flip": true, "swap": true}, {"against": 2, "baseEdge": 4, "cellEdge": 4, "flip": true, "swap": true}, {"against": 0, "baseEdge": 2, "cellEdge": 3, "flip": true, "swap": true}, {"against": 1, "baseEdge": 2, "cellEdge": 0, "flip": false, "swap": false}, {"against": 5, "baseEdge": 0, "cellEdge": 1, "flip": false, "swap": true}, {"against": 3, "baseEdge": 1, "cellEdge": 1, "flip": false, "swap": true}, {"against": 4, "baseEdge": 4, "cellEdge": 4, "flip": false, "swap": false}, {"against": 5, "baseEdge": 3, "cellEdge": 3, "flip": false, "swap": true}, {"against": 4, "baseEdge": 0, "cellEdge": 1, "flip": true, "swap": false}, {"against": 5, "baseEdge": 4, "cellEdge": 4, "flip": true, "swap": true}, {"against": 6, "baseEdge": 3, "cellEdge": 2, "flip": false, "swap": false}, {"against": 6, "baseEdge": 2, "cellEdge": 2, "flip": true, "swap": false}, {"against": 8, "baseEdge": 1, "cellEdge": 1, "flip": true, "swap": false}, {"against": 7, "baseEdge": 0, "cellEdge": 2, "flip": false, "swap": false}, {"against": 3, "baseEdge": 0, "cellEdge": 1, "flip": false, "swap": true}, {"against": 13, "baseEdge": 2, "cellEdge": 0, "flip": true, "swap": true}, {"against": 9, "baseEdge": 1, "cellEdge": 0, "flip": true, "swap": false}, {"against": 10, "baseEdge": 2, "cellEdge": 0, "flip": true, "swap": true}, {"against": 11, "baseEdge": 3, "cellEdge": 2, "flip": true, "swap": true}]},
  },
  // James, 1975, after reading Kershner in Martin Gardner's column. Six
  // cells to a unit rather than eight, and the only one of these whose
  // lattice leans.
  {
    name: "type 10",
    cells: 6,
    type: 10,
    spec: (t, s) => ({ angles: [90, 120, 120, 150, 60], lengths: [t + s, t + s, t, 1, s] }),
    recipe: {"kind": "patch", "placements": [{"against": 0, "baseEdge": 4, "cellEdge": 0, "flip": false, "swap": true}, {"against": 1, "baseEdge": 4, "cellEdge": 0, "flip": false, "swap": true}, {"against": 0, "baseEdge": 0, "cellEdge": 4, "flip": false, "swap": true}, {"against": 1, "baseEdge": 1, "cellEdge": 0, "flip": true, "swap": true}, {"against": 2, "baseEdge": 1, "cellEdge": 4, "flip": true, "swap": true}, {"against": 3, "baseEdge": 1, "cellEdge": 0, "flip": true, "swap": true}, {"against": 0, "baseEdge": 1, "cellEdge": 4, "flip": true, "swap": true}, {"against": 3, "baseEdge": 2, "cellEdge": 2, "flip": true, "swap": true}, {"against": 1, "baseEdge": 2, "cellEdge": 2, "flip": true, "swap": true}, {"against": 2, "baseEdge": 2, "cellEdge": 2, "flip": false, "swap": true}, {"against": 0, "baseEdge": 2, "cellEdge": 2, "flip": false, "swap": true}, {"against": 6, "baseEdge": 4, "cellEdge": 3, "flip": false, "swap": false}, {"against": 4, "baseEdge": 4, "cellEdge": 3, "flip": false, "swap": false}, {"against": 6, "baseEdge": 2, "cellEdge": 2, "flip": false, "swap": false}, {"against": 4, "baseEdge": 2, "cellEdge": 2, "flip": false, "swap": false}, {"against": 8, "baseEdge": 0, "cellEdge": 3, "flip": false, "swap": false}, {"against": 9, "baseEdge": 0, "cellEdge": 3, "flip": false, "swap": false}, {"against": 6, "baseEdge": 3, "cellEdge": 3, "flip": true, "swap": false}, {"against": 4, "baseEdge": 3, "cellEdge": 3, "flip": true, "swap": false}]},
  },
  // Rice, 1977. d = 2a = 2e with two right angles. Its unit is eight cells
  // in a box a third as wide as it is tall, so the boards run very wide.
  {
    name: "type 13",
    cells: 8,
    type: 13,
    spec: (t, s) => ({ angles: [110, 90, 110, 140, 90], lengths: [t, 1, s, 2 * t, t] }),
    recipe: {"kind": "patch", "placements": [{"against": 0, "baseEdge": 4, "cellEdge": 2, "flip": true, "swap": true}, {"against": 0, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": true}, {"against": 0, "baseEdge": 3, "cellEdge": 4, "flip": false, "swap": true}, {"against": 2, "baseEdge": 3, "cellEdge": 2, "flip": false, "swap": false}, {"against": 1, "baseEdge": 0, "cellEdge": 0, "flip": false, "swap": false}, {"against": 2, "baseEdge": 2, "cellEdge": 2, "flip": true, "swap": false}, {"against": 0, "baseEdge": 2, "cellEdge": 4, "flip": true, "swap": true}, {"against": 7, "baseEdge": 3, "cellEdge": 4, "flip": true, "swap": false}, {"against": 4, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": true}, {"against": 1, "baseEdge": 1, "cellEdge": 1, "flip": false, "swap": false}, {"against": 6, "baseEdge": 0, "cellEdge": 0, "flip": false, "swap": false}, {"against": 5, "baseEdge": 1, "cellEdge": 1, "flip": true, "swap": true}, {"against": 5, "baseEdge": 2, "cellEdge": 2, "flip": false, "swap": true}, {"against": 5, "baseEdge": 3, "cellEdge": 4, "flip": false, "swap": true}, {"against": 4, "baseEdge": 4, "cellEdge": 3, "flip": false, "swap": true}, {"against": 0, "baseEdge": 1, "cellEdge": 1, "flip": true, "swap": true}, {"against": 2, "baseEdge": 1, "cellEdge": 1, "flip": false, "swap": false}, {"against": 9, "baseEdge": 2, "cellEdge": 2, "flip": true, "swap": false}, {"against": 7, "baseEdge": 2, "cellEdge": 2, "flip": true, "swap": false}, {"against": 19, "baseEdge": 0, "cellEdge": 0, "flip": false, "swap": false}, {"against": 13, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": true}, {"against": 11, "baseEdge": 2, "cellEdge": 3, "flip": false, "swap": true}, {"against": 9, "baseEdge": 3, "cellEdge": 4, "flip": true, "swap": false}, {"against": 6, "baseEdge": 4, "cellEdge": 3, "flip": true, "swap": false}, {"against": 13, "baseEdge": 4, "cellEdge": 3, "flip": false, "swap": true}]},
  },
  // Mann, McLoud and Von Derau, 2015 -- the last pentagon found, and the one
  // that completed the classification two years later. Its angles are fixed,
  // not a family: 150, 60, 135, 105, 90. Twelve cells to a unit and eight
  // neighbours.
  {
    name: "type 15",
    cells: 12,
    type: 15,
    spec: (t, s) => ({ angles: [150, 60, 135, 105, 90], lengths: [s, 2 * s, s, t, s] }),
    recipe: {"kind": "patch", "placements": [{"against": 0, "baseEdge": 4, "cellEdge": 1, "flip": false, "swap": true}, {"against": 0, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": true}, {"against": 2, "baseEdge": 3, "cellEdge": 4, "flip": true, "swap": false}, {"against": 0, "baseEdge": 3, "cellEdge": 1, "flip": true, "swap": true}, {"against": 2, "baseEdge": 2, "cellEdge": 2, "flip": false, "swap": false}, {"against": 0, "baseEdge": 2, "cellEdge": 2, "flip": false, "swap": true}, {"against": 4, "baseEdge": 0, "cellEdge": 0, "flip": false, "swap": false}, {"against": 2, "baseEdge": 1, "cellEdge": 3, "flip": false, "swap": false}, {"against": 0, "baseEdge": 1, "cellEdge": 1, "flip": false, "swap": true}, {"against": 6, "baseEdge": 3, "cellEdge": 1, "flip": true, "swap": true}, {"against": 1, "baseEdge": 4, "cellEdge": 3, "flip": false, "swap": true}, {"against": 6, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": true}, {"against": 5, "baseEdge": 4, "cellEdge": 3, "flip": false, "swap": true}, {"against": 13, "baseEdge": 2, "cellEdge": 2, "flip": true, "swap": true}, {"against": 14, "baseEdge": 4, "cellEdge": 3, "flip": true, "swap": false}, {"against": 6, "baseEdge": 4, "cellEdge": 1, "flip": false, "swap": true}, {"against": 7, "baseEdge": 2, "cellEdge": 2, "flip": false, "swap": true}, {"against": 4, "baseEdge": 3, "cellEdge": 4, "flip": true, "swap": false}, {"against": 7, "baseEdge": 4, "cellEdge": 1, "flip": false, "swap": true}, {"against": 3, "baseEdge": 1, "cellEdge": 4, "flip": true, "swap": false}, {"against": 12, "baseEdge": 2, "cellEdge": 2, "flip": false, "swap": false}, {"against": 12, "baseEdge": 3, "cellEdge": 4, "flip": true, "swap": false}, {"against": 11, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": true}, {"against": 14, "baseEdge": 0, "cellEdge": 3, "flip": false, "swap": false}, {"against": 7, "baseEdge": 3, "cellEdge": 1, "flip": true, "swap": true}, {"against": 9, "baseEdge": 4, "cellEdge": 1, "flip": false, "swap": true}, {"against": 18, "baseEdge": 2, "cellEdge": 2, "flip": false, "swap": false}, {"against": 17, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": true}, {"against": 9, "baseEdge": 3, "cellEdge": 1, "flip": true, "swap": true}, {"against": 8, "baseEdge": 1, "cellEdge": 1, "flip": false, "swap": true}, {"against": 17, "baseEdge": 1, "cellEdge": 1, "flip": false, "swap": true}, {"against": 28, "baseEdge": 3, "cellEdge": 4, "flip": true, "swap": false}, {"against": 20, "baseEdge": 2, "cellEdge": 2, "flip": true, "swap": false}, {"against": 24, "baseEdge": 4, "cellEdge": 3, "flip": false, "swap": true}, {"against": 10, "baseEdge": 3, "cellEdge": 4, "flip": true, "swap": false}, {"against": 15, "baseEdge": 1, "cellEdge": 3, "flip": false, "swap": false}, {"against": 16, "baseEdge": 4, "cellEdge": 3, "flip": false, "swap": true}, {"against": 13, "baseEdge": 1, "cellEdge": 3, "flip": true, "swap": true}, {"against": 23, "baseEdge": 2, "cellEdge": 2, "flip": true, "swap": false}, {"against": 21, "baseEdge": 4, "cellEdge": 3, "flip": false, "swap": true}, {"against": 27, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": true}, {"against": 33, "baseEdge": 0, "cellEdge": 0, "flip": false, "swap": false}, {"against": 34, "baseEdge": 2, "cellEdge": 2, "flip": true, "swap": true}, {"against": 28, "baseEdge": 1, "cellEdge": 1, "flip": false, "swap": false}, {"against": 32, "baseEdge": 0, "cellEdge": 2, "flip": true, "swap": false}, {"against": 24, "baseEdge": 0, "cellEdge": 3, "flip": false, "swap": true}, {"against": 25, "baseEdge": 3, "cellEdge": 4, "flip": true, "swap": false}]},
  },

  // Rice, 1977. Not edge to edge, and the first of the three that needed a
  // corner-anchored placement: laying by whole edges alone, every branch of
  // the search reached an unfillable gap at about nine cells.
  {
    name: "type 11",
    cells: 8,
    type: 11,
    spec: (t, s) => ({ angles: [90, 144, 72, 126, 108], lengths: [t, 1, s, 2 * t + s, 2 * t + s] }),
    recipe: {"kind": "patch", "placements": [{"at": "corner", "against": 0, "baseCorner": 4, "cellCorner": 3, "dirCell": 0, "dirEdge": 2, "flip": false}, {"against": 0, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": true}, {"against": 1, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": true}, {"at": "corner", "against": 1, "baseCorner": 2, "cellCorner": 1, "dirCell": 1, "dirEdge": 2, "flip": true}, {"against": 0, "baseEdge": 3, "cellEdge": 3, "flip": false, "swap": true}, {"against": 1, "baseEdge": 1, "cellEdge": 1, "flip": false, "swap": true}, {"against": 3, "baseEdge": 2, "cellEdge": 3, "flip": true, "swap": false}, {"against": 5, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": true}, {"against": 3, "baseEdge": 3, "cellEdge": 3, "flip": true, "swap": false}, {"against": 0, "baseEdge": 2, "cellEdge": 3, "flip": false, "swap": true}, {"against": 3, "baseEdge": 4, "cellEdge": 2, "flip": true, "swap": false}]},
  },
  // Rice, 1977. 2a = d = c + e. Six neighbours, the only one of the later
  // types with as few -- the same as a hexagon.
  {
    name: "type 12",
    cells: 8,
    type: 12,
    spec: (t, s) => ({ angles: [90, 144, 72, 126, 108], lengths: [t, 1, s, 2 * t, 2 * t - s] }),
    recipe: {"kind": "patch", "placements": [{"at": "corner", "against": 0, "baseCorner": 4, "cellCorner": 2, "dirCell": 0, "dirEdge": 4, "flip": true}, {"against": 0, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": true}, {"against": 1, "baseEdge": 0, "cellEdge": 0, "flip": false, "swap": false}, {"against": 1, "baseEdge": 1, "cellEdge": 2, "flip": false, "swap": false}, {"against": 1, "baseEdge": 3, "cellEdge": 2, "flip": true, "swap": false}, {"against": 3, "baseEdge": 2, "cellEdge": 3, "flip": false, "swap": true}, {"against": 4, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": true}, {"against": 0, "baseEdge": 2, "cellEdge": 3, "flip": true, "swap": true}, {"against": 2, "baseEdge": 2, "cellEdge": 2, "flip": false, "swap": false}, {"against": 1, "baseEdge": 4, "cellEdge": 2, "flip": false, "swap": false}, {"against": 5, "baseEdge": 0, "cellEdge": 0, "flip": false, "swap": false}]},
  },
  // Stein, 1985. Its angles are fixed, not a family, and the solver finds
  // them: B comes out at 145.34 and C at 69.32, which is what the source
  // gives for sin B = (root 57 - 3) / 8.
  {
    name: "type 14",
    cells: 6,
    type: 14,
    spec: (t, s) => ({ angles: [90, s, 360 - 2 * s, 270 - s, 2 * s - 180], lengths: [t, 1, t, 2 * t, 2 * t] }),
    recipe: {"kind": "patch", "placements": [{"at": "corner", "against": 0, "baseCorner": 4, "cellCorner": 2, "dirCell": 0, "dirEdge": 4, "flip": true}, {"against": 0, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": true}, {"against": 1, "baseEdge": 1, "cellEdge": 3, "flip": false, "swap": false}, {"against": 1, "baseEdge": 3, "cellEdge": 2, "flip": true, "swap": false}, {"against": 1, "baseEdge": 0, "cellEdge": 0, "flip": true, "swap": false}, {"at": "corner", "against": 0, "baseCorner": 3, "cellCorner": 1, "dirCell": 0, "dirEdge": 3, "flip": true}, {"against": 5, "baseEdge": 3, "cellEdge": 2, "flip": true, "swap": false}]},
  },
];

// Built when first asked for, and remembered.
//
// Solving a pentagon and replaying its recipe is milliseconds each, and a
// dozen of them at import was most of a second before the page had drawn
// anything. A page plays one shape at a time, so only that shape's tiling is
// ever built.
const built = new Map<string, Tiling>();

function solved(name: string): Tiling {
  const already = built.get(name);
  if (already !== undefined) return already;
  const entry = SOLVED_PENTAGONS.find((p) => p.name === name);
  if (entry === undefined) {
    throw new Error(`no solved pentagon called ${name}`);
  }
  const tiling = fromType(entry.spec, entry.recipe);
  built.set(name, tiling);
  return tiling;
}

export const type2Glide = (): Tiling => solved("type 2 glide");
export const type4Ears = (): Tiling => solved("type 4 ears");
export const type5Fan = (): Tiling => solved("type 5 fan");
export const type6Pairs = (): Tiling => solved("type 6 pairs");
export const type7 = (): Tiling => solved("type 7");
export const type8 = (): Tiling => solved("type 8");
export const type9 = (): Tiling => solved("type 9");
export const type10 = (): Tiling => solved("type 10");
export const type13 = (): Tiling => solved("type 13");
export const type11 = (): Tiling => solved("type 11");
export const type12 = (): Tiling => solved("type 12");
export const type14 = (): Tiling => solved("type 14");
export const type15 = (): Tiling => solved("type 15");

// Every pentagon board, with how many seed cells the search needs to find an
// arrangement for it. That number is the tiling's orbit count, and it is
// carried here because a check that searches for one of these has to be
// allowed the seeds it takes -- type 6's cells are two orbits, and no search
// from a single seed will ever arrange them.
export const pentagonTilings = (): { name: string; tiling: Tiling; seeds: number }[] => [
  { name: "hexagon thirds", tiling: hexagonThirds, seeds: 1 },
  { name: "hexagon halves", tiling: hexagonHalves, seeds: 1 },
  { name: "house rows", tiling: houseRows, seeds: 1 },
  { name: "paired slab", tiling: pairedSlab, seeds: 1 },
  { name: "type 2 glide", tiling: type2Glide(), seeds: 1 },
  { name: "type 4 ears", tiling: type4Ears(), seeds: 1 },
  { name: "type 5 fan", tiling: type5Fan(), seeds: 1 },
  { name: "type 6 pairs", tiling: type6Pairs(), seeds: 2 },
  { name: "type 7", tiling: type7(), seeds: 1 },
  { name: "type 8", tiling: type8(), seeds: 1 },
  { name: "type 9", tiling: type9(), seeds: 1 },
  { name: "type 10", tiling: type10(), seeds: 1 },
  { name: "type 13", tiling: type13(), seeds: 1 },
  { name: "type 11", tiling: type11(), seeds: 1 },
  { name: "type 12", tiling: type12(), seeds: 1 },
  { name: "type 14", tiling: type14(), seeds: 1 },
  { name: "type 15", tiling: type15(), seeds: 1 },
];
