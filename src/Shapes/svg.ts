import { Coords } from "../State/Coords";
import { Tile } from "../State/Tile";
import { TileState } from "../State/TileState";
import { WinLoseStatus } from "../State/WinLoseStatus";
import { Board } from "./Board";
import { layoutFor, GLYPH_OUTLINE_PX, Layout } from "./geometry";
import { BOARD_FACE, colorForCount } from "./numberPalette";

// Board markup as a string, with no DOM calls, so the same drawing runs in a
// browser and in the screenshot harness.
//
// SVG polygons rather than CSS clip-path: a clipped element cannot carry a
// border or an outline, and a minesweeper cell has to read as raised or
// pressed, so the edge is not optional. Strokes also give hex and triangle
// cells real hit testing, which matters because their bounding boxes overlap
// their neighbours'.

// The art is emoji, so it carries its own colour and needs no theming.
export const GLYPHS = {
  flag: "\u{1F6A9}",
  bomb: "\u{1F4A3}",
  detonated: "\u{1F4A5}",
  wrongFlag: "❌",
} as const;

// The button above the board, as the original game had it: watching, caught
// mid-press, dead, and pleased with itself.
export const FACES = {
  active: "\u{1F642}",
  pressing: "\u{1F62E}",
  lost: "\u{1F635}",
  won: "\u{1F60E}",
} as const;

export type FaceKind = keyof typeof FACES;

// Emoji must name an emoji font, or the fallback chain can answer with a
// monochrome glyph from some coverage font that happens to cover the
// codepoint -- which is how the face button first rendered three of its four
// states as hollow outlines while the fourth came out in colour. It also
// pins the metrics: the glyph sizes are derived from Noto's proportions, so
// Noto is what should be asked for.
export const EMOJI_FONT =
  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

export const GLYPH_OUTLINE_ID = "shape-glyph-outline";
export const GLYPH_OUTLINE_COLOR = "#241f1c";

// A dark edge around the emoji, so they read against the face instead of
// dissolving into it.
//
// A stroke will not do it: colour emoji are bitmap glyphs on most platforms,
// and a bitmap has no path to stroke. Dilating the alpha channel, flooding it
// dark and putting that behind the original outlines whatever shape the glyph
// actually has, bitmap or not.
//
// One definition for the whole document, referenced by id from every cell --
// a filter repeated in nine hundred inline svgs would be nine hundred copies.
export function glyphOutlineDefs(): string {
  return (
    // Positioned out of the way rather than hidden: Safari drops a filter
    // whose defining svg is display:none, and the glyphs referencing it then
    // render as nothing at all.
    `<svg width="1" height="1" aria-hidden="true" focusable="false" ` +
    `style="position:absolute;width:1px;height:1px;overflow:hidden;` +
    `clip-path:inset(50%);pointer-events:none" ` +
    `xmlns="http://www.w3.org/2000/svg"><defs>` +
    `<filter id="${GLYPH_OUTLINE_ID}" x="-35%" y="-35%" width="170%" height="170%">` +
    `<feMorphology in="SourceAlpha" operator="dilate" ` +
    `radius="${GLYPH_OUTLINE_PX}" result="thick" />` +
    `<feFlood flood-color="${GLYPH_OUTLINE_COLOR}" result="ink" />` +
    `<feComposite in="ink" in2="thick" operator="in" result="edge" />` +
    `<feMerge><feMergeNode in="edge" /><feMergeNode in="SourceGraphic" /></feMerge>` +
    `</filter></defs></svg>`
  );
}

// A covered cell cannot carry a bevel the way a square sprite can, so raised
// against flat is carried by value instead: covered is darker than the face
// that opens under it, and wears a light edge where a bevel would catch the
// light.
export const FACE_HIDDEN = "#b5b5b5";
// Taken from the palette rather than declared here, so the numbers are always
// drawn on the face their contrast was measured against.
export const FACE_REVEALED = BOARD_FACE;
export const FACE_DETONATED = "#d08b8b";
export const EDGE_LIGHT = "#eaeaea";
export const EDGE_DARK = "#9a9a9a";

export interface CellArt {
  readonly face: string;
  readonly glyph?: string;
  readonly count?: number;
}

