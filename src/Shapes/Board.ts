import { Coords } from "../State/Coords";
import { Tile } from "../State/Tile";
import { TileState } from "../State/TileState";
import { tileArrayEquals } from "../Typescript/tsTools";
import { BoardInfo } from "./BoardInfo";

// A minesweeper board over any of the supported tilings.
//
// This is a fork of TileGrid rather than a rewrite of it: the square game and
// its renderers are untouched. The only difference in the rules is that every
// question about which cells touch which goes through the board's topology
// instead of a hardcoded set of eight offsets. Keeping that the single point
// of difference is deliberate -- it is what would make the two merge back
// together cheaply if that is ever wanted.
//
// Tiles are looked up through a "x,y" index rather than a linear scan of the
// array. TileGrid scans, which is fine for 480 square cells; a triangle board
// asks twelve adjacency questions per cell and wants more columns to look
// right, so the scan stops being free.
const key = (coords: Coords): string => `${coords.x},${coords.y}`;

export class Board {
  public readonly info: BoardInfo;
  public readonly tileArray: Tile[];

  constructor(info?: BoardInfo, tiles?: Tile[]) {
    this.info = info === undefined ? new BoardInfo() : info;
    this.tileArray = tiles === undefined ? [] : tiles;
  }

  public equals(other: Board): Boolean {
    return (
      this.info.equals(other.info) &&
      tileArrayEquals(this.tileArray, other.tileArray)
    );
  }

  public toString(): string {
    return `{ ${this.info.toString()}, ${this.tileArray.length} tiles }`;
  }

  // --- geometry -------------------------------------------------------------

  // All three tilings store in a rectangular array, so bounds and enumeration
  // are the same for every shape; only adjacency differs.
  public contains(coords: Coords): boolean {
    return (
      coords.x >= 0 &&
      coords.x < this.info.rows &&
      coords.y >= 0 &&
      coords.y < this.info.cols
    );
  }

  public neighbours(coords: Coords): Coords[] {
    return this.info
      .topology()
      .neighbours(coords)
      .filter((c) => this.contains(c));
  }

  public tileAt(coords: Coords): Tile | undefined {
    return this.tileArray.find((t) => t.coords.equals(coords));
  }

  public nearbyBombCount(coords: Coords): number {
    return Board.countBombs(Board.index(this.tileArray), this, coords);
  }

  public nearbyFlagCount(coords: Coords): number {
    return Board.countFlags(Board.index(this.tileArray), this, coords);
  }

  // Every cell's nearby bomb count in one pass, keyed "x,y". A renderer draws
  // the whole board at once and would otherwise rebuild the index per cell.
  public nearbyBombCounts(): Map<string, number> {
    const tiles = Board.index(this.tileArray);
    const counts = new Map<string, number>();
    for (const tile of this.tileArray) {
      counts.set(key(tile.coords), Board.countBombs(tiles, this, tile.coords));
    }
    return counts;
  }

  // --- generation -----------------------------------------------------------

  // `random` is injectable so a check can seed a repeatable board, the way
  // Mining's pickSpawn does.
  public static generateNewBoard(
    info: BoardInfo,
    excludedCoords?: Coords,
    random: () => number = Math.random
  ): Board {
    const all: Coords[] = [];
    for (let x = 0; x < info.rows; x++) {
      for (let y = 0; y < info.cols; y++) {
        all.push(new Coords(x, y));
      }
    }

    // The first click opens a pocket rather than a lone number: the clicked
    // cell and everything touching it are kept clear. TileGrid excludes only
    // the clicked cell, which on a twelve-neighbour triangle board almost
    // never produces a cascade, so the opening move stops meaning anything.
    const cleared = new Set<string>();
    if (excludedCoords !== undefined) {
      cleared.add(key(excludedCoords));
      for (const c of info.topology().neighbours(excludedCoords)) {
        cleared.add(key(c));
      }
    }

    const candidates = all.filter((c) => !cleared.has(key(c)));
    // A board cannot hold more bombs than it has cells left to put them in.
    const bombCount = Math.max(0, Math.min(info.bombs, candidates.length));
    const bombed = new Set(
      Board.shuffle(candidates, random)
        .slice(0, bombCount)
        .map((c) => key(c))
    );

    const tiles = all.map(
      (c) => new Tile(c, TileState.hidden, bombed.has(key(c)))
    );
    return new Board(info, tiles);
  }

