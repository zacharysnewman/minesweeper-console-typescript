import { Point } from "./Point";
import { checkCoverage, squareUp, Tiling } from "./Tiling";

// Finding a tiling's arrangement, rather than looking it up.
//
// A type's conditions say what shape its pentagon is. They do not say how the
// copies sit against each other, and that is what a board needs. The article
// carries the arrangements in diagrams; this searches for them instead.
//
// Two facts make the search small. A primitive unit of a periodic tiling is
// built by the isometries of its wallpaper group, and for these tilings that
// means turns of order 2, 3, 4 or 6 about a corner or an edge midpoint. And
// the lattice is pinned by area: whatever two vectors span it, the
// parallelogram they make has exactly the area of the unit. That turns a
// search over vectors into a handful of candidates, each settled by the
// coverage check.

const EPS = 1e-9;

export function polygonArea(polygon: readonly Point[]): number {
  let total = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    total += polygon[j].x * polygon[i].y - polygon[i].x * polygon[j].y;
  }
  return Math.abs(total) / 2;
}

function turn(polygon: readonly Point[], about: Point, radians: number): Point[] {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return polygon.map((p) => {
    const dx = p.x - about.x;
    const dy = p.y - about.y;
    return { x: about.x + dx * cos - dy * sin, y: about.y + dx * sin + dy * cos };
  });
}

// Copies of a cell turned about one point, which is how a corner where k
// equal angles meet gets filled.
export function turnedUnit(
  cell: readonly Point[],
  about: Point,
  order: number
): Point[][] {
  return Array.from({ length: order }, (_unused, k) =>
    turn(cell, about, (2 * Math.PI * k) / order)
  );
}

// Turns alone do not reach every arrangement: several of the fifteen types
// tile by glide reflection, where a copy is flipped as well as moved, and no
// rotation of the cell will stand in for it. Reflecting across the line an
// edge lies on is where a flipped copy sits in these tilings.
export function mirroredAcrossEdge(cell: readonly Point[], edge: number): Point[] {
  const a = cell[edge];
  const b = cell[(edge + 1) % cell.length];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return cell.map((p) => ({ ...p }));
  const ux = dx / len;
  const uy = dy / len;
  return cell.map((p) => {
    const vx = p.x - a.x;
    const vy = p.y - a.y;
    // Reflect v in the direction u.
    const along = vx * ux + vy * uy;
    const rx = 2 * along * ux - vx;
    const ry = 2 * along * uy - vy;
    return { x: a.x + rx, y: a.y + ry };
  });
}

// The two vectors that carry a unit across the plane.
//
// Candidates come from the geometry itself -- the differences between corners
// of the unit -- and the pair has to span exactly the unit's area, which
// discards almost everything before any coverage test runs.
export function findLattice(unit: Point[][], extra: Point[] = []): Tiling | undefined {
  const target = unit.reduce((sum, cell) => sum + polygonArea(cell), 0);
  const corners = unit.flat();
  const seen = new Set<string>();
  const candidates: Point[] = [];
  const offer = (v: Point): void => {
    const size = Math.hypot(v.x, v.y);
    if (size < EPS) return;
    // One of each opposite pair is enough.
    const signed = v.x < -EPS || (Math.abs(v.x) < EPS && v.y < 0)
      ? { x: -v.x, y: -v.y }
      : v;
    const k = `${signed.x.toFixed(6)},${signed.y.toFixed(6)}`;
    if (seen.has(k)) return;
    seen.add(k);
    candidates.push(signed);
  };

  // Offsets measured from the tiling itself come first: a vector that carries
  // a cell onto a same-facing copy just outside the unit is a lattice vector
  // by construction, where a difference between two corners is only a guess.
  for (const v of extra) offer(v);
  for (const v of extra) {
    for (const w of extra) {
      offer({ x: v.x + w.x, y: v.y + w.y });
      offer({ x: v.x - w.x, y: v.y - w.y });
    }
  }
  for (const a of corners) {
    for (const b of corners) {
      offer({ x: b.x - a.x, y: b.y - a.y });
    }
  }
  candidates.sort((p, q) => Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y));

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const across = candidates[i];
      const down = candidates[j];
      const span = Math.abs(across.x * down.y - across.y * down.x);
      if (Math.abs(span - target) > 1e-6) continue;
      const tiling: Tiling = {
        cells: unit.length,
        across,
        down,
        // Cells are drawn where they were grown, which may be several lattice
        // steps from the origin; the coverage check only translates a fixed
        // distance, so bring each one home first.
        unit: unit.map((cell) => intoDomain(cell, across, down)),
      };
      if (checkCoverage(tiling, seeded(5), 1500).ok) {
        return tiling;
      }
    }
  }
  return undefined;
}

