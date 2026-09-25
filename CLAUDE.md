# CLAUDE.md

Minesweeper in TypeScript. One set of game rules, several front ends: a
terminal renderer, a browser build, a mining game you walk around in, and a
board that can be squares, hexagons or triangles. Nothing in `src/State/`
knows any of them exist.

```bash
npm run typecheck    # both tsconfigs; the gate for every change
npm run mine:check   # the mining layer's rules, checking themselves
npm run shapes:check # the shape layer's rules and cell art, likewise
npm start            # terminal minesweeper (needs a real TTY)
npm run mine         # terminal mining game
npm run dev          # browser build, hot reload
npm run build        # typecheck + dist/
npm run shots        # specimen sheet of every cell state, photographed
npm run page:shots   # builds, then drives and photographs the real page
```

There is no test runner. `npm run typecheck`, `npm run mine:check` and
`npm run shapes:check` are what passes for one — run all three before
committing. Anything about how a thing *looks* goes through `npm run shots`
or `npm run page:shots`, which photograph it and then re-measure what
rendered.

`tsconfig.json` covers the node side and excludes `src/web`. `tsconfig.web.json`
declares **its own `exclude`** rather than inheriting that one — otherwise the
inherited `src/web` exclusion silently removes the entire browser build from
the typecheck, which is exactly what it used to do. If you add a directory that
only one side can compile (node globals, `chalk`), exclude it there by name,
as `src/Mining/Console`, `src/Mining/checks.ts` and `src/Shapes/checks.ts`
are. `tsconfig.web.json` lists its `include` directories **by name**, so a new
top level directory is invisible to the web typecheck until it is added
there — and since `npm run build` runs that typecheck first, the symptom is a
build that passes while the new code is never checked at all.

---

# State

State classes are immutable values. Nothing mutates a field after
construction; a change produces a new value. Follow this for any new state,
including state layered on top of the game rather than inside it.

## The shape of a state class

Every one of them — `Coords`, `Tile`, `TileGrid`, `TileGridInformation`,
`State`, `PlayerState` — is built the same way:

**Readonly fields only.**

```ts
public readonly coords: Coords;
public readonly tileState: TileState;
```

**A constructor where every argument is optional**, defaulted with an explicit
`undefined` check. Not `??`, not default parameters — this is the house style
and it is consistent across every state class:

```ts
constructor(coords?: Coords, tileState?: TileState) {
  var newCoords = coords === undefined ? Coords.zero : coords;
  ...
}
```

**A positional `with(...)` that copies**, taking the same arguments as the
constructor, keeping the current value wherever an argument is left out:

```ts
with(coords?: Coords, tileState?: TileState): Tile {
  var newCoords = coords !== undefined ? coords : this.coords;
  ...
}
```

`with` is the primitive: it always returns a new object, and it says which
fields changed rather than what happened.

**A structural `equals(other)`**, comparing field by field and delegating to
the nested values' own `equals`. Never `===` on a state object to ask whether
two values are the same.

**A `toString()`** where a value has a natural short form.

**Static factories** for construction that is not a copy of an existing value:
`TileGrid.generateNewTileGrid(...)`, `PlayerState.spawnedAt(...)`,
`Coords.zero`.

## Semantic transitions

Above `with`, a state exposes the transitions its domain actually has, named
for what happened rather than for which fields moved. These are the methods
callers should reach for; `with` is plumbing.

```ts
State.withTileGrid(newTileGrid)        // the board was replaced
State.withActivatedTile(coords, flag)  // a tile was activated
PlayerState.withStepTo(coords, facing) // the miner walked
PlayerState.withDig(facing)            // the miner dug
```

**A transition that changes nothing returns `this`.** This is what makes a
cheap `===` identity check meaningful downstream — a renderer or a subscriber
can tell "nothing happened" without a deep compare:

```ts
public withTileGrid(newTileGrid: TileGrid): State {
  return this.tileGrid.equals(newTileGrid) ? this : new State(newTileGrid);
}
```

A transition may also refuse, by returning `this` when the action is not legal:
`State.withActivatedTile` checks `canActivateTile` first.

## Where state lives

Exactly one mutable static reference per layer, holding the current value:

```ts
Game.state    // the board
Player.state  // the miner, in src/Mining/
```

