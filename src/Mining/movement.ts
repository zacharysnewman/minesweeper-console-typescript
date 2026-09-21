import { Coords } from "../State/Coords";
import { TileGrid } from "../State/TileGrid";
import { ActionResult } from "./ActionResult";
import { Direction, step } from "./Direction";
import { PlayerState } from "./PlayerState";
import { Terrain, terrainAt } from "./Terrain";

// A tile activation the player wants the game layer to perform. The movement
// rules never apply it; they hand it back so the session can publish an
// ActivateTileEvent, which is the one door into game state.
export interface ActivateRequest {
  readonly coords: Coords;
  readonly flagMode: boolean;
}

export interface PlayerAction {
  readonly player: PlayerState;
  readonly activate?: ActivateRequest;
}

// Walking into rock digs it and leaves the player standing where they were, so
// uncovering a tile and stepping onto it are two separate presses. Flip the
// `dug` case to move onto the target as well if you want one-press digging,
// but then the grid has to be re-read first: the dig has not happened yet.
export function resolveMove(
  player: PlayerState,
  tileGrid: TileGrid,
  direction: Direction
): PlayerAction {
  const facing = player.with({ facing: direction });
  const target = step(player.coords, direction);

  switch (terrainAt(tileGrid, target)) {
    case Terrain.open:
      return {
        player: facing.with({ coords: target, lastResult: ActionResult.moved }),
      };
    case Terrain.rock:
      return {
        player: facing.with({
          digCount: facing.digCount + 1,
          lastResult: ActionResult.dug,
        }),
        activate: { coords: target, flagMode: false },
      };
    default:
      return { player: facing.with({ lastResult: ActionResult.blocked }) };
  }
}

// Flag or unflag the tile ahead. The game layer owns the toggle, so both
// directions of it come back here as the same request.
export function resolveMark(
  player: PlayerState,
  tileGrid: TileGrid,
  direction: Direction
): PlayerAction {
  const facing = player.with({ facing: direction });
  const target = step(player.coords, direction);
  const terrain = terrainAt(tileGrid, target);

  if (terrain === Terrain.rock || terrain === Terrain.marked) {
    return {
      player: facing.with({ lastResult: ActionResult.marked }),
      activate: { coords: target, flagMode: true },
    };
  }
  return { player: facing.with({ lastResult: ActionResult.blocked }) };
}
