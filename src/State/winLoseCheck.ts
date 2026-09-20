import { Tile } from "./Tile";
import { TileState } from "./TileState";
import { WinLoseStatus } from "./WinLoseStatus";

// Shared by every renderer, so the console and the web board can never disagree
// about whether a game is over.
export function winLoseCheck(tiles: Tile[]): WinLoseStatus {
  const isBombRevealed = tiles.some(
    (x) => x.isBomb && x.tileState === TileState.revealed
  );
  if (isBombRevealed) {
    return WinLoseStatus.lose;
  }
  const allTilesAreRevealed = tiles.every(
    (x) => x.isBomb || (!x.isBomb && x.tileState === TileState.revealed)
  );
  if (allTilesAreRevealed) {
    return WinLoseStatus.win;
  }

  return WinLoseStatus.none;
}
