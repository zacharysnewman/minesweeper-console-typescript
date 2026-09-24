import { Point } from "./Point";
import { checkCoverage, squareUp, Tiling } from "./Tiling";

// Finding a tiling's arrangement, rather than looking it up.
//
// A type's conditions say what shape its pentagon is. They do not say how the
// copies sit against each other, and that is what a board needs.
//
// A periodic tiling's primitive unit is the orbit of its tiles under the
// symmetry group, so the search builds units the same way: take a symmetry
// group, apply it to one or more seed cells, and look for a lattice. Two
// numbers decide what a given type needs, and both come off the
// classification:
//
//   orbits = tiles in the primitive unit / order of the point group
//
// The orbit count says how many seeds. The group says which family -- and
// seven of the fifteen types are pgg, whose single orbit contains mirror
// images that no rotation produces, so a family of turns alone reaches only
// the four types that are isohedral *and* rotation-generated.
//
// The lattice is pinned by area: whatever two vectors span it, the
// parallelogram they make has exactly the area of the unit. That turns a
// search over vectors into a handful of candidates, each settled by coverage.

const EPS = 1e-9;

export function polygonArea(polygon: readonly Point[]): number {
  let total = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    total += polygon[j].x * polygon[i].y - polygon[i].x * polygon[j].y;
  }
  return Math.abs(total) / 2;
}

// An isometry, as the six numbers of an affine map. Kept as a value rather
// than as "the polygon that came out", because a group has to act on every
// seed, not only on the one it was derived from.
export type Motion = readonly [number, number, number, number, number, number];

const IDENTITY: Motion = [1, 0, 0, 1, 0, 0];

function applyTo(m: Motion, polygon: readonly Point[]): Point[] {
  return polygon.map((p) => ({
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5],
  }));
}

// first, then second.
function compose(second: Motion, first: Motion): Motion {
  return [
    second[0] * first[0] + second[2] * first[1],
    second[1] * first[0] + second[3] * first[1],
    second[0] * first[2] + second[2] * first[3],
    second[1] * first[2] + second[3] * first[3],
    second[0] * first[4] + second[2] * first[5] + second[4],
    second[1] * first[4] + second[3] * first[5] + second[5],
  ];
}

function turnMotion(about: Point, radians: number): Motion {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [cos, sin, -sin, cos, about.x - cos * about.x + sin * about.y, about.y - sin * about.x - cos * about.y];
}

function flipsOver(m: Motion): boolean {
  return m[0] * m[3] - m[1] * m[2] < 0;
}

// Where a turn is centred: a corner, or the middle of an edge.
export interface Centre {
  readonly at: "corner" | "edge";
  readonly index: number;
}

