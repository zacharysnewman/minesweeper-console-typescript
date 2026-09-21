import { Coords } from "../State/Coords";

// The grid stores x as the row index and y as the column index (the render
// loops in Renderer walk x over Width and y over Height), so north and south
// walk x while east and west walk y. Row 0 is the top of the map, which is why
// north subtracts from x.
export enum Direction {
  north,
  south,
  east,
  west,
}

const deltas: Record<Direction, Coords> = {
  [Direction.north]: new Coords(-1, 0),
  [Direction.south]: new Coords(1, 0),
  [Direction.east]: new Coords(0, 1),
  [Direction.west]: new Coords(0, -1),
};

const names: Record<Direction, string> = {
  [Direction.north]: "north",
  [Direction.south]: "south",
  [Direction.east]: "east",
  [Direction.west]: "west",
};

// The tile one step away from coords. It may be off the map; callers ask the
// terrain what is there rather than bounds checking here.
export function step(coords: Coords, direction: Direction): Coords {
  const delta = deltas[direction];
  return new Coords(coords.x + delta.x, coords.y + delta.y);
}

export function directionName(direction: Direction): string {
  return names[direction];
}
