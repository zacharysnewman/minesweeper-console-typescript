import { Point } from "./geometry";
import { Tiling } from "./Tiling";

// Pentagon tilings, as geometry.
//
// Fifteen types of convex pentagon tile the plane; the classification was
// finished in 2017 and there is no sixteenth. Most of the fifteen are families
// rather than single shapes, so supporting a "type" means choosing one
// instance of it.
//
// What the checks here can prove is that a unit is a valid tiling by congruent
// convex pentagons -- it covers the plane, without gaps or overlaps, and its
// adjacency is symmetric. What they cannot prove is that it is canonically
// type N: that is a claim about published angle and edge constraints, and it
// wants a source rather than a memory. Each entry below says which of the two
// it is standing on.

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

// Hexagon thirds.
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
export const hexagonThirds: Tiling = {
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

export const pentagonTilings: { name: string; tiling: Tiling }[] = [
  { name: "hexagon thirds", tiling: hexagonThirds },
];
