import { Coords } from "../State/Coords";
import { Shape } from "./Shape";
import { pointsUp } from "./Topology";

export interface Point {
  readonly x: number;
  readonly y: number;
}

// Where a cell sits, what outline it has, and how much room it has inside.
//
// Everything is expressed against one number: `content`, the diameter of the
// largest circle that fits inside a cell. Sizing the three tilings by that
// rather than by their edge length is what makes a digit or an emoji the same
// size on all three -- a triangle's inscribed circle is only 0.577 of its
// side, so a triangle sized like a square would slice its own glyphs.
//
// Screen coordinates here, not board coordinates: x runs right and y runs
// down. Cell coordinates keep the project's convention, coords.x the row and
// coords.y the column.
export interface Layout {
  readonly shape: Shape;
  readonly content: number;
  // The cell's bounding box. Cells overlap for hex and triangle, so these are
  // not the same as the distance between cells.
  readonly cellWidth: number;
  readonly cellHeight: number;
  boardWidth(cols: number): number;
  boardHeight(rows: number): number;
  // The cell's bounding box on the board. Cells overlap for hex and triangle,
  // so a renderer that positions boxes absolutely needs this as well as the
  // outline that sits inside it.
  origin(coords: Coords): Point;
  // The cell outline, in board space.
  polygon(coords: Coords): Point[];
  // Where a glyph goes. Not the centre of the bounding box for a triangle:
  // its incentre sits a third of the height from the base, so an up-pointing
  // cell's content rides low and a down-pointing cell's rides high.
  center(coords: Coords): Point;
}

const ROOT3 = Math.sqrt(3);

function squareLayout(content: number): Layout {
  const s = content;
  const origin = (c: Coords): Point => ({ x: c.y * s, y: c.x * s });
  return {
    shape: Shape.square,
    content,
    origin,
    cellWidth: s,
    cellHeight: s,
    boardWidth: (cols) => cols * s,
    boardHeight: (rows) => rows * s,
    polygon: (c) => {
      const o = origin(c);
      return [
        { x: o.x, y: o.y },
        { x: o.x + s, y: o.y },
        { x: o.x + s, y: o.y + s },
        { x: o.x, y: o.y + s },
      ];
    },
    center: (c) => {
      const o = origin(c);
      return { x: o.x + s / 2, y: o.y + s / 2 };
    },
  };
}

// Pointy-top hexes in odd-r offset: odd rows sit half a cell right, and rows
// overlap vertically because the row step is three quarters of the height.
// The inscribed circle spans the full flat-to-flat width, which makes hex the
// roomiest of the three for its footprint.
function hexLayout(content: number): Layout {
  const w = content;
  const h = (2 * content) / ROOT3;
  const rowStep = 0.75 * h;
  const origin = (c: Coords): Point => ({
    x: c.y * w + (Math.abs(c.x % 2) === 1 ? w / 2 : 0),
    y: c.x * rowStep,
  });
  return {
    shape: Shape.hex,
    content,
    origin,
    cellWidth: w,
    cellHeight: h,
    boardWidth: (cols) => cols * w + w / 2,
    boardHeight: (rows) => (rows - 1) * rowStep + h,
    polygon: (c) => {
      const o = origin(c);
      return [
        { x: o.x + w / 2, y: o.y },
        { x: o.x + w, y: o.y + h / 4 },
        { x: o.x + w, y: o.y + (3 * h) / 4 },
        { x: o.x + w / 2, y: o.y + h },
        { x: o.x, y: o.y + (3 * h) / 4 },
        { x: o.x, y: o.y + h / 4 },
      ];
    },
    center: (c) => {
      const o = origin(c);
      return { x: o.x + w / 2, y: o.y + h / 2 };
    },
  };
}

// Triangles alternate point-up and point-down along a row and advance only
// half a cell each, so bounding boxes overlap their neighbours by half. The
// side is content * sqrt(3), which is what it takes for the inscribed circle
// to match the other two shapes.
function triangleLayout(content: number): Layout {
  const side = content * ROOT3;
  const h = (side * ROOT3) / 2;
  const colStep = side / 2;
  const origin = (c: Coords): Point => ({ x: c.y * colStep, y: c.x * h });
  return {
    shape: Shape.triangle,
    content,
    origin,
    cellWidth: side,
    cellHeight: h,
    boardWidth: (cols) => (cols + 1) * colStep,
    boardHeight: (rows) => rows * h,
    polygon: (c) => {
      const o = origin(c);
      return pointsUp(c)
        ? [
            { x: o.x + side / 2, y: o.y },
            { x: o.x + side, y: o.y + h },
            { x: o.x, y: o.y + h },
          ]
        : [
            { x: o.x, y: o.y },
            { x: o.x + side, y: o.y },
            { x: o.x + side / 2, y: o.y + h },
          ];
    },
    center: (c) => {
      const o = origin(c);
      // The centroid of an equilateral triangle is its incentre.
      return {
        x: o.x + side / 2,
        y: pointsUp(c) ? o.y + (2 * h) / 3 : o.y + h / 3,
      };
    },
  };
}

