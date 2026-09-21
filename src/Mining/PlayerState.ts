import { Coords } from "../State/Coords";
import { ActionResult } from "./ActionResult";
import { Direction, directionName } from "./Direction";

// The mining layer's state, built the way the game's state is built: readonly
// fields, an all-optional constructor, a positional `with` for copies, a
// structural `equals`, and semantic transitions that hand back `this` when the
// action changed nothing — the same shape as State.withTileGrid.
//
// It is a peer of State, not a part of it. A board with no player on it is
// still a valid board, which is why the other front ends are untouched by any
// of this.
//
// The one place it deliberately parts company with State: State publishes
// StateChangedEvent from its constructor, and this does not. Movement builds
// intermediate values while it works out what an input means, and a
// constructor that published would announce every one of them. Player.publish
// announces the settled value instead. See CLAUDE.md.
export class PlayerState {
  public readonly coords: Coords;
  public readonly facing: Direction;
  public readonly digCount: number;
  public readonly isSpawned: Boolean;
  public readonly lastResult: ActionResult;

  constructor(
    coords?: Coords,
    facing?: Direction,
    digCount?: number,
    isSpawned?: Boolean,
    lastResult?: ActionResult
  ) {
    var newCoords = coords === undefined ? Coords.zero : coords;
    var newFacing = facing === undefined ? Direction.north : facing;
    var newDigCount = digCount === undefined ? 0 : digCount;
    var newIsSpawned = isSpawned === undefined ? false : isSpawned;
    var newLastResult =
      lastResult === undefined ? ActionResult.none : lastResult;
    this.coords = newCoords;
    this.facing = newFacing;
    this.digCount = newDigCount;
    this.isSpawned = newIsSpawned;
    this.lastResult = newLastResult;
  }

  // A player waking up in a cave: the one construction that is not a copy of
  // an existing player.
  public static spawnedAt(coords: Coords): PlayerState {
    return new PlayerState(coords, Direction.north, 0, true, ActionResult.none);
  }

  public equals(other: PlayerState): Boolean {
    return (
      this.coords.equals(other.coords) &&
      this.facing === other.facing &&
      this.digCount === other.digCount &&
      this.isSpawned === other.isSpawned &&
      this.lastResult === other.lastResult
    );
  }

  public with(
    coords?: Coords,
    facing?: Direction,
    digCount?: number,
    isSpawned?: Boolean,
    lastResult?: ActionResult
  ): PlayerState {
    var newCoords = coords !== undefined ? coords : this.coords;
    var newFacing = facing !== undefined ? facing : this.facing;
    var newDigCount = digCount !== undefined ? digCount : this.digCount;
    var newIsSpawned = isSpawned !== undefined ? isSpawned : this.isSpawned;
    var newLastResult =
      lastResult !== undefined ? lastResult : this.lastResult;
    return new PlayerState(
      newCoords,
      newFacing,
      newDigCount,
      newIsSpawned,
      newLastResult
    );
  }

  // The transitions an input can produce. Each one says what the player did,
  // not which fields moved, so movement.ts decides and this decides how that
  // is recorded.
  public withStepTo(coords: Coords, facing: Direction): PlayerState {
    return this.settled(
      this.with(coords, facing, undefined, undefined, ActionResult.moved)
    );
  }

  public withDig(facing: Direction): PlayerState {
    return this.settled(
      this.with(
        undefined,
        facing,
        this.digCount + 1,
        undefined,
        ActionResult.dug
      )
    );
  }

  public withMark(facing: Direction): PlayerState {
    return this.settled(
      this.with(undefined, facing, undefined, undefined, ActionResult.marked)
    );
  }

  public withBlocked(facing: Direction): PlayerState {
    return this.settled(
      this.with(undefined, facing, undefined, undefined, ActionResult.blocked)
    );
  }

  private settled(next: PlayerState): PlayerState {
    return this.equals(next) ? this : next;
  }

  public toString(): string {
    return `{ ${this.coords.toString()}, facing ${directionName(
      this.facing
    )}, digs ${this.digCount} }`;
  }
}
