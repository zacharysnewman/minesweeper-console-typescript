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

// Hexagon thirds.
//
// A regular hexagon divides into three congruent convex pentagons: from the
// centre out to an edge midpoint, around two corners, and back to the next
// midpoint but one. Because hexagons tile, so does this, and it needs no
// appeal to the classification to be sure of -- the construction is the
// proof, and the checks confirm the three pieces partition the hexagon
// exactly.
export const hexagonThirds: Tiling = {
  cells: 3,
  across: P(1.5, ROOT3 / 2),
  down: P(0, ROOT3),
  unit: [
    [P(0, 0), midpoint(5), corner(0), corner(1), midpoint(1)],
    [P(0, 0), midpoint(1), corner(2), corner(3), midpoint(3)],
    [P(0, 0), midpoint(3), corner(4), corner(5), midpoint(5)],
  ],
};

export const pentagonTilings: { name: string; tiling: Tiling }[] = [
  { name: "hexagon thirds", tiling: hexagonThirds },
];
