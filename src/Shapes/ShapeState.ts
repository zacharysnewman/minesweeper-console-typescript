import { EventAggregator } from "../Events/EventAggregator";
import { Coords } from "../State/Coords";
import { Board } from "./Board";
import { ShapeStateChangedEvent } from "./ShapeEvents";

// A peer of State, not a replacement for it. The square game keeps its own
// State and its own renderers; this one exists so a board over any tiling can
// be played without the original growing a branch for it.
//
// As with State, constructing one is what announces it.
export class ShapeState {
  public readonly board: Board;

  constructor(board?: Board) {
    if (board === undefined) {
      board = new Board();
    }
    this.board = board;
    EventAggregator.get(ShapeStateChangedEvent).publish(this);
  }

  public withBoard(newBoard: Board): ShapeState {
    return this.board.equals(newBoard) === true
      ? this
      : new ShapeState(newBoard);
  }

  public withActivatedCell(coords: Coords, flagMode: Boolean): ShapeState {
    return this.board.canActivateCell(coords) === true
      ? this.withBoard(this.board.withActivatedCell(coords, flagMode))
      : this;
  }
}
