import { EventAggregator } from "../Events/EventAggregator";
import { Coords } from "../State/Coords";
import { Board } from "./Board";
import { BoardInfo } from "./BoardInfo";
import {
  ActivateCellEvent,
  GenerateBoardEvent,
} from "./ShapeEvents";
import { ShapeState } from "./ShapeState";

// The session for the shape-agnostic board: one mutable static reference to
// the current value, swapped and never edited, subscribed in a static init().
//
// Importing this module constructs the initial ShapeState, which publishes
// ShapeStateChangedEvent -- the same import-time side effect Game has. Only
// the page that plays this board should reach it.
export abstract class ShapeGame {
  public static state: ShapeState = new ShapeState();

  public static init(): void {
    EventAggregator.get(GenerateBoardEvent).subscribe(ShapeGame.onGenerateBoard);
    EventAggregator.get(ActivateCellEvent).subscribe(ShapeGame.onActivateCell);
  }

  private static onGenerateBoard(info: BoardInfo): void {
    ShapeGame.state = ShapeGame.state.withBoard(Board.generateNewBoard(info));
  }

  private static onActivateCell(coords: Coords, flagMode: Boolean): void {
    ShapeGame.state = ShapeGame.state.withActivatedCell(coords, flagMode);
  }
}
