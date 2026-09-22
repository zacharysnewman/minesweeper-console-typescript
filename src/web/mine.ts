import "./styles.css";
import "./mine.css";

import { EventAggregator } from "../Events/EventAggregator";
import { GenerateTileGridEvent } from "../Events/Events";
import { Direction } from "../Mining/Direction";
import {
  MarkTileEvent,
  MovePlayerEvent,
  SpawnPlayerEvent,
} from "../Mining/MiningEvents";
import { Player } from "../Mining/Player";
import { Coords } from "../State/Coords";
import { Game } from "../State/Game";
import { TileGridInformation } from "../TileGridGeneration/TileGridInformation";
import { CAVES, CaveName, DEFAULT_CAVE, isCaveName } from "./caves";
import { requireElement } from "./dom";
import { MiningDomRenderer } from "./MiningDomRenderer";

// The browser entry point for the mining game, a sibling of main.ts. Same game
// rules, same tileset, a different thing to do with them.

const renderer = new MiningDomRenderer(
  {
    board: requireElement("board"),
    position: requireElement("position"),
    digs: requireElement("digs"),
    status: requireElement("status"),
  },
  onTilePress
);

let current: TileGridInformation = CAVES[DEFAULT_CAVE];

Game.init();
Player.init();
renderer.init();

// --- the one place a frame is asked for ---------------------------------
//
// Every input publishes, lets the layers settle synchronously, then draws
// once. Nothing else calls draw.

function act(direction: Direction, mark: boolean): void {
  if (mark) {
    EventAggregator.get(MarkTileEvent).publish(direction);
  } else {
    EventAggregator.get(MovePlayerEvent).publish(direction);
  }
  renderer.draw();
}

function newCave(info: TileGridInformation = current): void {
  current = info;
  EventAggregator.get(GenerateTileGridEvent).publish(info);
  EventAggregator.get(SpawnPlayerEvent).publish();
  renderer.draw();
}

// --- input ---------------------------------------------------------------

const keyDirections: Record<string, Direction> = {
  w: Direction.north,
  a: Direction.west,
  s: Direction.south,
  d: Direction.east,
  arrowup: Direction.north,
  arrowleft: Direction.west,
  arrowdown: Direction.south,
  arrowright: Direction.east,
};

// `in` would answer yes for 'constructor' and friends.
function directionForKey(key: string): Direction | undefined {
  return Object.prototype.hasOwnProperty.call(keyDirections, key)
    ? keyDirections[key]
    : undefined;
}

// Which way a tapped tile lies, when it is one of the four the miner can
// reach. Anything further away is not a move.
function directionTo(from: Coords, to: Coords): Direction | undefined {
  if (to.x === from.x - 1 && to.y === from.y) return Direction.north;
  if (to.x === from.x + 1 && to.y === from.y) return Direction.south;
  if (to.x === from.x && to.y === from.y + 1) return Direction.east;
  if (to.x === from.x && to.y === from.y - 1) return Direction.west;
  return undefined;
}

function onTilePress(coords: Coords): void {
  const player = Player.state;
  if (player.isSpawned !== true) {
    return;
  }
  const direction = directionTo(player.coords, coords);
  if (direction === undefined) {
    renderer.draw("You can only reach the four tiles around you.");
    return;
  }
  act(direction, isMarkMode());
}

window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === "f") {
    event.preventDefault();
    setMarkMode(!isMarkMode());
    return;
  }

  const direction = directionForKey(key);
  if (direction === undefined) {
    return;
  }
  // Arrow keys would scroll the page out from under the cave.
  event.preventDefault();
  // Shift marks without leaving mark mode on, which is how you flag one tile
  // mid-walk without having to remember to switch back.
  act(direction, event.shiftKey || isMarkMode());
});

// --- chrome --------------------------------------------------------------

const markModeButton = requireElement<HTMLButtonElement>("mark-mode");
const hint = requireElement("hint");
const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

function isMarkMode(): boolean {
  return markModeButton.getAttribute("aria-pressed") === "true";
}

function setMarkMode(on: boolean): void {
  markModeButton.setAttribute("aria-pressed", String(on));
  requireElement("board").classList.toggle("mark-mode", on);
  updateHint();
}

function updateHint(): void {
  const verb = isMarkMode() ? "marks" : "moves and digs";
  hint.textContent = isTouch
    ? `Tap a tile beside you, or use the pad. Tapping ${verb}.`
    : `W A S D or the arrow keys ${verb} · shift marks · F toggles mark mode`;
}

markModeButton.addEventListener("click", () => setMarkMode(!isMarkMode()));

for (const [id, direction] of [
  ["pad-north", Direction.north],
  ["pad-south", Direction.south],
  ["pad-east", Direction.east],
  ["pad-west", Direction.west],
] as const) {
  requireElement<HTMLButtonElement>(id).addEventListener("click", () =>
    act(direction, isMarkMode())
  );
}

requireElement<HTMLButtonElement>("new-cave").addEventListener("click", () =>
  newCave()
);

const caveSelect = requireElement<HTMLSelectElement>("cave");
caveSelect.addEventListener("change", () => {
  const name: CaveName = isCaveName(caveSelect.value)
    ? caveSelect.value
    : DEFAULT_CAVE;
  newCave(CAVES[name]);
});

caveSelect.value = DEFAULT_CAVE;
setMarkMode(false);
newCave(CAVES[DEFAULT_CAVE]);

// Tells the watchdog in the page that the script arrived and ran. Without it
// a page whose script 404s -- which is what a stale index.html pointing at a
// replaced build looks like -- is just a styled page with nothing on it.
(window as Window & { pageBooted?: boolean }).pageBooted = true;