export function layoutFor(shape: Shape, content: number): Layout {
  switch (shape) {
    case Shape.hex:
      return hexLayout(content);
    case Shape.triangle:
      return triangleLayout(content);
    default:
      return squareLayout(content);
  }
}

// How big text may be drawn at a cell's centre and still clear the outline.
//
// An inscribed circle is the wrong model here. Text is a wide, short box, and
// the shapes do not narrow the same way: a square or a hex is at its full
// width across the middle, while a triangle narrows toward its apex, so the
// binding constraint there is the top corners of the box rather than its
// diagonal. Sizing triangles by the inscribed circle overflows them, which is
// exactly what the first specimen showed.

// Measured from the browser rather than assumed -- see `npm run shots`, which
// re-measures every glyph it photographs and fails if these drift.
//
// DejaVu Sans figures are tabular, and the numbers are drawn bold, which is
// wider than the regular weight (0.636em) it is tempting to look up. Noto
// Color Emoji is wider than its em box, so an emoji has to be set smaller
// than a digit, not larger.
const DIGIT_ADVANCE_EM = 0.696;
const DIGIT_CAP_EM = 0.729;
const EMOJI_WIDTH_EM = 1.25;
const EMOJI_HEIGHT_EM = 1.18;

// Room to breathe. The geometry above says where a glyph would just touch the
// outline; a cell that reads well keeps it well short of that.
export const FILL = 0.82;

// The largest font size at which a text box of widthEm x heightEm, centred on
// the cell's content centre, stays inside the outline.
export function fitFontSize(
  layout: Layout,
  widthEm: number,
  heightEm: number,
  inset = 0
): number {
  const c = layout.content - 2 * inset;
  switch (layout.shape) {
    case Shape.hex: {
      // Full width across the middle half of the height, then closing toward
      // the points. A box short enough to stay in that middle band is limited
      // only by the width; a taller one has to clear the slanted sides, which
      // works out to content >= (width + sqrt(3) * height) / 2.
      const h = (2 * c) / ROOT3;
      const byWidth = c / widthEm;
      const withinBand = h / 2 / heightEm;
      return byWidth <= withinBand
        ? FILL * byWidth
        : FILL * ((2 * c) / (widthEm + ROOT3 * heightEm));
    }
    case Shape.triangle: {
      // Half-width at depth y is (y / h)(side / 2). Requiring the box's top
      // corners to sit inside, with the box centred on the incentre, reduces
      // to content >= 0.866 * width + height / 2.
      const byOutline = c / ((ROOT3 / 2) * widthEm + heightEm / 2);
      // And the box still has to fit between the incentre and the base.
      const byHeight = c / heightEm;
      return FILL * Math.min(byOutline, byHeight);
    }
    default:
      return FILL * Math.min(c / widthEm, c / heightEm);
  }
}

// The box a piece of text occupies, in em, so a check can put the corners
// back on the board and confirm they land inside the cell.
export function digitBoxEm(digits: number): { width: number; height: number } {
  return { width: DIGIT_ADVANCE_EM * digits, height: DIGIT_CAP_EM };
}

export function glyphBoxEm(): { width: number; height: number } {
  return { width: EMOJI_WIDTH_EM, height: EMOJI_HEIGHT_EM };
}

export function digitFontSize(layout: Layout, digits: number): number {
  const box = digitBoxEm(digits);
  return fitFontSize(layout, box.width, box.height);
}

// Glyphs are drawn with a dark outline around them, which grows the mark by
// its width on every side, so the room it takes has to come off the fit.
export const GLYPH_OUTLINE_PX = 1.25;

export function glyphFontSize(layout: Layout): number {
  const box = glyphBoxEm();
  return fitFontSize(layout, box.width, box.height, GLYPH_OUTLINE_PX);
}

// True when every corner of the text box lies inside the cell outline.
export function textBoxFits(
  layout: Layout,
  coords: Coords,
  widthEm: number,
  heightEm: number,
  inset = 0
): boolean {
  const size = fitFontSize(layout, widthEm, heightEm, inset);
  const centre = layout.center(coords);
  // The outline counts: what has to clear the cell is the mark plus its edge.
  const halfWidth = (widthEm * size) / 2 + inset;
  const halfHeight = (heightEm * size) / 2 + inset;
  const corners: Point[] = [
    { x: centre.x - halfWidth, y: centre.y - halfHeight },
    { x: centre.x + halfWidth, y: centre.y - halfHeight },
    { x: centre.x + halfWidth, y: centre.y + halfHeight },
    { x: centre.x - halfWidth, y: centre.y + halfHeight },
  ];
  const polygon = layout.polygon(coords);
  return corners.every((corner) => inside(corner, polygon));
}

