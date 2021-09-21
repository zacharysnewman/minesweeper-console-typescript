import { EventAggregator } from "./../Events/EventAggregator";
import { StateChangedEvent } from "./../Events/Events";
import { State } from "./../State/State";
import { Color } from "./Color";
import { ConsoleString } from "./ConsoleString";
import { tileMapToTileArray } from "./../Typescript/CollectionConversions";
import { CoolRendering } from "./CoolRendering";
import { WinLoseStatus } from "./WinLoseStatus";
import { TileState } from "./../State/TileState";
import { Tile } from "./../State/Tile";
import { Coords } from "./../State/Coords";
import { TileGrid } from "./../State/TileGrid";

export abstract class Renderer {
  private static readonly Hidden: ConsoleString = new ConsoleString(
    "#",
    Color.None,
    Color.bgNone
  );
  private static readonly Flagged: ConsoleString = new ConsoleString(
    "#",
    Color.redBright,
    Color.bgNone
  );
  private static readonly BombRevealed: ConsoleString = new ConsoleString(
    "B",
    Color.blackBright,
    Color.bgGray
  );
  private static readonly BombIncorrect: ConsoleString = new ConsoleString(
    "X",
    Color.redBright,
    Color.bgNone
  );
  private static readonly BombDetonated: ConsoleString = new ConsoleString(
    "B",
    Color.blackBright,
    Color.bgRedBright
  );
  private static readonly NearbyBombs: ConsoleString[] = [
    new ConsoleString(" ", Color.whiteBright, Color.bgNone),
    new ConsoleString("1", Color.blueBright, Color.bgNone),
    new ConsoleString("2", Color.greenBright, Color.bgNone),
    new ConsoleString("3", Color.redBright, Color.bgNone),
    new ConsoleString("4", Color.blue, Color.bgNone),
    new ConsoleString("5", Color.red, Color.bgNone),
    new ConsoleString("6", Color.cyanBright, Color.bgNone),
    new ConsoleString("7", Color.blackBright, Color.bgNone),
    new ConsoleString("8", Color.gray, Color.bgNone),
  ];
  private static readonly Logo: ConsoleString = new ConsoleString(
    CoolRendering.MinesweeperLogoSmall,
    Color.yellowBright,
    Color.bgNone
  );

  private static readonly CommandList: string =
    "Commands:\n" +
    "check <row><col> (Ex: 'check a3' or 'g6') [Reveals a tile] \n" +
    "flag <row><col> (Ex: 'flag a3' or 'f g6') [Flags a tile]\n" +
    "new [Generates a new map]\n" +
    "new <bombs> (Ex: 'new 15') [Generates a new map with X bombs]";

  public static init(): void {
    EventAggregator.get(StateChangedEvent).subscribe(Renderer.onStateChanged);
  }

  public static onStateChanged(newState: State): void {
    const { MapInfo, Tiles } = newState.map;
    var tiles = tileMapToTileArray(Tiles);
    var winLoseStatus = Renderer.WinOrLoseCheck(tiles);

    console.clear();

    // Console.ForegroundColor = ConsoleColor.Yellow;

    this.Logo.write();
    // console.log(CoolRendering.MinesweeperLogoSmall);

    // Console.ForegroundColor = ConsoleColor.Black;
    // Console.BackgroundColor = ConsoleColor.White;

    console.log("\n                                               \n     ");
    for (let i = 0; i < 10; i++) {
      console.log(i + "   ");
    }
    console.log("  \n");

    for (let x = 0; x < MapInfo.Width; x++) {
      console.log("   |---|---|---|---|---|---|---|---|---|---|   \n");
      console.log(" " + "abcdefghijklmnopqrstuvwxyz".toUpperCase()[x] + " | ");
      for (let y = 0; y < MapInfo.Height; y++) {
        Renderer.GetTileString(
          Tiles,
          Tiles.get(new Coords(x, y)) as Tile,
          winLoseStatus
        ).write();
        console.log(" | ");
      }
      console.log("abcdefghijklmnopqrstuvwxyz".toUpperCase()[x]);
      console.log(" \n");
    }
    console.log("   |---|---|---|---|---|---|---|---|---|---|   \n     ");
    for (let i = 0; i < 10; i++) {
      console.log(i + "   ");
    }
    console.log("  \n                                               \n\n");

    // Console.ResetColor();

    console.log(Renderer.CommandList);
    console.log("\n\n");
    var winOrLoseStatus = Renderer.WinOrLoseCheck(tiles);
    var gameStatus =
      winOrLoseStatus === WinLoseStatus.win
        ? "You Won!"
        : winLoseStatus === WinLoseStatus.lose
        ? "You Lost!"
        : "In Progress...";
    console.log(`Game Status: ${gameStatus}`);

    console.log("\n\nEnter Command: ");
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
    tilesDict: Map<Coords, Tile>,
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
          var bombCount = TileGrid.getNearbyBombCount(tilesDict, tile.coords);
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
