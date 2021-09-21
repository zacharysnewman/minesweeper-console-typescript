import { State } from "./State";
import { ActivateTileEvent, GenerateMapEvent } from "./../Events/Events";
import { EventAggregator } from "./../Events/EventAggregator";
import { MapInformation } from "./../MapGeneration/MapInformation";
import { Coords } from "./Coords";
import { TileGrid } from "./TileGrid";

export abstract class Game {
  public static state: State = new State();

  public static init(): void {
    EventAggregator.get(GenerateMapEvent).subscribe(Game.onGenerateMap);
    EventAggregator.get(ActivateTileEvent).subscribe(Game.onActivateTile);
  }

  private static onGenerateMap(mapInfo: MapInformation): void {
    Game.state = Game.state.withMap(TileGrid.generateNewMap(mapInfo));
  }

  private static onActivateTile(coords: Coords, flagMode: Boolean): void {
    Game.state = Game.state.withActivatedTile(coords, flagMode);
  }
}
