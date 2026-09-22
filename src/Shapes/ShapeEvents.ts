import { Evt } from "../Events/Events";
import { EventSync1, EventSync2 } from "../Events/EventTypes/EventSync";
import { Coords } from "../State/Coords";
import { BoardInfo } from "./BoardInfo";
import { ShapeState } from "./ShapeState";

// Its own tokens, in its own module, so the existing front ends import nothing
// new and keep their own event payload types.
//
// EventAggregator keys its subscriber map by the token's `name` string, not by
// the token object, so these names must differ from the ones in
// src/Events/Events.ts. Two tokens sharing a name silently share one event
// instance -- no type error, no runtime error, just the square game hearing
// this layer's activations.
class GenerateBoardEventClass extends EventSync1<BoardInfo> {}
class ActivateCellEventClass extends EventSync2<Coords, Boolean> {}
class ShapeStateChangedEventClass extends EventSync1<ShapeState> {}

export const GenerateBoardEvent: Evt<GenerateBoardEventClass> = {
  name: "GenerateBoardEvent",
  constructor: () => new GenerateBoardEventClass(),
};
export const ActivateCellEvent: Evt<ActivateCellEventClass> = {
  name: "ActivateCellEvent",
  constructor: () => new ActivateCellEventClass(),
};
export const ShapeStateChangedEvent: Evt<ShapeStateChangedEventClass> = {
  name: "ShapeStateChangedEvent",
  constructor: () => new ShapeStateChangedEventClass(),
};
