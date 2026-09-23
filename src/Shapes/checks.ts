import { EventAggregator } from "../Events/EventAggregator";
import {
  ActivateTileEvent,
  GenerateTileGridEvent,
  StateChangedEvent,
} from "../Events/Events";
import { Coords } from "../State/Coords";
import { Game } from "../State/Game";
import { Tile } from "../State/Tile";
import { TileGridInformation } from "../TileGridGeneration/TileGridInformation";
import { TileState } from "../State/TileState";
import { winLoseCheck } from "../State/winLoseCheck";
import { WinLoseStatus } from "../State/WinLoseStatus";
import { Board } from "./Board";
import { BoardInfo } from "./BoardInfo";
import { BOARD_FACE, NUMBER_COLORS } from "./numberPalette";
import { FACE_REVEALED } from "./svg";
import { PRESETS, PRESET_NAMES } from "./presets";
import {
  ActivateCellEvent,
  GenerateBoardEvent,
  ShapeStateChangedEvent,
} from "./ShapeEvents";
import { ShapeGame } from "./ShapeGame";
import { polygonArea, Recipe, searchArrangement } from "./arrange";
import { solvePentagon, Spec } from "./pentagonShapes";

// The two shapes whose geometry is solved rather than written down, with the
// type each is meant to be and the arrangement the search found for it.
const SOLVED_PENTAGONS: {
  label: string;
  spec: Spec;
  want: number;
  recipe: Recipe;
}[] = [
  {
    label: "type 4 ears",
    spec: (t, s) => ({ angles: [130, 90, 110, 90, 120], lengths: [t, 1, 1, s, s] }),
    want: 4,
    recipe: { kind: "turn", centre: { at: "corner", index: 1 }, order: 4 },
  },
  {
    label: "type 5 fan",
    spec: (t, s) => ({ angles: [60, 100, 150, 120, 110], lengths: [1, 1, s, t, t] }),
    want: 5,
    recipe: { kind: "turn", centre: { at: "corner", index: 0 }, order: 6 },
  },
];
import { allShapes, Shape, shapeName } from "./Shape";
import {
  chebyshevCenter,
  digitBoxEm,
  fitTextInPolygon,
  glyphBoxEm,
  GLYPH_OUTLINE_PX,
  layoutFor,
  Point,
  contentFitsCell,
  centroidOf,
} from "./geometry";
import {
  checkCoverage,
  deriveOffsets,
  fundamentalArea,
  polygonsTouch,
  rotateTiling,
  Tiling,
} from "./Tiling";
import { pentagonTilings } from "./pentagons";
import { PENTAGON_TYPES, typesOf } from "./pentagonTypes";
import { TILINGS, topologyFor } from "./Topology";
import { layoutFor as layoutForShape } from "./geometry";

// The project has no test runner, so the shape rules check themselves:
// `npm run shapes:check`. The adjacency properties below are the point of the
// file -- a hand written, parity dependent offset table is where a tiling goes
// wrong, and a table whose two parities disagree produces asymmetric bomb
// counts and a board that is quietly unsolvable rather than obviously broken.
// That is not something playing the game will find.

let failures = 0;
function check(label: string, ok: boolean): void {
  if (!ok) {
    failures++;
  }
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
}

const key = (c: Coords): string => `${c.x},${c.y}`;

function areaOf(polygon: readonly Point[]): number {
  let total = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    total += polygon[j].x * polygon[i].y - polygon[i].x * polygon[j].y;
  }
  return Math.abs(total) / 2;
}

function isConvex(polygon: readonly Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const c = polygon[(i + 2) % polygon.length];
    const turn =
      (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(turn) < 1e-12) {
      continue;
    }
    const next = Math.sign(turn);
    if (sign === 0) {
      sign = next;
    } else if (next !== sign) {
      return false;
    }
  }
  return true;
}

// Scale a unit polygon so its inscribed circle is `content` across, the way a
// board sizes its cells.
function scaleTo(polygon: readonly Point[], content: number): Point[] {
  const factor = content / 2 / chebyshevCenter(polygon).radius;
  return polygon.map((p) => ({ x: p.x * factor, y: p.y * factor }));
}

