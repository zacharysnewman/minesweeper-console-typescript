import { Point } from "./Point";

// The fifteen types of convex pentagon that tile the plane.
//
// Conditions transcribed from the Wikipedia article "Pentagonal tiling".
//
// Its labelling says the sides a..e run "directly clockwise from" the angles
// at A..E, which reads as though a runs out of A. It does not: the same
// sentence adds that A, B, C, D, E are opposite d, e, a, b, c, and that only
// holds if a is the side running *into* A, from E. Reading it the other way
// puts every edge condition one place out, and a pentagon that plainly tiles
// then matches none of the fifteen -- which is how the mistake was caught.
//
// This is a specification, not a set of tilings. It says what shape each type
// must be; it does not say how the copies are arranged, which the article
// carries in diagrams. What it buys is the ability to *check* a claim: given
// a tiling, measure its pentagon and see which types it actually satisfies,
// rather than asserting a type number and hoping.
//
// Primitive unit sizes and wallpaper groups are the article's too, and are
// kept because they constrain any search for an arrangement.
export interface PentagonType {
  readonly type: number;
  readonly conditions: string;
  readonly holds: (m: PentagonMeasures) => boolean;
  readonly primitiveUnits: number[];
  readonly groups: string[];
}

export interface PentagonMeasures {
  // Interior angles at A..E, in degrees.
  readonly A: number;
  readonly B: number;
  readonly C: number;
  readonly D: number;
  readonly E: number;
  // Side lengths, a joining A to B and so on round the pentagon.
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
}

// Angles are compared in degrees and edges as a ratio, so one tolerance
// cannot serve both.
const DEG = 0.5;
const REL = 0.005;

const ang = (x: number, y: number): boolean => Math.abs(x - y) < DEG;
const len = (x: number, y: number): boolean =>
  Math.abs(x - y) <= REL * Math.max(Math.abs(x), Math.abs(y), 1e-9);

