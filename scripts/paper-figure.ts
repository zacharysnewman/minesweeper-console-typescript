import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { typesOf, labellings } from "../src/Shapes/pentagonTypes";

// Reads the tiling diagrams out of a PDF of the fifteen pentagon types, and
// says which type each panel of the figure is.
//
//   npx ts-node scripts/paper-figure.ts <paper.pdf>
//
// Why bother: the conditions in pentagonTypes.ts say what shape each type
// has, but not how the copies are arranged, and that is what a tiling needs.
// The arrangements live in the figure. This pulls the figure apart far enough
// to read them, and -- by checking each panel against the conditions -- to be
// sure which panel is which.
//
// The coordinates that come out are only as good as the figure: a stroke
// position in a PDF, snapped to merge shared corners. Good enough to read an
// arrangement from and to identify a type, not good enough to ship as a
// tiling. Exact geometry has to be solved from the conditions.

const TOLERANCE = 0.35;

type Pt = [number, number];

function inflate(pdf: Buffer): string {
  // The figure is one content stream; find it by how much line drawing it has.
  let best = "";
  const marker = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  const text = pdf.toString("latin1");
  while ((m = marker.exec(text)) !== null) {
    const stop = text.indexOf("endstream", m.index + m[0].length);
    if (stop < 0) continue;
    const body = pdf.subarray(m.index + m[0].length, stop);
    for (const candidate of [body, body.subarray(0, body.length - 1)]) {
      try {
        const out = zlib.inflateSync(candidate).toString("latin1");
        const draws = (out.match(/[-\d.]+\s+[-\d.]+\s+l[\s\n]/g) ?? []).length;
        if (draws > 500 && out.length > best.length) best = out;
        break;
      } catch {
        /* not a deflate stream, or not this variant of it */
      }
    }
  }
  return best;
}