// Slide a cell by whole lattice steps until it sits in the unit cell at the
// origin. The tiling is unchanged; only its description moves.
function intoDomain(cell: readonly Point[], across: Point, down: Point): Point[] {
  const det = across.x * down.y - across.y * down.x;
  if (Math.abs(det) < EPS) return cell.map((p) => ({ ...p }));
  const mid = centre(cell);
  const s = Math.floor((mid.x * down.y - mid.y * down.x) / det);
  const t = Math.floor((across.x * mid.y - across.y * mid.x) / det);
  const dx = s * across.x + t * down.x;
  const dy = s * across.y + t * down.y;
  return cell.map((p) => ({ x: p.x - dx, y: p.y - dy }));
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Where a turn can be centred: a corner, or the middle of an edge.
//
// Widening this to the points an edge is divided at by the other edges'
// lengths -- where a copy's corner lands in a tiling that is not edge to edge
// -- was tried and found nothing those two do not already reach, at three
// times the running time. What the remaining types need is not another centre
// but a glide, below.
interface Spot {
  readonly at: Point;
  readonly name: string;
  readonly centre: Centre;
}

function turnCentres(cell: readonly Point[]): Spot[] {
  const spots: Spot[] = [];
  cell.forEach((p, i) =>
    spots.push({ at: p, name: `corner ${i}`, centre: { at: "corner", index: i } })
  );
  cell.forEach((p, i) => {
    const q = cell[(i + 1) % cell.length];
    spots.push({
      at: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 },
      name: `edge ${i} midpoint`,
      centre: { at: "edge", index: i },
    });
  });
  return spots;
}

// What this search does not reach.
//
// Glide reflections were built and tried -- flip across an edge's line, then
// slide along it by one of the distances between corners, which are the only
// slides at which a flipped copy sits against its original. They found
// nothing, at eight times the running time, so they are not here.
//
// The limit is more likely the size of the unit than the moves. Every family
// below is one turn, or two half turns: units of 2, 3, 4 or 6 cells. Several
// of the fifteen types have primitive units of 8, 12 or 18, which take more
// generators composed than this search composes.

// Where a turn is centred, named so it survives being written down.
export interface Centre {
  readonly at: "corner" | "edge";
  readonly index: number;
}

// How an arrangement was built, in a form that can be replayed. Searching for
// one takes tens of seconds, which is no use at page load; replaying the
// recipe takes milliseconds, and shapes:check runs the search again to
// confirm the recipe still describes what the search finds.
export type Recipe =
  | { readonly kind: "turn"; readonly centre: Centre; readonly order: number }
  | { readonly kind: "halfTurns"; readonly first: Centre; readonly second: Centre };

export interface Arrangement {
  readonly tiling: Tiling;
  // How it was found, so a shipped tiling can say where it came from.
  readonly how: string;
  readonly recipe: Recipe;
}

