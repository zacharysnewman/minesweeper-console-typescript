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
import { allShapes, Shape, shapeName } from "./Shape";
import {
  digitBoxEm,
  glyphBoxEm,
  layoutFor,
  textBoxFits,
} from "./geometry";
import { topologyFor } from "./Topology";

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
  // A patch big enough that the middle of it is nowhere near an edge.
  const span = 12;
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
    `${name}: every cell lists exactly ${topology.degree} neighbours`,
    cells.every((c) => topology.neighbours(c).length === topology.degree)
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
  check(
    `${name}: interior cells on a board have ${topology.degree} neighbours`,
    cells
      .filter((c) => c.x >= 2 && c.x < span - 2 && c.y >= 2 && c.y < span - 2)
      .every((c) => b.neighbours(c).length === topology.degree)
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
  const orientations: [string, Coords][] = [
    ["point up", new Coords(0, 0)],
    ["point down", new Coords(0, 1)],
  ];

  for (const [orientation, coords] of orientations) {
    const label = shape === Shape.triangle ? `${name} ${orientation}` : name;
    if (shape !== Shape.triangle && orientation === "point down") {
      continue;
    }

    // Counts run to the shape's degree, so only a triangle needs two digits.
    const widest = topologyFor(shape).degree;
    const digits = String(widest).length;
    check(
      `${label}: a ${digits}-digit number stays inside the cell`,
      textBoxFits(
        layout,
        coords,
        digitBoxEm(digits).width,
        digitBoxEm(digits).height
      )
    );
    check(
      `${label}: an emoji glyph stays inside the cell`,
      textBoxFits(
        layout,
        coords,
        glyphBoxEm().width,
        glyphBoxEm().height
      )
    );
  }
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
