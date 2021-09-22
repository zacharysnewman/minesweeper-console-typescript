import { State } from "./State";
import { ActivateTileEvent, GenerateTileGridEvent } from "./../Events/Events";
import { EventAggregator } from "./../Events/EventAggregator";
import { TileGridInformation } from "../TileGridGeneration/TileGridInformation";
import { Coords } from "./Coords";
import { TileGrid } from "./TileGrid";
import { Tile } from "./Tile";

export abstract class Game {
  public static state: State = new State();

  public static init(): void {
    EventAggregator.get(GenerateTileGridEvent).subscribe(
      Game.onGenerateTileGrid
    );
    EventAggregator.get(ActivateTileEvent).subscribe(Game.onActivateTile);
  }

  private static onGenerateTileGrid(tileGridInfo: TileGridInformation): void {
    Game.state = Game.state.withTileGrid(
      TileGrid.generateNewTileGrid(tileGridInfo)
    );
  }

  private static onActivateTile(coords: Coords, flagMode: Boolean): void {
    Game.state = Game.state.withActivatedTile(coords, flagMode);
  }
}
