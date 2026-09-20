import { Tile } from "../State/Tile";
import { TileState } from "../State/TileState";
import { TileGrid } from "../State/TileGrid";
import { WinLoseStatus } from "../State/WinLoseStatus";

// tileset.png is a 16x224 vertical strip of 14 16px tiles. These indices are
// the slice order recorded in the Unity importer metadata
// (OriginalTileset.png.meta), top to bottom.
export const TILE_SIZE = 16;
export const TILE_INDEX = {
  nearbyBombs: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  hidden: 9,
  flagged: 10,
  bombIncorrect: 11,
  bombDetonated: 12,
  bombRevealed: 13,
} as const;

// smileys.png is 139x84 with five 25px faces in a row. Unity stores sprite
// rects bottom-up, so the y=34 row sits 25px from the top.
export const SMILEY_SIZE = 25;
export const SMILEY_TOP = 25;
export const SMILEY_X = {
  active: 1,
  activeClicked: 28,
  tileClicked: 55,
  won: 82,
  lost: 109,
} as const;

export type SmileyFace = keyof typeof SMILEY_X;

// A direct port of RendererBehaviour.GetSpriteForTile from the Unity project,
// returning a tileset row instead of a Sprite reference.
export function tileIndexFor(
  tiles: Tile[],
  tile: Tile,
  winLoseStatus: WinLoseStatus
): number {
  switch (tile.tileState) {
    case TileState.hidden:
      return tile.isBomb && winLoseStatus === WinLoseStatus.lose
        ? TILE_INDEX.bombRevealed
        : TILE_INDEX.hidden;
    case TileState.revealed:
      if (tile.isBomb) {
        return TILE_INDEX.bombDetonated;
      }
      return TILE_INDEX.nearbyBombs[
        TileGrid.getNearbyBombCount(tiles, tile.coords)
      ];
    case TileState.flagged:
      return !tile.isBomb && winLoseStatus === WinLoseStatus.lose
        ? TILE_INDEX.bombIncorrect
        : TILE_INDEX.flagged;
    default:
      return TILE_INDEX.hidden;
  }
}
