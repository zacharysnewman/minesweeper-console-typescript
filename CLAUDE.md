# CLAUDE.md

Minesweeper in TypeScript. One set of game rules, several front ends: a
terminal renderer, a browser build, and a mining game you walk around in.
Nothing in `src/State/` knows any of them exist.

```bash
npm run typecheck   # both tsconfigs; the gate for every change
npm run mine:check  # the mining layer's rules, checking themselves
npm start           # terminal minesweeper (needs a real TTY)
npm run mine        # terminal mining game
npm run dev         # browser build, hot reload
npm run build       # typecheck + dist/
```

There is no test runner. `npm run typecheck` and `npm run mine:check` are what
passes for one — run both before committing.

`tsconfig.json` covers the node side and excludes `src/web`. `tsconfig.web.json`
declares **its own `exclude`** rather than inheriting that one — otherwise the
inherited `src/web` exclusion silently removes the entire browser build from
the typecheck, which is exactly what it used to do. If you add a directory that
only one side can compile (node globals, `chalk`), exclude it there by name,
as `src/Mining/Console` and `src/Mining/checks.ts` are.

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

The browser build is a two-page Vite build, declared in
`build.rollupOptions.input`: `index.html` (minesweeper) and `mine/index.html`
(mining, served at `/mine/`). Rollup keeps each entry's directory, so a sub
path needs no server rewrite on GitHub Pages, and the two pages share chunks.

A new page is an HTML file, an entry in that input map, and an entry module in
`src/web/`. Link between pages with **relative** hrefs (`mine/`, `../`) so they
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
