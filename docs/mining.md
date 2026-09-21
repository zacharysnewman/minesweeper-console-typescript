# The mining layer

A second thing to do with a minesweeper board: stand on it.

`src/Mining/` adds a player — one tile, somewhere random, digging through rock —
without changing a line of the game. The console and web minesweepers import
nothing from here and behave exactly as they did.

## Why it is a separate layer

The board is already a good cave. Hidden tiles are rock, revealed tiles are the
space you have opened up, flags are the rock you have decided not to touch, and
the numbers are how much unstable ground is pressing on a tile. None of that
needs new game state — it needs a reading of the state that is already there,
plus one thing the game has no opinion about: where the player is standing.

So the player lives in its own value, in its own layer, and the game keeps
being the game:

```
input ──▶ MovePlayerEvent ──▶ Player ──▶ ActivateTileEvent ──▶ Game
                                │                                │
                                │                          StateChangedEvent
                                │                                │
                                ▼                                ▼
                     PlayerStateChangedEvent ─────────────▶  a front end
                                                            (draws both)
```

`Player` publishes `ActivateTileEvent` — the same event a mouse click
publishes. The game logic cannot tell a miner from a click, which is the point:
no branch in `TileGrid` ever has to know this mode exists.

The arrow that does the real work is the one from `StateChangedEvent` back into
`Player`. The player layer reads the board the same way a renderer does, and
holds its own copy of the last `TileGrid` it saw rather than reaching into
`Game.state`. Reading is all it does — nothing in `src/Mining/` returns a new
`TileGrid`.

## The pieces

| file | what it is |
| --- | --- |
| `Direction.ts` | four directions and the one place that knows x is the row and y the column |
| `Terrain.ts` | reads a `TileGrid` as cave: bedrock, rock, marked, open. Read-only |
| `PlayerState.ts` | the immutable player value: where, facing, digs, last result |
| `movement.ts` | the rules, as pure functions. Given a player and a board, what happens |
| `spawn.ts` | picking a starting tile |
| `MiningEvents.ts` | the layer's own event tokens, on the shared `EventAggregator` |
| `Player.ts` | the session: owns one `PlayerState`, wires the events, talks to the game |
| `Console/MiningRenderer.ts` | one front end. The only place the two layers are drawn together |
| `checks.ts` | `npm run mine:check` — the rules checking themselves |

`movement.ts` never applies anything. It returns the next `PlayerState` and, if
the game needs to be asked for something, an `ActivateRequest` describing what.
`Player` is what publishes it. That split is what makes the rules testable
without an event bus, and what keeps "the player wants to dig" distinct from
"the board changed".

## The rules, as they stand

- **Walk** into open cave and you move.
- **Walk into rock** and you dig it instead — you stay where you are, and the
  tile is revealed. Uncovering a tile and stepping onto it are two presses.
  A dug tile is a revealed tile, so digging a zero opens the whole cavern
  behind it, exactly as clicking it would.
- **Marked rock blocks you**, and is never dug by a stray keypress. That is the
  whole reason to mark something.
- **The edge is bedrock.** You always face the way you tried to go, even when
  you are blocked.
- **Marking** flags or unflags the tile ahead. The game layer owns the toggle,
  so both directions are the same request from here.
- **A decided cave stops taking input.** Once the board is won or lost, the
  miner does not walk away from it; `new` digs a fresh cave.

## Where the player wakes up

`pickSpawn` takes a random tile on an untouched board, and `Player` immediately
digs it. That is not a special case — it is the first activation, so
`TileGrid.withActivatedTile` regenerates the bombs around it, and the player
always wakes up in a pocket that was safe by construction. First-click safety
and "you woke up somewhere survivable" turn out to be the same rule.

The pocket is not always roomy: a safe first tile can still be a numbered one,
in which case you wake up in a hole the size of yourself and dig your way out.
That reads fine for a mining game, so it is left alone.

On a board that has already been played, spawn falls back to cave the player
has opened. The only `isBomb` values read there belong to tiles already
revealed, so the spawn never peeks at anything the player cannot see.

## Front ends

`MiningRenderer` holds the latest of each layer and draws them together. Within
one input the two layers settle one after the other — a dig changes the board
before the player state that caused it is published — so its subscriptions only
cache, and `src/mining.ts` asks for the frame once the input is fully handled.
Drawing straight from the subscriptions gives one frame per event instead of
one per input, and the in-between frames show a half-settled cave.

Input is line based, like `app.ts`, so a line of movement keys (`wwdd`) runs as
a sequence. Moving to raw keypresses means changing `src/mining.ts` and nothing
else.

Nothing outside `Console/` is console-specific, so a browser front end is a
subscriber and a keydown handler. `src/Mining/` is not in `tsconfig.web.json`
yet; adding it is how that would start.

## Deliberately not here yet

The things a mining game wants next, left out so the first version stays one
readable idea:

- **Anything but a single tile.** `PlayerState.coords` is one `Coords`. A
  larger player means terrain queries over a footprint, which is a change to
  `movement.ts` and nothing else.
- **Ore, lamps, stamina, depth.** They belong in `PlayerState` beside
  `digCount`, which is there partly to show where they go.
- **Turn cost.** Every input currently costs the same nothing.
- **Fog.** The renderer draws the whole board. A lamp radius is a filter in the
  renderer, or a `seen` set on the player if it has to persist.
