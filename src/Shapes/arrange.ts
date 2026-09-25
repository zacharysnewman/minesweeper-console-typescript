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

function invert(m: Motion): Motion {
  const det = m[0] * m[3] - m[1] * m[2];
  const a = m[3] / det;
  const b = -m[1] / det;
  const c = -m[2] / det;
  const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
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
// Two ways of saying where a copy goes, both relative to cells already down.
//
// "edge" lays it against one edge of one cell, corner to corner. That reaches
// every edge-to-edge tiling and, through some other neighbour, most of the
// rest.
//
// "corner" only puts one of its corners on an existing corner and turns it to
// line up with an existing edge -- leaving the rest of the cell to land where
// it will, part way along its neighbours' edges. Most of the fifteen types
// are not edge to edge, and three of them need this: laying by edges alone,
// every branch of the search reached an unfillable gap at about nine cells.
export type Placement =
  | {
      readonly at?: "edge";
      // Which already-placed cell to lay this one against; 0 is the seed.
      readonly against: number;
      readonly baseEdge: number;
      readonly cellEdge: number;
      readonly flip: boolean;
      readonly swap: boolean;
    }
  | {
      readonly at: "corner";
      readonly against: number;
      // The corner of that cell to sit on, and the corner of the copy to
      // sit there.
      readonly baseCorner: number;
      readonly cellCorner: number;
      // The edge to line up with, named by the patch cell it belongs to and
      // its index there, so a recipe replays without depending on the order
      // anything was enumerated in.
      readonly dirCell: number;
      readonly dirEdge: number;
      readonly flip: boolean;
    };

function placementMotion(
  cell: readonly Point[],
  against: readonly Point[],
  placement: Placement,
  patch?: readonly Point[][]
): Motion | undefined {
  const n = cell.length;
  if (placement.at === "corner") {
    if (patch === undefined) return undefined;
    const dirOwner = patch[placement.dirCell];
    if (dirOwner === undefined) return undefined;
    const e0 = dirOwner[placement.dirEdge];
    const e1 = dirOwner[(placement.dirEdge + 1) % dirOwner.length];
    const ta = Math.atan2(e1.y - e0.y, e1.x - e0.x);
    const q = cell[placement.cellCorner];
    const r = cell[(placement.cellCorner + 1) % n];
    const fa = Math.atan2(r.y - q.y, r.x - q.x);
    const to = against[placement.baseCorner];
    const mirror: Motion = placement.flip ? [1, 0, 0, -1, 0, 0] : IDENTITY;
    const toOrigin: Motion = [1, 0, 0, 1, -q.x, -q.y];
    const rot = turnMotion({ x: 0, y: 0 }, ta - (placement.flip ? -fa : fa));
    const back: Motion = [1, 0, 0, 1, to.x, to.y];
    return compose(back, compose(rot, compose(mirror, toOrigin)));
  }
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

// The same, plus the slid positions. Kept separate because the group
// families do not need them and there are eleven times as many.
// The corner-anchored placements: a corner of the copy on an existing corner,
// turned to line up with an existing edge, leaving the rest of the cell to
// land where it will -- part way along its neighbours' edges.
//
// Generated only against cells near the spot being covered, or there would be
// thousands. Three of the fifteen types need these: laying by whole edges
// alone, every branch of the search reached an unfillable gap at nine cells.
function cornerPlacements(
  cell: readonly Point[],
  patch: readonly Point[][],
  near: readonly number[]
): Placement[] {
  const out: Placement[] = [];
  for (const against of near) {
    for (let baseCorner = 0; baseCorner < patch[against].length; baseCorner++) {
      for (let cellCorner = 0; cellCorner < cell.length; cellCorner++) {
        for (const dirCell of near) {
          for (let dirEdge = 0; dirEdge < patch[dirCell].length; dirEdge++) {
            for (const flip of [false, true]) {
              out.push({
                at: "corner",
                against,
                baseCorner,
                cellCorner,
                dirCell,
                dirEdge,
                flip,
              });
            }
          }
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
export type Recipe =
  | {
      readonly kind: "orbit";
      readonly group: Group;
      // Seed cells beyond the first, for the types whose tiles fall into more
      // than one orbit and whose unit therefore cannot be any one cell's.
      readonly seeds: readonly Placement[];
    }
  // A patch laid one cell at a time, for the tilings no group family reaches.
  // A k-isohedral tiling's rotation centres need not sit on the cell at all,
  // so there is nothing to enumerate; what can be done instead is to tile,
  // the way a person would, and then measure the periodicity of the result.
  | { readonly kind: "patch"; readonly placements: readonly Placement[] };

export interface Arrangement {
  readonly tiling: Tiling;
  readonly how: string;
  readonly recipe: Recipe;
}

export function seedCells(cell: Point[], seeds: readonly Placement[]): Point[][] | undefined {
  const placed: Point[][] = [cell];
  for (const seed of seeds) {
    if (seed.against >= placed.length) return undefined;
    const motion = placementMotion(cell, placed[seed.against], seed, placed);
    if (motion === undefined) return undefined;
    placed.push(applyTo(motion, cell));
  }
  return placed;
}

export function buildArrangement(cell: Point[], recipe: Recipe): Tiling | undefined {
  if (recipe.kind === "patch") {
    const patch = seedCells(cell, recipe.placements);
    if (patch === undefined || overlapping(patch)) return undefined;
    const found = latticeFromPatch(cell, patch);
    return found === undefined ? undefined : squareUp(found);
  }
  const unit = unitFor(cell, recipe);
  if (unit === undefined) return undefined;
  const found = findLattice(unit, latticeOffsets(cell, unit));
  return found === undefined ? undefined : squareUp(found);
}

function unitFor(
  cell: Point[],
  recipe: { group: Group; seeds: readonly Placement[] }
): Point[][] | undefined {
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

  // Both halves of the double loop are worked out once. A group's motions and
  // a seed set's cells do not depend on each other, and recomputing either
  // inside the loop -- an atan2 per glide, per combination -- is most of the
  // running time otherwise.
  const groups = candidateGroups(cell, spots)
    .map((g) => ({ ...g, motions: groupMotions(cell, g.group) }))
    .filter((g): g is typeof g & { motions: Motion[] } => g.motions !== undefined);

  // Fewest seeds first, so a tiling that needs only one is never given two.
  for (let seedCount = 1; seedCount <= maxSeeds; seedCount++) {
    const sets = seedSets(cell, seedCount)
      .map((seeds) => ({ seeds, cells: seedCells(cell, seeds) }))
      .filter((set): set is typeof set & { cells: Point[][] } => set.cells !== undefined);
    for (const set of sets) {
      for (const { group, name, motions } of groups) {
        if (Date.now() > deadline) return undefined;
        const unit = set.cells.flatMap((seed) => motions.map((m) => applyTo(m, seed)));
        if (overlapping(unit)) continue;
        const found = findLattice(unit, latticeOffsets(cell, unit));
        if (found !== undefined) {
          const seedNote = seedCount === 1 ? "" : ` on ${seedCount} seed cells`;
          return {
            tiling: squareUp(found),
            how: `${name}${seedNote}`,
            recipe: { kind: "orbit", group, seeds: set.seeds },
          };
        }
      }
    }
  }

  // No group family fits. Tile by hand instead, and measure what comes out.
  const budgetLeft = deadline - Date.now();
  if (budgetLeft > 0) {
    const laid = layArrangement(cell, deadline);
    if (laid !== undefined) return laid;
  }
  return undefined;
}

// Lay a patch and read its lattice. Tried at a few sizes, smallest first,
// because a patch only has to be big enough to come round to itself once in
// each direction and a smaller one is quicker to find and to check.
function layArrangement(cell: Point[], deadline: number): Arrangement | undefined {
  for (const size of [8, 12, 16, 20, 26, 32, 40, 48]) {
    if (Date.now() > deadline) return undefined;
    const budget = { nodes: 200000 };
    let lattice: Tiling | undefined;
    const placements = tileByLaying(
      cell,
      size,
      budget,
      (patch) => {
        if (Date.now() > deadline) return false;
        lattice = latticeFromPatch(cell, [...patch]);
        return lattice !== undefined;
      },
      deadline
    );
    if (placements === undefined || lattice === undefined) continue;
    return {
      tiling: squareUp(lattice),
      how: `a patch of ${size} cells laid one at a time`,
      recipe: { kind: "patch", placements },
    };
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
        name: `a half turn about ${spot.name} with a flip`,
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

// Tiling the plane by laying one cell at a time, and reading the periodicity
// off what comes out.
//
// The group families above enumerate arrangements, which works while the
// symmetry can be written down in terms of the cell -- a turn about one of
// its corners, a flip across one of its edges. A tiling whose tiles fall into
// several orbits need not oblige: its rotation centres can sit anywhere, so
// there is nothing to enumerate.
//
// What can always be done is to tile. Take an uncovered spot against the
// patch so far, try every way of covering it, and carry on; that is what a
// person does with a bag of tiles, and a pentagon that tiles will fill a
// patch this way. Then look for the translations that carry the patch into
// itself, which is the lattice -- measured from the tiling rather than
// assumed from a group.

const PROBE = 1e-4;

// How far a cell reaches from its own middle.
function reachOf(cell: readonly Point[]): number {
  const mid = centre(cell);
  return Math.max(...cell.map((p) => Math.hypot(p.x - mid.x, p.y - mid.y)));
}

function insidePolygon(p: Point, polygon: readonly Point[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      hit = !hit;
    }
  }
  return hit;
}

// A spot just outside the patch that nothing covers yet. Taken in a fixed
// order and nearest the middle first, so the same cell always produces the
// same patch.
function uncoveredSpot(patch: readonly Point[][]): Point | undefined {
  let best: Point | undefined;
  let bestDistance = Infinity;
  for (const cell of patch) {
    for (let i = 0; i < cell.length; i++) {
      const a = cell[i];
      const b = cell[(i + 1) % cell.length];
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const len = Math.hypot(nx, ny);
      if (len < EPS) continue;
      // Several spots along the edge, because a neighbour may cover part of
      // it and leave the rest -- most of these tilings are not edge to edge.
      for (const along of [0.25, 0.5, 0.75]) {
        const mid = { x: a.x + (b.x - a.x) * along, y: a.y + (b.y - a.y) * along };
        for (const side of [1, -1]) {
          const spot = {
            x: mid.x + (side * PROBE * nx) / len,
            y: mid.y + (side * PROBE * ny) / len,
          };
          if (patch.some((other) => insidePolygon(spot, other))) continue;
          const distance = Math.hypot(spot.x, spot.y);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = spot;
          }
        }
      }
    }
  }
  return best;
}

// Every way of laying a copy that covers a given spot without overlapping
// what is already down. Small: a spot admits only a few tiles.
//
// The motion is worked out against the base polygon itself, which is how
// buildArrangement replays a recipe. Deriving it once in the reference cell's
// frame and carrying it over with the base's own motion is faster and is
// wrong: composing with a base that has been turned over flips the placement
// too, so the same Placement means one thing to the search and another to the
// replay, and a recipe that was found rebuilt a different patch.
function coveringPlacements(
  cell: readonly Point[],
  patch: readonly Point[][],
  spot: Point
): { placement: Placement; polygon: Point[] }[] {
  const out: { placement: Placement; polygon: Point[] }[] = [];
  const seen = new Set<string>();
  // Only cells near the spot can have put a tile there, and checking the far
  // ones costs as much as checking the near ones.
  const span = reachOf(cell) * 2.5;
  const near: number[] = [];
  for (let against = 0; against < patch.length; against++) {
    const mid = centre(patch[against]);
    if (Math.hypot(mid.x - spot.x, mid.y - spot.y) <= span) near.push(against);
  }
  const tries: Placement[] = [
    ...near.flatMap((against) => allPlacements(cell.length, against)),
    ...cornerPlacements(cell, patch, near),
  ];
  {
    for (const placement of tries) {
      const motion = placementMotion(cell, patch[placement.against], placement, patch);
      if (motion === undefined) continue;
      const polygon = applyTo(motion, cell);
      if (!insidePolygon(spot, polygon)) continue;
      if (patch.some((other) => convexOverlap(other, polygon))) continue;
      const key = polygon.map((q) => `${q.x.toFixed(5)},${q.y.toFixed(5)}`).sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ placement, polygon });
    }
  }
  // Nearest the middle first. A periodic tiling grows as a compact blob,
  // where a fill that takes whatever placement comes first tends to wander
  // outward and never come round to itself -- and a patch that never does has
  // no lattice to read off it.
  out.sort((a, b) => {
    const p = centre(a.polygon);
    const q = centre(b.polygon);
    return Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y);
  });
  return out;
}

// `accept` decides whether a finished patch is the one wanted. Without it
// the search stops at the first arrangement that packs, and for three of the
// fifteen types that arrangement wanders -- it fills the plane locally and
// never comes round to itself, so there is no lattice to read off it. Asking
// for a periodic patch instead keeps the search going through the others.
export function tileByLaying(
  cell: Point[],
  cells: number,
  budget: { nodes: number },
  accept: (patch: readonly Point[][]) => boolean = () => true,
  deadline = Infinity
): Placement[] | undefined {
  const patch: Point[][] = [cell];
  const chosen: Placement[] = [];

  const step = (): boolean => {
    if (patch.length >= cells) return accept(patch);
    // Both bounds are needed. A node was cheap when a cell could only be laid
    // against a whole edge; with the corner-anchored placements one node can
    // cost a hundred times as much, so a node budget alone stopped bounding
    // how long this runs.
    if (budget.nodes-- <= 0) return false;
    if ((budget.nodes & 0xff) === 0 && Date.now() > deadline) return false;
    const spot = uncoveredSpot(patch);
    if (spot === undefined) return false;
    for (const { placement, polygon } of coveringPlacements(cell, patch, spot)) {
      patch.push(polygon);
      chosen.push(placement);
      if (step()) return true;
      patch.pop();
      chosen.pop();
    }
    return false;
  };

  return step() ? [...chosen] : undefined;
}

// The lattice of a patch: the translations that carry one of its cells onto
// another facing the same way, taken two at a time.
export function latticeFromPatch(cell: Point[], patch: Point[][]): Tiling | undefined {
  const area = polygonArea(cell);
  const offsets: Point[] = [];
  for (const a of patch) {
    for (const b of patch) {
      const v = translationBetween(a, b);
      if (v !== undefined && Math.hypot(v.x, v.y) > EPS) offsets.push(v);
    }
  }
  const seen = new Set<string>();
  const candidates = offsets.filter((v) => {
    const k = `${v.x.toFixed(5)},${v.y.toFixed(5)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  candidates.sort((p, q) => Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y));

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const across = candidates[i];
      const down = candidates[j];
      const span = Math.abs(across.x * down.y - across.y * down.x);
      if (span < EPS) continue;
      const count = Math.round(span / area);
      if (count < 1 || Math.abs(span - count * area) > 1e-6) continue;
      if (count > patch.length) continue;
      // One representative of each cell of the tiling, modulo the lattice.
      //
      // Taken from the middle of the patch outwards, and skipping any that
      // lands on top of one already taken. A patch grown a cell at a time is
      // periodic in its middle and ragged at its edge, where a cell may
      // belong to a neighbouring arrangement rather than this one; demanding
      // that every cell of the patch reduce into exactly these classes threw
      // away lattices that were right.
      const ordered = [...patch].sort(
        (a, b) => Math.hypot(centre(a).x, centre(a).y) - Math.hypot(centre(b).x, centre(b).y)
      );
      const unit: Point[][] = [];
      const placed = new Set<string>();
      for (const c of ordered) {
        if (unit.length === count) break;
        const home = intoDomain(c, across, down);
        const key = centreKey(home);
        if (placed.has(key)) continue;
        if (unit.some((other) => convexOverlap(other, home))) continue;
        placed.add(key);
        unit.push(home);
      }
      if (unit.length !== count) continue;
      const tiling: Tiling = { cells: count, across, down, unit };
      if (checkCoverage(tiling, seeded(5), 1500).ok) return tiling;
    }
  }
  return undefined;
}

function centreKey(polygon: readonly Point[]): string {
  const m = centre(polygon);
  return `${m.x.toFixed(5)},${m.y.toFixed(5)}`;
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
