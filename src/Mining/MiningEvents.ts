import { Evt } from "../Events/Events";
import { EventSync, EventSync1 } from "../Events/EventTypes/EventSync";
import { Direction } from "./Direction";
import { PlayerState } from "./PlayerState";

// The mining layer keeps its own event tokens instead of extending
// src/Events/Events.ts, so the existing experiences import nothing new. They
// still share one EventAggregator, which is how the player layer hears about
// game state and how it talks back.
class SpawnPlayerEventClass extends EventSync {}
class MovePlayerEventClass extends EventSync1<Direction> {}
class MarkTileEventClass extends EventSync1<Direction> {}
class PlayerStateChangedEventClass extends EventSync1<PlayerState> {}

export const SpawnPlayerEvent: Evt<SpawnPlayerEventClass> = {
  name: "SpawnPlayerEvent",
  constructor: () => new SpawnPlayerEventClass(),
};
export const MovePlayerEvent: Evt<MovePlayerEventClass> = {
  name: "MovePlayerEvent",
  constructor: () => new MovePlayerEventClass(),
};
export const MarkTileEvent: Evt<MarkTileEventClass> = {
  name: "MarkTileEvent",
  constructor: () => new MarkTileEventClass(),
};
export const PlayerStateChangedEvent: Evt<PlayerStateChangedEventClass> = {
  name: "PlayerStateChangedEvent",
  constructor: () => new PlayerStateChangedEventClass(),
};