function centreOf(cell: readonly Point[], centre: Centre): Point {
  const p = cell[centre.index];
  if (centre.at === "corner") return p;
  const q = cell[(centre.index + 1) % cell.length];
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

export function buildArrangement(cell: Point[], recipe: Recipe): Tiling | undefined {
  if (recipe.kind === "turn") {
    const unit = turnedUnit(cell, centreOf(cell, recipe.centre), recipe.order);
    if (overlapping(unit)) return undefined;
    const found = findLattice(unit, latticeOffsets(cell, unit));
    return found === undefined ? undefined : squareUp(found);
  }
  const c1 = centreOf(cell, recipe.first);
  const c2 = centreOf(cell, recipe.second);
  const half = (poly: readonly Point[]): Point[] => turn(poly, c1, Math.PI);
  const other = (poly: readonly Point[]): Point[] => turn(poly, c2, Math.PI);
  const unit = [cell, half(cell), other(cell), other(half(cell))];
  if (overlapping(unit)) return undefined;
  const found = findLattice(unit, [{ x: 2 * (c2.x - c1.x), y: 2 * (c2.y - c1.y) }]);
  return found === undefined ? undefined : squareUp(found);
}

// Try the turns a pentagon tiling's symmetry can be built from, and keep the
// first that covers the plane. Corners first, then edge midpoints, and lower
// orders first, because a smaller unit makes a better board.
export function searchArrangement(cell: Point[]): Arrangement | undefined {
  const spots = turnCentres(cell);

  for (const order of [2, 3, 4, 6]) {
    for (const spot of spots) {
      const unit = turnedUnit(cell, spot.at, order);
      // Turns that put copies on top of each other are not arrangements.
      if (overlapping(unit)) continue;
      const found = findLattice(unit, latticeOffsets(cell, unit));
      if (found !== undefined) {
        return {
          tiling: squareUp(found),
          how: `${order} copies turned about ${spot.name}`,
          recipe: { kind: "turn", centre: spot.centre, order },
        };
      }
    }
  }
  return undefined;
}

// Growing a unit by laying cells against each other.
//
// Turns about a point reach the arrangements built from rotations, and that
// is not all of them: several types tile by glide reflection, and most of the
// fifteen are not edge to edge, so a copy's edge lands part way along its
// neighbour's rather than matching it end to end. Both are covered by the one
// move a person makes with physical tiles -- slide a copy up against an edge,
// either way round, lined up at one end -- so the search makes that move and
// looks for a lattice after each one.

interface Placed {
  readonly cells: Point[][];
  readonly how: string;
}

// Every way to lay a copy of the cell against one edge of a placed cell:
// which edge of the copy touches, which ends meet, and whether it is flipped.
function placementsAgainst(cell: readonly Point[], against: readonly Point[]): Point[][] {
  const out: Point[][] = [];
  const n = cell.length;
  for (let i = 0; i < n; i++) {
    const p0 = against[i];
    const p1 = against[(i + 1) % n];
    for (let j = 0; j < n; j++) {
      const q0 = cell[j];
      const q1 = cell[(j + 1) % n];
      for (const flip of [false, true]) {
        for (const swap of [false, true]) {
          // Take the copy's edge j onto the line of edge i, anchored at one end.
          const from0 = flip ? q1 : q0;
          const from1 = flip ? q0 : q1;
          const to0 = swap ? p1 : p0;
          const to1 = swap ? p0 : p1;
          const moved = alignEdge(cell, from0, from1, to0, to1, flip);
          if (moved !== undefined) out.push(moved);
        }
      }
    }
  }
  return out;
}

// Rigid motion (with a flip when asked) carrying from0 to to0 and pointing
// from1 along to1. Lengths need not match: the copy's edge may run part way
// along its neighbour's, which is what a non-edge-to-edge tiling does.
function alignEdge(
  cell: readonly Point[],
  from0: Point,
  from1: Point,
  to0: Point,
  to1: Point,
  flip: boolean
): Point[] | undefined {
  const fx = from1.x - from0.x;
  const fy = from1.y - from0.y;
  const tx = to1.x - to0.x;
  const ty = to1.y - to0.y;
  const fl = Math.hypot(fx, fy);
  const tl = Math.hypot(tx, ty);
  if (fl < EPS || tl < EPS) return undefined;
  const fa = Math.atan2(fy, fx);
  const ta = Math.atan2(ty, tx);
  const rot = ta - (flip ? -fa : fa);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return cell.map((p) => {
    const vx = p.x - from0.x;
    const vy = flip ? -(p.y - from0.y) : p.y - from0.y;
    return { x: to0.x + vx * cos - vy * sin, y: to0.y + vx * sin + vy * cos };
  });
}

// Is b a copy of a that has only been moved -- not turned, not flipped?
function translationBetween(a: readonly Point[], b: readonly Point[]): Point | undefined {
  const v = { x: b[0].x - a[0].x, y: b[0].y - a[0].y };
  for (let i = 1; i < a.length; i++) {
    if (Math.abs(b[i].x - a[i].x - v.x) > 1e-7) return undefined;
    if (Math.abs(b[i].y - a[i].y - v.y) > 1e-7) return undefined;
  }
  return v;
}

// Lay cells against the unit one more ring out, and keep the offsets of those
// that came back as plain translations of a cell already in it.
function latticeOffsets(cell: readonly Point[], unit: readonly Point[][]): Point[] {
  const out: Point[] = [];
  for (const base of unit) {
    for (const placed of placementsAgainst(cell, base)) {
      for (const home of unit) {
        const v = translationBetween(home, placed);
        if (v !== undefined) out.push(v);
      }
    }
  }
  return out;
}

function unitKey(cells: readonly Point[][]): string {
  return cells
    .map((c) => {
      const m = centre(c);
      return `${m.x.toFixed(5)},${m.y.toFixed(5)}`;
    })
    .sort()
    .join("|");
}

// A primitive unit is compact, so when the frontier has to be trimmed, keep
// the units whose cells sit closest together.
function spread(cells: readonly Point[][]): number {
  const mids = cells.map(centre);
  const cx = mids.reduce((s, p) => s + p.x, 0) / mids.length;
  const cy = mids.reduce((s, p) => s + p.y, 0) / mids.length;
  return mids.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0);
}

