import { Coords } from "../State/Coords";
import { ActionResult } from "./ActionResult";
import { Direction, directionName } from "./Direction";

export interface PlayerStateChanges {
  coords?: Coords;
  facing?: Direction;
  digCount?: number;
  isSpawned?: boolean;
  lastResult?: ActionResult;
}

// An immutable value like State, but owned by the mining layer. Nothing here
// lives in the game's State: a board with no player on it is still a valid
// board, and every other front end keeps working untouched.
//
// Unlike State, the constructor publishes nothing. The Player session decides
// when a change is worth announcing, so the value stays free of side effects.
export class PlayerState {
  public readonly coords: Coords;
  public readonly facing: Direction;
  public readonly digCount: number;
  public readonly isSpawned: boolean;
  public readonly lastResult: ActionResult;

  constructor(
    coords?: Coords,
    facing?: Direction,
    digCount?: number,
    isSpawned?: boolean,
    lastResult?: ActionResult
  ) {
    this.coords = coords === undefined ? Coords.zero : coords;
    this.facing = facing === undefined ? Direction.north : facing;
    this.digCount = digCount === undefined ? 0 : digCount;
    this.isSpawned = isSpawned === undefined ? false : isSpawned;
    this.lastResult = lastResult === undefined ? ActionResult.none : lastResult;
  }

  // Named changes rather than the positional `with` Tile uses: five optional
  // slots in a row is where that idiom stops being readable.
  public with(changes: PlayerStateChanges): PlayerState {
    return new PlayerState(
      changes.coords ?? this.coords,
      changes.facing ?? this.facing,
      changes.digCount ?? this.digCount,
      changes.isSpawned ?? this.isSpawned,
      changes.lastResult ?? this.lastResult
    );
  }

  public equals(other: PlayerState): boolean {
    return (
      this.coords.equals(other.coords) === true &&
      this.facing === other.facing &&
      this.digCount === other.digCount &&
      this.isSpawned === other.isSpawned &&
      this.lastResult === other.lastResult
    );
  }

  public toString(): string {
    return `{ ${this.coords.toString()}, facing ${directionName(
      this.facing
    )}, digs ${this.digCount} }`;
  }
}
