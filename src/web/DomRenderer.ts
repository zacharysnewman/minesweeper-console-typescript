import { EventAggregator } from "../Events/EventAggregator";
import { StateChangedEvent } from "../Events/Events";
import { State } from "../State/State";
import { Tile } from "../State/Tile";
import { TileState } from "../State/TileState";
import { WinLoseStatus } from "../State/WinLoseStatus";
import { winLoseCheck } from "../State/winLoseCheck";
import { Coords } from "../State/Coords";
import {
  SMILEY_SIZE,
  SMILEY_TOP,
  SMILEY_X,
  SmileyFace,
  TILE_SIZE,
  tileIndexFor,
} from "./sprites";

export type ActivateHandler = (coords: Coords, flagMode: boolean) => void;

export interface DomRendererElements {
  board: HTMLElement;
  counter: HTMLElement;
  smiley: HTMLButtonElement;
  status: HTMLElement;
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

export class DomRenderer {
  // Long enough not to fire on a hurried tap, short enough to feel deliberate.
  private static readonly LONG_PRESS_MS = 450;
  // A drag of more than roughly half a tile is a scroll, not a press.
  private static readonly MOVE_TOLERANCE_PX = 12;

  private readonly elements: DomRendererElements;
  private readonly onActivate: ActivateHandler;

  // Cells are reused across state changes; only the sprite offset is rewritten
  // unless the board's dimensions actually changed.
  private cells: HTMLButtonElement[] = [];
  private renderedWidth = -1;
  private renderedHeight = -1;
  private gameOver = false;
  private smileyHeldDown = false;

  /** Inverts tap and hold, for flagging without a right mouse button. */
  private flagMode = false;
  /** The tiles behind the current render, so a press can read tile state. */
  private lastTiles = new Map<string, Tile>();
  private gesture: PointerGesture | null = null;

  constructor(elements: DomRendererElements, onActivate: ActivateHandler) {
    this.elements = elements;
    this.onActivate = onActivate;
  }

  public init(): void {
    EventAggregator.get(StateChangedEvent).subscribe(this.onStateChanged);
    this.bindBoardEvents();
    this.setSmiley("active");
  }

  public setFlagMode(on: boolean): void {
    this.flagMode = on;
    this.elements.board.classList.toggle("flag-mode", on);
  }

  public isFlagMode(): boolean {
    return this.flagMode;
  }

  // --- input -------------------------------------------------------------
  //
  // Mouse and touch resolve to the same pair of actions:
  //
  //                    primary (tap / left)   secondary (hold / right)
  //   normal mode      reveal                 flag or unflag
  //   flag mode        flag or unflag         reveal
  //
  // with one override: a press on an already-revealed tile always activates
  // it, so tapping a number chords it in either mode.

  private bindBoardEvents(): void {
    const { board, smiley } = this.elements;

    // The platform's own long-press menu would pre-empt the flag gesture.
    board.addEventListener("contextmenu", (event) => event.preventDefault());

    board.addEventListener("pointerdown", this.onPointerDown);
    board.addEventListener("pointermove", this.onPointerMove);
    board.addEventListener("pointerup", this.onPointerUp);
    board.addEventListener("pointercancel", this.cancelGesture);
    board.addEventListener("pointerleave", this.cancelGesture);

    smiley.addEventListener("pointerdown", () => {
      this.smileyHeldDown = true;
      this.setSmiley("activeClicked");
    });
    document.addEventListener("pointerup", () => {
      this.smileyHeldDown = false;
    });
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.gameOver) return;

