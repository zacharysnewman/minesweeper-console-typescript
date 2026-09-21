import { Coords } from "../State/Coords";
import { Tile } from "../State/Tile";
import { TileGrid } from "../State/TileGrid";
import { TileState } from "../State/TileState";

// Where the player wakes up. `random` is injectable so a caller can seed a
// repeatable run.
export function pickSpawn(
  tileGrid: TileGrid,
  random: () => number = Math.random
): Coords | undefined {
  const tiles = tileGrid.tileArray;
  if (tiles.length === 0) {
    return undefined;
  }

  // On an untouched grid every tile is a safe spawn: the first activation
  // regenerates the board around it (see TileGrid.withActivatedTile), so the
  // player always wakes up in a bomb-free pocket. Once the board has been
  // played, fall back to cave the player has already opened — that keeps the
  // spawn honest, since the only isBomb values read here belong to tiles the
  // player can already see.
  const untouched = tiles.every((t) => t.tileState === TileState.hidden);
  const candidates: Tile[] = untouched
    ? tiles
    : tiles.filter(
        (t) => t.tileState === TileState.revealed && t.isBomb !== true
      );
  const pool = candidates.length > 0 ? candidates : tiles;

  return pool[Math.floor(random() * pool.length)].coords;
}
