import readlineSync from "readline-sync";
import { EventAggregator } from "./Events/EventAggregator";
import { GenerateTileGridEvent } from "./Events/Events";
import { Direction } from "./Mining/Direction";
import { MiningRenderer } from "./Mining/Console/MiningRenderer";
import {
  MarkTileEvent,
  MovePlayerEvent,
  SpawnPlayerEvent,
} from "./Mining/MiningEvents";
import { Player } from "./Mining/Player";
import { Game } from "./State/Game";
import { TileGridInformation } from "./TileGridGeneration/TileGridInformation";

// Entry point for the mining experience. It is a sibling of app.ts, not a
// replacement: the console and web minesweepers still start the same way and
// know nothing about any of this.
//
// Input is line based like app.ts, so a line of movement keys ('wwdd') runs as
// a sequence. Swapping in raw keypresses later means changing this file only.
class Mine {
  // Width is the row count and Height the column count, matching the render
  // loops the rest of the project uses.
  private static tileGridInfo: TileGridInformation = new TileGridInformation(
    12,
    24,
    30
  );
  private static isRunning: boolean = true;

  private static readonly directions: Record<string, Direction> = {
    w: Direction.north,
    a: Direction.west,
    s: Direction.south,
    d: Direction.east,
    up: Direction.north,
    down: Direction.south,
    left: Direction.west,
    right: Direction.east,
    north: Direction.north,
    south: Direction.south,
    east: Direction.east,
    west: Direction.west,
  };

  public static main(): void {
    Game.init();
    Player.init();
    MiningRenderer.init();

    Mine.newCave();
    MiningRenderer.draw();

    while (Mine.isRunning) {
      const notice = Mine.execute(
        readlineSync.question("").trim().toLowerCase()
      );
      if (Mine.isRunning) {
        MiningRenderer.draw(notice);
      }
    }
  }

  private static newCave(): void {
    EventAggregator.get(GenerateTileGridEvent).publish(Mine.tileGridInfo);
    EventAggregator.get(SpawnPlayerEvent).publish();
  }

  // Returns a notice for the next frame, if the input deserves one.
  private static execute(input: string): string | undefined {
    const newWithBombs = input.match(Mine.newWithParamsRegex);
    if (newWithBombs !== null) {
      const rawBombs = parseInt(newWithBombs[1], 10);
      const bombs = rawBombs < 1 ? 1 : rawBombs > 200 ? 200 : rawBombs;
      Mine.tileGridInfo = Mine.tileGridInfo.withBombs(bombs);
      Mine.newCave();
      return `A fresh cave, ${bombs} gas pockets in it somewhere.`;
    }
    if (Mine.newRegex.test(input)) {
      Mine.newCave();
      return undefined;
    }
    if (Mine.quitRegex.test(input)) {
      Mine.isRunning = false;
      console.log("You climb back up the shaft.");
      return undefined;
    }

    const mark = input.match(Mine.markRegex);
    const markDirection =
      mark === null ? undefined : Mine.directionFor(mark[2]);
    if (markDirection !== undefined) {
      EventAggregator.get(MarkTileEvent).publish(markDirection);
      return undefined;
    }
    const moveDirection = Mine.directionFor(input);
    if (moveDirection !== undefined) {
      EventAggregator.get(MovePlayerEvent).publish(moveDirection);
      return undefined;
    }
    if (Mine.moveRunRegex.test(input)) {
      for (const key of input) {
        EventAggregator.get(MovePlayerEvent).publish(Mine.directions[key]);
      }
      return undefined;
    }
    if (Mine.lookRegex.test(input)) {
      return undefined;
    }

    return "The cave swallows the sound. Try again.";
  }

  // `in` would answer yes to every name on Object's prototype, so 'constructor'
  // would look like a direction. Same guard difficulty.ts uses.
  private static directionFor(key: string): Direction | undefined {
    return Object.prototype.hasOwnProperty.call(Mine.directions, key)
      ? Mine.directions[key]
      : undefined;
  }

  private static newRegex: RegExp = new RegExp(/^new$/);
  private static newWithParamsRegex: RegExp = new RegExp(/^new ([0-9]+)$/);
  private static quitRegex: RegExp = new RegExp(/^(q|quit|exit)$/);
  private static lookRegex: RegExp = new RegExp(/^(look|l|r)$/);
  private static markRegex: RegExp = new RegExp(/^(f|flag|mark) ([a-z]+)$/);
  private static moveRunRegex: RegExp = new RegExp(/^[wasd]+$/);
}

Mine.main();
