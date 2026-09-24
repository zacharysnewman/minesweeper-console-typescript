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
  pentagonThirds,
  pentagonHalves,
  pentagonHouses,
  pentagonSlab,
  pentagonEars,
  pentagonFan,
  pentagonGlide,
  pentagonPairs,
  pentagonType7,
  pentagonType8,
  pentagonType9,
  pentagonType10,
  pentagonType13,
  pentagonType15,
}

const names: Record<Shape, string> = {
  [Shape.square]: "square",
  [Shape.hex]: "hex",
  [Shape.triangle]: "triangle",
  [Shape.pentagonThirds]: "pentagon (hexagon thirds)",
  [Shape.pentagonHalves]: "pentagon (hexagon halves)",
  [Shape.pentagonHouses]: "pentagon (house rows)",
  [Shape.pentagonSlab]: "pentagon (paired slab)",
  [Shape.pentagonEars]: "pentagon (type 4 ears)",
  [Shape.pentagonFan]: "pentagon (type 5 fan)",
  [Shape.pentagonGlide]: "pentagon (type 2 glide)",
  [Shape.pentagonPairs]: "pentagon (type 6 pairs)",
  [Shape.pentagonType7]: "pentagon (type 7, Kershner)",
  [Shape.pentagonType8]: "pentagon (type 8, Kershner)",
  [Shape.pentagonType9]: "pentagon (type 9, Rice)",
  [Shape.pentagonType10]: "pentagon (type 10, James)",
  [Shape.pentagonType13]: "pentagon (type 13, Rice)",
  [Shape.pentagonType15]: "pentagon (type 15, Mann)",
};

export function shapeName(shape: Shape): string {
  return names[shape];
}

export const allShapes: Shape[] = [
  Shape.square,
  Shape.hex,
  Shape.triangle,
  Shape.pentagonThirds,
  Shape.pentagonHalves,
  Shape.pentagonHouses,
  Shape.pentagonSlab,
  Shape.pentagonEars,
  Shape.pentagonFan,
  Shape.pentagonGlide,
  Shape.pentagonPairs,
  Shape.pentagonType7,
  Shape.pentagonType8,
  Shape.pentagonType9,
  Shape.pentagonType10,
  Shape.pentagonType13,
  Shape.pentagonType15,
];

// What a shape is called in the page's select, and in the URL. This lives
// here rather than in the entry point so that nothing can add a shape and
// leave it out: the page reads it to resolve a choice, and page:shots reads
// it to know what to play.
const options: Record<Shape, string> = {
  [Shape.square]: "square",
  [Shape.hex]: "hex",
  [Shape.triangle]: "triangle",
  [Shape.pentagonThirds]: "pentagonThirds",
  [Shape.pentagonHalves]: "pentagonHalves",
  [Shape.pentagonHouses]: "pentagonHouses",
  [Shape.pentagonSlab]: "pentagonSlab",
  [Shape.pentagonEars]: "pentagonEars",
  [Shape.pentagonFan]: "pentagonFan",
  [Shape.pentagonGlide]: "pentagonGlide",
  [Shape.pentagonPairs]: "pentagonPairs",
  [Shape.pentagonType7]: "pentagonType7",
  [Shape.pentagonType8]: "pentagonType8",
  [Shape.pentagonType9]: "pentagonType9",
  [Shape.pentagonType10]: "pentagonType10",
  [Shape.pentagonType13]: "pentagonType13",
  [Shape.pentagonType15]: "pentagonType15",
};

export function shapeOption(shape: Shape): string {
  return options[shape];
}

export const SHAPES_BY_OPTION: Record<string, Shape> = Object.fromEntries(
  allShapes.map((shape) => [options[shape], shape])
);

