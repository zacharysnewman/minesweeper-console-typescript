import { MapInformation } from "./../MapGeneration/MapInformation";
import { State } from "./../State/State";
import { Coords } from "./../State/Coords";
import { EventSync, EventSync1, EventSync2 } from "./EventTypes/EventSync";

export type Evt<T> = { name: string; constructor: () => T };

class KeyCommandEventClass extends EventSync {}
class GenerateMapEventClass extends EventSync1<MapInformation> {}
class ActivateTileEventClass extends EventSync2<Coords, Boolean> {}
class StateChangedEventClass extends EventSync1<State> {}

export const KeyCommandEvent: Evt<KeyCommandEventClass> = {
  name: "KeyCommandEvent",
  constructor: () => new KeyCommandEventClass(),
};
export const GenerateMapEvent: Evt<GenerateMapEventClass> = {
  name: "GenerateMapEvent",
  constructor: () => new GenerateMapEventClass(),
};
export const ActivateTileEvent: Evt<ActivateTileEventClass> = {
  name: "ActivateTileEvent",
  constructor: () => new ActivateTileEventClass(),
};
export const StateChangedEvent: Evt<StateChangedEventClass> = {
  name: "StateChangedEvent",
  constructor: () => new StateChangedEventClass(),
};

// namespace Events
// {
//     namespace ConsoleEvents
//     {
//         // Console commands: From Entry > Renderer
//         public class KeyCommandEvent : EventSync { }
//     }
//     namespace InputEvents
//     {
//         public class GenerateMapEvent : EventSync<MapInformation> { }
//         public class ActivateTileEvent : EventSync<Coords, bool> { }
//     }
//     namespace StateEvents
//     {
//         public class StateChangedEvent : EventSync<State> { }
//     }
// }
