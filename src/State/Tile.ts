import { Coords } from "./Coords";
import { TileState } from "./TileState";

export class Tile {
  public readonly coords: Coords;
  public readonly tileState: TileState;
  public readonly isBomb: Boolean;

  constructor(coords?: Coords, tileState?: TileState, isBomb?: Boolean) {
    var newCoords = coords === undefined ? Coords.zero : coords;
    var newTileState = tileState === undefined ? TileState.hidden : tileState;
    var newIsBomb = isBomb === undefined ? false : isBomb;
    this.coords = newCoords;
    this.tileState = newTileState;
    this.isBomb = newIsBomb;
  }

  newTileWithCoords(coords: Coords): Tile {
    return new Tile(coords, TileState.hidden, false);
  }

  with(coords?: Coords, tileState?: TileState, isBomb?: Boolean): Tile {
    var newCoords = coords !== undefined ? coords : this.coords;
    var newTileState = tileState !== undefined ? tileState : this.tileState;
    var newIsBomb = isBomb !== undefined ? isBomb : this.isBomb;
    return new Tile(newCoords, newTileState, newIsBomb);
  }

  public toString(): string {
    return `{ (${this.coords.x},${this.coords.y}), ${this.isBomb} }`;
  }
}
