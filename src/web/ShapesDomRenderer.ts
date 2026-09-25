import { EventAggregator } from "../Events/EventAggregator";
import { Coords } from "../State/Coords";
import { Tile } from "../State/Tile";
import { TileState } from "../State/TileState";
import { WinLoseStatus } from "../State/WinLoseStatus";
import { winLoseCheck } from "../State/winLoseCheck";
import { forBoard, layoutFor, Layout } from "../Shapes/geometry";
import { Shape } from "../Shapes/Shape";
import { ShapeState } from "../Shapes/ShapeState";
import { ShapeStateChangedEvent } from "../Shapes/ShapeEvents";
import {
  artKey,
  cellArt,
  cellElementSvg,
  FaceKind,
  FACES,
  glyphOutlineDefs,
} from "../Shapes/svg";

export type ActivateHandler = (coords: Coords, flagMode: boolean) => void;

export interface ShapesDomRendererElements {
  board: HTMLElement;
  counter: HTMLElement;
  status: HTMLElement;
  face: HTMLButtonElement;
}

interface PointerGesture {
  id: number;
  coords: Coords;
  startX: number;
  startY: number;
  pointerType: string;
  timer: number | null;
  /** Set once the long press has fired, so the release does not act again. */
  resolved: boolean;
}

// The board for the shape-agnostic game.
//
// Cells are positioned absolutely from the layout rather than laid out by CSS
// grid: hex rows overlap by a quarter and triangle cells overlap their
// neighbours by half, which a grid cannot express. Absolute boxes handle all
// three tilings with one code path.
//
// Each cell is a <button> holding one <svg>. The button gives focus, tab order
// and a keyboard press for free; the svg gives an outline that an HTML element
// could not have, since a clip-path cannot carry a border. Only the polygon
// takes pointer events, so the overlapping boxes still hit test correctly.
export class ShapesDomRenderer {
  // Long enough not to fire on a hurried tap, short enough to feel deliberate.
  private static readonly LONG_PRESS_MS = 450;

  private readonly elements: ShapesDomRendererElements;
  private readonly onActivate: ActivateHandler;

  private cells: HTMLButtonElement[] = [];
  /** What each cell is currently showing, so an unchanged one is left alone. */
  private drawn: string[] = [];
  private renderedShape: Shape | null = null;
  private renderedRows = -1;
  private renderedCols = -1;
  private layout: Layout | null = null;
  private gameOver = false;

  /** Inverts tap and hold, for flagging without a right mouse button. */
  private flagMode = false;
  /** The tiles behind the current render, so a press can read tile state. */
  private lastTiles = new Map<string, Tile>();
  private gesture: PointerGesture | null = null;
  private content = 30;
  /** Kept so a resize can redraw without waiting for the game to change. */
  private lastState: ShapeState | null = null;

  constructor(
    elements: ShapesDomRendererElements,
    onActivate: ActivateHandler
  ) {
    this.elements = elements;
    this.onActivate = onActivate;
  }

  public init(): void {
    EventAggregator.get(ShapeStateChangedEvent).subscribe(this.onStateChanged);
    this.bindBoardEvents();
    // One copy of the glyph outline filter for the whole document; every cell
    // references it by id.
    this.elements.board.insertAdjacentHTML("beforebegin", glyphOutlineDefs());
    this.setFace("active");
  }

  private setFace(kind: FaceKind): void {
    this.elements.face.textContent = FACES[kind];
  }

  public setFlagMode(on: boolean): void {
    this.flagMode = on;
    this.elements.board.classList.toggle("flag-mode", on);
  }

  public isFlagMode(): boolean {
    return this.flagMode;
  }

  // A triangle board is twice as wide in columns and half as wide per column,
  // so the cell size that suits one shape does not suit the others, and a big
  // board has to shrink to fit. The entry point sets this when the shape
  // changes and when the window resizes; a redraw follows so the board does
  // not wait for the game to change before it fits again.
  public setCellSize(content: number): void {
    if (content === this.content) {
      return;
    }
    this.content = content;
    this.renderedShape = null;
    if (this.lastState !== null) {
      this.onStateChanged(this.lastState);
    }
  }

  public reset(): void {
    this.gameOver = false;
    this.cancelGesture();
    this.elements.board.classList.remove("is-over");
    this.setFace("active");
    this.setStatus(WinLoseStatus.none);
  }

