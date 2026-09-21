import { EventAggregator } from "../Events/EventAggregator";
import { GenerateTileGridEvent, StateChangedEvent } from "../Events/Events";
import { Game } from "../State/Game";
import { Coords } from "../State/Coords";
import { State } from "../State/State";
import { Tile } from "../State/Tile";
import { TileGrid } from "../State/TileGrid";
import { TileState } from "../State/TileState";
import { winLoseCheck } from "../State/winLoseCheck";
import { WinLoseStatus } from "../State/WinLoseStatus";
import { TileGridInformation } from "../TileGridGeneration/TileGridInformation";
import { ActionResult } from "./ActionResult";
import { Direction } from "./Direction";
import {
  MarkTileEvent,
  MovePlayerEvent,
  PlayerStateChangedEvent,
  SpawnPlayerEvent,
} from "./MiningEvents";
import { resolveMark, resolveMove } from "./movement";
import { Player } from "./Player";
import { PlayerState } from "./PlayerState";
import { pickSpawn } from "./spawn";
import { Terrain, terrainAt } from "./Terrain";

// The project has no test runner, so the mining rules check themselves:
// `npm run mine:check`. Everything below is deterministic — the boards are
// hand built rather than generated, so a red line here is a real change in
// behaviour and not an unlucky shuffle.

let failures = 0;
function check(label: string, ok: boolean): void {
  if (!ok) {
    failures++;
  }
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
}

// Builds a grid from rows of glyphs. x is the row and y the column, matching
// the rest of the project. '#' rock, '.' open cave, '!' marked, '*' hidden
// bomb, ',' revealed bomb.
function grid(...rows: string[]): TileGrid {
  const states: Record<string, [TileState, boolean]> = {
    "#": [TileState.hidden, false],
    ".": [TileState.revealed, false],
    "!": [TileState.flagged, false],
    "*": [TileState.hidden, true],
    ",": [TileState.revealed, true],
  };
  const tiles: Tile[] = [];
  rows.forEach((row, x) => {
    [...row].forEach((glyph, y) => {
      const [tileState, isBomb] = states[glyph];
      tiles.push(new Tile(new Coords(x, y), tileState, isBomb));
    });
  });
  return new TileGrid(
    new TileGridInformation(rows.length, rows[0].length, 0),
    tiles
  );
}

const at = (x: number, y: number) => new PlayerState(new Coords(x, y), Direction.north, 0, true);

console.log("\nterrain");
{
  const g = grid("#.!", "*,.");
  check("hidden rock reads as rock", terrainAt(g, new Coords(0, 0)) === Terrain.rock);
  check("revealed tile reads as open", terrainAt(g, new Coords(0, 1)) === Terrain.open);
  check("flagged tile reads as marked", terrainAt(g, new Coords(0, 2)) === Terrain.marked);
  check("a hidden bomb is indistinguishable from rock", terrainAt(g, new Coords(1, 0)) === Terrain.rock);
  check("off the north edge is bedrock", terrainAt(g, new Coords(-1, 0)) === Terrain.bedrock);
  check("off the south edge is bedrock", terrainAt(g, new Coords(2, 0)) === Terrain.bedrock);
  check("off the west edge is bedrock", terrainAt(g, new Coords(0, -1)) === Terrain.bedrock);
  check("off the east edge is bedrock", terrainAt(g, new Coords(0, 3)) === Terrain.bedrock);
}

