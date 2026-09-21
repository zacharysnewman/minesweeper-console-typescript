import chalk from "chalk";
import { EventAggregator } from "../../Events/EventAggregator";
import { StateChangedEvent } from "../../Events/Events";
import { Coords } from "../../State/Coords";
import { State } from "../../State/State";
import { Tile } from "../../State/Tile";
import { TileGrid } from "../../State/TileGrid";
import { TileState } from "../../State/TileState";
import { winLoseCheck } from "../../State/winLoseCheck";
import { WinLoseStatus } from "../../State/WinLoseStatus";
import { ActionResult } from "../ActionResult";
import { directionName } from "../Direction";
import { PlayerStateChangedEvent } from "../MiningEvents";
import { PlayerState } from "../PlayerState";

const rowLabels = "abcdefghijklmnopqrstuvwxyz".toUpperCase();

// The one place the two layers meet. It holds the latest of each and draws
// them together; neither layer knows the other is being drawn.
//
// The two layers settle one after the other inside a single input — a dig
// changes the board before the player state that caused it is published — so
// the subscriptions only cache and the caller asks for the frame once the
// input is fully handled. Drawing from the subscriptions instead would show a
// half-settled cave for a moment.
export abstract class MiningRenderer {
  private static tileGrid: TileGrid = new TileGrid();
  private static player: PlayerState = new PlayerState();

  private static readonly commandList: string =
    "Move: w a s d (north west south east), or a run of them like 'wwdd'\n" +
    "Mark: 'f d' or 'mark north' [flags the rock ahead so you cannot dig it]\n" +
    "new / new <bombs> [fresh cave]   look [redraw]   q [quit]";

  public static init(): void {
    EventAggregator.get(StateChangedEvent).subscribe(
      MiningRenderer.onStateChanged
    );
    EventAggregator.get(PlayerStateChangedEvent).subscribe(
      MiningRenderer.onPlayerStateChanged
    );
  }

  private static onStateChanged(newState: State): void {
    MiningRenderer.tileGrid = newState.tileGrid;
  }

  private static onPlayerStateChanged(newPlayer: PlayerState): void {
    MiningRenderer.player = newPlayer;
  }

  // `notice` is for things the cave itself would not say — an unparsed
  // command, mostly. It lives in the frame because the frame clears the
  // screen, so anything logged around it is gone before it can be read.
  public static draw(notice?: string): void {
    const { tileGridInfo, tileArray } = MiningRenderer.tileGrid;
    if (tileArray.length === 0) {
      return;
    }
    const winLoseStatus = winLoseCheck(tileArray);
    const player = MiningRenderer.player;

    console.clear();

    let output = chalk.yellowBright("  M I N E S H A F T\n");
    output += chalk.blackBright(
      "  dig through the rock, mark what you do not trust\n\n"
    );

    const columnHeader =
      "    " +
      Array.from({ length: tileGridInfo.Height }, (_unused, i) => i % 10).join(
        ""
      );
    output += chalk.blackBright(columnHeader) + "\n";

    for (let x = 0; x < tileGridInfo.Width; x++) {
      let row = chalk.blackBright(` ${rowLabels[x]} `);
      for (let y = 0; y < tileGridInfo.Height; y++) {
        const coords = new Coords(x, y);
        row +=
          player.isSpawned && player.coords.equals(coords) === true
            ? chalk.bgBlack(chalk.yellowBright("@"))
            : MiningRenderer.glyphFor(tileArray, coords);
      }
      output += row + chalk.blackBright(` ${rowLabels[x]}`) + "\n";
    }
    output += chalk.blackBright(columnHeader) + "\n\n";

    output += MiningRenderer.hud(player, winLoseStatus) + "\n";
    output += notice === undefined ? "\n" : chalk.yellowBright(notice) + "\n";
    output += chalk.blackBright(MiningRenderer.commandList) + "\n";
    output += "\nEnter Command: ";

    console.log(output);
  }

  private static glyphFor(tiles: Tile[], coords: Coords): string {
    const tile = tiles.find((t) => t.coords.equals(coords));
    if (tile === undefined) {
      return chalk.black("▓");
    }

    switch (tile.tileState) {
      case TileState.flagged:
        return chalk.redBright("!");
      case TileState.revealed:
        if (tile.isBomb === true) {
          return chalk.bgRed(chalk.black("*"));
        }
        return MiningRenderer.floorGlyph(
          TileGrid.getNearbyBombCount(tiles, coords)
        );
      default:
        return chalk.gray("▓");
    }
  }

  // Open cave floor. The count is the same warning minesweeper gives, read
  // here as how much unstable rock is touching this tile.
  private static floorGlyph(nearbyBombs: number): string {
    const palette = [
      chalk.blueBright,
      chalk.greenBright,
      chalk.redBright,
      chalk.blue,
      chalk.red,
      chalk.cyanBright,
      chalk.magenta,
      chalk.white,
    ];
    return nearbyBombs === 0
      ? chalk.blackBright("·")
      : palette[nearbyBombs - 1](String(nearbyBombs));
  }

  private static hud(
    player: PlayerState,
    winLoseStatus: WinLoseStatus
  ): string {
    const where = player.isSpawned
      ? `${rowLabels[player.coords.x]}${player.coords.y}`
      : "--";
    const line =
      chalk.white(
        `At ${where}  facing ${directionName(player.facing)}  digs ${
          player.digCount
        }`
      ) +
      "   " +
      MiningRenderer.statusText(player, winLoseStatus);
    return line;
  }

  private static statusText(
    player: PlayerState,
    winLoseStatus: WinLoseStatus
  ): string {
    if (winLoseStatus === WinLoseStatus.lose) {
      return chalk.redBright("A gas pocket! The shaft caves in. 'new' to dig again.");
    }
    if (winLoseStatus === WinLoseStatus.win) {
      return chalk.greenBright("The cave is fully mapped. You made it out.");
    }

    const facing = directionName(player.facing);
    switch (player.lastResult) {
      case ActionResult.moved:
        return chalk.blackBright(`You walk ${facing}.`);
      case ActionResult.dug:
        return chalk.blackBright(`You dig into the rock to the ${facing}.`);
      case ActionResult.marked:
        return chalk.blackBright(`You mark the rock to the ${facing}.`);
      case ActionResult.blocked:
        return chalk.blackBright(`The way ${facing} is blocked.`);
      default:
        return chalk.blackBright("You wake in a pocket of open cave.");
    }
  }
}
