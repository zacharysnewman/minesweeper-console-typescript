import { MapInformation } from "./../MapGeneration/MapInformation";
import { Shuffler } from "./../MapGeneration/Shuffler";
import { tileMapToTileArray } from "./../Typescript/CollectionConversions";
import { Coords } from "./Coords";
import { Tile } from "./Tile";
import { TileState } from "./TileState";

export class TileGrid {
  // previously Map
  public readonly MapInfo: MapInformation;
  public readonly Tiles: Map<Coords, Tile>;

  constructor(mapInfo: MapInformation, tiles: Map<Coords, Tile>) {
    this.MapInfo = mapInfo;
    this.Tiles = tiles;
  }

  // public bool Equals(TileMap other) => this.Tiles ===other.Tiles;
  // public override bool Equals(Object other) => this.Equals((TileMap)other);
  // public override int GetHashCode() => base.GetHashCode();
  // public static bool operator ==(TileMap a, TileMap b) => a.Equals(b);
  // public static bool operator !==(TileMap a, TileMap b) => !a.Equals(b);

  // public static GenerateNewMap(mapInfo : MapInformation, doExcludeTile: Boolean = false, excludedTileCoords = Coords.zero) : TileMap
  // {
  //     return TileMap.GenerateNewMap(mapInfo, doExcludeTile, excludedTileCoords);
  // }

  public static generateNewMap(
    mapInfo: MapInformation,
    doExcludeTile: Boolean = false,
    excludedTileCoords = Coords.zero
  ): TileGrid {
    const allTiles: Tile[] = new Array<Tile>();
    for (let x = 0; x < mapInfo.Width; x++) {
      for (let y = 0; y < mapInfo.Height; y++) {
        var newTileCoords = new Coords(x, y);
        if (doExcludeTile && excludedTileCoords == newTileCoords) {
          continue;
        }
        allTiles.push(new Tile(newTileCoords));
      }
    }
    const shuffledTiles = Shuffler.shuffle(allTiles);
    let bombsToAdd = mapInfo.Bombs;
    const tilesWithBombs = shuffledTiles.map((x) =>
      bombsToAdd-- > 0 ? x.with(undefined, undefined, true) : x
    );

    if (doExcludeTile) {
      tilesWithBombs.push(new Tile(excludedTileCoords));
    }

    return new TileGrid(
      mapInfo,
      new Map(tilesWithBombs.map((tile) => [tile.coords, tile]))
    );
  }

  canActivateTile(coords: Coords): Boolean {
    return this.Tiles.has(coords);
  }
  withActivatedTile(coords: Coords, flagMode: Boolean): TileGrid {
    if (
      tileMapToTileArray(this.Tiles).every(
        (x) => x.tileState === TileState.hidden
      )
    ) {
      let newMap = TileGrid.generateNewMap(this.MapInfo, true, coords);
      let newTiles = new Map<Coords, Tile>(newMap.Tiles);
      newTiles = TileGrid.activate(newTiles, coords, flagMode, true);
      return new TileGrid(newMap.MapInfo, newTiles);
    } else {
      let newTiles = new Map<Coords, Tile>(this.Tiles);
      newTiles = TileGrid.activate(newTiles, coords, flagMode, true);

      return new TileGrid(this.MapInfo, newTiles);
    }
  }

  public static activate(
    tiles: Map<Coords, Tile>,
    coords: Coords,
    flagMode: Boolean,
    primaryActivation: Boolean = false
  ): Map<Coords, Tile> {
    let newTiles = new Map<Coords, Tile>(tiles);
    let tile = newTiles.get(coords) as Tile;
    let nearbyActivateableTiles = TileGrid.getNearbyTiles(
      newTiles,
      tile.coords
    ).filter((x) => x.tileState === TileState.hidden);

    switch (tile.tileState) {
      case TileState.hidden:
        newTiles.set(
          coords,
          tile.with(
            undefined,
            flagMode ? TileState.flagged : TileState.revealed
          )
        );

        if (
          !flagMode &&
          TileGrid.isNotNearAnyBombs(tiles, coords) &&
          !tile.isBomb
        ) {
          newTiles = TileGrid.activateAll(newTiles, nearbyActivateableTiles);
        }
        break;
      case TileState.flagged:
        newTiles.set(
          coords,
          flagMode
            ? tile.with(undefined, TileState.hidden)
            : (newTiles.get(coords) as Tile)
        );
        break;
      case TileState.revealed:
        if (
          TileGrid.getNearbyFlagCount(tiles, coords) >=
            TileGrid.getNearbyBombCount(tiles, coords) &&
          (flagMode ||
            TileGrid.isNotNearAnyBombs(tiles, coords) ||
            primaryActivation)
        ) {
          newTiles = TileGrid.activateAll(newTiles, nearbyActivateableTiles);
        }
        break;
    }
    return newTiles;
  }

  public static activateAll(
    tiles: Map<Coords, Tile>,
    nearbyTiles: Tile[]
  ): Map<Coords, Tile> {
    let newTiles = new Map<Coords, Tile>(tiles);
    for (let t of nearbyTiles) {
      newTiles =
        (newTiles.get(t.coords) as Tile).tileState !== TileState.revealed
          ? TileGrid.activate(newTiles, t.coords, false)
          : newTiles;
    }
    return newTiles;
  }

  public static isNotNearAnyBombs(
    tiles: Map<Coords, Tile>,
    coords: Coords
  ): Boolean {
    return TileGrid.getNearbyBombCount(tiles, coords) === 0;
  }
  public static getNearbyBombCount(
    tiles: Map<Coords, Tile>,
    coords: Coords
  ): number {
    return TileGrid.getNearbyTiles(tiles, coords).filter((x) => x.isBomb)
      .length;
  }
  public static getNearbyFlagCount(
    tiles: Map<Coords, Tile>,
    coords: Coords
  ): number {
    return TileGrid.getNearbyTiles(tiles, coords).filter(
      (x) => x.tileState === TileState.flagged
    ).length;
  }

  private static getNearbyTiles(
    tiles: Map<Coords, Tile>,
    coords: Coords
  ): Tile[] {
    let col = coords.x;
    let row = coords.y;

    return [
      TileGrid.tryGetTile(tiles, new Coords(col - 1, row - 1)),
      TileGrid.tryGetTile(tiles, new Coords(col - 1, row)),
      TileGrid.tryGetTile(tiles, new Coords(col - 1, row + 1)),
      TileGrid.tryGetTile(tiles, new Coords(col, row - 1)),
      //TileGrid.TryGetTile(tiles, new Coords(col,row)),
      TileGrid.tryGetTile(tiles, new Coords(col, row + 1)),
      TileGrid.tryGetTile(tiles, new Coords(col + 1, row - 1)),
      TileGrid.tryGetTile(tiles, new Coords(col + 1, row)),
      TileGrid.tryGetTile(tiles, new Coords(col + 1, row + 1)),
    ]
      .filter((x) => x !== undefined)
      .map((x) => x as Tile);
  }

  private static tryGetTile(
    tiles: Map<Coords, Tile>,
    coords: Coords
  ): Tile | undefined {
    try {
      return tiles.get(coords);
    } catch {
      return undefined;
    }
  }
}