Those references are **swapped, never edited**. `Game` and `Player` are
`abstract class`es with static members and a `static init()` that subscribes
them to their events — that is the session idiom in this codebase, not a
`new`-able service.

The arrays inside a state are plain arrays, not frozen. Treat them as
immutable anyway: copy before changing (`let newTiles = [...this.tileArray]`),
which is what `TileGrid` does throughout.

## A parallel board: `src/Shapes/`

`src/Shapes/` is a second, self contained state layer for a board that can be
squares, hexagons or triangles. It is a **fork** of `TileGrid`/`State`/`Game`,
not a generalisation of them: the square game and its renderers are untouched.

The parameter is not how many sides a cell has but how many cells touch it,
because Minesweeper counts contact at a vertex as well as along an edge — a
square has 4 sides and 8 neighbours, a triangle 3 and 12, and a hexagon is the
one shape where the two agree at 6. All three store in the same rectangular
rows x cols array, so enumeration and bounds are shape independent; the whole
of the difference is `Topology.neighbours`, and the rules are written against
that one seam so the fork could be merged back mechanically.

It reuses `Coords`, `Tile`, `TileState`, `WinLoseStatus` and — the one that
matters — `winLoseCheck`, so the two boards can never disagree about whether a
game is over.

Two departures from `TileGrid`, both because twelve neighbours changes what the
old behaviour means: the first click clears the whole neighbourhood rather than
just the cell under the cursor (excluding one cell almost never cascades at
degree 12), and the flood fill is iterative over a `"x,y"` index rather than
recursive over a linear scan.

## Tilings given as geometry

Shapes beyond the first three are described as **polygons plus two lattice
vectors** (`src/Shapes/Tiling.ts`), and their adjacency is *computed* rather
than written out. Cells still address as `Coords`: the index within the
primitive unit folds into the column, `y = unitColumn * cells + indexInUnit`,
so the board stays a rectangular array.

A tiling's board is rectangular only while its lattice is axis aligned.
Quarter and half turns keep that; a sixth or a twelfth of a turn shears it.
Where a natural basis shears — hexagon centres step half a hexagon down as
they step one across — take two cells per unit instead and the shear goes.

Four things must hold, and each catches something the others miss:

- **Coverage.** Sample the fundamental domain; every point in exactly one
  cell. A gap gives zero, an overlap gives two.
- **Symmetry.** `b ∈ N(a) ⟺ a ∈ N(b)`.
- **The hand tables against the outlines.** The first three shapes carry hand
  written offsets *and* draw polygons; they are two descriptions and they can
  disagree. Only this one catches a parity branching on the wrong axis — the
  table stays symmetric, the right degree, and simply wrong.
- **Known degrees.** Coverage, symmetry and area can all pass for a tiling
  that is not the one you meant. A triangle unit with the wrong row step
  tiles the plane perfectly well as a *different*, degree-4 tiling. The three
  shipped shapes are permanent fixtures for this reason.

**A pentagon that tiles is one of fifteen types.** `pentagonTypes.ts` carries
all fifteen sets of angle and edge conditions, so a tiling's type is measured
rather than claimed — and since there is no sixteenth, a pentagon that tiles
and matches *nothing* means either the tiling or the conditions are wrong.
That is a real check, and it has already earned its place: the article's
labelling sentence reads as though side `a` runs out of vertex A, but it runs
*into* it (the same sentence says A is opposite d, which only holds the
second way). Read the wrong way every edge condition sits one place out, and
a tiling that plainly covered the plane matched none of the fifteen.

**Type 1 has a general construction.** A pentagon with two adjacent angles
summing to 180° — which is exactly the type 1 condition — pairs with its own
half turn about the edge between them into a hexagon with a centre of
symmetry: the two angles make a straight line at each end, so eight corners
become six. Every centrally symmetric hexagon tiles by translation, so
`pairedPentagonTiling` turns any type 1 pentagon into a board with no
arrangement to look up. `squareUp` then puts the lattice on the axes, since
the natural basis leans and a leaning basis draws a long diagonal in a mostly
empty box; where the residual drift is a simple fraction of a step, stacking
that many rows into the unit cancels it exactly.