  // Fisher-Yates. Shuffler.shuffle draws at random and rejects what it has
  // already taken, which costs O(n^2) comparisons and gets slow on the larger
  // boards the triangle tiling wants; this is O(n) and takes an injected
  // source of randomness.
  private static shuffle<T>(items: T[], random: () => number): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const swap = result[i];
      result[i] = result[j];
      result[j] = swap;
    }
    return result;
  }

  // --- transitions ----------------------------------------------------------

  public canActivateCell(coords: Coords): Boolean {
    return this.contains(coords) && this.tileAt(coords) !== undefined;
  }

  // Reveal, flag or chord the cell, returning the board that results. A board
  // whose cells are all still hidden is regenerated around the click first, so
  // the opening move is always safe.
  public withActivatedCell(coords: Coords, flagMode: Boolean): Board {
    if (this.canActivateCell(coords) !== true) {
      return this;
    }

    const untouched = this.tileArray.every(
      (t) => t.tileState === TileState.hidden
    );
    const base = untouched
      ? Board.generateNewBoard(this.info, coords)
      : this;

    const tiles = Board.index(base.tileArray);
    const tile = tiles.get(key(coords)) as Tile;

    switch (tile.tileState) {
      case TileState.hidden:
        tiles.set(
          key(coords),
          tile.with(undefined, flagMode ? TileState.flagged : TileState.revealed)
        );
        if (
          !flagMode &&
          !tile.isBomb &&
          Board.countBombs(tiles, base, coords) === 0
        ) {
          Board.revealFrom(tiles, base, base.neighbours(coords));
        }
        break;
      case TileState.flagged:
        // Flagging a flagged cell clears the flag; revealing one does nothing,
        // so a mis-flag can be taken back without detonating what is under it.
        if (flagMode) {
          tiles.set(key(coords), tile.with(undefined, TileState.hidden));
        }
        break;
      case TileState.revealed:
        // Chording. Only ever reached from a direct activation: a cascade
        // skips cells that are already revealed before it recurses, which is
        // why this needs no "was this the primary activation" flag the way
        // TileGrid.activate does.
        if (
          Board.countFlags(tiles, base, coords) >=
          Board.countBombs(tiles, base, coords)
        ) {
          Board.revealFrom(tiles, base, base.neighbours(coords));
        }
        break;
    }

    return new Board(base.info, base.tileArray.map((t) => tiles.get(key(t.coords)) as Tile));
  }

  // --- the flood fill -------------------------------------------------------

  // Reveals each seed that is still hidden, and walks on from any cell that
  // turns out to be a bomb-free zero. Flagged cells are left alone, so a
  // cascade never steps over a mark. Iterative rather than recursive: a
  // twelve-neighbour board cascades wide enough to be worth not putting on
  // the call stack.
  private static revealFrom(
    tiles: Map<string, Tile>,
    board: Board,
    seeds: Coords[]
  ): void {
    const queue = [...seeds];
    while (queue.length > 0) {
      const coords = queue.pop() as Coords;
      const tile = tiles.get(key(coords));
      if (tile === undefined || tile.tileState !== TileState.hidden) {
        continue;
      }
      tiles.set(key(coords), tile.with(undefined, TileState.revealed));
      if (!tile.isBomb && Board.countBombs(tiles, board, coords) === 0) {
        for (const next of board.neighbours(coords)) {
          queue.push(next);
        }
      }
    }
  }

  private static index(tiles: Tile[]): Map<string, Tile> {
    const map = new Map<string, Tile>();
    for (const tile of tiles) {
      map.set(key(tile.coords), tile);
    }
    return map;
  }

  private static countBombs(
    tiles: Map<string, Tile>,
    board: Board,
    coords: Coords
  ): number {
    let count = 0;
    for (const c of board.neighbours(coords)) {
      const tile = tiles.get(key(c));
      if (tile !== undefined && tile.isBomb === true) {
        count++;
      }
    }
    return count;
  }

  private static countFlags(
    tiles: Map<string, Tile>,
    board: Board,
    coords: Coords
  ): number {
    let count = 0;
    for (const c of board.neighbours(coords)) {
      const tile = tiles.get(key(c));
      if (tile !== undefined && tile.tileState === TileState.flagged) {
        count++;
      }
    }
    return count;
  }
}