function inside(point: Point, polygon: Point[]): boolean {
  // Ray casting, with the edges nudged outward by a hair so a corner sitting
  // exactly on the outline is not called a miss.
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const straddles = a.y > point.y !== b.y > point.y;
    if (
      straddles &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      hit = !hit;
    }
  }
  return hit;
}

// --- fitting content into an arbitrary convex cell ---------------------------
//
// The three original shapes each got a closed form: a square and a hex are at
// full width across the middle, a triangle closes toward its apex. There is no
// closed form for the fifteen pentagons, and several of them are lopsided
// enough that guessing would slice glyphs the way the inscribed circle did on
// triangles. So this works for any convex polygon, and the special cases stay
// only because they are already proven.

// The point furthest from every edge, and how far that is: the centre of the
// largest circle that fits. For a triangle this is the incentre, which is why
// an up-pointing cell's glyph rides low.
export function chebyshevCenter(polygon: readonly Point[]): {
  center: Point;
  radius: number;
} {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  let lo: Point = { x: Math.min(...xs), y: Math.min(...ys) };
  let hi: Point = { x: Math.max(...xs), y: Math.max(...ys) };

  let best: Point = { x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2 };
  let bestRadius = -Infinity;

  // Coarse grid, then tighten around the winner. Cheap, and the polygons are
  // small and few -- this runs once per shape, not once per cell drawn.
  for (let pass = 0; pass < 24; pass++) {
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const p: Point = {
          x: lo.x + ((hi.x - lo.x) * i) / steps,
          y: lo.y + ((hi.y - lo.y) * j) / steps,
        };
        const r = distanceToEdges(p, polygon);
        if (r > bestRadius) {
          bestRadius = r;
          best = p;
        }
      }
    }
    const spanX = (hi.x - lo.x) / 4;
    const spanY = (hi.y - lo.y) / 4;
    lo = { x: best.x - spanX, y: best.y - spanY };
    hi = { x: best.x + spanX, y: best.y + spanY };
  }
  return { center: best, radius: Math.max(0, bestRadius) };
}

// Twice the signed area: positive when the polygon is wound counter-clockwise.
function signedArea(polygon: readonly Point[]): number {
  let total = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    total += polygon[j].x * polygon[i].y - polygon[i].x * polygon[j].y;
  }
  return total;
}

// Distance from an interior point to the nearest edge, negative when outside.
//
// Which side of an edge is "in" depends on the winding, so the winding is
// measured rather than assumed. Assuming it cost two failing checks here: the
// down-pointing triangle of the triangle tiling is wound the opposite way to
// the up-pointing one, so every point in it read as outside and it fit
// nothing at all. Fifteen hand-entered pentagon units are not going to be
// consistently wound either.
function distanceToEdges(point: Point, polygon: readonly Point[]): number {
  const orientation = signedArea(polygon) >= 0 ? 1 : -1;
  let nearest = Infinity;
  let inside = true;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const length = Math.hypot(ex, ey);
    if (length === 0) {
      continue;
    }
    const cross =
      (orientation * (ex * (point.y - a.y) - ey * (point.x - a.x))) / length;
    if (cross < 0) {
      inside = false;
    }
    nearest = Math.min(nearest, Math.abs(cross));
  }
  return inside ? nearest : -nearest;
}

export function pointInPolygon(
  point: Point,
  polygon: readonly Point[]
): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      hit = !hit;
    }
  }
  return hit;
}

// The largest font size at which a text box of widthEm x heightEm, centred on
// the cell's content centre, keeps all four corners inside the outline.
// Binary search rather than algebra, because the outline is arbitrary.
export function fitTextInPolygon(
  polygon: readonly Point[],
  centre: Point,
  widthEm: number,
  heightEm: number,
  inset = 0
): number {
  const fits = (size: number): boolean => {
    const halfWidth = (widthEm * size) / 2 + inset;
    const halfHeight = (heightEm * size) / 2 + inset;
    return [
      { x: centre.x - halfWidth, y: centre.y - halfHeight },
      { x: centre.x + halfWidth, y: centre.y - halfHeight },
      { x: centre.x + halfWidth, y: centre.y + halfHeight },
      { x: centre.x - halfWidth, y: centre.y + halfHeight },
    ].every((corner) => pointInPolygon(corner, polygon));
  };

  let lo = 0;
  let hi = 4 * chebyshevCenter(polygon).radius + 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return FILL * lo;
}
