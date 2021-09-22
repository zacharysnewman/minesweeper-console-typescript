import { TileGridInformation } from "../TileGridGeneration/TileGridInformation";
import { Shuffler } from "../TileGridGeneration/Shuffler";
import { Coords } from "./Coords";
import { Tile } from "./Tile";
import { TileState } from "./TileState";

export class TileGrid {
  public readonly tileGridInfo: TileGridInformation;
  public readonly tileArray: Tile[];

  constructor(tileGridInfo?: TileGridInformation, tiles?: Tile[]) {
    this.tileGridInfo =
      tileGridInfo === undefined ? new TileGridInformation() : tileGridInfo;
    this.tileArray = tiles === undefined ? [] : tiles;
  }

  // public equals(other: TileGrid): Boolean {
  //   return (
  //     this.tileGridInfo.equals(other.tileGridInfo) &&
  //     this.tiles.equals(other.tiles)
  //   );
  // }

  public static generateNewTileGrid(
    tileGridInfo: TileGridInformation,
    doExcludeTile: Boolean = false,
    excludedTileCoords = Coords.zero
  ): TileGrid {
    const allTiles: Tile[] = new Array<Tile>();
    for (let x = 0; x < tileGridInfo.Width; x++) {
      for (let y = 0; y < tileGridInfo.Height; y++) {
        var newTileCoords = new Coords(x, y);
        if (doExcludeTile && excludedTileCoords == newTileCoords) {
          continue;
        }
        allTiles.push(new Tile(newTileCoords));
      }
    }
    const shuffledTiles = Shuffler.shuffle(allTiles);
    let bombsToAdd = tileGridInfo.Bombs;
    const tilesWithBombs = shuffledTiles.map((x) =>
      bombsToAdd-- > 0 ? x.with(undefined, undefined, true) : x
    );

    if (doExcludeTile) {
      tilesWithBombs.push(new Tile(excludedTileCoords));
    }

    return new TileGrid(tileGridInfo, tilesWithBombs);
  }

  canActivateTile(coords: Coords): Boolean {
    return this.tileArray.some((x) => x.coords.equals(coords));
  }

  withActivatedTile(coords: Coords, flagMode: Boolean): TileGrid {
    if (this.tileArray.every((x) => x.tileState === TileState.hidden)) {
      let newTileGrid = TileGrid.generateNewTileGrid(
        this.tileGridInfo,
        true,
        coords
      );
      let newTiles = [...newTileGrid.tileArray];
      newTiles = TileGrid.activate(newTiles, coords, flagMode, true);
      return new TileGrid(newTileGrid.tileGridInfo, newTiles);
    } else {
      let newTiles = [...this.tileArray];
      newTiles = TileGrid.activate(newTiles, coords, flagMode, true);
      return new TileGrid(this.tileGridInfo, newTiles);
    }
  }

  public static activate(
    tiles: Tile[],
    coords: Coords,
    flagMode: Boolean,
    primaryActivation: Boolean = false
  ): Tile[] {
    let newTiles = [...tiles];
    let tile = newTiles.find((t) => t.coords.equals(coords)) as Tile;
    let nearbyActivateableTiles = TileGrid.getNearbyTiles(
      newTiles,
      tile.coords
    ).filter((x) => x.tileState === TileState.hidden);

    const tileIndex = newTiles.findIndex((x) => x.coords.equals(coords));

    switch (tile.tileState) {
      case TileState.hidden:
        newTiles[tileIndex] = tile.with(
          undefined,
          flagMode ? TileState.flagged : TileState.revealed
        );

        // newTiles.set(
        //   coords,
        //   tile.with(
        //     undefined,
        //     flagMode ? TileState.flagged : TileState.revealed
        //   )
        // );

        if (
          !flagMode &&
          TileGrid.isNotNearAnyBombs(tiles, coords) &&
          !tile.isBomb
        ) {
          newTiles = TileGrid.activateAll(newTiles, nearbyActivateableTiles);
        }
        break;
      case TileState.flagged:
        newTiles[tileIndex] = tile.with(
          undefined,
          flagMode ? TileState.flagged : TileState.revealed
        );

        // newTiles.set(
        //   coords,
        //   flagMode
        //     ? tile.with(undefined, TileState.hidden)
        //     : (newTiles.find((x) => x.coords.equals(coords)) as Tile)
        // );
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

  public static activateAll(tiles: Tile[], nearbyTiles: Tile[]): Tile[] {
    let newTiles = [...tiles];
    for (let t of nearbyTiles) {
      newTiles =
        (newTiles.find((x) => x.coords.equals(t.coords)) as Tile).tileState !==
        TileState.revealed
          ? TileGrid.activate(newTiles, t.coords, false)
          : newTiles;
    }
    return newTiles;
  }

  public static isNotNearAnyBombs(tiles: Tile[], coords: Coords): Boolean {
    return TileGrid.getNearbyBombCount(tiles, coords) === 0;
  }
  public static getNearbyBombCount(tiles: Tile[], coords: Coords): number {
    return TileGrid.getNearbyTiles(tiles, coords).filter((x) => x.isBomb)
      .length;
  }
  public static getNearbyFlagCount(tiles: Tile[], coords: Coords): number {
    return TileGrid.getNearbyTiles(tiles, coords).filter(
      (x) => x.tileState === TileState.flagged
    ).length;
  }

  private static getNearbyTiles(tiles: Tile[], coords: Coords): Tile[] {
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

  private static tryGetTile(tiles: Tile[], coords: Coords): Tile | undefined {
    try {
      return tiles.find((x) => x.coords.equals(coords));
    } catch {
      return undefined;
    }
  }
}