// Builds a board from rows of glyphs, the way Mining/checks.ts does.
// '#' hidden, '.' revealed, '!' flagged, '*' hidden bomb, ',' revealed bomb.
function board(shape: Shape, ...rows: string[]): Board {
  const states: Record<string, [TileState, boolean]> = {
    "#": [TileState.hidden, false],
    ".": [TileState.revealed, false],
    "!": [TileState.flagged, false],
    "*": [TileState.hidden, true],
    ",": [TileState.revealed, true],
  };
  const tiles: Tile[] = [];
  let bombs = 0;
  rows.forEach((row, x) => {
    row.split("").forEach((glyph, y) => {
      const [state, isBomb] = states[glyph];
      if (isBomb) bombs++;
      tiles.push(new Tile(new Coords(x, y), state, isBomb));
    });
  });
  const info = new BoardInfo(rows.length, rows[0].length, bombs, shape);
  return new Board(info, tiles);
}

// A deterministic source of randomness, so a red line is a real change in
// behaviour and not an unlucky shuffle.
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

console.log("\nadjacency properties\n");

for (const shape of allShapes) {
  const topology = topologyFor(shape);
  const name = shapeName(shape);
  // A patch big enough that the middle of it is nowhere near an edge. A
  // tiling's neighbours reach into the next primitive unit, so "near an edge"
  // is measured in units and not in cells: twelve columns of a six-cell unit
  // is two units across, and almost nothing in it is interior at all.
  const unitCells = TILINGS[shape]?.cells ?? 1;
  const span = 12 * unitCells;
  const margin = 3 * unitCells;
  const cells: Coords[] = [];
  for (let x = 0; x < span; x++) {
    for (let y = 0; y < span; y++) {
      cells.push(new Coords(x, y));
    }
  }

  check(
    `${name}: a cell is never its own neighbour`,
    cells.every((c) => !topology.neighbours(c).some((n) => n.equals(c) === true))
  );

  check(
    `${name}: no coordinate is listed twice`,
    cells.every((c) => {
      const ns = topology.neighbours(c);
      return new Set(ns.map(key)).size === ns.length;
    })
  );

  check(
    `${name}: every cell lists exactly the neighbours its degree says`,
    cells.every((c) => topology.neighbours(c).length === topology.degreeAt(c))
  );

  // The one that matters: b is a's neighbour if and only if a is b's. A table
  // whose even and odd rows disagree fails here and nowhere else.
  check(
    `${name}: adjacency is symmetric`,
    cells.every((c) =>
      topology
        .neighbours(c)
        .every((n) =>
          topology.neighbours(n).some((back) => back.equals(c) === true)
        )
    )
  );

  // Degree counted on a real board, away from the edges, is the same number.
  const b = Board.generateNewBoard(new BoardInfo(span, span, 0, shape));
  const interior = cells.filter(
    (c) =>
      c.x >= margin &&
      c.x < span - margin &&
      c.y >= margin &&
      c.y < span - margin
  );
  check(
    `${name}: interior cells on a board keep their full degree (${interior.length} of them)`,
    interior.length > 0 &&
      interior.every((c) => b.neighbours(c).length === topology.degreeAt(c))
  );

  check(
    `${name}: no neighbour of a board cell falls outside the board`,
    cells.every((c) => b.neighbours(c).every((n) => b.contains(n)))
  );
}

console.log("\nboard generation\n");

for (const shape of allShapes) {
  const name = shapeName(shape);
  const info = new BoardInfo(10, 10, 20, shape);

  const generated = Board.generateNewBoard(info, undefined, seeded(7));
  check(
    `${name}: a generated board has one tile per cell`,
    generated.tileArray.length === info.cellCount
  );
  check(
    `${name}: a generated board carries the requested bomb count`,
    generated.tileArray.filter((t) => t.isBomb === true).length === info.bombs
  );
  check(
    `${name}: every generated tile starts hidden`,
    generated.tileArray.every((t) => t.tileState === TileState.hidden)
  );
  check(
    `${name}: generation is repeatable for a given seed`,
    Board.generateNewBoard(info, undefined, seeded(7)).equals(
      Board.generateNewBoard(info, undefined, seeded(7))
    ) === true
  );

  // The opening move clears a pocket, not just the cell under the cursor.
  const target = new Coords(5, 5);
  const opened = Board.generateNewBoard(info, target, seeded(3));
  const pocket = [target, ...opened.neighbours(target)];
  check(
    `${name}: the first click and everything touching it are bomb free`,
    pocket.every((c) => (opened.tileAt(c) as Tile).isBomb !== true)
  );
  check(
    `${name}: clearing the pocket does not cost the board its bombs`,
    opened.tileArray.filter((t) => t.isBomb === true).length === info.bombs
  );
  check(
    `${name}: a board cannot hold more bombs than it has cells`,
    Board.generateNewBoard(
      new BoardInfo(4, 4, 999, shape),
      undefined,
      seeded(1)
    ).tileArray.filter((t) => t.isBomb === true).length <= 16
  );
}

