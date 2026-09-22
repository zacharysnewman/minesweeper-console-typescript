import "./styles.css";
import "./shapes.css";

import { EventAggregator } from "../Events/EventAggregator";
import { Coords } from "../State/Coords";
import { BoardInfo } from "../Shapes/BoardInfo";
import { ActivateCellEvent, GenerateBoardEvent } from "../Shapes/ShapeEvents";
import { ShapeGame } from "../Shapes/ShapeGame";
import { Shape } from "../Shapes/Shape";
import { DEFAULT_PRESET, presetFor, PRESET_NAMES } from "../Shapes/presets";
import { topologyFor } from "../Shapes/Topology";
import { layoutFor } from "../Shapes/geometry";
import { ShapesDomRenderer } from "./ShapesDomRenderer";
import { requireElement } from "./dom";

// The entry point owns the chrome -- the selects, the toggle, the new-board
// button -- and the renderer owns the board, as on the other two pages.
//
// Every input goes through newBoard() or the renderer's activate callback, so
// there is one place each kind of change enters the game.

const SHAPES: Record<string, Shape> = {
  square: Shape.square,
  hex: Shape.hex,
  triangle: Shape.triangle,
};

// A triangle advances half a cell per column, so it needs a bigger cell to
// come out legible; a hex is the roomiest for its footprint.
const PREFERRED_CELL: Record<Shape, number> = {
  [Shape.square]: 30,
  [Shape.hex]: 30,
  [Shape.triangle]: 34,
};

// Below this a board stops being readable, and scrolling is the better answer
// than shrinking further.
const MIN_CELL = 13;

// Board width is linear in the cell size, so the width of a one-unit board
// gives the factor to divide the available room by. A triangle expert board
// is 61 half-cells across and would otherwise run off the side of the window.
function cellSizeFor(shape: Shape, cols: number): number {
  const perUnit = layoutFor(shape, 1).boardWidth(cols);
  const available = Math.max(240, document.documentElement.clientWidth - 48);
  const fitted = Math.floor(available / perUnit);
  return Math.max(MIN_CELL, Math.min(PREFERRED_CELL[shape], fitted));
}

function isShapeName(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(SHAPES, value);
}

function isPresetName(value: string): boolean {
  return PRESET_NAMES.includes(value);
}

const renderer = new ShapesDomRenderer(
  {
    board: requireElement("board"),
    counter: requireElement("counter"),
    status: requireElement("status"),
    face: requireElement<HTMLButtonElement>("face"),
  },
  (coords: Coords, flagMode: boolean) => {
    EventAggregator.get(ActivateCellEvent).publish(coords, flagMode);
  }
);

const shapeSelect = requireElement<HTMLSelectElement>("shape");
const difficultySelect = requireElement<HTMLSelectElement>("difficulty");
const flagModeButton = requireElement<HTMLButtonElement>("flag-mode");
const hint = requireElement("hint");
const note = requireElement("shape-note");

function currentShape(): Shape {
  const value = shapeSelect.value;
  return isShapeName(value) ? SHAPES[value] : Shape.square;
}

function currentPreset(): string {
  const value = difficultySelect.value;
  return isPresetName(value) ? value : DEFAULT_PRESET;
}

function newBoard(): void {
  const shape = currentShape();
  const info: BoardInfo = presetFor(shape, currentPreset());
  renderer.setCellSize(cellSizeFor(shape, info.cols));
  renderer.reset();
  EventAggregator.get(GenerateBoardEvent).publish(info);
  describeShape(info);
}

function describeShape(info: BoardInfo): void {
  const degree = topologyFor(info.shape).degree;
  const density = ((info.bombs / info.cellCount) * 100).toFixed(0);
  note.textContent =
    `${info.rows} x ${info.cols}, ${info.bombs} mines at ${density}% ` +
    `density. Each cell touches ${degree} others, so a number here can run ` +
    `as high as ${degree}.`;
}

const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

function updateHint(): void {
  const flagging = renderer.isFlagMode();
  const primary = flagging ? "flags" : "reveals";
  const secondary = flagging ? "reveals" : "flags";
  hint.textContent = isTouch
    ? `Tap ${primary} · hold ${secondary} · tap a number to clear around it`
    : `Left click ${primary} · right click ${secondary} · F flags the focused cell`;
}

ShapeGame.init();
renderer.init();

requireElement("face").addEventListener("click", () => newBoard());
shapeSelect.addEventListener("change", () => newBoard());
difficultySelect.addEventListener("change", () => newBoard());

flagModeButton.addEventListener("click", () => {
  const next = !renderer.isFlagMode();
  renderer.setFlagMode(next);
  flagModeButton.setAttribute("aria-pressed", String(next));
  updateHint();
});

renderer.setFlagMode(false);
updateHint();
shapeSelect.value = "square";
difficultySelect.value = DEFAULT_PRESET;
newBoard();

// Refit on resize. The board is rebuilt at the new size rather than scaled,
// so the glyphs stay sized to the cell rather than blurring with it.
let resizeTimer: number | null = null;
window.addEventListener("resize", () => {
  if (resizeTimer !== null) {
    window.clearTimeout(resizeTimer);
  }
  resizeTimer = window.setTimeout(() => {
    resizeTimer = null;
    const shape = currentShape();
    renderer.setCellSize(cellSizeFor(shape, presetFor(shape, currentPreset()).cols));
  }, 120);
});