**An arrangement can be searched for.** A type's conditions say what shape its
pentagon is; they say nothing about how the copies sit against each other, and
that is what a board needs. `pentagonShapes.ts` solves the shape -- the five
angles fix the five edge directions, closing the outline is two more
equations, and Newton takes it from there, with an unknown allowed to be an
angle where a type pins its edges too tightly to leave one. `arrange.ts` then
searches for the arrangement: a unit built by turning copies about a corner or
an edge midpoint, or by two half turns, and a lattice found for it. The
lattice is pinned by area -- whatever two vectors span it, the parallelogram
they make has exactly the area of the unit -- which turns a search over
vectors into a handful of candidates, each settled by the coverage check.

Two things make the search trustworthy rather than merely productive. It
recovers all four hand-built tilings, and it **refuses a regular pentagon**,
which does not tile -- that is the whole point of there being fifteen types.

**One pentagon can tile several ways.** The house is shipped as rows of two
cells with six neighbours, and the search answers with a different, equally
valid tiling of four cells with seven. A rediscovery check that asserts the
known degree fails on that, and the check is what is wrong. Rediscovery
checks that the arrangement is built from the same cell, covers the plane and
has symmetric adjacency; the house's second tiling is pinned separately, so
that the surprise is a fact rather than a failure.

**Searching takes seconds, so what ships is the recipe.** A found arrangement
carries a `Recipe` -- which centre, what order -- that replays in
milliseconds at page load, and `shapes:check` runs the full search again and
fails if the recipe is no longer what it finds. The pentagon is never written
down either, only its conditions, because a transcription can be wrong in a
way that still looks like a pentagon and a solved one cannot. The checks also
demand each solved pentagon measure as its own type *and nothing else*: a
too-symmetric choice of the free parameters satisfies a neighbouring type's
conditions too, and then it is not an instance of the type it is named for.

**All fifteen types have boards, and two ideas got the last eleven.**

The first was to enumerate symmetry groups: build a unit as the orbit of one
or more seed cells under a group of turns, or under a half turn paired with a
glide, which is pgg. Two numbers off the classification say what a type needs,
and both are checkable:

    orbits = tiles in the primitive unit / order of the point group

Types 1, 3, 4 and 5 are isohedral and rotation-generated, and a turn family
alone reaches exactly those. Type 2 is isohedral but pgg: its one orbit holds
mirror images no turn produces, and a flip is the whole of what it needed.
Type 6 is p2 with a four-cell unit -- the same group and the same size the
plain half-turn family builds -- and out of reach all the same, because those
four cells are *two* orbits; it needed a second seed. Neither the group nor
the size was ever the obstacle.

The second idea is that enumeration runs out. A tiling whose tiles fall into
several orbits need not put its turning centres anywhere on the cell, so there
is nothing left to enumerate. What can always be done is to **tile**: take an
uncovered spot against the patch so far, try every way of covering it, carry
on, backtrack when stuck -- and then look for the translations that carry the
patch into itself. The lattice is measured from the tiling rather than assumed
from a group. Every unit size it finds matches the classification.

Four things had to be right, and each was wrong first:

- **Take the unit from the middle of the patch outwards**, skipping a cell
  that lands on one already taken. A patch grown a cell at a time is periodic
  in its middle and ragged at its edge; demanding that every cell reduce into
  exactly these classes threw away lattices that were right.
- **Build placements the way the replay does.** Deriving one in the reference
  cell's frame and carrying it over with the base's own motion is faster and
  is wrong: composing with a base that has been turned over flips the
  placement too, so the same record meant one thing to the search and another
  to the replay. Types 7 and 9 were lost to this and it looked like a search
  failure.
- **Ask for a periodic patch, not the first one that packs.** The fill stops
  at the first arrangement that fits, and for some types that arrangement
  wanders -- it fills the plane locally and never comes round to itself.
- **A cell may need a corner-anchored placement**: one corner on an existing
  corner, turned to line up with an existing edge, and the rest of it landing
  part way along its neighbours' edges. Most of the fifteen are not edge to
  edge, and types 11, 12 and 14 cannot be built without this -- laying by
  whole edges alone, every branch reached an unfillable gap at about nine
  cells. Sliding a copy a fixed distance along an edge was tried first and
  reached none of them.

