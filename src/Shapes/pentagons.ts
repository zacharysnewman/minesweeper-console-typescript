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
}

export const SOLVED_PENTAGONS: SolvedPentagon[] = [
  // Its four cells are a single orbit, but the orbit is pgg: two of the four
  // are turned over, so no arrangement of turns alone reaches it however long
  // it is searched for. A half turn paired with a glide is the whole of what
  // it needed.
  {
    name: "type 2 glide",
    type: 2,
    spec: (t, s) => ({ angles: [120, 100, 130, 80, 110], lengths: [t, 1, s, 1, s] }),
    recipe: {
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
    type: 4,
    spec: (t, s) => ({ angles: [130, 90, 110, 90, 120], lengths: [t, 1, 1, s, s] }),
    recipe: {
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
    type: 5,
    spec: (t, s) => ({ angles: [60, 100, 150, 120, 110], lengths: [1, 1, s, t, t] }),
    recipe: {
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
    type: 6,
    spec: (t, s) => ({ angles: [200 - t, t, 160 - t, 180 - t, 2 * t], lengths: [1, s, s, 1, 1] }),
    recipe: {
      group: { kind: "cyclic", centre: { at: "edge", index: 1 }, order: 2 },
      seeds: [{ against: 0, baseEdge: 0, cellEdge: 1, flip: false, swap: true }],
    },
  },
];

function solved(name: string): Tiling {
  const entry = SOLVED_PENTAGONS.find((p) => p.name === name);
  if (entry === undefined) {
    throw new Error(`no solved pentagon called ${name}`);
  }
  return fromType(entry.spec, entry.recipe);
}

export const type2Glide: Tiling = solved("type 2 glide");
export const type4Ears: Tiling = solved("type 4 ears");
export const type5Fan: Tiling = solved("type 5 fan");
export const type6Pairs: Tiling = solved("type 6 pairs");

// Every pentagon board, with how many seed cells the search needs to find an
// arrangement for it. That number is the tiling's orbit count, and it is
// carried here because a check that searches for one of these has to be
// allowed the seeds it takes -- type 6's cells are two orbits, and no search
// from a single seed will ever arrange them.
export const pentagonTilings: { name: string; tiling: Tiling; seeds: number }[] = [
  { name: "hexagon thirds", tiling: hexagonThirds, seeds: 1 },
  { name: "hexagon halves", tiling: hexagonHalves, seeds: 1 },
  { name: "house rows", tiling: houseRows, seeds: 1 },
  { name: "paired slab", tiling: pairedSlab, seeds: 1 },
  { name: "type 2 glide", tiling: type2Glide, seeds: 1 },
  { name: "type 4 ears", tiling: type4Ears, seeds: 1 },
  { name: "type 5 fan", tiling: type5Fan, seeds: 1 },
  { name: "type 6 pairs", tiling: type6Pairs, seeds: 2 },
];