export const PENTAGON_TYPES: PentagonType[] = [
  {
    type: 1,
    conditions: "B + C = 180°",
    holds: (m) => ang(m.B + m.C, 180),
    primitiveUnits: [2, 4],
    groups: ["p2", "cmm", "cm", "pmg", "pgg", "p1"],
  },
  {
    type: 2,
    conditions: "c = e, B + D = 180°",
    holds: (m) => len(m.c, m.e) && ang(m.B + m.D, 180),
    primitiveUnits: [4],
    groups: ["pgg", "p2"],
  },
  {
    type: 3,
    conditions: "a = b, d = c + e, A = C = D = 120°",
    holds: (m) =>
      len(m.a, m.b) &&
      len(m.d, m.c + m.e) &&
      ang(m.A, 120) &&
      ang(m.C, 120) &&
      ang(m.D, 120),
    primitiveUnits: [3],
    groups: ["p3"],
  },
  {
    type: 4,
    conditions: "b = c, d = e, B = D = 90°",
    holds: (m) => len(m.b, m.c) && len(m.d, m.e) && ang(m.B, 90) && ang(m.D, 90),
    primitiveUnits: [4],
    groups: ["p4"],
  },
  {
    type: 5,
    conditions: "a = b, d = e, A = 60°, D = 120°",
    holds: (m) =>
      len(m.a, m.b) && len(m.d, m.e) && ang(m.A, 60) && ang(m.D, 120),
    primitiveUnits: [6, 18],
    groups: ["p6"],
  },
  {
    type: 6,
    conditions: "a = d = e, b = c, B + D = 180°, 2B = E",
    holds: (m) =>
      len(m.a, m.d) &&
      len(m.d, m.e) &&
      len(m.b, m.c) &&
      ang(m.B + m.D, 180) &&
      ang(2 * m.B, m.E),
    primitiveUnits: [4],
    groups: ["p2", "pgg"],
  },
  {
    type: 7,
    conditions: "b = c = d = e, B + 2E = 360°, 2C + D = 360°",
    holds: (m) =>
      len(m.b, m.c) &&
      len(m.c, m.d) &&
      len(m.d, m.e) &&
      ang(m.B + 2 * m.E, 360) &&
      ang(2 * m.C + m.D, 360),
    primitiveUnits: [8],
    groups: ["pgg"],
  },
  {
    type: 8,
    conditions: "b = c = d = e, 2B + C = 360°, D + 2E = 360°",
    holds: (m) =>
      len(m.b, m.c) &&
      len(m.c, m.d) &&
      len(m.d, m.e) &&
      ang(2 * m.B + m.C, 360) &&
      ang(m.D + 2 * m.E, 360),
    primitiveUnits: [8],
    groups: ["pgg"],
  },
  {
    type: 9,
    conditions: "b = c = d = e, 2A + C = 360°, D + 2E = 360°",
    holds: (m) =>
      len(m.b, m.c) &&
      len(m.c, m.d) &&
      len(m.d, m.e) &&
      ang(2 * m.A + m.C, 360) &&
      ang(m.D + 2 * m.E, 360),
    primitiveUnits: [8],
    groups: ["pgg"],
  },
  {
    type: 10,
    conditions: "a = b = c + e, A = 90°, B + E = 180°, B + 2C = 360°",
    holds: (m) =>
      len(m.a, m.b) &&
      len(m.a, m.c + m.e) &&
      ang(m.A, 90) &&
      ang(m.B + m.E, 180) &&
      ang(m.B + 2 * m.C, 360),
    primitiveUnits: [6],
    groups: ["p2", "cmm"],
  },
  {
    type: 11,
    conditions: "2a + c = d = e, A = 90°, 2B + C = 360°, C + E = 180°",
    holds: (m) =>
      len(2 * m.a + m.c, m.d) &&
      len(m.d, m.e) &&
      ang(m.A, 90) &&
      ang(2 * m.B + m.C, 360) &&
      ang(m.C + m.E, 180),
    primitiveUnits: [8],
    groups: ["p2"],
  },
  {
    type: 12,
    conditions: "2a = d = c + e, A = 90°, 2B + C = 360°, C + E = 180°",
    holds: (m) =>
      len(2 * m.a, m.d) &&
      len(m.d, m.c + m.e) &&
      ang(m.A, 90) &&
      ang(2 * m.B + m.C, 360) &&
      ang(m.C + m.E, 180),
    primitiveUnits: [8],
    groups: ["p2"],
  },
  {
    type: 13,
    conditions: "d = 2a = 2e, B = E = 90°, 2A + D = 360°",
    holds: (m) =>
      len(m.d, 2 * m.a) &&
      len(m.a, m.e) &&
      ang(m.B, 90) &&
      ang(m.E, 90) &&
      ang(2 * m.A + m.D, 360),
    primitiveUnits: [8],
    groups: ["p2"],
  },
  {
    type: 14,
    conditions:
      "2a = 2c = d = e, A = 90°, 2B + C = 360°, C + E = 180° " +
      "(B ~ 145.34°, C ~ 69.32°, D ~ 124.66°, E ~ 110.68°)",
    holds: (m) =>
      len(2 * m.a, m.d) &&
      len(m.a, m.c) &&
      len(m.d, m.e) &&
      ang(m.A, 90) &&
      ang(2 * m.B + m.C, 360) &&
      ang(m.C + m.E, 180),
    primitiveUnits: [6],
    groups: ["p2"],
  },
  {
    type: 15,
    conditions:
      "a = c = e, b = 2a, A = 150°, B = 60°, C = 135°, D = 105°, E = 90°",
    holds: (m) =>
      len(m.a, m.c) &&
      len(m.c, m.e) &&
      len(m.b, 2 * m.a) &&
      ang(m.A, 150) &&
      ang(m.B, 60) &&
      ang(m.C, 135) &&
      ang(m.D, 105) &&
      ang(m.E, 90),
    primitiveUnits: [12],
    groups: ["p2"],
  },
];

// Every way of labelling a pentagon's corners A..E: five places to start, and
// both directions round, since which way is "clockwise" depends on whether
// the polygon was wound for a screen with y running down.
export function labellings(polygon: readonly Point[]): PentagonMeasures[] {
  const out: PentagonMeasures[] = [];
  for (const ring of [polygon, [...polygon].reverse()]) {
    for (let start = 0; start < ring.length; start++) {
      const v = ring.map((_unused, i) => ring[(start + i) % ring.length]);
      // Side a runs into vertex A, so it is the edge from E to A.
      const side = (i: number): number =>
        Math.hypot(
          v[i].x - v[(i + 4) % 5].x,
          v[i].y - v[(i + 4) % 5].y
        );
      const angle = (i: number): number => {
        const prev = v[(i + 4) % 5];
        const next = v[(i + 1) % 5];
        const u = Math.atan2(prev.y - v[i].y, prev.x - v[i].x);
        const w = Math.atan2(next.y - v[i].y, next.x - v[i].x);
        let turn = ((u - w) * 180) / Math.PI;
        while (turn < 0) turn += 360;
        while (turn > 360) turn -= 360;
        return turn > 180 ? 360 - turn : turn;
      };
      out.push({
        A: angle(0), B: angle(1), C: angle(2), D: angle(3), E: angle(4),
        a: side(0), b: side(1), c: side(2), d: side(3), e: side(4),
      });
    }
  }
  return out;
}

// Which of the fifteen types a pentagon satisfies. A pentagon can belong to
// several -- the article says so explicitly -- so this returns all of them.
export function typesOf(polygon: readonly Point[]): number[] {
  if (polygon.length !== 5) {
    return [];
  }
  const ways = labellings(polygon);
  return PENTAGON_TYPES.filter((t) => ways.some((m) => t.holds(m))).map(
    (t) => t.type
  );
}