**Bound a search by time, not by work.** The node budget stopped bounding how
long the fill runs the moment corner-anchored placements made a node a hundred
times more expensive, and `shapes:check` went from a minute to over ten.

**Recipes are verified by replaying them, not by searching again.** A recipe
says how copies were laid, so replaying it either reproduces a tiling of that
same pentagon or it does not, and coverage, symmetric adjacency and the cell
count say which -- in milliseconds. Re-running the search costs a minute a
type and, for a patch, checks the order a depth-first search happened to take
rather than anything about the tiling. Rediscovery is kept for the four
tilings that were built by hand, where it means something, along with the
regular pentagon the search must refuse.

**Tilings are built when first asked for.** A dozen of them at import was most
of a second before the page drew anything, and a page plays one shape at a
time.

**A lattice may lean, and then the board is not a rectangle.** Layouts report
the least corner a board of a given size reaches, and `forBoard` slides the
board back by it. Without that, a lattice whose row step carries left renders
its far rows at negative coordinates, where they can be seen and not clicked.

**Contact is not corner-to-corner.** Most pentagon tilings are not edge to
edge: one cell's corner lands part way along another's edge, and there no
corners coincide at all. `polygonsTouch` asks whether a corner lies anywhere
on the other outline, both directions, because a T-junction is one-sided. A
tiling of houses read as degree 4 while sharing five edges before this.

**Its event tokens must not share a name with `src/Events/Events.ts`.**
`EventAggregator` keys subscribers by the token's `name` string, so a
collision silently wires the two games together — no type error, no runtime
error. `shapes:check` checks for it.

## Layering state

`PlayerState` is a peer of `State`, not a part of it. A board with no player on
it is still a valid board, so the mining layer adds state beside the game
rather than inside it, and the other front ends are untouched.

A layer reads the game the way a renderer does — subscribe to
`StateChangedEvent`, keep the last `TileGrid` it saw — and never reaches into
`Game.state` directly. It changes the board only by publishing the same
`ActivateTileEvent` a mouse click publishes, so game logic cannot tell the two
apart and never grows a branch for the new mode. Nothing in `src/Mining/`
returns a new `TileGrid`.

Keep the rules that decide a transition as **pure functions** separate from the
session that applies it. `src/Mining/movement.ts` returns the next
`PlayerState` plus, when the game has to be asked for something, a description
of the request; `Player` is what publishes it. That is what lets the rules be
checked without an event bus.

Derive rather than store. Whether a cave is lost is `winLoseCheck(tiles)`, not
a flag on `PlayerState` that can drift out of step.

## Events

`EventAggregator.get(SomeEvent)` returns the single instance for an event
token; `subscribe` / `publish` are synchronous, so by the time `publish`
returns, every subscriber has run and the state it triggered has settled.

Event tokens are `Evt<T>` objects — a name and a constructor. A new layer
declares its own tokens in its own module (`src/Mining/MiningEvents.ts`) rather
than extending `src/Events/Events.ts`, so existing front ends import nothing
new. They still share one aggregator.

Subscribers are held in a `Set`, so **hand `subscribe` a stable reference**: a
static method (`Renderer.onStateChanged`) or an instance arrow property
(`DomRenderer.onStateChanged = (s) => {}`), never a fresh closure, and never a
plain instance method that needs `this`.

**`State`'s constructor publishes `StateChangedEvent`.** Constructing a
`State` is what announces it. `PlayerState` deliberately does not do this:
movement builds intermediate values while working out what an input means, and
a publishing constructor would announce every one of them. `Player.publish()`
announces the settled value instead, once per input, always — even when
nothing moved — so it is a reliable "the input has finished settling" signal.
If you add another state layer, prefer the explicit publish.

## Conventions that will bite

**`x` is the row and `y` is the column.** `TileGridInformation.Width` is the
row count and `Height` the column count. Every render loop in the project
walks `x` over `Width` and `y` over `Height`. Expert is 16 rows of 30, written
`new TileGridInformation(16, 30, 99)`. In the mining layer, north and south
walk `x`; east and west walk `y`.

**`equals` is typed `Boolean`, not `boolean`.** That is TypeScript's wrapper
type and is a wart, but every `equals` in the codebase uses it and a mixed
signature is worse — match it. It is why comparisons sometimes need an
explicit `=== true`. Anything new that is not an `equals` should use lowercase
`boolean`, as `src/web/` does.

