import { Shape } from "./Shape";
import { Topology, topologyFor } from "./Topology";

// The shape-agnostic answer to TileGridInformation.
//
// The shape is stored as an enum rather than as the adjacency functions
// themselves, so this stays a plain immutable value with a structural equals
// and travels over the event bus as a payload. topology() turns it into rules.
//
// Named rows/cols rather than Width/Height: x is still the row and y still the
// column, as everywhere else in the project, but this layer is new enough that
// it does not have to inherit the naming that made that confusing.
export class BoardInfo {
  public readonly rows: number;
  public readonly cols: number;
  public readonly bombs: number;
  public readonly shape: Shape;

  constructor(rows?: number, cols?: number, bombs?: number, shape?: Shape) {
    this.rows = rows === undefined ? 0 : rows;
    this.cols = cols === undefined ? 0 : cols;
    this.bombs = bombs === undefined ? 0 : bombs;
    this.shape = shape === undefined ? Shape.square : shape;
  }

  public get cellCount(): number {
    return this.rows * this.cols;
  }

  public topology(): Topology {
    return topologyFor(this.shape);
  }

  public with(
    rows?: number,
    cols?: number,
    bombs?: number,
    shape?: Shape
  ): BoardInfo {
    var newRows = rows !== undefined ? rows : this.rows;
    var newCols = cols !== undefined ? cols : this.cols;
    var newBombs = bombs !== undefined ? bombs : this.bombs;
    var newShape = shape !== undefined ? shape : this.shape;
    return new BoardInfo(newRows, newCols, newBombs, newShape);
  }

  public withBombs(bombs: number): BoardInfo {
    return this.with(undefined, undefined, bombs, undefined);
  }

  public withShape(shape: Shape): BoardInfo {
    return this.with(undefined, undefined, undefined, shape);
  }

  public equals(other: BoardInfo): Boolean {
    return (
      this.rows === other.rows &&
      this.cols === other.cols &&
      this.bombs === other.bombs &&
      this.shape === other.shape
    );
  }

  public toString(): string {
    return `{ rows: ${this.rows}, cols: ${this.cols}, bombs: ${this.bombs}, shape: ${Shape[this.shape]} }`;
  }
}
