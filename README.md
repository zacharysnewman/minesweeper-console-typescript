# minesweeper-console-typescript

Minesweeper in TypeScript. The same game logic drives every front end: the
original terminal renderer, a browser build deployed to GitHub Pages, and a
mining game you walk around in.

**Play it:** https://zacharysnewman.github.io/minesweeper-console-typescript/

## Running it

```bash
npm install

npm start      # play in the terminal (needs a real TTY)
npm run mine   # play the mining experience in the terminal
npm run dev    # play in the browser, with hot reload
npm run build  # produce dist/ for deployment
npm run preview # serve the built dist/ locally
npm run typecheck
npm run mine:check # check the mining rules
```

## Controls

The web build resolves mouse and touch to the same pair of actions, so the
flag-mode toggle works with either:

|             | primary (tap / left click) | secondary (hold / right click) |
| ----------- | -------------------------- | ------------------------------ |
| normal mode | reveal                     | flag or unflag                 |
| flag mode   | flag or unflag             | reveal                         |

One override sits on top of that table: a press on an already-revealed tile
always activates it, so tapping a number clears around it in either mode.
A hold is 450 ms, and dragging more than 12 px cancels it, so scrolling the
board never drops a flag.

The terminal build is unchanged: `check a3` / `a3` reveals, `flag a3` / `f a3`
flags, `new` and `new <bombs>` restart.

## Mining

`npm run mine` is a third front end rather than a different game: you stand on
a board as a single tile and walk it. Hidden tiles are rock, revealed tiles are
the cave you have opened, and flags are rock you have marked not to dig. Walk
into open cave and you move; walk into rock and you dig it instead.

`w a s d` move (a run like `wwdd` walks the sequence), `f d` / `mark north`
marks the rock ahead, `new` and `new <bombs>` dig a fresh cave.

The player lives in its own state layer that reads the board and talks back to
it through the same `ActivateTileEvent` the other front ends publish, so the
game logic is untouched by it. `docs/mining.md` has the design.

## Layout

```
src/State/              game logic and immutable state, no I/O
src/Events/             the EventAggregator the renderers subscribe to
src/TileGridGeneration/ board generation and shuffling
src/Console/            terminal renderer (chalk)
src/web/                browser renderer (DOM + sprites)
src/Mining/             player state and movement, layered over the game
src/app.ts              terminal entry point
src/mining.ts           terminal entry point for the mining experience
public/assets/          sprite sheets, counter font, icons
CLAUDE.md               the state and rendering patterns this project follows
```

Both renderers subscribe to `StateChangedEvent` and publish
`ActivateTileEvent` / `GenerateTileGridEvent` back. Neither one holds game
state, so adding a front end means writing a subscriber and nothing else.
`src/web/sprites.ts` is a direct port of `GetSpriteForTile` from the Unity
project, returning a tileset row index instead of a `Sprite`.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which typechecks,
builds, and publishes `dist/` to GitHub Pages. The repository must have
**Settings → Pages → Source** set to **GitHub Actions**.

Vite's `base` is set to `/minesweeper-console-typescript/` so asset URLs
resolve under the project-site path. Build with `BASE_PATH=/` for a
root-domain deploy.

## Attribution

The artwork and counter font came from the companion Unity project,
[minesweeper-unity-csharp](https://github.com/zacharysnewman/minesweeper-unity-csharp),
and are included here under `public/assets/`:

- `tileset.png` — the 16×224 tile strip (`Assets/Art/Sprites/OriginalTileset.png`).
  This is the classic Minesweeper tileset and is **not original artwork**; it
  reproduces the tile designs from Microsoft's Minesweeper and is included here
  for a non-commercial hobby reimplementation.
- `smileys.png` — the five face sprites (`Assets/Art/Sprites/minesweeper-sprites.png`),
  likewise modelled on the original game's reset button.
- `digital-numbers.ttf` — the "Digital Numbers" family, obtained via
  [Fontmirror](https://www.fontmirror.com/digital-numbers). See that page for
  its licence terms.
- `favicon-32.png`, `apple-touch-icon.png`, `icon-256.png` — downscaled from
  `Assets/Art/Icon.PNG`.

The TypeScript source is the project's own work; the assets above are not, and
are credited accordingly. If you intend to use this for anything beyond a
personal project, replace the tileset and verify the font's licence first.