// Laying cells against each other and looking for a lattice after each one
// reaches arrangements the turn families do not -- it found type 4's unit
// without being told to turn about a corner. It is not here because it takes
// forty seconds to do so, and because what it found, the turn families found
// in a form that can be written down and replayed. If a type turns up that
// needs it, it is a breadth-first search over placementsAgainst.

// Do two cells of a proposed unit share any area? Cells are convex, so a
// separating axis settles it exactly, and a shared edge separates rather than
// overlaps -- which is the whole point, since that is how they are laid.
//
// A centroid-in-polygon test is not enough here: two cells can overlap with
// neither centre inside the other, and a unit of near-coincident cells is the
// most compact thing the search can build, so it would crowd out the real
// arrangement before it was ever tried.
function overlapping(unit: readonly Point[][]): boolean {
  for (let i = 0; i < unit.length; i++) {
    for (let j = i + 1; j < unit.length; j++) {
      if (convexOverlap(unit[i], unit[j])) return true;
    }
  }
  return false;
}

const OVERLAP_SLACK = 1e-7;

function convexOverlap(a: readonly Point[], b: readonly Point[]): boolean {
  return !separated(a, b) && !separated(b, a);
}

function separated(a: readonly Point[], b: readonly Point[]): boolean {
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = a[(i + 1) % a.length];
    // Outward normal of this edge, for whichever way the outline is wound.
    const nx = q.y - p.y;
    const ny = -(q.x - p.x);
    const len = Math.hypot(nx, ny);
    if (len < EPS) continue;
    let aMin = Infinity;
    let aMax = -Infinity;
    for (const v of a) {
      const d = ((v.x - p.x) * nx + (v.y - p.y) * ny) / len;
      aMin = Math.min(aMin, d);
      aMax = Math.max(aMax, d);
    }
    let bMin = Infinity;
    let bMax = -Infinity;
    for (const v of b) {
      const d = ((v.x - p.x) * nx + (v.y - p.y) * ny) / len;
      bMin = Math.min(bMin, d);
      bMax = Math.max(bMax, d);
    }
    if (bMin >= aMax - OVERLAP_SLACK || bMax <= aMin + OVERLAP_SLACK) return true;
  }
  return false;
}

function centre(polygon: readonly Point[]): Point {
  return {
    x: polygon.reduce((s, p) => s + p.x, 0) / polygon.length,
    y: polygon.reduce((s, p) => s + p.y, 0) / polygon.length,
  };
}