console.log("\nactivation\n");

for (const shape of allShapes) {
  const name = shapeName(shape);
  const info = new BoardInfo(12, 12, 20, shape);

  const fresh = Board.generateNewBoard(info);
  const first = fresh.withActivatedCell(new Coords(6, 6), false);
  check(
    `${name}: the first activation never detonates`,
    winLoseCheck(first.tileArray) !== WinLoseStatus.lose
  );
  check(
    `${name}: the first activation opens more than the cell clicked`,
    first.tileArray.filter((t) => t.tileState === TileState.revealed).length > 1
  );

  const flagged = fresh.withActivatedCell(new Coords(6, 6), true);
  check(
    `${name}: flagging a hidden cell marks it`,
    (flagged.tileAt(new Coords(6, 6)) as Tile).tileState === TileState.flagged
  );
  check(
    `${name}: flagging a flagged cell clears the mark`,
    (
      flagged.withActivatedCell(new Coords(6, 6), true).tileAt(
        new Coords(6, 6)
      ) as Tile
    ).tileState === TileState.hidden
  );
  check(
    `${name}: revealing a flagged cell does nothing`,
    flagged
      .withActivatedCell(new Coords(6, 6), false)
      .equals(flagged) === true
  );
  check(
    `${name}: activating a cell off the board is refused`,
    fresh.withActivatedCell(new Coords(-1, 0), false) === fresh
  );
}

// Hand built boards, so the numbers below are read off the glyphs rather than
// trusted from a shuffle.
{
  const b = board(
    Shape.square,
    "#####",
    "#*#*#",
    "#####",
    "#####",
    "#####"
  );
  check(
    "square: a cell counts the bombs touching it",
    b.nearbyBombCount(new Coords(2, 2)) === 2 &&
      b.nearbyBombCount(new Coords(0, 0)) === 1 &&
      b.nearbyBombCount(new Coords(4, 4)) === 0
  );

  const empty = board(Shape.square, "###", "###", "###");
  const cascaded = empty.withActivatedCell(new Coords(1, 1), false);
  check(
    "square: a zero opens the whole empty board",
    cascaded.tileArray.every((t) => t.tileState === TileState.revealed)
  );

  const marked = board(
    Shape.square,
    ".....",
    ".!*..",
    ".....",
    ".....",
    "....."
  );
  check(
    "square: a cascade does not step over a mark",
    (
      board(Shape.square, "###", "#!#", "###").withActivatedCell(
        new Coords(0, 0),
        false
      ).tileAt(new Coords(1, 1)) as Tile
    ).tileState === TileState.flagged
  );

  // Chording: the flags around a revealed cell cover its bombs, so activating
  // it opens the rest.
  const chordable = board(
    Shape.square,
    "###",
    "#.#",
    "#!#"
  ).withActivatedCell(new Coords(1, 1), false);
  check(
    "square: chording a satisfied cell opens its hidden neighbours",
    chordable.tileArray.filter((t) => t.tileState === TileState.revealed)
      .length > 1
  );
  check(
    "square: an unrelated board is unaffected by marking",
    marked.nearbyBombCount(new Coords(1, 1)) === 1
  );
}

console.log("\nwin and lose, shared with the square game\n");

