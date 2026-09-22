import { Coords } from "../State/Coords";
import { Tile } from "../State/Tile";
import { TileState } from "../State/TileState";
import { WinLoseStatus } from "../State/WinLoseStatus";
import { Board } from "./Board";
import { layoutFor, digitFontSize, glyphFontSize, Layout } from "./geometry";
import { colorForCount } from "./numberPalette";

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

export const FACE_HIDDEN = "#c0c0c0";
export const FACE_REVEALED = "#d6d6d6";
export const FACE_DETONATED = "#d08b8b";
export const EDGE_LIGHT = "#ffffff";
export const EDGE_DARK = "#7b7b7b";

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
    const size = glyphFontSize(layout);
    parts.push(
      `<text x="${centre.x.toFixed(2)}" y="${centre.y.toFixed(2)}" ` +
        `font-size="${size.toFixed(2)}" text-anchor="middle" ` +
        `dominant-baseline="central" data-ink="box">${art.glyph}</text>`
    );
  } else if (art.count !== undefined) {
    const digits = String(art.count).length;
    const size = digitFontSize(layout, digits);
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
  const w = layout.boardWidth(board.info.cols);
  const h = layout.boardHeight(board.info.rows);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(0)}" height="${h.toFixed(0)}" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}">${cells}</svg>`;
}
