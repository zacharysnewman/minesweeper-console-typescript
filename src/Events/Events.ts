import { TileGridInformation } from "../TileGridGeneration/TileGridInformation";
import { State } from "./../State/State";
import { Coords } from "./../State/Coords";
import { EventSync, EventSync1, EventSync2 } from "./EventTypes/EventSync";

export type Evt<T> = { name: string; constructor: () => T };

class KeyCommandEventClass extends EventSync {}
class GenerateTileGridEventClass extends EventSync1<TileGridInformation> {}
class ActivateTileEventClass extends EventSync2<Coords, Boolean> {}
class StateChangedEventClass extends EventSync1<State> {}

export const KeyCommandEvent: Evt<KeyCommandEventClass> = {
  name: "KeyCommandEvent",
  constructor: () => new KeyCommandEventClass(),
};
export const GenerateTileGridEvent: Evt<GenerateTileGridEventClass> = {
  name: "GenerateTileGridEvent",
  constructor: () => new GenerateTileGridEventClass(),
};
export const ActivateTileEvent: Evt<ActivateTileEventClass> = {
  name: "ActivateTileEvent",
  constructor: () => new ActivateTileEventClass(),
};
export const StateChangedEvent: Evt<StateChangedEventClass> = {
  name: "StateChangedEvent",
  constructor: () => new StateChangedEventClass(),
};