---

# Rendering

A renderer is a subscriber. It holds no game state, it is the only thing that
knows about its output medium, and adding a front end means writing one — no
change to `src/State/` is needed or wanted.

## The contract

**In:** subscribe to `StateChangedEvent` in `init()` and take the whole
`State`. **Out:** publish `ActivateTileEvent` (coords, flagMode) and
`GenerateTileGridEvent` (a `TileGridInformation`).

```ts
public static init(): void {
  EventAggregator.get(StateChangedEvent).subscribe(Renderer.onStateChanged);
}
```

Draw as a function of the state you were handed. Do not keep a shadow copy of
the board to diff against, do not keep a "current difficulty" or a "game over"
value that the state could contradict — `DomRenderer` keeps only what the DOM
itself cannot re-derive (its cell elements, an index of the last tiles for hit
testing, in-flight gesture state).

Publishing back is not the renderer's monopoly: `DomRenderer` takes an
`ActivateHandler` callback from `main.ts` instead of publishing directly, which
keeps the DOM code testable and the event wiring in one place. Either is fine;
be deliberate.

## Derive at draw time, from shared code

Nearby bomb counts, win/lose, the mine counter: all computed from the tiles
when drawing, never stored.

Anything two front ends could disagree about lives in `src/State/` and is
imported by both — `winLoseCheck` is shared precisely so the console and the
web board can never disagree about whether a game is over. A glyph table is
local to its renderer; the rule behind it is not.

## Drawing more than one layer

A front end drawing two layers (the mining renderer draws the board and the
miner) should **cache on its subscriptions and draw once per input**, not draw
from each subscription.

Within a single input the layers settle one after another — a dig changes the
board before the player state that caused it is published — so drawing from
each event gives a frame per event instead of a frame per input, and the
in-between frames show a half-settled world. `MiningRenderer.draw()` is called
by `src/mining.ts` once the input is fully handled.

## Console renderers

`abstract class` with statics. Build the whole frame into one string and
`console.log` it once; a frame that clears the screen first must carry
everything the player needs to read, so route messages into the frame rather
than `console.log`-ing them around it (`MiningRenderer.draw(notice)`).

Colour goes through `chalk`. `src/Console/` wraps it in `ConsoleString`
(text + fg + bg); the mining renderer calls `chalk` directly for a darker
palette. Either is fine.

## The web renderers

Instance classes, constructed in their entry point with their elements and
their callbacks, and subscribing through **arrow-function properties** so the
binding survives the aggregator. They reuse cells across renders and rebuild
the grid only when the board's dimensions change; they index tiles by `"x,y"`
rather than scanning the array per cell. `src/web/sprites.ts` is a pure
`state -> tileset index` function, kept separate from the DOM work and shared
by both boards — a dug tile looks the same in either game.

Entry points own the chrome — the selects, the toggles, the new-game button —
and the renderer owns the board.

## Pages

The browser build is a multi-page Vite build, declared in
`build.rollupOptions.input`: `index.html` (minesweeper), `mine/index.html`
(mining, at `/mine/`) and `shapes/index.html` (the other tilings, at
`/shapes/`). Rollup keeps each entry's directory, so a sub
path needs no server rewrite on GitHub Pages, and the two pages share chunks.

The build is actually three pages — `index.html`, `mine/index.html` and
`shapes/index.html`. A new page is an HTML file, an entry in that input map,
and an entry module in `src/web/`. Link between pages with **relative** hrefs (`mine/`, `../`) so they
survive the configured `base`. Page-specific CSS goes in its own file scoped
under a body class (`body.mine`), not into `styles.css`, which both pages load.

## Input

Input handling belongs to the front end, not the state. The terminal builds
parse a line and publish; the minesweeper page resolves pointer gestures to a
pair of actions; the mining page maps keys, an on-screen pad and taps on
neighbouring tiles to the same two events.

Every input publishes, lets the layers settle synchronously, then draws once.
`src/web/mine.ts` funnels all of its input through one `act()` for that reason
— if you add an input, route it through the same place rather than publishing
and drawing beside it.

