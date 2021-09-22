import { EventAggregator } from "./../Events/EventAggregator";
import { StateChangedEvent } from "./../Events/Events";
import { Coords } from "./Coords";
import { TileGrid } from "./TileGrid";

export class State {
  public readonly tileGrid: TileGrid;

  constructor(tileGrid?: TileGrid) {
    if (tileGrid === undefined) {
      tileGrid = new TileGrid();
    }
    this.tileGrid = tileGrid;
    EventAggregator.get(StateChangedEvent).publish(this);
  }

  public withTileGrid(newTileGrid: TileGrid): State {
    return /*this.tileGrid.equals(newTileGrid) ? this :*/ new State(
      newTileGrid
    );
  }
  public withActivatedTile(coords: Coords, flagMode: Boolean): State {
    return this.tileGrid.canActivateTile(coords)
      ? this.withTileGrid(this.tileGrid.withActivatedTile(coords, flagMode))
      : this;
  }
}
