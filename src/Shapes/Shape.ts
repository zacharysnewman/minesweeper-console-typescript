// The tilings the shape-agnostic board supports.
//
// The parameter that matters is not how many sides a cell has but how many
// cells touch it, because Minesweeper counts contact at a vertex as well as
// along an edge. A square has four sides and eight neighbours; a triangle has
// three sides and twelve; a hexagon is the one shape where the two numbers
// agree, because hexes have no vertex-only contact.
export enum Shape {
  square,
  hex,
  triangle,
  pentagon,
}

const names: Record<Shape, string> = {
  [Shape.square]: "square",
  [Shape.hex]: "hex",
  [Shape.triangle]: "triangle",
  [Shape.pentagon]: "pentagon",
};

export function shapeName(shape: Shape): string {
  return names[shape];
}

export const allShapes: Shape[] = [
  Shape.square,
  Shape.hex,
  Shape.triangle,
  Shape.pentagon,
];
