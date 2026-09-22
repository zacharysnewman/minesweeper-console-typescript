import * as fs from "fs";
import * as path from "path";
import { Coords } from "../src/State/Coords";
import { Tile } from "../src/State/Tile";
import { TileState } from "../src/State/TileState";
import { WinLoseStatus } from "../src/State/WinLoseStatus";
import { allShapes, Shape, shapeName } from "../src/Shapes/Shape";
import { layoutFor } from "../src/Shapes/geometry";
import { topologyFor } from "../src/Shapes/Topology";
import { cellArt, cellSvg, GLYPHS, FACE_HIDDEN } from "../src/Shapes/svg";
import { NUMBER_COLORS } from "../src/Shapes/numberPalette";

// Draws every cell a board can show, on every shape, so the art can be looked
// at rather than reasoned about. `npm run specimen` writes the page and
// `npm run shots` photographs it.
//
// Cells are laid out one per row of the tiling so each is drawn in isolation;
// the neighbouring-cell packing is a separate question from whether a glyph
// fits inside one.

const CONTENT = 34;

// A cell drawn on its own, at whichever coordinate gives the orientation
// asked for. Triangles have two, so both get shown.
function specimenCell(
  shape: Shape,
  art: ReturnType<typeof cellArt>,
  orientation: "up" | "down" = "up"
): string {
  const layout = layoutFor(shape, CONTENT);
  // (0,0) points up for a triangle; (0,1) points down.
  const coords = new Coords(0, orientation === "up" ? 0 : 1);
  const w = layout.cellWidth + 4;
  const h = layout.cellHeight + 4;
  const shifted = layoutFor(shape, CONTENT);
  const body = cellSvg(shifted, coords, art);
  // Translate so the cell's own bounding box lands inside the viewport.
  const ox = shape === Shape.triangle && orientation === "down"
    ? -(layout.cellWidth / 2) + 2
    : 2;
  return (
    `<svg width="${w.toFixed(0)}" height="${h.toFixed(0)}" ` +
    `viewBox="${(-ox).toFixed(2)} -2 ${w.toFixed(2)} ${h.toFixed(2)}" ` +
    `xmlns="http://www.w3.org/2000/svg">${body}</svg>`
  );
}

function tile(state: TileState, isBomb: boolean): Tile {
  return new Tile(new Coords(0, 0), state, isBomb);
}

interface Spec {
  label: string;
  art: ReturnType<typeof cellArt>;
}

function specsFor(shape: Shape): Spec[] {
  const degree = topologyFor(shape).degree;
  const specs: Spec[] = [
    {
      label: "hidden",
      art: cellArt(tile(TileState.hidden, false), 0, WinLoseStatus.none),
    },
    {
      label: "flagged",
      art: cellArt(tile(TileState.flagged, false), 0, WinLoseStatus.none),
    },
    {
      label: "empty",
      art: cellArt(tile(TileState.revealed, false), 0, WinLoseStatus.none),
    },
  ];
  for (let n = 1; n <= degree; n++) {
    specs.push({
      label: String(n),
      art: cellArt(tile(TileState.revealed, false), n, WinLoseStatus.none),
    });
  }
  specs.push(
    {
      label: "detonated",
      art: cellArt(tile(TileState.revealed, true), 0, WinLoseStatus.lose),
    },
    {
      label: "bomb shown",
      art: cellArt(tile(TileState.hidden, true), 0, WinLoseStatus.lose),
    },
    {
      label: "wrong flag",
      art: cellArt(tile(TileState.flagged, false), 0, WinLoseStatus.lose),
    }
  );
  return specs;
}

function section(shape: Shape): string {
  const name = shapeName(shape);
  const degree = topologyFor(shape).degree;
  const layout = layoutFor(shape, CONTENT);
  const specs = specsFor(shape);

  const row = (orientation: "up" | "down") =>
    specs
      .map(
        (s) =>
          `<figure><div class="cell">${specimenCell(shape, s.art, orientation)}</div>` +
          `<figcaption>${s.label}</figcaption></figure>`
      )
      .join("");

  const orientations =
    shape === Shape.triangle
      ? `<h3>point up</h3><div class="row">${row("up")}</div>` +
        `<h3>point down</h3><div class="row">${row("down")}</div>`
      : `<div class="row">${row("up")}</div>`;

  return `<section>
    <h2>${name} <span class="meta">${degree} neighbours &middot; cell ${layout.cellWidth.toFixed(0)}&times;${layout.cellHeight.toFixed(0)}px &middot; content circle ${CONTENT}px</span></h2>
    ${orientations}
  </section>`;
}

// The numbers on their own, at a large size, so the colours can be compared
// against each other rather than through the cell art.
function swatches(): string {
  const cells = Object.keys(NUMBER_COLORS)
    .map(Number)
    .sort((a, b) => a - b)
    .map(
      (n) =>
        `<figure><div class="swatch" style="color:${NUMBER_COLORS[n]}">${n}</div>` +
        `<figcaption>${NUMBER_COLORS[n]}</figcaption></figure>`
    )
    .join("");
  return `<section><h2>number palette <span class="meta">on the #c0c0c0 face</span></h2><div class="row">${cells}</div></section>`;
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>Shape specimen</title>
<style>
  body { margin: 0; padding: 28px; background: #3a3a3a; color: #f0f0f0;
         font-family: DejaVu Sans, Verdana, sans-serif; }
  h1 { font-size: 1.2rem; margin: 0 0 4px; }
  h2 { font-size: 1rem; margin: 28px 0 8px; }
  h3 { font-size: .8rem; font-weight: 400; color: #b8b8b8; margin: 12px 0 4px; }
  .meta { font-weight: 400; color: #b8b8b8; font-size: .78rem; }
  .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
  figure { margin: 0; text-align: center; }
  .cell { background: ${FACE_HIDDEN}; padding: 3px; display: inline-flex; }
  .swatch { background: ${FACE_HIDDEN}; width: 48px; height: 48px; display: grid;
            place-items: center; font-size: 26px; font-weight: 700; }
  figcaption { font-size: .66rem; color: #c8c8c8; margin-top: 3px; }
  .note { font-size: .78rem; color: #b8b8b8; max-width: 70ch; }
</style></head>
<body>
<h1>Shape specimen</h1>
<p class="note">Every cell state on every tiling, each drawn alone. Glyphs are ${GLYPHS.flag} ${GLYPHS.bomb} ${GLYPHS.detonated} ${GLYPHS.wrongFlag}; numbers are text. Cells are sized so their inscribed circle is the same ${CONTENT}px on all three shapes, which is what makes a glyph the same size in each.</p>
${allShapes.map(section).join("")}
${swatches()}
</body></html>`;

const out = path.join(__dirname, "..", ".specimen");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "index.html"), html);
console.log(`wrote ${path.join(out, "index.html")}`);
