import { Coords } from "./../State/Coords";
import { Tile } from "./../State/Tile";

export const tileArrayToTileMap = (tileArray: Tile[]): Map<Coords, Tile> =>
  new Map(tileArray.map((tile) => [tile.coords, tile]));
export const tileMapToTileArray = (tileMap: Map<Coords, Tile>): Tile[] =>
  Array.from(tileMap, ([name, value]) => ({ name, value })).map((x) => x.value);
