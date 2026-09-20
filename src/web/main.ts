import "./styles.css";

import { EventAggregator } from "../Events/EventAggregator";
import { ActivateTileEvent, GenerateTileGridEvent } from "../Events/Events";
import { Game } from "../State/Game";
import { Coords } from "../State/Coords";
import { TileGridInformation } from "../TileGridGeneration/TileGridInformation";
import { DomRenderer } from "./DomRenderer";
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DifficultyName,
  isDifficultyName,
} from "./difficulty";

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }
  return element as T;
}

const renderer = new DomRenderer(
  {
    board: requireElement("board"),
    counter: requireElement("counter"),
    smiley: requireElement<HTMLButtonElement>("smiley"),
    status: requireElement("status"),
  },
  (coords: Coords, flagMode: boolean) => {
    EventAggregator.get(ActivateTileEvent).publish(coords, flagMode);
  }
);

let current: TileGridInformation = DIFFICULTIES[DEFAULT_DIFFICULTY];

function newGame(info: TileGridInformation = current): void {
  current = info;
  renderer.reset();
  EventAggregator.get(GenerateTileGridEvent).publish(info);
}

Game.init();
renderer.init();

requireElement("smiley").addEventListener("click", () => newGame());

const flagModeButton = requireElement<HTMLButtonElement>("flag-mode");
const hint = requireElement("hint");

const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

function updateHint(): void {
  const flagging = renderer.isFlagMode();
  const primary = flagging ? "flags" : "reveals";
  const secondary = flagging ? "reveals" : "flags";
  hint.textContent = isTouch
    ? `Tap ${primary} · hold ${secondary} · tap a number to clear around it`
    : `Left click ${primary} · right click ${secondary}`;
}

flagModeButton.addEventListener("click", () => {
  const next = !renderer.isFlagMode();
  renderer.setFlagMode(next);
  flagModeButton.setAttribute("aria-pressed", String(next));
  updateHint();
});

renderer.setFlagMode(false);
updateHint();

const difficultySelect = requireElement<HTMLSelectElement>("difficulty");
difficultySelect.addEventListener("change", () => {
  const value = difficultySelect.value;
  const name: DifficultyName = isDifficultyName(value)
    ? value
    : DEFAULT_DIFFICULTY;
  newGame(DIFFICULTIES[name]);
});

difficultySelect.value = DEFAULT_DIFFICULTY;
newGame(DIFFICULTIES[DEFAULT_DIFFICULTY]);
