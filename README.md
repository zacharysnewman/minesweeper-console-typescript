# minesweeper-console-typescript

Minesweeper in TypeScript. The same game logic drives two front ends: the
original terminal renderer and a browser build deployed to GitHub Pages.

**Play it:** https://zacharysnewman.github.io/minesweeper-console-typescript/

## Running it

```bash
npm install

npm start      # play in the terminal (needs a real TTY)
npm run dev    # play in the browser, with hot reload
npm run build  # produce dist/ for deployment
npm run preview # serve the built dist/ locally
npm run typecheck
```

## Layout

```
src/State/              game logic and immutable state, no I/O
src/Events/             the EventAggregator the renderers subscribe to
src/TileGridGeneration/ board generation and shuffling
src/Console/            terminal renderer (chalk)
src/web/                browser renderer (DOM + sprites)
src/app.ts              terminal entry point
public/assets/          sprite sheets, counter font, icons
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