  // --- input --------------------------------------------------------------

  private bindBoardEvents(): void {
    const { board } = this.elements;
    board.addEventListener("contextmenu", (event) => event.preventDefault());
    board.addEventListener("pointerdown", this.onPointerDown);
    board.addEventListener("pointerup", this.onPointerUp);
    board.addEventListener("pointercancel", this.cancelGesture);
    board.addEventListener("pointerleave", this.cancelGesture);
    board.addEventListener("pointermove", this.onPointerMove);
    board.addEventListener("keydown", this.onKeyDown);
  }

  private coordsFrom(target: EventTarget | null): Coords | null {
    if (!(target instanceof Element)) {
      return null;
    }
    const cell = target.closest(".shape-cell");
    if (cell === null || !(cell instanceof HTMLElement)) {
      return null;
    }
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    return Number.isNaN(x) || Number.isNaN(y) ? null : new Coords(x, y);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.gameOver) return;
    const coords = this.coordsFrom(event.target);
    if (coords === null) return;

    if (event.pointerType === "mouse" && event.button === 2) {
      this.dispatch(coords, true);
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    this.cancelGesture();
    const gesture: PointerGesture = {
      id: event.pointerId,
      coords,
      startX: event.clientX,
      startY: event.clientY,
      pointerType: event.pointerType,
      timer: null,
      resolved: false,
    };
    this.setFace("pressing");
    gesture.timer = window.setTimeout(() => {
      gesture.resolved = true;
      gesture.timer = null;
      this.buzz();
      this.dispatch(gesture.coords, true);
    }, ShapesDomRenderer.LONG_PRESS_MS);
    this.gesture = gesture;
  };

  private onPointerMove = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (gesture === null || gesture.id !== event.pointerId) return;
    // More than roughly half a cell of travel is a scroll, not a press.
    const tolerance = Math.max(12, this.content / 2);
    const moved = Math.hypot(
      event.clientX - gesture.startX,
      event.clientY - gesture.startY
    );
    if (moved > tolerance) {
      this.cancelGesture();
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (gesture === null || gesture.id !== event.pointerId) return;
    this.clearGestureTimer(gesture);
    this.gesture = null;
    this.releaseFace();
    if (gesture.resolved) return;
    this.dispatch(gesture.coords, false);
  };

  private cancelGesture = (): void => {
    if (this.gesture === null) return;
    this.clearGestureTimer(this.gesture);
    this.gesture = null;
    this.releaseFace();
  };

  private releaseFace(): void {
    if (!this.gameOver) {
      this.setFace("active");
    }
  }

  private clearGestureTimer(gesture: PointerGesture): void {
    if (gesture.timer !== null) {
      window.clearTimeout(gesture.timer);
      gesture.timer = null;
    }
  }