{
  const lost = board(Shape.hex, "##", ",#");
  check(
    "a revealed bomb loses, on any shape",
    winLoseCheck(lost.tileArray) === WinLoseStatus.lose
  );
  const won = board(Shape.triangle, "..", ".*");
  check(
    "every non-bomb revealed wins, on any shape",
    winLoseCheck(won.tileArray) === WinLoseStatus.win
  );
  const ongoing = board(Shape.square, "..", "#*");
  check(
    "anything else is still in progress",
    winLoseCheck(ongoing.tileArray) === WinLoseStatus.none
  );
}

console.log("\npresets and palette\n");

for (const shape of allShapes) {
  const name = shapeName(shape);
  const degree = topologyFor(shape).degree;
  check(
    `${name}: every preset is defined and carries its own shape`,
    PRESET_NAMES.every((p) => {
      const info = PRESETS[shape][p];
      return info !== undefined && info.shape === shape;
    })
  );
  // A tiling repeats a primitive unit, so a board that ends mid-unit would
  // have cells whose neighbours were never placed.
  const tiling = TILINGS[shape];
  if (tiling !== undefined) {
    check(
      `${name}: every preset holds a whole number of primitive units`,
      PRESET_NAMES.every((p) => PRESETS[shape][p].cols % tiling.cells === 0)
    );
  }

  check(
    `${name}: no preset asks for more bombs than it has cells`,
    PRESET_NAMES.every((p) => {
      const info = PRESETS[shape][p];
      return info.bombs < info.cellCount;
    })
  );
  // Every preset should land near the square game's mean clue for its tier.
  const targets: Record<string, number> = {
    beginner: 0.99,
    intermediate: 1.25,
    expert: 1.65,
  };
  check(
    `${name}: preset density gives the same mean clue as the square game`,
    PRESET_NAMES.every((p) => {
      const info = PRESETS[shape][p];
      const mean = (info.bombs / info.cellCount) * degree;
      return Math.abs(mean - targets[p]) < 0.12;
    })
  );
}