// What a cell shows. The rule is shared by every shape; only the outline
// around it changes.
export function cellArt(
  tile: Tile,
  nearbyBombs: number,
  status: WinLoseStatus
): CellArt {
  switch (tile.tileState) {
    case TileState.hidden:
      return tile.isBomb === true && status === WinLoseStatus.lose
        ? { face: FACE_REVEALED, glyph: GLYPHS.bomb }
        : { face: FACE_HIDDEN };
    case TileState.flagged:
      return tile.isBomb !== true && status === WinLoseStatus.lose
        ? { face: FACE_REVEALED, glyph: GLYPHS.wrongFlag }
        : { face: FACE_HIDDEN, glyph: GLYPHS.flag };
    case TileState.revealed:
      if (tile.isBomb === true) {
        return { face: FACE_DETONATED, glyph: GLYPHS.detonated };
      }
      return nearbyBombs > 0
        ? { face: FACE_REVEALED, count: nearbyBombs }
        : { face: FACE_REVEALED };
    default:
      return { face: FACE_HIDDEN };
  }
}

function points(layout: Layout, coords: Coords): string {
  return layout
    .polygon(coords)
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}

export function cellSvg(
  layout: Layout,
  coords: Coords,
  art: CellArt
): string {
  const centre = layout.center(coords);
  const raised = art.face === FACE_HIDDEN;
  const parts = [
    `<polygon points="${points(layout, coords)}" fill="${art.face}" ` +
      `stroke="${raised ? EDGE_LIGHT : EDGE_DARK}" stroke-width="${raised ? 2 : 1}" ` +
      `stroke-linejoin="round" />`,
  ];

  if (art.glyph !== undefined) {
    const size = layout.glyphSize(coords);
    parts.push(
      `<text x="${centre.x.toFixed(2)}" y="${centre.y.toFixed(2)}" ` +
        `font-size="${size.toFixed(2)}" text-anchor="middle" ` +
        `dominant-baseline="central" data-ink="box" ` +
        `font-family='${EMOJI_FONT}' ` +
        `filter="url(#${GLYPH_OUTLINE_ID})">${art.glyph}</text>`
    );
  } else if (art.count !== undefined) {
    const digits = String(art.count).length;
    const size = layout.digitSize(coords, digits);
    parts.push(
      `<text x="${centre.x.toFixed(2)}" y="${centre.y.toFixed(2)}" ` +
        `font-size="${size.toFixed(2)}" fill="${colorForCount(art.count)}" ` +
        `font-weight="700" text-anchor="middle" dominant-baseline="central" ` +
        `font-family="DejaVu Sans, Verdana, sans-serif" ` +
        `data-ink="cap">${art.count}</text>`
    );
  }

  return parts.join("");
}

export function boardSvg(board: Board, content: number): string {
  const layout = layoutFor(board.info.shape, content);
  const counts = board.nearbyBombCounts();
  const status = WinLoseStatus.none;
  const cells = board.tileArray
    .map((tile) =>
      cellSvg(
        layout,
        tile.coords,
        cellArt(
          tile,
          counts.get(`${tile.coords.x},${tile.coords.y}`) ?? 0,
          status
        )
      )
    )
    .join("");
  const w = layout.boardWidth(board.info.rows, board.info.cols);
  const h = layout.boardHeight(board.info.rows, board.info.cols);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(0)}" height="${h.toFixed(0)}" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}">${cells}</svg>`;
}

// A single cell as a standalone <svg>, sized and positioned by its own
// bounding box. The viewBox is the cell's box in board coordinates, so the
// polygon and text keep the absolute coordinates the layout gives them and
// need no second, local coordinate system.
//
// The polygon takes pointer events and the svg around it does not, which is
// what makes hit testing correct where bounding boxes overlap: a hex row
// overlaps the one above by a quarter, and a triangle overlaps its
// neighbour by half.
export function cellElementSvg(
  layout: Layout,
  coords: Coords,
  art: CellArt
): string {
  const o = layout.origin(coords);
  const w = layout.cellWidth;
  const h = layout.cellHeight;
  return (
    `<svg viewBox="${o.x.toFixed(2)} ${o.y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}" ` +
    `width="${w.toFixed(2)}" height="${h.toFixed(2)}" ` +
    `xmlns="http://www.w3.org/2000/svg" focusable="false">` +
    cellSvg(layout, coords, art) +
    `</svg>`
  );
}

// What a cell is showing, as a short string, so a renderer can skip rewriting
// the cells whose art has not changed.
export function artKey(art: CellArt): string {
  return `${art.face}|${art.glyph ?? ""}|${art.count ?? ""}`;
}