When matching input against a lookup object, use
`Object.prototype.hasOwnProperty.call(table, key)` rather than `key in table` —
`in` answers yes for `constructor`, `toString` and friends, which has already
caused one crash here.

---

# Drawing a cell that is not a square

`ShapesDomRenderer` draws a board of hexagons or triangles, and almost
everything about it follows from two facts.

**Cells overlap.** A hex row overlaps the one above by a quarter of its
height; a triangle overlaps its neighbour by half its width. CSS Grid cannot
express that, so cells are **positioned absolutely** from `layout.origin`,
which handles all three tilings with one code path.

**A clip-path cannot carry a border**, and a minesweeper cell has to read as
covered or open, so the outline is not optional. Each cell is a `<button>`
holding one `<svg>` with a `<polygon>`. The button gives focus, tab order and a
keyboard press for free; the polygon gives a real outline. Only the polygon
takes pointer events (`pointer-events: none` on the cell, `auto` on the
polygon), which is what makes hit testing correct where the boxes overlap —
`page:shots` checks that every cell hit tests on its outline rather than its
box. Focus is drawn as a stroke on the polygon, since an `outline` would be
clipped away.

**Size cells by their inscribed circle, not their edge.** A triangle's
inscribed circle is 0.577 of its side, so a triangle sized like a square
slices its own glyphs. `layoutFor(shape, content)` takes that diameter.
Triangle content sits on the **incentre**, a third of the height from the
base, so an up-pointing cell's glyph rides low and a down-pointing one's rides
high.

**Fitting text is measured, not derived.** There was a formula per shape once.
A formula per shape also has a fallback, and a pentagon quietly taking the
square's fallback renders without complaining. `fitTextInPolygon` binary
searches against the outline itself and puts content on the Chebyshev centre;
it reproduced all three hand formulas before replacing them. Computed once
per distinct cell shape, and asked of the **cell**, since a primitive unit
need not be uniform.

**One size per board, centred on the cell's area.** Cells of a unit are
usually congruent, but a *horizontal* box does not fit a turned copy the same
way, so the tightest cell sets the size for all of them — a house-shaped
pentagon was 23% apart between its two cells before that. And the point of
most clearance, which is what gives the biggest glyph, sits off centre in a
lopsided cell: `centredAnchor` takes the size from that point and then slides
toward the centroid as far as the content still fits, which so far reaches the
centroid every time at no cost in size.

Watch for a **non-unique** Chebyshev centre. A house's largest circle slides
up and down inside the body without ever growing, so there is a segment of
equally good answers and a search returns whichever it landed on — a
different one for a cell that has been turned over. Ties go to the point
nearest the centroid, which is both canonical and what looks centred.

**Never hardcode a font metric without measuring it.** Two shipped wrong: the
numbers are drawn bold, which advances 0.696em per digit rather than the
0.636em of the regular weight, and Noto's emoji are 1.25em wide rather than
the 1em of their box. `shapes:check` tests the analytic box against the cell
outline, and `shots` closes the loop by reading each glyph's real box out of
the browser.

**Emoji must name an emoji font.** Without one the fallback chain can answer
with a monochrome glyph from whatever coverage font happens to cover that
codepoint — the face button first rendered three of its four states as hollow
outlines while the fourth came out in colour, because Unifont covers the older
emoji and Noto Color Emoji only got asked for the newer one. `EMOJI_FONT` in
`svg.ts` is the stack; `shots` checks each glyph came back at the 1.25em the
emoji font gives, since a wrong width means a wrong font answered.

**Emoji get a dark edge, and it is a filter, not a stroke.** A stroke does
nothing to a colour emoji, because on most platforms it is a bitmap and a
bitmap has no path. `glyphOutlineDefs()` dilates the glyph's own alpha, floods
it dark and puts that behind — which outlines whatever shape the glyph has.
It is defined once per document and referenced by id, and its width comes off
the glyph's fit, since an outline makes the mark bigger.

**The number palette is measured, not chosen.** `BOARD_FACE` is the face the
numbers are drawn on and `svg.ts` takes its revealed face *from* it, so the
colour they are measured against is by construction the colour they sit on.
`shapes:check` verifies all twelve clear WCAG AA on it. Retuning a colour for
separation and forgetting to re-check its contrast is how one shipped at
4.10:1 while being described as AA — change a colour, run the checks.
