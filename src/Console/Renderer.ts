import { EventAggregator } from "./../Events/EventAggregator";
import { StateChangedEvent } from "./../Events/Events";
import { State } from "./../State/State";
import { Color } from "./Color";
import { ConsoleString } from "./ConsoleString";
import { CoolRendering } from "./CoolRendering";
import { WinLoseStatus } from "./WinLoseStatus";
import { TileState } from "./../State/TileState";
import { Tile } from "./../State/Tile";
import { Coords } from "./../State/Coords";
import { TileGrid } from "./../State/TileGrid";
import chalk from "chalk";

export abstract class Renderer {
  private static readonly Hidden: ConsoleString = new ConsoleString(
    "#",
    Color.none,
    Color.bgNone
  );
  private static readonly Flagged: ConsoleString = new ConsoleString(
    "#",
    Color.redBright,
    Color.bgNone
  );
  private static readonly BombRevealed: ConsoleString = new ConsoleString(
    "B",
    Color.none,
    Color.bgNone
  );
  private static readonly BombIncorrect: ConsoleString = new ConsoleString(
    "X",
    Color.redBright,
    Color.bgNone
  );
  private static readonly BombDetonated: ConsoleString = new ConsoleString(
    "B",
    Color.none,
    Color.bgRedBright
  );
  private static readonly NearbyBombs: ConsoleString[] = [
    new ConsoleString(" ", Color.white, Color.bgNone),
    new ConsoleString("1", Color.blueBright, Color.bgNone),
    new ConsoleString("2", Color.greenBright, Color.bgNone),
    new ConsoleString("3", Color.redBright, Color.bgNone),
    new ConsoleString("4", Color.blue, Color.bgNone),
    new ConsoleString("5", Color.red, Color.bgNone),
    new ConsoleString("6", Color.cyanBright, Color.bgNone),
    new ConsoleString("7", Color.none, Color.bgNone),
    new ConsoleString("8", Color.gray, Color.bgNone),
  ];

  private static readonly Logo: ConsoleString = new ConsoleString(
    CoolRendering.MinesweeperLogoSmall,
    Color.yellowBright,
    Color.bgBlack
  );

  private static readonly CommandList: string =
    "Commands:\n" +
    "check <row><col> (Ex: 'check a3' or 'g6') [Reveals a tile] \n" +
    "flag <row><col> (Ex: 'flag a3' or 'f g6') [Flags a tile]\n" +
    "new [Generates a new tile grid]\n" +
    "new <bombs> (Ex: 'new 15') [Generates a new tile grid with X bombs]";

  public static init(): void {
    EventAggregator.get(StateChangedEvent).subscribe(Renderer.onStateChanged);
  }

  public static onStateChanged(newState: State): void {
    const { tileGridInfo, tileArray } = newState.tileGrid;
    // const tileArray = tileMapToTileArray(tiles);
    const winLoseStatus = Renderer.WinOrLoseCheck(tileArray);

    console.clear();
    console.log("\n\n\n\n\n\n\n\n\n\n\n");
    // console.log("Tiles: ", tiles);

    let output: string = "";

    // Console.ForegroundColor = ConsoleColor.Yellow;

    // Renderer.Logo.write();
    output += Renderer.Logo;
    // console.log(CoolRendering.MinesweeperLogoSmall);

    // Console.ForegroundColor = ConsoleColor.Black;
    // Console.BackgroundColor = ConsoleColor.White;

    // console.log(
    let gameBoard = "";

    gameBoard += "\n                                               \n     ";
    for (let i = 0; i < 10; i++) {
      // console.log(
      gameBoard += i + "   ";
    }
    // console.log(
    gameBoard += "  \n";

    // console.log("Game board: ", tiles);
    // console.log(tileArray);
    // let c = new Coords(0, 1);
    // let testMap = new Map<[number, number], string>();
    // testMap.set([0, 0], "tile1");
    // testMap.set([0, 1], "test2");
    // console.log(testMap.has([0, 0]));
    // console.log(
    //   new Coords() == new Coords(),
    //   new Coords().equals(new Coords())
    // );

    for (let x = 0; x < tileGridInfo.Width; x++) {
      // console.log(
      gameBoard += "   |---|---|---|---|---|---|---|---|---|---|   \n";
      // console.log(
      gameBoard += " " + "abcdefghijklmnopqrstuvwxyz".toUpperCase()[x] + " | ";
      for (let y = 0; y < tileGridInfo.Height; y++) {
        const tile = tileArray.find((t) =>
          t.coords.equals(new Coords(x, y))
        ) as Tile;
        // console.log(
        gameBoard += Renderer.GetTileString(
          //chalk.red("#");
          tileArray,
          tile,
          winLoseStatus
        );
        // console.log(
        gameBoard += " | ";
      }
      // console.log(
      gameBoard += "abcdefghijklmnopqrstuvwxyz".toUpperCase()[x];
      // console.log(
      gameBoard += " \n";
    }
    // console.log(
    gameBoard += "   |---|---|---|---|---|---|---|---|---|---|   \n     ";
    for (let i = 0; i < 10; i++) {
      // console.log(
      gameBoard += i + "   ";
    }
    // console.log(
    gameBoard += "  \n                                               \n\n";

    output += chalk.bgWhite(chalk.black(gameBoard));
    // Console.ResetColor();

    // console.log(
    output += Renderer.CommandList;
    // console.log(
    output += "\n\n";
    var winOrLoseStatus = Renderer.WinOrLoseCheck(tileArray);
    var gameStatus =
      winOrLoseStatus === WinLoseStatus.win
        ? "You Won!"
        : winLoseStatus === WinLoseStatus.lose
        ? "You Lost!"
        : "In Progress...";
    // console.log(
    output += `Game Status: ${gameStatus}`;

    // console.log(
    output += "\n\nEnter Command: ";

    console.log(output);
  }

  private static WinOrLoseCheck(tiles: Tile[]): WinLoseStatus {
    var isBombRevealed = tiles.some(
      (x) => x.isBomb && x.tileState === TileState.revealed
    );
    if (isBombRevealed) {
      return WinLoseStatus.lose;
    }
    var allTilesAreRevealed = tiles.every(
      (x) => x.isBomb || (!x.isBomb && x.tileState === TileState.revealed)
    );
    if (allTilesAreRevealed) {
      return WinLoseStatus.win;
    }

    return WinLoseStatus.none;
  }

  private static GetTileString(
    tilesArray: Tile[],
    tile: Tile,
    winLoseStatus: WinLoseStatus
  ): ConsoleString {
    let tileString: ConsoleString = Renderer.Hidden;
    switch (tile.tileState) {
      case TileState.hidden:
        if (tile.isBomb && winLoseStatus === WinLoseStatus.lose) {
          tileString = Renderer.BombRevealed;
        } else {
          tileString = Renderer.Hidden;
        }
        break;
      case TileState.revealed:
        if (tile.isBomb) {
          tileString = Renderer.BombDetonated;
        } else {
          var bombCount = TileGrid.getNearbyBombCount(tilesArray, tile.coords);
          tileString = Renderer.NearbyBombs[bombCount];
        }
        break;
      case TileState.flagged:
        if (!tile.isBomb && winLoseStatus === WinLoseStatus.lose) {
          tileString = Renderer.BombIncorrect;
        } else {
          tileString = Renderer.Flagged;
        }
        break;
    }
    return tileString;
  }
}