{
  const maxCount = Math.max(...allShapes.map((s) => topologyFor(s).degree));
  check(
    `the palette covers every reachable count, 1 to ${maxCount}`,
    Array.from({ length: maxCount }, (_unused, i) => i + 1).every(
      (n) => typeof NUMBER_COLORS[n] === "string"
    )
  );

  check(
    "the numbers are drawn on the face the palette is measured against",
    FACE_REVEALED === BOARD_FACE
  );

  // Retuning a colour for separation and forgetting to re-check its contrast
  // is how #005c7a shipped at 4.10:1 while being described as AA. The check
  // belongs here rather than in anybody's memory.
  const relativeLuminance = (hex: string): number => {
    const value = parseInt(hex.slice(1), 16);
    const channel = (c: number): number => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return (
      0.2126 * channel((value >> 16) & 255) +
      0.7152 * channel((value >> 8) & 255) +
      0.0722 * channel(value & 255)
    );
  };
  const contrast = (a: string, b: string): number => {
    const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  for (const face of [BOARD_FACE, "#c0c0c0"]) {
    const worst = Object.keys(NUMBER_COLORS)
      .map(Number)
      .map((n) => [n, contrast(NUMBER_COLORS[n], face)] as [number, number])
      .sort((a, b) => a[1] - b[1])[0];
    check(
      `every number clears WCAG AA on ${face} (worst is ${worst[0]} at ${worst[1].toFixed(2)}:1)`,
      worst[1] >= 4.5
    );
  }
}

console.log("\ncell art fits its outline\n");

for (const shape of allShapes) {
  const name = shapeName(shape);
  const layout = layoutFor(shape, 34);
  // A triangle's two orientations put the content centre in different places,
  // so both have to be checked. (0,0) points up and (0,1) points down; for the
  // other shapes the second is just another cell.
  const tiling = TILINGS[shape];
  const orientations: [string, Coords][] =
    tiling !== undefined
      ? Array.from({ length: tiling.cells }, (_unused, i) => [
          `cell ${i + 1} of the unit`,
          new Coords(0, i),
        ])
      : [
          ["point up", new Coords(0, 0)],
          ["point down", new Coords(0, 1)],
        ];

  for (const [orientation, coords] of orientations) {
    const label =
      shape === Shape.triangle || tiling !== undefined
        ? `${name} ${orientation}`
        : name;
    if (
      tiling === undefined &&
      shape !== Shape.triangle &&
      orientation === "point down"
    ) {
      continue;
    }

    // Counts run to the shape's degree, so only a triangle needs two digits.
    const widest = topologyFor(shape).degree;
    const digits = String(widest).length;
    check(
      `${label}: a ${digits}-digit number stays inside the cell`,
      contentFitsCell(layout, coords, "digits", digits)
    );
    check(
      `${label}: an emoji glyph and its outline stay inside the cell`,
      contentFitsCell(layout, coords, "glyph")
    );
  }
}

console.log("\npentagons against the classification\n");

{
  // Fifteen types of convex pentagon tile the plane and there is no
  // sixteenth, so any pentagon here that tiles must be one of them. That
  // makes this a real check rather than a label: a tiling that matches
  // nothing means either the tiling is wrong or the conditions are.
  //
  // It has already earned it. The article's own labelling sentence reads as
  // though side a runs out of vertex A; it runs into it, and read the wrong
  // way every edge condition sits one place out. A tiling that plainly
  // covered the plane then matched none of the fifteen, which is what
  // exposed the mistake.
  for (const { name, tiling } of pentagonTilings) {
    const types = typesOf(tiling.unit[0]);
    check(
      `${name}: is one of the fifteen types [${types.join(", ") || "none"}]`,
      types.length > 0
    );
    check(
      `${name}: every cell of the unit is the same type`,
      tiling.unit.every(
        (cell) => typesOf(cell).join() === types.join()
      )
    );
  }

  // A regular pentagon does not tile, so it must match nothing. Without this
  // the matcher could pass everything and no one would notice.
  const regular = Array.from({ length: 5 }, (_unused, k) => {
    const angle = (Math.PI / 180) * (90 + 72 * k);
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
  check(
    "a regular pentagon matches none of the fifteen",
    typesOf(regular).length === 0
  );
  check(
    `all fifteen types are recorded`,
    PENTAGON_TYPES.length === 15 &&
      PENTAGON_TYPES.every((t, i) => t.type === i + 1)
  );
}

console.log("\nnumbers centred and all one size\n");

for (const shape of allShapes) {
  const name = shapeName(shape);
  const layout = layoutFor(shape, 34);
  const cells = TILINGS[shape]?.cells ?? 2;
  const at = Array.from({ length: cells }, (_unused, i) => new Coords(0, i));

  // Cells of one unit are usually congruent, but a horizontal box does not
  // fit a turned copy the same way, so the sizes have to be levelled or the
  // board shows numbers of visibly different sizes. A house-shaped pentagon
  // was 23% apart between its two cells before this.
  for (const digits of [1, 2]) {
    const sizes = at.map((c) => layout.digitSize(c, digits));
    check(
      `${name}: every cell draws a ${digits}-digit number the same size`,
      Math.max(...sizes) - Math.min(...sizes) < 1e-6
    );
  }
  const glyphs = at.map((c) => layout.glyphSize(c));
  check(
    `${name}: every cell draws a glyph the same size`,
    Math.max(...glyphs) - Math.min(...glyphs) < 1e-6
  );

  // And content sits at the centre of the cell's area where it can. The point
  // of most clearance gives the biggest glyph but sits off centre in a
  // lopsided cell, so the anchor slides toward the centroid as far as the
  // content still fits.
  const drift = at.map((c) => {
    const centre = layout.center(c);
    const middle = centroidOf(layout.polygon(c));
    return Math.hypot(centre.x - middle.x, centre.y - middle.y);
  });
  check(
    `${name}: content sits on the centre of each cell's area (worst ${Math.max(...drift).toFixed(2)}px)`,
    Math.max(...drift) < 1.5
  );
}

console.log("\nhand tables against what is drawn\n");

// The three hand written tables and the shapes actually drawn on screen are
// two separate descriptions of the same tiling, and nothing had been checking
// they agreed. They can drift: turning the hexes flat-top means their offsets
// branch on the column instead of the row, and a table left branching the old
// way would still be symmetric, still degree six, and simply wrong about
// which cells touch.
//
// So: build the polygons the layout will draw, and require two cells to be
// neighbours exactly when their outlines share a point.
for (const shape of allShapes) {
  const name = shapeName(shape);
  const topology = topologyFor(shape);
  const layout = layoutFor(shape, 40);
  const span = 8;
  const patch: Coords[] = [];
  for (let x = 0; x < span; x++) {
    for (let y = 0; y < span; y++) {
      patch.push(new Coords(x, y));
    }
  }
  const polygons = new Map<string, Point[]>();
  for (const c of patch) {
    polygons.set(key(c), layout.polygon(c));
  }
  const share = (a: Coords, b: Coords): boolean =>
    polygonsTouch(
      polygons.get(key(a)) as Point[],
      polygons.get(key(b)) as Point[]
    );

  // Only cells whose whole neighbourhood is inside the patch can be judged.
  const inner = patch.filter(
    (c) => c.x > 1 && c.x < span - 2 && c.y > 1 && c.y < span - 2
  );
  let disagreements = 0;
  for (const c of inner) {
    const listed = new Set(
      topology.neighbours(c).map((n) => key(n))
    );
    for (const other of patch) {
      if (key(other) === key(c)) {
        continue;
      }
      if (share(c, other) !== listed.has(key(other))) {
        disagreements++;
      }
    }
  }
  check(
    `${name}: the neighbour table matches the outlines drawn (${inner.length} cells)`,
    inner.length > 0 && disagreements === 0
  );
}

console.log("\ntilings described as geometry\n");

{
  const P = (x: number, y: number): Point => ({ x, y });
  const ROOT3 = Math.sqrt(3);
  const h = ROOT3 / 2;

  // The three shipped shapes, written the other way round: as polygons and a
  // lattice rather than as a table of offsets. Deriving their adjacency from
  // the geometry has to reproduce the tables that are already trusted, or the
  // derivation has no business being pointed at a pentagon.
  const references: { name: string; tiling: Tiling; degree: number }[] = [
    {
      name: "square",
      degree: 8,
      tiling: {
        cells: 1,
        across: P(1, 0),
        down: P(0, 1),
        unit: [[P(0, 0), P(1, 0), P(1, 1), P(0, 1)]],
      },
    },
    {
      name: "hex",
      degree: 6,
      tiling: {
        cells: 1,
        across: P(ROOT3, 0),
        down: P(ROOT3 / 2, 1.5),
        unit: [
          Array.from({ length: 6 }, (_unused, k) => {
            const angle = (Math.PI / 180) * (60 * k + 90);
            return P(Math.cos(angle), Math.sin(angle));
          }),
        ],
      },
    },
    {
      name: "triangle",
      degree: 12,
      // The row step is half a cell across. Getting that wrong gives a
      // tiling that still covers the plane, still has symmetric adjacency and
      // still has the right area -- it is simply a different tiling, of
      // degree 4. Only the known answer catches it, which is the reason these
      // three are here.
      tiling: {
        cells: 2,
        across: P(1, 0),
        down: P(0.5, h),
        unit: [
          [P(0, 0), P(1, 0), P(0.5, h)],
          [P(0.5, h), P(1.5, h), P(1, 0)],
        ],
      },
    },
  ];

  for (const { name, tiling, degree } of references) {
    const derived = deriveOffsets(tiling);
    check(
      `${name}: adjacency derived from geometry gives ${degree} neighbours`,
      derived.every((row) => row.length === degree)
    );
  }

  const named: { name: string; tiling: Tiling }[] = [
    ...references.map((r) => ({ name: r.name, tiling: r.tiling })),
    ...pentagonTilings,
  ];

  for (const { name, tiling } of named) {
    const derived = deriveOffsets(tiling);

    check(
      `${name}: derived adjacency is symmetric`,
      derived.every((row, index) =>
        row.every((offset) =>
          derived[offset.index].some(
            (back) =>
              back.index === index &&
              back.dRow === -offset.dRow &&
              back.dUnitColumn === -offset.dUnitColumn
          )
        )
      )
    );

    check(
      `${name}: the unit fills one fundamental domain`,
      Math.abs(
        tiling.unit.reduce((total, polygon) => total + areaOf(polygon), 0) -
          fundamentalArea(tiling)
      ) < 1e-9
    );

    // Deterministic, so a red line is a real change and not an unlucky sample.
    const coverage = checkCoverage(tiling, seeded(19), 6000);
    check(
      `${name}: covers the plane with no gaps and no overlaps`,
      coverage.ok
    );

    check(
      `${name}: every cell of the unit is convex`,
      tiling.unit.every((polygon) => isConvex(polygon))
    );

    // Whatever a cell shows has to fit inside it, and for a pentagon that
    // cannot be answered by a formula the way the first three were.
    check(
      `${name}: a two-digit number fits every cell of the unit`,
      tiling.unit.every((polygon) => {
        const scaled = scaleTo(polygon, 34);
        const centre = chebyshevCenter(scaled).center;
        const box = digitBoxEm(2);
        return fitTextInPolygon(scaled, centre, box.width, box.height, 0) > 6;
      })
    );

    check(
      `${name}: an emoji and its outline fit every cell of the unit`,
      tiling.unit.every((polygon) => {
        const scaled = scaleTo(polygon, 34);
        const centre = chebyshevCenter(scaled).center;
        const box = glyphBoxEm();
        return (
          fitTextInPolygon(
            scaled,
            centre,
            box.width,
            box.height,
            GLYPH_OUTLINE_PX
          ) > 6
        );
      })
    );
  }

  // Turning a tiling must not change it. Orientation is presentation, so
  // adjacency, degree and coverage all have to come out the same -- which is
  // what makes it safe to face each of the fifteen pentagons whichever way
  // reads best.
  for (const { name, tiling } of named) {
    const before = deriveOffsets(tiling).map((row) => row.length).sort();
    for (const [label, turn] of [
      ["a half turn", Math.PI],
      ["a quarter turn", Math.PI / 2],
    ] as [string, number][]) {
      const turned = rotateTiling(tiling, turn);
      const after = deriveOffsets(turned).map((row) => row.length).sort();
      check(
        `${name}: ${label} leaves the tiling unchanged`,
        after.join() === before.join() &&
          checkCoverage(turned, seeded(23), 3000).ok
      );
    }
  }

  // The palette only runs to twelve, so a tiling that reached further would
  // draw an undefined colour rather than a number.
  for (const { name, tiling } of named) {
    const worst = Math.max(...deriveOffsets(tiling).map((row) => row.length));
    check(
      `${name}: its ${worst} neighbours stay within the palette`,
      typeof NUMBER_COLORS[worst] === "string"
    );
  }
}

console.log("\narrangements searched for, not written down\n");

{
  // The two newest shapes do not carry their geometry: a pentagon is solved
  // from its type's conditions and the arrangement is replayed from a recipe
  // the search found. Both halves can rot, and differently.

  // First, that the solved pentagons really are the types claimed -- and only
  // those. A pentagon that also satisfies a neighbouring type's conditions
  // still tiles, but it is not an instance of the type it is named for.
  for (const { label, spec, want } of SOLVED_PENTAGONS) {
    const cell = solvePentagon(spec);
    check(`${label}: its conditions close into a convex pentagon`, cell !== undefined);
    if (cell === undefined) continue;
    const measured = typesOf(cell);
    check(
      `${label}: measures as type ${want} and nothing else`,
      measured.length === 1 && measured[0] === want
    );
  }

  // Second, that the recipe is still what the search finds. The recipe is
  // written down because searching takes seconds and a page cannot wait; this
  // is what stops it becoming a number nobody can re-derive.
  for (const { label, spec, recipe } of SOLVED_PENTAGONS) {
    const cell = solvePentagon(spec);
    if (cell === undefined) continue;
    const found = searchArrangement(cell);
    check(`${label}: the search still finds an arrangement`, found !== undefined);
    if (found === undefined) continue;
    check(
      `${label}: and it is the one written down (${found.how})`,
      JSON.stringify(found.recipe) === JSON.stringify(recipe)
    );
  }

  // Third, that the search is worth trusting at all: handed the cell of a
  // tiling that was built by hand, it has to find a way to tile with it.
  //
  // What it must not be asked is to find the *same* way. A pentagon can tile
  // the plane in more than one arrangement, and the house does: it is shipped
  // as rows of two cells with six neighbours, and the search answers with a
  // different, equally valid tiling of four cells with seven. Asserting the
  // known degree here failed on exactly that, and the check was wrong rather
  // than the search.
  for (const { name, tiling } of pentagonTilings) {
    const cell = tiling.unit[0].map((p) => ({ ...p }));
    const found = searchArrangement(cell);
    check(`${name}: the search recovers an arrangement for it`, found !== undefined);
    if (found === undefined) continue;
    check(
      `${name}: built from the same cell`,
      found.tiling.unit.every(
        (c) => Math.abs(polygonArea(c) - polygonArea(cell)) < 1e-6
      )
    );
    check(
      `${name}: and it covers the plane`,
      checkCoverage(found.tiling, Math.random, 4000).ok
    );
    const derived = deriveOffsets(found.tiling);
    check(
      `${name}: with adjacency that runs both ways`,
      derived.every((row, index) =>
        row.every((offset) =>
          derived[offset.index].some(
            (back) =>
              back.index === index &&
              back.dRow === -offset.dRow &&
              back.dUnitColumn === -offset.dUnitColumn
          )
        )
      )
    );
  }

  // The house tiling two ways is worth pinning rather than leaving as a
  // surprise: it is the reason the loop above cannot check a degree.
  {
    const house = pentagonTilings.find((t) => t.name === "house rows");
    check(
      "the house pentagon is shipped with six neighbours",
      house !== undefined &&
        Math.max(...deriveOffsets(house.tiling).map((o) => o.length)) === 6
    );
    const other =
      house === undefined
        ? undefined
        : searchArrangement(house.tiling.unit[0].map((p) => ({ ...p })));
    check(
      "and tiles a second way, with seven",
      other !== undefined &&
        Math.max(...deriveOffsets(other.tiling).map((o) => o.length)) === 7
    );
  }

  // And that it says no when the answer is no. A regular pentagon does not
  // tile the plane -- that is why there are fifteen types and not sixteen --
  // so the search must fail to arrange one.
  const regular: Point[] = Array.from({ length: 5 }, (_unused, k) => ({
    x: Math.cos((2 * Math.PI * k) / 5),
    y: Math.sin((2 * Math.PI * k) / 5),
  }));
  check("a regular pentagon measures as no type at all", typesOf(regular).length === 0);
  check(
    "and the search refuses to arrange one",
    searchArrangement(regular) === undefined
  );
}

console.log("\nseparation from the square game\n");

{
  // EventAggregator keys its subscribers by the token's `name` string, so a
  // token here sharing a name with one in src/Events/Events.ts would silently
  // wire the two games into each other -- no type error, no runtime error.
  // These are the checks that would catch that.
  const squareNames = [
    ActivateTileEvent.name,
    GenerateTileGridEvent.name,
    StateChangedEvent.name,
  ];
  const shapeNames = [
    ActivateCellEvent.name,
    GenerateBoardEvent.name,
    ShapeStateChangedEvent.name,
  ];
  check(
    "no event token name is shared with the square game",
    shapeNames.every((n) => !squareNames.includes(n))
  );
  check(
    "the two layers resolve to different event instances",
    (EventAggregator.get(StateChangedEvent) as object) !==
      (EventAggregator.get(ShapeStateChangedEvent) as object)
  );

  Game.init();
  ShapeGame.init();
  EventAggregator.get(GenerateTileGridEvent).publish(
    new TileGridInformation(6, 6, 4)
  );
  EventAggregator.get(GenerateBoardEvent).publish(
    new BoardInfo(8, 8, 6, Shape.hex)
  );

  const squareBefore = Game.state;
  const shapeBefore = ShapeGame.state;
  EventAggregator.get(ActivateCellEvent).publish(new Coords(4, 4), false);
  check(
    "activating a shape cell moves the shape board",
    ShapeGame.state !== shapeBefore
  );
  check(
    "activating a shape cell leaves the square game alone",
    Game.state === squareBefore
  );

  const shapeMid = ShapeGame.state;
  EventAggregator.get(ActivateTileEvent).publish(new Coords(3, 3), false);
  check(
    "activating a square tile moves the square game",
    Game.state !== squareBefore
  );
  check(
    "activating a square tile leaves the shape board alone",
    ShapeGame.state === shapeMid
  );
}

console.log(
  failures === 0 ? "\nall checks passed\n" : `\n${failures} check(s) failed\n`
);
process.exit(failures === 0 ? 0 : 1);
