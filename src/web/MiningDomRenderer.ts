import { EventAggregator } from "../Events/EventAggregator";
import { StateChangedEvent } from "../Events/Events";
import { ActionResult } from "../Mining/ActionResult";
import { Direction, directionName, step } from "../Mining/Direction";
import { PlayerStateChangedEvent } from "../Mining/MiningEvents";
import { PlayerState } from "../Mining/PlayerState";
import { Terrain, terrainAt } from "../Mining/Terrain";
import { Coords } from "../State/Coords";
import { State } from "../State/State";
import { Tile } from "../State/Tile";
import { TileGrid } from "../State/TileGrid";
import { WinLoseStatus } from "../State/WinLoseStatus";
import { winLoseCheck } from "../State/winLoseCheck";
import { tileIndexFor } from "./sprites";

export interface MiningDomRendererElements {
  board: HTMLElement;
  position: HTMLElement;
  digs: HTMLElement;
  status: HTMLElement;
}

export type TilePressHandler = (coords: Coords) => void;

const rowLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// The browser front end for the mining layer. It draws the same tileset the
// minesweeper board draws — a dug tile is a dug tile — and puts the miner on
// top of it.
//
// Like DomRenderer it holds no game state, and like MiningRenderer it caches
// both layers and leaves the drawing to its caller: within one input the board
// settles before the player state that caused it is published, so a draw per
// event would show a half-settled cave.
export class MiningDomRenderer {
  private readonly elements: MiningDomRendererElements;
  private readonly onTilePress: TilePressHandler;

  // Cells are reused across draws; only what changed is rewritten unless the
  // cave's dimensions actually changed.
  private cells: HTMLButtonElement[] = [];
  private renderedWidth = -1;
  private renderedHeight = -1;

  private tileGrid: TileGrid = new TileGrid();
  private player: PlayerState = new PlayerState();

  constructor(
    elements: MiningDomRendererElements,
    onTilePress: TilePressHandler
  ) {
    this.elements = elements;
    this.onTilePress = onTilePress;
  }

  public init(): void {
    EventAggregator.get(StateChangedEvent).subscribe(this.onStateChanged);
    EventAggregator.get(PlayerStateChangedEvent).subscribe(
      this.onPlayerStateChanged
    );
    this.elements.board.addEventListener("click", this.onBoardClick);
  }

  // Arrow properties so they keep their binding when handed to the aggregator.
  private onStateChanged = (newState: State): void => {
    this.tileGrid = newState.tileGrid;
  };

  private onPlayerStateChanged = (newPlayer: PlayerState): void => {
    this.player = newPlayer;
  };

  private onBoardClick = (event: MouseEvent): void => {
    const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-x]"
    );
    if (!cell) {
      return;
    }
    this.onTilePress(
      new Coords(Number(cell.dataset.x), Number(cell.dataset.y))
    );
  };

  public draw(notice?: string): void {
    const { tileGridInfo, tileArray } = this.tileGrid;
    if (tileArray.length === 0) {
      return;
    }

    const status = winLoseCheck(tileArray);
    this.ensureGrid(tileGridInfo.Width, tileGridInfo.Height);

    // Index by coordinate once instead of scanning the array per cell.
    const byCoords = new Map<string, Tile>();
    for (const tile of tileArray) {
      byCoords.set(`${tile.coords.x},${tile.coords.y}`, tile);
    }

    const reachable = this.reachableTiles();

    for (let x = 0; x < tileGridInfo.Width; x++) {
      for (let y = 0; y < tileGridInfo.Height; y++) {
        const tile = byCoords.get(`${x},${y}`);
        if (!tile) {
          continue;
        }
        const cell = this.cells[x * tileGridInfo.Height + y];
        const index = tileIndexFor(tileArray, tile, status);
        cell.style.backgroundPositionY = `calc(var(--tile) * -${index})`;

        const isMiner =
          this.player.isSpawned === true &&
          this.player.coords.equals(tile.coords) === true;
        cell.classList.toggle("miner", isMiner);
        cell.classList.toggle("reachable", reachable.has(`${x},${y}`));
        cell.setAttribute(
          "aria-label",
          `Row ${rowLabels[x]}, column ${y}: ${
            isMiner ? "you are here" : describe(this.tileGrid, tile.coords)
          }`
        );
      }
    }

    this.elements.board.classList.toggle(
      "is-over",
      status !== WinLoseStatus.none
    );
    this.elements.position.textContent = this.player.isSpawned === true
      ? `${rowLabels[this.player.coords.x]}${this.player.coords.y} · facing ${directionName(this.player.facing)}`
      : "—";
    this.elements.digs.textContent = String(this.player.digCount);
    this.elements.status.textContent =
      notice ?? statusText(this.player, status);
  }

  // The four tiles an input can act on from where the miner stands. Showing
  // them is most of what tells a new player this is not minesweeper: you reach
  // what you are standing next to, and nothing else.
  private reachableTiles(): Set<string> {
    const reachable = new Set<string>();
    if (this.player.isSpawned !== true) {
      return reachable;
    }
    for (const direction of [
      Direction.north,
      Direction.south,
      Direction.east,
      Direction.west,
    ]) {
      const target = step(this.player.coords, direction);
      if (terrainAt(this.tileGrid, target) !== Terrain.bedrock) {
        reachable.add(`${target.x},${target.y}`);
      }
    }
    return reachable;
  }

  private ensureGrid(width: number, height: number): void {
    if (width === this.renderedWidth && height === this.renderedHeight) {
      return;
    }

    const { board } = this.elements;
    board.replaceChildren();
    board.style.setProperty("--columns", String(height));
    this.cells = [];

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "tile";
        // The keyboard drives the miner, so the cells are click targets rather
        // than 140 stops in the tab order.
        cell.tabIndex = -1;
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        board.appendChild(cell);
        this.cells.push(cell);
      }
    }

    this.renderedWidth = width;
    this.renderedHeight = height;
  }
}

function describe(tileGrid: TileGrid, coords: Coords): string {
  switch (terrainAt(tileGrid, coords)) {
    case Terrain.open:
      return "open cave";
    case Terrain.marked:
      return "marked rock";
    default:
      return "rock";
  }
}

function statusText(player: PlayerState, status: WinLoseStatus): string {
  if (status === WinLoseStatus.lose) {
    return "A gas pocket! The shaft caves in. Dig a new cave to try again.";
  }
  if (status === WinLoseStatus.win) {
    return "The cave is fully mapped. You made it out.";
  }

  const facing = directionName(player.facing);
  switch (player.lastResult) {
    case ActionResult.moved:
      return `You walk ${facing}.`;
    case ActionResult.dug:
      return `You dig into the rock to the ${facing}.`;
    case ActionResult.marked:
      return `You mark the rock to the ${facing}.`;
    case ActionResult.blocked:
      return `The way ${facing} is blocked.`;
    default:
      return "You wake in a pocket of open cave.";
  }
}
