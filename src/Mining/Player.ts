import { EventAggregator } from "../Events/EventAggregator";
import { ActivateTileEvent, StateChangedEvent } from "../Events/Events";
import { State } from "../State/State";
import { TileGrid } from "../State/TileGrid";
import { winLoseCheck } from "../State/winLoseCheck";
import { WinLoseStatus } from "../State/WinLoseStatus";
import { Direction } from "./Direction";
import {
  MarkTileEvent,
  MovePlayerEvent,
  PlayerStateChangedEvent,
  SpawnPlayerEvent,
} from "./MiningEvents";
import { PlayerAction, resolveMark, resolveMove } from "./movement";
import { PlayerState } from "./PlayerState";
import { pickSpawn } from "./spawn";
import { Terrain, terrainAt } from "./Terrain";

// The player layer, shaped like Game: it owns one immutable value and swaps it
// in response to events. It never touches Game.state. The only way it changes
// the board is by publishing ActivateTileEvent, exactly like a renderer does,
// so the game logic cannot tell a miner from a mouse click.
//
// It keeps its own copy of the last TileGrid it saw rather than reading
// Game.state, so the rules stay driven by events and a second board (a replay,
// a test, a different game entirely) needs no change here.
export abstract class Player {
  public static state: PlayerState = new PlayerState();
  private static tileGrid: TileGrid = new TileGrid();

  public static init(): void {
    EventAggregator.get(StateChangedEvent).subscribe(Player.onStateChanged);
    EventAggregator.get(SpawnPlayerEvent).subscribe(Player.onSpawnPlayer);
    EventAggregator.get(MovePlayerEvent).subscribe(Player.onMovePlayer);
    EventAggregator.get(MarkTileEvent).subscribe(Player.onMarkTile);
  }

  private static onStateChanged(newState: State): void {
    Player.tileGrid = newState.tileGrid;
  }

  private static onSpawnPlayer(): void {
    const coords = pickSpawn(Player.tileGrid);
    if (coords === undefined) {
      return;
    }

    Player.state = PlayerState.spawnedAt(coords);

    // Hollow out the pocket the player wakes up in. On a fresh board this is
    // the first activation, so the bombs are regenerated around the spawn and
    // the flood reveal gives the player somewhere to walk.
    if (terrainAt(Player.tileGrid, coords) === Terrain.rock) {
      EventAggregator.get(ActivateTileEvent).publish(coords, false);
    }

    Player.publish();
  }

  private static onMovePlayer(direction: Direction): void {
    Player.apply(resolveMove(Player.state, Player.tileGrid, direction));
  }

  private static onMarkTile(direction: Direction): void {
    Player.apply(resolveMark(Player.state, Player.tileGrid, direction));
  }

  private static apply(action: PlayerAction): void {
    // No player on the board yet, and no walking away from a cave-in: once the
    // board is decided, the only thing that moves the miner again is a new
    // cave. The rule is derived from the board rather than stored, so it stays
    // in step with whatever the game layer decides a win or a loss is.
    if (!Player.state.isSpawned || Player.isCaveDecided()) {
      return;
    }
    Player.state = action.player;

    // Publishing the activation runs the game layer inline: by the time this
    // returns, Player.tileGrid already holds the board the dig produced.
    if (action.activate !== undefined) {
      EventAggregator.get(ActivateTileEvent).publish(
        action.activate.coords,
        action.activate.flagMode
      );
    }

    Player.publish();
  }

  private static isCaveDecided(): boolean {
    const tiles = Player.tileGrid.tileArray;
    return tiles.length > 0 && winLoseCheck(tiles) !== WinLoseStatus.none;
  }

  // Always published, even when nothing moved, so this is the one reliable
  // signal that an input has finished settling: it comes after the board
  // change the input caused, never before it.
  private static publish(): void {
    EventAggregator.get(PlayerStateChangedEvent).publish(Player.state);
  }
}
