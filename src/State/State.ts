import { EventAggregator } from "./../Events/EventAggregator";
import { StateChangedEvent } from "./../Events/Events";
import { MapInformation } from "./../MapGeneration/MapInformation";
import { Coords } from "./Coords";
import { TileGrid } from "./TileGrid";

export class State {
  public readonly mapInfo: MapInformation;
  public readonly map: TileGrid;

  constructor(map: TileGrid) {
    this.map = map;
    this.mapInfo = map.MapInfo;
    EventAggregator.get(StateChangedEvent).publish(this);
  }

  public withMap(newMap: TileGrid): State {
    return this.map == newMap ? this : new State(newMap);
  }
  public withActivatedTile(coords: Coords, flagMode: Boolean): State {
    return this.map.canActivateTile(coords)
      ? this.withMap(this.map.withActivatedTile(coords, flagMode))
      : this;
  }

  // public void Deconstruct(out MapInformation mapInfo, out Dictionary<Coords, Tile> tiles)
  // {
  //     mapInfo = this.map.MapInfo;
  //     tiles = this.map.Tiles;
  // }
}
