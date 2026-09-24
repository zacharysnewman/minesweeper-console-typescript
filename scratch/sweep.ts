import { solvePentagon, Spec } from "../src/Shapes/pentagonShapes";
import { typesOf } from "../src/Shapes/pentagonTypes";
import { searchArrangement } from "../src/Shapes/arrange";
import { deriveOffsets } from "../src/Shapes/Tiling";

export const SPECS: { type: number; spec: Spec }[] = [
  { type: 1, spec: (t, s) => ({ angles: [110, 100, 80, 130, 120], lengths: [t, 1, s, 1, 1.2] }) },
  { type: 2, spec: (t, s) => ({ angles: [120, 100, 130, 80, 110], lengths: [t, 1, s, 1, s] }) },
  { type: 3, spec: (t, s) => ({ angles: [120, 100, 120, 120, 80], lengths: [1, 1, t, t + s, s] }) },
  { type: 4, spec: (t, s) => ({ angles: [130, 90, 110, 90, 120], lengths: [t, 1, 1, s, s] }) },
  { type: 5, spec: (t, s) => ({ angles: [60, 100, 150, 120, 110], lengths: [1, 1, s, t, t] }) },
  { type: 6, spec: (t, s) => ({ angles: [200 - t, t, 160 - t, 180 - t, 2 * t], lengths: [1, s, s, 1, 1] }) },
  { type: 7, spec: (t, s) => ({ angles: [134 + s - 180, 360 - 2 * s, 134, 360 - 268, s], lengths: [t, 1, 1, 1, 1] }) },
  { type: 8, spec: (t, s) => ({ angles: [s - 70, 110, 140, 360 - 2 * s, s], lengths: [t, 1, 1, 1, 1] }) },
  { type: 9, spec: (t, s) => ({ angles: [110, s - 70, 140, 360 - 2 * s, s], lengths: [t, 1, 1, 1, 1] }) },
  { type: 10, spec: (t, s) => ({ angles: [90, 120, 120, 150, 60], lengths: [t + s, t + s, t, 1, s] }) },
  { type: 11, spec: (t, s) => ({ angles: [90, 144, 360 - 288, 270 - 144, 288 - 180], lengths: [t, 1, s, 2 * t + s, 2 * t + s] }) },
  { type: 12, spec: (t, s) => ({ angles: [90, 144, 360 - 288, 270 - 144, 288 - 180], lengths: [t, 1, s, 2 * t, 2 * t - s] }) },
  { type: 13, spec: (t, s) => ({ angles: [110, 90, 110, 140, 90], lengths: [t, 1, s, 2 * t, t] }) },
  { type: 14, spec: (t, s) => ({ angles: [90, s, 360 - 2 * s, 270 - s, 2 * s - 180], lengths: [t, 1, t, 2 * t, 2 * t] }) },
  { type: 15, spec: (t, s) => ({ angles: [150, 60, 135, 105, 90], lengths: [s, 2 * s, s, t, s] }) },
];

if (require.main === module) {
  const only = process.argv[2] ? process.argv[2].split(",").map(Number) : undefined;
  for (const { type, spec } of SPECS) {
    if (only && !only.includes(type)) continue;
    const p = solvePentagon(spec);
    if (!p) { console.log(`type ${type}: no pentagon closes`); continue; }
    const t0 = Date.now();
    const seeds = Number(process.env.SEEDS || "1");
    const f = searchArrangement(p, { maxSeeds: seeds, milliseconds: Number(process.env.MS || "60000") });
    const deg = f ? deriveOffsets(f.tiling).map((o) => o.length) : [];
    console.log(
      `type ${type}: [${typesOf(p)}] ${f ? `-> ${f.tiling.cells} cells, max deg ${Math.max(...deg)}, ${f.how}` : `-> none (${seeds} seeds)`} (${Date.now() - t0}ms)`
    );
  }
}
