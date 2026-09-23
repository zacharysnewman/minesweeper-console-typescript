import { Point } from "./Point";

// Building a pentagon from its type's conditions.
//
// A type is a set of conditions on angles and edges, not a shape: most of the
// fifteen are families with room left over. Choosing an instance means
// picking the free parameters and then *solving* for the rest, because the
// conditions never determine a pentagon on their own -- the five angles fix
// the five edge directions, and closing the outline is two more equations.
//
// So: give the five angles, and give the five edges as a function of two
// unknowns. The solver finds the unknowns that close the pentagon. Nothing
// here asserts a type; pentagonTypes.ts measures the result, which is what
// catches an arrangement built from conditions that were mis-transcribed.

const DEG = Math.PI / 180;

// Vertices are A..E = 0..4, and side i runs from vertex i-1 into vertex i --
// so a ends at A, b at B, and so on. That is pentagonTypes.ts's labelling,
// and getting it the other way round is the mistake the fifteen conditions
// are most sensitive to.
export interface PentagonSpec {
  readonly angles: readonly number[];
  readonly lengths: readonly number[];
}

// Several types pin their edges so tightly that nothing is left to solve for
// -- type 6 fixes three of the five equal and another two equal -- while
// leaving an angle free instead. So a spec returns both, and the two unknowns
// may be edges, angles, or one of each.
export type Spec = (t: number, s: number) => PentagonSpec;

function directions(anglesDeg: readonly number[]): Point[] {
  // The turn at a vertex is what is left of a straight line. dirs[i] is the
  // heading of the side *leaving* vertex i, so the turn that ends it is the
  // angle at the vertex it arrives at, i + 1 -- not the one it left.
  let heading = 0;
  const dirs: Point[] = [];
  for (let i = 0; i < 5; i++) {
    dirs.push({ x: Math.cos(heading), y: Math.sin(heading) });
    heading += (180 - anglesDeg[(i + 1) % 5]) * DEG;
  }
  return dirs;
}

function gap(spec: Spec, t: number, s: number): Point {
  const { angles: anglesDeg, lengths } = spec(t, s);
  const dirs = directions(anglesDeg);
  let x = 0;
  let y = 0;
  for (let i = 0; i < 5; i++) {
    // dirs[i] is the heading of the side leaving vertex i, which is side i+1.
    x += lengths[(i + 1) % 5] * dirs[i].x;
    y += lengths[(i + 1) % 5] * dirs[i].y;
  }
  return { x, y };
}

// Newton on the two unknowns. The edge relations of every type are affine, so
// this lands in one step; it is written as a loop so a type whose relations
// are not affine still converges.
export function pentagonFrom(
  spec: Spec,
  guess: { t: number; s: number } = { t: 1, s: 1 }
): Point[] | undefined {
  let { t, s } = guess;
  for (let step = 0; step < 60; step++) {
    const f = gap(spec, t, s);
    if (Math.hypot(f.x, f.y) < 1e-12) break;
    const h = 1e-6;
    const ft = gap(spec, t + h, s);
    const fs = gap(spec, t, s + h);
    const j11 = (ft.x - f.x) / h;
    const j12 = (fs.x - f.x) / h;
    const j21 = (ft.y - f.y) / h;
    const j22 = (fs.y - f.y) / h;
    const det = j11 * j22 - j12 * j21;
    if (Math.abs(det) > 1e-12) {
      t -= (j22 * f.x - j12 * f.y) / det;
      s -= (-j21 * f.x + j11 * f.y) / det;
      continue;
    }
    // A type can pin its pentagon so completely that the second unknown does
    // nothing -- type 15 is a single shape, not a family -- and then the two
    // closure equations are redundant rather than unsolvable. Take the
    // least-squares step, which handles that and leaves the other cases alone.
    const g11 = j11 * j11 + j21 * j21;
    const g12 = j11 * j12 + j21 * j22;
    const g22 = j12 * j12 + j22 * j22;
    const b1 = j11 * f.x + j21 * f.y;
    const b2 = j12 * f.x + j22 * f.y;
    const damp = 1e-9;
    const gdet = (g11 + damp) * (g22 + damp) - g12 * g12;
    if (Math.abs(gdet) < 1e-18) return undefined;
    t -= ((g22 + damp) * b1 - g12 * b2) / gdet;
    s -= (-g12 * b1 + (g11 + damp) * b2) / gdet;
  }

  const { angles: anglesDeg, lengths } = spec(t, s);
  if (Math.abs(anglesDeg.reduce((sum, a) => sum + a, 0) - 540) > 1e-6) return undefined;
  if (anglesDeg.some((a) => !(a > 1e-6 && a < 180 - 1e-6))) return undefined;
  if (lengths.some((l) => !(l > 1e-6))) return undefined;
  const closed = gap(spec, t, s);
  if (Math.hypot(closed.x, closed.y) > 1e-9) return undefined;

  const dirs = directions(anglesDeg);
  const points: Point[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < 5; i++) {
    points.push({ x, y });
    x += lengths[(i + 1) % 5] * dirs[i].x;
    y += lengths[(i + 1) % 5] * dirs[i].y;
  }
  return convex(points) ? points : undefined;
}

// Newton needs somewhere to start, and a type whose conditions allow several
// shapes can send it to one with a negative edge. Try a spread of starts and
// keep the first that closes into a convex pentagon.
export function solvePentagon(spec: Spec): Point[] | undefined {
  const scales = [0.4, 0.6, 0.8, 1, 1.4, 2];
  const angles = [60, 80, 100, 110, 120, 140];
  const starts: { t: number; s: number }[] = [];
  for (const t of scales) for (const s of scales) starts.push({ t, s });
  for (const t of scales) for (const s of angles) starts.push({ t, s });
  for (const t of angles) for (const s of scales) starts.push({ t, s });
  for (const start of starts) {
    const found = pentagonFrom(spec, start);
    if (found !== undefined) return found;
  }
  return undefined;
}

function convex(polygon: readonly Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const c = polygon[(i + 2) % polygon.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) return false;
    const here = cross > 0 ? 1 : -1;
    if (sign === 0) sign = here;
    else if (sign !== here) return false;
  }
  return true;
}
