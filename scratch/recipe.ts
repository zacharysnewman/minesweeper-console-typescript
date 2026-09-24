import { solvePentagon } from "../src/Shapes/pentagonShapes";
import { searchArrangement } from "../src/Shapes/arrange";
import { deriveOffsets } from "../src/Shapes/Tiling";
import { SPECS } from "./sweep";

const want = process.argv[2].split(",").map(Number);
for (const { type, spec } of SPECS) {
  if (!want.includes(type)) continue;
  const cell = solvePentagon(spec)!;
  const f = searchArrangement(cell, { maxSeeds: Number(process.env.SEEDS || "1"), milliseconds: 300000 });
  if (!f) { console.log(`type ${type}: none`); continue; }
  const deg = deriveOffsets(f.tiling).map((o) => o.length);
  console.log(`type ${type}: ${f.tiling.cells} cells, maxdeg ${Math.max(...deg)}`);
  console.log(`  recipe ${JSON.stringify(f.recipe)}`);
  console.log(`  across ${f.tiling.across.x.toFixed(4)},${f.tiling.across.y.toFixed(4)} down ${f.tiling.down.x.toFixed(4)},${f.tiling.down.y.toFixed(4)}`);
}