console.log("\nmovement");
{
  //     y=0 1 2        the player stands at (1,1): open cave to the north and
  // x=0  #  .  #        west, rock to the south, marked rock to the east.
  // x=1  .  .  !
  // x=2  #  #  #
  const g = grid("#.#", "..!", "###");
  const player = at(1, 1);

  const north = resolveMove(player, g, Direction.north);
  check("stepping into open cave moves the player", north.player.coords.equals(new Coords(0, 1)) === true);
  check("a step asks the game layer for nothing", north.activate === undefined);
  check("a step records moved", north.player.lastResult === ActionResult.moved);
  check("a step faces the way it went", north.player.facing === Direction.north);

  const south = resolveMove(player, g, Direction.south);
  check("walking into rock leaves the player where they were", south.player.coords.equals(player.coords) === true);
  check("walking into rock asks the game layer to reveal it", south.activate?.coords.equals(new Coords(2, 1)) === true && south.activate?.flagMode === false);
  check("walking into rock records dug", south.player.lastResult === ActionResult.dug);
  check("walking into rock counts a dig", south.player.digCount === 1);

  const east = resolveMove(player, g, Direction.east);
  check("marked rock blocks the step", east.player.coords.equals(player.coords) === true);
  check("marked rock is never dug by a step", east.activate === undefined);
  check("a blocked step records blocked", east.player.lastResult === ActionResult.blocked);
  check("a blocked step still turns the player", east.player.facing === Direction.east);

  const edge = resolveMove(at(0, 0), g, Direction.north);
  check("bedrock blocks the step", edge.player.coords.equals(new Coords(0, 0)) === true);
  check("bedrock is never dug", edge.activate === undefined);

  check("resolveMove leaves the grid alone", g.tileArray.filter((t) => t.tileState === TileState.revealed).length === 3);
  check("resolveMove leaves the player value alone", player.digCount === 0 && player.facing === Direction.north);
}

console.log("\nmarking");
{
  //     y=0 1 2        north of the player is already marked, south is rock,
  // x=0  #  !  #        west and east are open cave.
  // x=1  .  .  .
  // x=2  #  #  #
  const g = grid("#!#", "...", "###");
  const player = at(1, 1);

  const markRock = resolveMark(player, g, Direction.south);
  check("marking rock asks for a flag", markRock.activate?.coords.equals(new Coords(2, 1)) === true && markRock.activate?.flagMode === true);
  check("marking records marked", markRock.player.lastResult === ActionResult.marked);
  check("marking never moves the player", markRock.player.coords.equals(player.coords) === true);

  const markMarked = resolveMark(player, g, Direction.north);
  check("marking a marked tile asks for the same toggle", markMarked.activate?.coords.equals(new Coords(0, 1)) === true && markMarked.activate?.flagMode === true);

  const markOpen = resolveMark(player, g, Direction.west);
  check("open cave cannot be marked", markOpen.activate === undefined && markOpen.player.lastResult === ActionResult.blocked);
}

console.log("\nspawn");
{
  const untouched = grid("###", "*##", "###");
  check("an untouched board can spawn anywhere (first dig is safe)", pickSpawn(untouched, () => 0)!.equals(new Coords(0, 0)) === true);
  check("spawn picks by the random it is given", pickSpawn(untouched, () => 0.99)!.equals(new Coords(2, 2)) === true);

  const played = grid("#.#", "#,#", "###");
  const spawn = pickSpawn(played, () => 0.5)!;
  check("a played board spawns on opened cave", terrainAt(played, spawn) === Terrain.open);
  check("a played board never spawns on a revealed bomb", spawn.equals(new Coords(1, 1)) === false);

  check("an empty board has nowhere to spawn", pickSpawn(new TileGrid()) === undefined);
}