function centreOf(cell: readonly Point[], centre: Centre): Point {
  const p = cell[centre.index];
  if (centre.at === "corner") return p;
  const q = cell[(centre.index + 1) % cell.length];
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

function turnCentres(cell: readonly Point[]): { centre: Centre; name: string }[] {
  const spots: { centre: Centre; name: string }[] = [];
  cell.forEach((_unused, i) => spots.push({ centre: { at: "corner", index: i }, name: `corner ${i}` }));
  cell.forEach((_unused, i) => spots.push({ centre: { at: "edge", index: i }, name: `edge ${i} midpoint` }));
  return spots;
}

// Laying one cell against another: which edge of each touches, which ends
// meet, and whether the copy is turned over. Lengths need not match, because
// most of the fifteen types are not edge to edge and a copy's edge runs part
// way along its neighbour's.
export interface Placement {
  // Which already-placed cell to lay this one against; 0 is the seed itself.
  readonly against: number;
  readonly baseEdge: number;
  readonly cellEdge: number;
  readonly flip: boolean;
  readonly swap: boolean;
}

function placementMotion(
  cell: readonly Point[],
  against: readonly Point[],
  placement: Placement
): Motion | undefined {
  const n = cell.length;
  const p0 = against[placement.baseEdge];
  const p1 = against[(placement.baseEdge + 1) % n];
  const q0 = cell[placement.cellEdge];
  const q1 = cell[(placement.cellEdge + 1) % n];

  const from0 = placement.flip ? q1 : q0;
  const from1 = placement.flip ? q0 : q1;
  const to0 = placement.swap ? p1 : p0;
  const to1 = placement.swap ? p0 : p1;

  const fa = Math.atan2(from1.y - from0.y, from1.x - from0.x);
  const ta = Math.atan2(to1.y - to0.y, to1.x - to0.x);
  if (!isFinite(fa) || !isFinite(ta)) return undefined;

  // Turn the copy's edge onto the line of the base's, anchored at one end,
  // having first turned it over if that is what this placement is.
  const mirror: Motion = placement.flip ? [1, 0, 0, -1, 0, 0] : IDENTITY;
  const toOrigin: Motion = [1, 0, 0, 1, -from0.x, -from0.y];
  const rot = turnMotion({ x: 0, y: 0 }, ta - (placement.flip ? -fa : fa));
  const back: Motion = [1, 0, 0, 1, to0.x, to0.y];
  return compose(back, compose(rot, compose(mirror, toOrigin)));
}

function allPlacements(cellLength: number, against: number): Placement[] {
  const out: Placement[] = [];
  for (let baseEdge = 0; baseEdge < cellLength; baseEdge++) {
    for (let cellEdge = 0; cellEdge < cellLength; cellEdge++) {
      for (const flip of [false, true]) {
        for (const swap of [false, true]) {
          out.push({ against, baseEdge, cellEdge, flip, swap });
        }
      }
    }
  }
  return out;
}

// The symmetry group a unit is built with. Turns about one centre give the
// cyclic groups -- p1, p2, p3, p4, p6 -- and a half turn paired with a glide
// gives pgg, whose four elements include two that turn the cell over.
export type Group =
  | { readonly kind: "cyclic"; readonly centre: Centre; readonly order: number }
  | { readonly kind: "pgg"; readonly centre: Centre; readonly glide: Placement };

function groupMotions(cell: readonly Point[], group: Group): Motion[] | undefined {
  if (group.kind === "cyclic") {
    const about = centreOf(cell, group.centre);
    return Array.from({ length: group.order }, (_unused, k) =>
      turnMotion(about, (2 * Math.PI * k) / group.order)
    );
  }
  const glide = placementMotion(cell, cell, group.glide);
  if (glide === undefined || !flipsOver(glide)) return undefined;
  const half = turnMotion(centreOf(cell, group.centre), Math.PI);
  return [IDENTITY, half, glide, compose(half, glide)];
}

// How an arrangement was built, in a form that can be replayed. Searching for
// one takes seconds, which is no use at page load; replaying takes
// milliseconds, and shapes:check runs the search again to confirm the recipe
// still describes what it finds.
export interface Recipe {
  readonly group: Group;
  // Seed cells beyond the first, for the types whose tiles fall into more
  // than one orbit and whose unit therefore cannot be any one cell's.
  readonly seeds: readonly Placement[];
}

export interface Arrangement {
  readonly tiling: Tiling;
  readonly how: string;
  readonly recipe: Recipe;
}

function seedCells(cell: Point[], seeds: readonly Placement[]): Point[][] | undefined {
  const placed: Point[][] = [cell];
  for (const seed of seeds) {
    if (seed.against >= placed.length) return undefined;
    const motion = placementMotion(cell, placed[seed.against], seed);
    if (motion === undefined) return undefined;
    placed.push(applyTo(motion, cell));
  }
  return placed;
}

export function buildArrangement(cell: Point[], recipe: Recipe): Tiling | undefined {
  const unit = unitFor(cell, recipe);
  if (unit === undefined) return undefined;
  const found = findLattice(unit, latticeOffsets(cell, unit));
  return found === undefined ? undefined : squareUp(found);
}

function unitFor(cell: Point[], recipe: Recipe): Point[][] | undefined {
  const seeds = seedCells(cell, recipe.seeds);
  if (seeds === undefined) return undefined;
  const motions = groupMotions(cell, recipe.group);
  if (motions === undefined) return undefined;
  const unit = seeds.flatMap((seed) => motions.map((m) => applyTo(m, seed)));
  return overlapping(unit) ? undefined : unit;
}

export interface SearchLimits {
  // The search is exhaustive over its families and that is a lot of units at
  // three seeds, so callers that only want the cheap answers can stop early.
  readonly maxSeeds?: number;
  readonly milliseconds?: number;
}

export function searchArrangement(
  cell: Point[],
  limits: SearchLimits = {}
): Arrangement | undefined {
  const maxSeeds = limits.maxSeeds !== undefined ? limits.maxSeeds : 3;
  const deadline = Date.now() + (limits.milliseconds !== undefined ? limits.milliseconds : 120000);
  const spots = turnCentres(cell);
  const groups = candidateGroups(cell, spots);

  // Fewest seeds first, so a tiling that needs only one is never given two.
  for (let seedCount = 1; seedCount <= maxSeeds; seedCount++) {
    for (const seeds of seedSets(cell, seedCount)) {
      for (const { group, name } of groups) {
        if (Date.now() > deadline) return undefined;
        const recipe: Recipe = { group, seeds };
        const unit = unitFor(cell, recipe);
        if (unit === undefined) continue;
        const found = findLattice(unit, latticeOffsets(cell, unit));
        if (found !== undefined) {
          const seedNote = seedCount === 1 ? "" : ` on ${seedCount} seed cells`;
          return { tiling: squareUp(found), how: `${name}${seedNote}`, recipe };
        }
      }
    }
  }
  return undefined;
}

function candidateGroups(
  cell: readonly Point[],
  spots: { centre: Centre; name: string }[]
): { group: Group; name: string }[] {
  const out: { group: Group; name: string }[] = [];
  // Turns first: they are cheaper and they are what the isohedral,
  // rotation-generated types need.
  for (const order of [2, 3, 4, 6]) {
    for (const spot of spots) {
      out.push({
        group: { kind: "cyclic", centre: spot.centre, order },
        name: `${order} copies turned about ${spot.name}`,
      });
    }
  }
  // Then the reflecting family. Only placements that turn the cell over can
  // be the glide, and two that act identically are one candidate.
  const seen = new Set<string>();
  for (const placement of allPlacements(cell.length, 0)) {
    if (!placement.flip) continue;
    const motion = placementMotion(cell, cell, placement);
    if (motion === undefined || !flipsOver(motion)) continue;
    const key = motion.map((v) => v.toFixed(6)).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    for (const spot of spots) {
      out.push({
        group: { kind: "pgg", centre: spot.centre, glide: placement },
        name: `a half turn about ${spot.name} with a flip across edge ${placement.baseEdge}`,
      });
    }
  }
  out.push({ group: { kind: "cyclic", centre: { at: "corner", index: 0 }, order: 1 }, name: "translations alone" });
  return out;
}

// Seed sets, as placements against cells already seeded. Sets whose cells
// overlap are dropped here rather than after a group has been applied to
// them, which is most of them.
function seedSets(cell: Point[], count: number): Placement[][] {
  if (count === 1) return [[]];
  let sets: Placement[][] = [[]];
  for (let depth = 1; depth < count; depth++) {
    const next: Placement[][] = [];
    for (const set of sets) {
      const placed = seedCells(cell, set);
      if (placed === undefined) continue;
      for (let against = 0; against < placed.length; against++) {
        for (const placement of allPlacements(cell.length, against)) {
          const motion = placementMotion(cell, placed[against], placement);
          if (motion === undefined) continue;
          const candidate = applyTo(motion, cell);
          if (placed.some((other) => convexOverlap(other, candidate))) continue;
          next.push([...set, placement]);
        }
      }
    }
    sets = dedupe(cell, next);
  }
  return sets;
}

function dedupe(cell: Point[], sets: Placement[][]): Placement[][] {
  const seen = new Set<string>();
  const out: Placement[][] = [];
  for (const set of sets) {
    const placed = seedCells(cell, set);
    if (placed === undefined) continue;
    const key = placed
      .map((c) => {
        const m = centre(c);
        return `${m.x.toFixed(5)},${m.y.toFixed(5)}`;
      })
      .sort()
      .join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(set);
  }
  return out;
}

// The two vectors that carry a unit across the plane.
export function findLattice(unit: Point[][], extra: Point[] = []): Tiling | undefined {
  const target = unit.reduce((sum, cell) => sum + polygonArea(cell), 0);
  const corners = unit.flat();
  const seen = new Set<string>();
  const candidates: Point[] = [];
  const offer = (v: Point): void => {
    const size = Math.hypot(v.x, v.y);
    if (size < EPS) return;
    // One of each opposite pair is enough.
    const signed = v.x < -EPS || (Math.abs(v.x) < EPS && v.y < 0) ? { x: -v.x, y: -v.y } : v;
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
        // Cells sit where they were built, which may be several lattice steps
        // from the origin; the coverage check only translates a fixed
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
    for (const placement of allPlacements(cell.length, 0)) {
      const motion = placementMotion(cell, base, placement);
      if (motion === undefined) continue;
      const placed = applyTo(motion, cell);
      for (const home of unit) {
        const v = translationBetween(home, placed);
        if (v !== undefined) out.push(v);
      }
    }
  }
  return out;
}

// Do two cells of a proposed unit share any area? Cells are convex, so a
// separating axis settles it exactly, and a shared edge separates rather than
// overlaps -- which is the whole point, since that is how they are laid.
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