    const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-x]"
    );
    if (!cell) return;

    // Ignore anything that is not the left or right mouse button.
    if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 2) {
      return;
    }

    this.cancelGesture();

    const coords = new Coords(Number(cell.dataset.x), Number(cell.dataset.y));
    const gesture: PointerGesture = {
      id: event.pointerId,
      coords,
      startX: event.clientX,
      startY: event.clientY,
      pointerType: event.pointerType,
      timer: null,
      resolved: false,
    };
    this.gesture = gesture;
    this.setSmiley("tileClicked");

    // A mouse has a second button, so only touch and pen need the hold.
    if (event.pointerType !== "mouse") {
      gesture.timer = window.setTimeout(() => {
        if (this.gesture !== gesture) return;
        gesture.resolved = true;
        this.buzz();
        this.releaseFace();
        this.dispatch(gesture.coords, true);
      }, DomRenderer.LONG_PRESS_MS);
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (!gesture || gesture.id !== event.pointerId || gesture.resolved) return;

    const drifted =
      Math.abs(event.clientX - gesture.startX) >
        DomRenderer.MOVE_TOLERANCE_PX ||
      Math.abs(event.clientY - gesture.startY) > DomRenderer.MOVE_TOLERANCE_PX;
    if (drifted) {
      this.cancelGesture();
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (!gesture || gesture.id !== event.pointerId) return;

    this.clearGestureTimer(gesture);
    this.gesture = null;
    this.releaseFace();

    // The long press already acted; the release that ends it must not repeat.
    if (gesture.resolved) return;

    const secondary = gesture.pointerType === "mouse" && event.button === 2;
    this.dispatch(gesture.coords, secondary);
  };

  private cancelGesture = (): void => {
    if (!this.gesture) return;
    this.clearGestureTimer(this.gesture);
    this.gesture = null;
    this.releaseFace();
  };

  private clearGestureTimer(gesture: PointerGesture): void {
    if (gesture.timer !== null) {
      window.clearTimeout(gesture.timer);
      gesture.timer = null;
    }
  }

  private dispatch(coords: Coords, secondary: boolean): void {
    if (this.gameOver) return;

    const tile = this.lastTiles.get(`${coords.x},${coords.y}`);
    if (tile && tile.tileState === TileState.revealed) {
      this.onActivate(coords, false);
      return;
    }

    this.onActivate(coords, secondary ? !this.flagMode : this.flagMode);
  }

  private buzz(): void {
    // Confirms the hold registered on phones that support it.
    try {
      navigator.vibrate?.(12);
    } catch {
      /* vibration is a nicety; never let it break the move */
    }
  }

  private releaseFace(): void {
    if (!this.gameOver && !this.smileyHeldDown) {
      this.setSmiley("active");
    }
  }

  // --- rendering ---------------------------------------------------------

  // Arrow function so it keeps its binding when handed to the event aggregator.
  private onStateChanged = (newState: State): void => {
    const { tileGridInfo, tileArray } = newState.tileGrid;
    if (tileArray.length === 0) return;

    const status = winLoseCheck(tileArray);
    this.gameOver = status !== WinLoseStatus.none;
    if (this.gameOver) {
      this.cancelGesture();
    }

    this.ensureGrid(tileGridInfo.Width, tileGridInfo.Height);

    // Index by coordinate once instead of scanning the array per cell.
    this.lastTiles = new Map<string, Tile>();
    for (const tile of tileArray) {
      this.lastTiles.set(`${tile.coords.x},${tile.coords.y}`, tile);
    }

    for (let x = 0; x < tileGridInfo.Width; x++) {
      for (let y = 0; y < tileGridInfo.Height; y++) {
        const tile = this.lastTiles.get(`${x},${y}`);
        if (!tile) continue;
        const cell = this.cells[x * tileGridInfo.Height + y];
        const index = tileIndexFor(tileArray, tile, status);
        cell.style.backgroundPositionY = `calc(var(--tile) * -${index})`;
        cell.setAttribute(
          "aria-label",
          `Row ${x + 1}, column ${y + 1}: ${describe(tile, status)}`
        );
      }
    }

    const flagged = tileArray.filter(
      (t) => t.tileState === TileState.flagged
    ).length;
    this.setCounter(tileGridInfo.Bombs - flagged);
    this.setStatus(status);
  };

  private ensureGrid(width: number, height: number): void {
    if (width === this.renderedWidth && height === this.renderedHeight) return;

    const { board } = this.elements;
    board.replaceChildren();
    board.style.setProperty("--columns", String(height));
    this.cells = [];

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "tile";
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        board.appendChild(cell);
        this.cells.push(cell);
      }
    }

    this.renderedWidth = width;
    this.renderedHeight = height;
  }

  private setCounter(value: number): void {
    const clamped = Math.max(-99, Math.min(999, value));
    const text =
      clamped < 0
        ? `-${String(Math.abs(clamped)).padStart(2, "0")}`
        : String(clamped).padStart(3, "0");
    this.elements.counter.textContent = text;
  }

  private setStatus(status: WinLoseStatus): void {
    const { status: statusEl } = this.elements;
    switch (status) {
      case WinLoseStatus.win:
        statusEl.textContent = "You won!";
        this.setSmiley("won");
        break;
      case WinLoseStatus.lose:
        statusEl.textContent = "You lost.";
        this.setSmiley("lost");
        break;
      default:
        statusEl.textContent = "";
        this.setSmiley("active");
        break;
    }
    this.elements.board.classList.toggle("is-over", this.gameOver);
  }

  private setSmiley(face: SmileyFace): void {
    const scale = `calc(var(--smiley) / ${SMILEY_SIZE})`;
    this.elements.smiley.style.backgroundPosition = `calc(${scale} * -${SMILEY_X[face]}) calc(${scale} * -${SMILEY_TOP})`;
  }

  public reset(): void {
    this.cancelGesture();
    this.gameOver = false;
    this.setSmiley("active");
  }
}

function describe(tile: Tile, status: WinLoseStatus): string {
  switch (tile.tileState) {
    case TileState.flagged:
      return "flagged";
    case TileState.revealed:
      return tile.isBomb ? "mine" : "revealed";
    default:
      return tile.isBomb && status === WinLoseStatus.lose ? "mine" : "hidden";
  }
}

export const TILE_PIXELS = TILE_SIZE;