console.log("\nthe wiring, end to end");
{
  // Seeded so the board and the walk are both reproducible: Shuffler and
  // pickSpawn both reach for Math.random.
  const realRandom = Math.random;
  const seeded = (seed: number) => {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  let latest: State = new State();
  EventAggregator.get(StateChangedEvent).subscribe((s) => (latest = s));
  let playerEvents = 0;
  EventAggregator.get(PlayerStateChangedEvent).subscribe(() => playerEvents++);

  Game.init();
  Player.init();

  const dirs = [
    Direction.north,
    Direction.south,
    Direction.east,
    Direction.west,
  ];
  let walkedNeverMovedRock = true;
  let stoodOnlyOnCave = true;
  let stayedOnTheBoard = true;
  let seenDig = false;
  let seenMove = false;
  let seenBlocked = false;
  let seenDecidedCave = false;
  let liveInputs = 0;

  try {
    for (let seed = 1; seed <= 5; seed++) {
      const rng = seeded(seed * 7919);
      Math.random = rng;

      EventAggregator.get(GenerateTileGridEvent).publish(
        new TileGridInformation(8, 12, 10)
      );
      if (seed === 1) {
        check("a board with no player on it is still a board", Player.state.isSpawned === false);
        const before = playerEvents;
        EventAggregator.get(MovePlayerEvent).publish(Direction.north);
        check("input before the player exists does nothing", playerEvents === before);
      }

      EventAggregator.get(SpawnPlayerEvent).publish();
      const spawn = Player.state.coords;
      if (seed === 1) {
        check("the player spawns on opened cave", Player.state.isSpawned === true && terrainAt(latest.tileGrid, spawn) === Terrain.open);
        check("the spawn tile is never a bomb", latest.tileGrid.tileArray.find((t) => t.coords.equals(spawn))!.isBomb !== true);
      }

      // Wander. Whatever the cave turns out to be, the two layers stay honest.
      for (let i = 0; i < 400; i++) {
        const boardBefore = latest.tileGrid;
        const playerBefore = Player.state;
        const decided =
          winLoseCheck(latest.tileGrid.tileArray) !== WinLoseStatus.none;
        seenDecidedCave = seenDecidedCave || decided;
        if (!decided) {
          liveInputs++;
        }
        EventAggregator.get(MovePlayerEvent).publish(
          dirs[Math.floor(rng() * dirs.length)]
        );
        if (decided && Player.state !== playerBefore) {
          check("a cave-in ends the walk", false);
        }
        const result = Player.state.lastResult;
        seenDig = seenDig || result === ActionResult.dug;
        seenMove = seenMove || result === ActionResult.moved;
        seenBlocked = seenBlocked || result === ActionResult.blocked;
        if (result !== ActionResult.dug && latest.tileGrid !== boardBefore) {
          walkedNeverMovedRock = false;
        }
        if (result === ActionResult.blocked && !Player.state.coords.equals(playerBefore.coords)) {
          stayedOnTheBoard = false;
        }
        const standing = terrainAt(latest.tileGrid, Player.state.coords);
        stoodOnlyOnCave = stoodOnlyOnCave && standing === Terrain.open;
        stayedOnTheBoard = stayedOnTheBoard && standing !== Terrain.bedrock;
      }
    }
  } finally {
    Math.random = realRandom;
  }

  check("2000 inputs across 5 caves: only digging ever changed the board", walkedNeverMovedRock);
  check("2000 inputs across 5 caves: the player only ever stood on opened cave", stoodOnlyOnCave);
  check("2000 inputs across 5 caves: the player never left the board", stayedOnTheBoard);
  check("the walk exercised moving, digging and being blocked", seenMove && seenDig && seenBlocked);
  check("every input on a live cave ends on a published player state", playerEvents >= liveInputs);
  check("at least one of the five caves was decided mid-walk", seenDecidedCave);

  const marked = Player.state;
  EventAggregator.get(MarkTileEvent).publish(Direction.north);
  check("marking never moves the player", Player.state.coords.equals(marked.coords) === true);

  check("a decided cave stops taking input", (() => {
    // Reveal everything: the board is now won or lost either way.
    const tiles = Game.state.tileGrid.tileArray.map((t) =>
      t.with(undefined, TileState.revealed)
    );
    EventAggregator.get(StateChangedEvent).publish(
      new State(new TileGrid(Game.state.tileGrid.tileGridInfo, tiles))
    );
    const frozen = Player.state;
    for (const d of dirs) {
      EventAggregator.get(MovePlayerEvent).publish(d);
      EventAggregator.get(MarkTileEvent).publish(d);
    }
    return Player.state === frozen;
  })());
  check("a fresh cave takes the player back, decided or not", (() => {
    EventAggregator.get(GenerateTileGridEvent).publish(
      new TileGridInformation(8, 12, 10)
    );
    EventAggregator.get(SpawnPlayerEvent).publish();
    const walkable = terrainAt(latest.tileGrid, Player.state.coords) === Terrain.open;
    const before = Player.state;
    EventAggregator.get(MovePlayerEvent).publish(Direction.south);
    return walkable && Player.state !== before;
  })());
}

console.log(
  failures === 0 ? "\nall checks passed\n" : `\n${failures} check(s) failed\n`
);
process.exit(failures === 0 ? 0 : 1);