// Walk the content stream far enough to get stroked line segments out, in
// page coordinates: the transform stack, a move, some lines, a stroke.
function segments(stream: string): [Pt, Pt][] {
  const tokens = stream.match(/-?\d*\.?\d+|[A-Za-z'"*]+/g) ?? [];
  const mul = (a: number[], b: number[]): number[] => [
    a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
  ];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const at = (x: number, y: number): Pt => [
    ctm[0] * x + ctm[2] * y + ctm[4],
    ctm[1] * x + ctm[3] * y + ctm[5],
  ];
  const out: [Pt, Pt][] = [];
  let nums: number[] = [];
  let run: Pt[] = [];
  for (const t of tokens) {
    if (/^-?[\d.]/.test(t)) { nums.push(Number(t)); continue; }
    if (t === "q") stack.push([...ctm]);
    else if (t === "Q") ctm = stack.pop() ?? ctm;
    else if (t === "cm" && nums.length >= 6) ctm = mul(nums.slice(-6), ctm);
    else if (t === "m" && nums.length >= 2) run = [at(nums[nums.length - 2], nums[nums.length - 1])];
    else if (t === "l" && nums.length >= 2) run.push(at(nums[nums.length - 2], nums[nums.length - 1]));
    else if ("SsfFBbn".includes(t) && t.length === 1) {
      for (let i = 0; i + 1 < run.length; i++) out.push([run[i], run[i + 1]]);
      run = [];
    }
    nums = [];
  }
  return out;
}

// Faces of the planar graph the segments form: from the edge u->v, leave v
// along the neighbour just clockwise of the way back.
function faces(segs: [Pt, Pt][]): Pt[][] {
  const id = (p: Pt): string =>
    `${Math.round(p[0] / TOLERANCE)},${Math.round(p[1] / TOLERANCE)}`;
  const spot = new Map<string, Pt[]>();
  for (const [a, b] of segs) for (const p of [a, b]) {
    const k = id(p);
    spot.set(k, [...(spot.get(k) ?? []), p]);
  }
  const node = new Map<string, Pt>();
  for (const [k, ps] of spot) {
    node.set(k, [
      ps.reduce((s, p) => s + p[0], 0) / ps.length,
      ps.reduce((s, p) => s + p[1], 0) / ps.length,
    ]);
  }
  const adj = new Map<string, Set<string>>();
  for (const [a, b] of segs) {
    const ka = id(a), kb = id(b);
    if (ka === kb) continue;
    adj.set(ka, (adj.get(ka) ?? new Set()).add(kb));
    adj.set(kb, (adj.get(kb) ?? new Set()).add(ka));
  }
  const bearing = (u: string, v: string): number => {
    const a = node.get(u) as Pt, b = node.get(v) as Pt;
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  const next = new Map<string, string>();
  for (const [v, nbs] of adj) {
    const ring = [...nbs].sort((p, q) => bearing(v, p) - bearing(v, q));
    ring.forEach((u, i) => next.set(`${u}|${v}`, ring[(i - 1 + ring.length) % ring.length]));
  }
  const seen = new Set<string>();
  const found: Pt[][] = [];
  for (const edge of next.keys()) {
    if (seen.has(edge)) continue;
    const ring: string[] = [];
    let cur = edge;
    while (!seen.has(cur) && ring.length <= 24) {
      seen.add(cur);
      const [u, v] = cur.split("|");
      ring.push(u);
      cur = `${v}|${next.get(cur) as string}`;
    }
    if (ring.length >= 3 && ring.length <= 12) {
      found.push(ring.map((k) => node.get(k) as Pt));
    }
  }
  const area = (p: Pt[]): number => {
    let s = 0;
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length;
      s += p[i][0] * p[j][1] - p[j][0] * p[i][1];
    }
    return Math.abs(s / 2);
  };
  return found.filter((f) => area(f) > 4);
}

const file = process.argv[2];
if (file === undefined) {
  console.error("usage: ts-node scripts/paper-figure.ts <paper.pdf>");
  process.exit(1);
}
const segs = segments(inflate(fs.readFileSync(file)));
const all = faces(segs);
const pentagons = all.filter((f) => f.length === 5);
console.log(`  ${segs.length} segments, ${all.length} faces, ${pentagons.length} pentagons`);

// The panels sit in a grid, five across, and turn out to run in type order.
const xs = all.flat().map((p) => p[0]);
const ys = all.flat().map((p) => p[1]);
const minX = Math.min(...xs), maxX = Math.max(...xs);
const minY = Math.min(...ys), maxY = Math.max(...ys);
const cw = (maxX - minX) / 5, ch = (maxY - minY) / 4;
const panels = new Map<string, Pt[][]>();
for (const f of pentagons) {
  const cx = f.reduce((s, p) => s + p[0], 0) / 5;
  const cy = f.reduce((s, p) => s + p[1], 0) / 5;
  const col = Math.min(4, Math.floor((cx - minX) / cw));
  const row = Math.min(3, Math.floor((maxY - cy) / ch));
  const k = `${row},${col}`;
  panels.set(k, [...(panels.get(k) ?? []), f]);
}

console.log("\n  panel   expected   types the conditions actually accept");
for (const k of [...panels.keys()].sort()) {
  const [row, col] = k.split(",").map(Number);
  const expected = row * 5 + col + 1;
  const cells = (panels.get(k) as Pt[][]).map((f) =>
    f.map(([x, y]) => ({ x, y: -y }))
  );
  const union = [...new Set(cells.flatMap((c) => typesOf(c)))].sort((a, b) => a - b);
  const sane = cells.filter((c) => {
    const m = labellings(c)[0];
    return Math.abs(m.A + m.B + m.C + m.D + m.E - 540) < 3;
  }).length;
  console.log(
    `  ${k.padEnd(6)}  ${row < 3 ? String(expected).padStart(4) : "   -"}       ` +
      `[${union.join(", ") || "none"}]   ${sane}/${cells.length} pentagons read cleanly`
  );
}

// Draw what was read, so the figure can be looked at rather than trusted.
const S = 2.6;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${((maxX - minX) * S).toFixed(0)}" height="${((maxY - minY) * S).toFixed(0)}"><rect width="100%" height="100%" fill="#fff"/>`;
for (const [a, b] of segs) {
  svg += `<line x1="${((a[0] - minX) * S).toFixed(1)}" y1="${((maxY - a[1]) * S).toFixed(1)}" x2="${((b[0] - minX) * S).toFixed(1)}" y2="${((maxY - b[1]) * S).toFixed(1)}" stroke="#111" stroke-width="1.1"/>`;
}
svg += "</svg>";
const out = path.join(__dirname, "..", ".specimen");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "paper.html"), `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff">${svg}</body>`);
console.log(`\n  redrawn to ${path.join(out, "paper.html")}`);
