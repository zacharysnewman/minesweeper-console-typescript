import { Coords } from "../State/Coords";
import { Tile } from "../State/Tile";
import { TileGrid } from "../State/TileGrid";
import { TileState } from "../State/TileState";

// How the mining layer reads a minesweeper board as a cave. This is the only
// place that translates TileState into something the player can walk on, and
// it is strictly read-only: nothing here returns a new TileGrid.
export enum Terrain {
  // Off the edge of the map, or a coordinate the grid has no tile for.
  bedrock,
  // Unrevealed rock. Walking into it digs instead of moving.
  rock,
  // Rock the player flagged. Blocks movement so a marked cave-in is never dug
  // by a stray keypress.
  marked,
  // Revealed tile: open cave floor.
  open,
}

export function isInBounds(tileGrid: TileGrid, coords: Coords): boolean {
  const { Width, Height } = tileGrid.tileGridInfo;
  return (
    coords.x >= 0 && coords.x < Width && coords.y >= 0 && coords.y < Height
  );
}

export function tileAt(tileGrid: TileGrid, coords: Coords): Tile | undefined {
  return tileGrid.tileArray.find((t) => t.coords.equals(coords));
}

export function terrainAt(tileGrid: TileGrid, coords: Coords): Terrain {
  const tile = isInBounds(tileGrid, coords)
    ? tileAt(tileGrid, coords)
    : undefined;
  if (tile === undefined) {
    return Terrain.bedrock;
  }
  switch (tile.tileState) {
    case TileState.revealed:
      return Terrain.open;
    case TileState.flagged:
      return Terrain.marked;
    default:
      return Terrain.rock;
  }
}

export function isWalkable(tileGrid: TileGrid, coords: Coords): boolean {
  return terrainAt(tileGrid, coords) === Terrain.open;
}
