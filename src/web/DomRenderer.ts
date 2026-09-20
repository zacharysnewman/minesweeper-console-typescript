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

export class DomRenderer {
  private readonly elements: DomRendererElements;
  private readonly onActivate: ActivateHandler;

  // Cells are reused across state changes; only the sprite offset is rewritten
  // unless the board's dimensions actually changed.
  private cells: HTMLButtonElement[] = [];
  private renderedWidth = -1;
  private renderedHeight = -1;
  private gameOver = false;
  private smileyHeldDown = false;

  constructor(elements: DomRendererElements, onActivate: ActivateHandler) {
    this.elements = elements;
    this.onActivate = onActivate;
  }

  public init(): void {
    EventAggregator.get(StateChangedEvent).subscribe(this.onStateChanged);
    this.bindBoardEvents();
    this.setSmiley("active");
  }

  private bindBoardEvents(): void {
    const { board, smiley } = this.elements;

    board.addEventListener("contextmenu", (event) => event.preventDefault());

    board.addEventListener("mousedown", (event) => {
      if (this.gameOver) return;
      // The face reacts to the press itself, matching the Unity tileset's
      // separate "tile clicked" expression.
      this.setSmiley("tileClicked");
    });

    const releaseFace = () => {
      if (!this.gameOver && !this.smileyHeldDown) {
        this.setSmiley("active");
      }
    };
    document.addEventListener("mouseup", releaseFace);
    board.addEventListener("mouseleave", releaseFace);

    board.addEventListener("click", (event) => {
      const coords = this.coordsFromEvent(event);
      if (coords) this.onActivate(coords, false);
    });

    board.addEventListener("auxclick", (event) => {
      if (event.button !== 1) return;
      const coords = this.coordsFromEvent(event);
      if (coords) this.onActivate(coords, false);
    });

    board.addEventListener("contextmenu", (event) => {
      const coords = this.coordsFromEvent(event);
      if (coords) this.onActivate(coords, true);
    });

    smiley.addEventListener("mousedown", () => {
      this.smileyHeldDown = true;
      this.setSmiley("activeClicked");
    });
    document.addEventListener("mouseup", () => {
      this.smileyHeldDown = false;
    });
  }

  private coordsFromEvent(event: Event): Coords | null {
    if (this.gameOver) return null;
    const target = (event.target as HTMLElement)?.closest<HTMLElement>(
      "[data-x]"
    );
    if (!target) return null;
    return new Coords(Number(target.dataset.x), Number(target.dataset.y));
  }

  // Arrow function so it keeps its binding when handed to the event aggregator.
  private onStateChanged = (newState: State): void => {
    const { tileGridInfo, tileArray } = newState.tileGrid;
    if (tileArray.length === 0) return;

    const status = winLoseCheck(tileArray);
    this.gameOver = status !== WinLoseStatus.none;

    this.ensureGrid(tileGridInfo.Width, tileGridInfo.Height);

    // Index by coordinate once instead of scanning the array per cell.
    const byCoords = new Map<string, Tile>();
    for (const tile of tileArray) {
      byCoords.set(`${tile.coords.x},${tile.coords.y}`, tile);
    }

    for (let x = 0; x < tileGridInfo.Width; x++) {
      for (let y = 0; y < tileGridInfo.Height; y++) {
        const tile = byCoords.get(`${x},${y}`);
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