  // Keyboard: Enter and Space act, F flags. A cell is a button, so the browser
  // already moves focus between them.
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.gameOver) return;
    const coords = this.coordsFrom(event.target);
    if (coords === null) return;
    if (event.key === "f" || event.key === "F") {
      event.preventDefault();
      this.dispatch(coords, true);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.dispatch(coords, false);
    }
  };

  private dispatch(coords: Coords, secondary: boolean): void {
    if (this.gameOver) return;
    const tile = this.lastTiles.get(`${coords.x},${coords.y}`);
    // Pressing an open cell always chords, whichever mode is on.
    if (tile !== undefined && tile.tileState === TileState.revealed) {
      this.onActivate(coords, false);
      return;
    }
    this.onActivate(coords, secondary ? !this.flagMode : this.flagMode);
  }

  private buzz(): void {
    try {
      navigator.vibrate?.(12);
    } catch {
      /* vibration is a nicety; never let it break the move */
    }
  }

  // --- rendering ----------------------------------------------------------

  // Arrow function so it keeps its binding when handed to the event aggregator.
  private onStateChanged = (newState: ShapeState): void => {
    this.lastState = newState;
    const board = newState.board;
    const { rows, cols, shape, bombs } = board.info;
    if (board.tileArray.length === 0) return;

    const status = winLoseCheck(board.tileArray);
    this.gameOver = status !== WinLoseStatus.none;
    if (this.gameOver) {
      this.cancelGesture();
    }
    this.elements.board.classList.toggle("is-over", this.gameOver);
    this.setFace(
      status === WinLoseStatus.win
        ? "won"
        : status === WinLoseStatus.lose
        ? "lost"
        : "active"
    );

    this.ensureGrid(shape, rows, cols);
    const layout = this.layout as Layout;

    this.lastTiles = new Map<string, Tile>();
    for (const tile of board.tileArray) {
      this.lastTiles.set(`${tile.coords.x},${tile.coords.y}`, tile);
    }

    const counts = board.nearbyBombCounts();
    for (let i = 0; i < board.tileArray.length; i++) {
      const tile = board.tileArray[i];
      const key = `${tile.coords.x},${tile.coords.y}`;
      const art = cellArt(tile, counts.get(key) ?? 0, status);
      const drawnKey = artKey(art);
      if (this.drawn[i] === drawnKey) {
        continue;
      }
      const cell = this.cells[i];
      cell.innerHTML = cellElementSvg(layout, tile.coords, art);
      cell.setAttribute("aria-label", describe(tile, art.count, status));
      this.drawn[i] = drawnKey;
    }

    const flagged = board.tileArray.filter(
      (t) => t.tileState === TileState.flagged
    ).length;
    this.setCounter(bombs - flagged);
    this.setStatus(status);
  };

  private ensureGrid(shape: Shape, rows: number, cols: number): void {
    if (
      shape === this.renderedShape &&
      rows === this.renderedRows &&
      cols === this.renderedCols
    ) {
      return;
    }

    const layout = forBoard(layoutFor(shape, this.content), rows, cols);
    this.layout = layout;

    const { board } = this.elements;
    board.replaceChildren();
    board.style.width = `${layout.boardWidth(rows, cols).toFixed(1)}px`;
    board.style.height = `${layout.boardHeight(rows, cols).toFixed(1)}px`;
    this.cells = [];
    this.drawn = [];

    // Same order as Board.generateNewBoard walks its cells, so the cell array
    // and the tile array line up by index.
    for (let x = 0; x < rows; x++) {
      for (let y = 0; y < cols; y++) {
        const origin = layout.origin(new Coords(x, y));
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "shape-cell";
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        cell.style.left = `${origin.x.toFixed(2)}px`;
        cell.style.top = `${origin.y.toFixed(2)}px`;
        cell.style.width = `${layout.cellWidth.toFixed(2)}px`;
        cell.style.height = `${layout.cellHeight.toFixed(2)}px`;
        board.appendChild(cell);
        this.cells.push(cell);
        this.drawn.push("");
      }
    }

    this.renderedShape = shape;
    this.renderedRows = rows;
    this.renderedCols = cols;
  }

  private setCounter(value: number): void {
    const clamped = Math.max(-99, Math.min(999, value));
    this.elements.counter.textContent =
      clamped < 0
        ? `-${String(Math.abs(clamped)).padStart(2, "0")}`
        : String(clamped).padStart(3, "0");
  }

  private setStatus(status: WinLoseStatus): void {
    const { status: statusEl } = this.elements;
    switch (status) {
      case WinLoseStatus.win:
        statusEl.textContent = "Cleared it.";
        break;
      case WinLoseStatus.lose:
        statusEl.textContent = "Boom.";
        break;
      default:
        statusEl.textContent = "";
        break;
    }
  }
}

// A cell is a button, so it needs a name. Deliberately not "row X, column Y":
// hex rows are offset and triangle cells alternate orientation, so a column
// number does not describe a position the way it does on a square grid.
function describe(
  tile: Tile,
  count: number | undefined,
  status: WinLoseStatus
): string {
  const where = `cell ${tile.coords.x + 1}-${tile.coords.y + 1}`;
  switch (tile.tileState) {
    case TileState.flagged:
      return tile.isBomb !== true && status === WinLoseStatus.lose
        ? `${where}, wrongly flagged`
        : `${where}, flagged`;
    case TileState.revealed:
      if (tile.isBomb === true) {
        return `${where}, mine`;
      }
      return count !== undefined && count > 0
        ? `${where}, ${count} nearby`
        : `${where}, clear`;
    default:
      return tile.isBomb === true && status === WinLoseStatus.lose
        ? `${where}, mine`
        : `${where}, covered`;
  }
}
