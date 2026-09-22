import * as fs from "fs";
import * as path from "path";
import { chromium, Browser, Page } from "playwright";

// Drives the real page and photographs it, rather than photographing a
// specimen of its parts. Runs against the built site so what is checked is
// what would deploy: `npm run build` first, then this serves dist/.
//
// It also plays a little -- opening a cell, flagging another -- because a
// board of covered cells proves almost nothing.
const root = path.join(__dirname, "..");
const out = path.join(root, ".specimen", "page");
const dist = path.join(root, "dist");

function findChromium(): string | undefined {
  const fromEnv = process.env.CHROMIUM_PATH;
  if (fromEnv !== undefined && fs.existsSync(fromEnv)) return fromEnv;
  const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (browsers === undefined || !fs.existsSync(browsers)) return undefined;
  for (const entry of fs.readdirSync(browsers)) {
    for (const rel of [
      ["chrome-linux", "chrome"],
      ["chrome-linux", "headless_shell"],
      ["chrome-headless-shell-linux64", "chrome-headless-shell"],
    ]) {
      const candidate = path.join(browsers, entry, ...rel);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

// The built site sets base to /minesweeper-console-typescript/, so it is
// served from a matching prefix rather than the filesystem root.
const BASE = "/minesweeper-console-typescript/";

async function serve(): Promise<{ url: string; stop: () => void }> {
  const http = await import("http");
  const types: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".ttf": "font/ttf",
  };
  const server = http.createServer((req, res) => {
    let rel = (req.url ?? "/").split("?")[0];
    rel = rel.startsWith(BASE) ? rel.slice(BASE.length) : rel.replace(/^\//, "");
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    const file = path.join(dist, rel);
    if (!file.startsWith(dist) || !fs.existsSync(file)) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    res.setHeader("content-type", types[path.extname(file)] ?? "application/octet-stream");
    res.end(fs.readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${port}${BASE}`,
    stop: () => server.close(),
  };
}

async function shoot(
  page: Page,
  url: string,
  shape: string,
  size: string
): Promise<string[]> {
  const problems: string[] = [];
  await page.goto(`${url}shapes/`);
  await page.selectOption("#shape", shape);
  await page.selectOption("#difficulty", size);
  await page.waitForTimeout(120);

  // Open the middle of the board, then flag something beside it, so the shot
  // shows numbers, a cascade, a flag and covered cells at once.
  const cells = page.locator(".shape-cell");
  const total = await cells.count();
  const middle = Math.floor(total / 2);
  await cells.nth(middle).locator("polygon").click();
  await page.waitForTimeout(80);
  // Flag a cell the cascade did not open. Right-clicking an opened cell
  // chords it, which is correct but makes for a screenshot with no flag in it.
  const covered = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll(".shape-cell"));
    return cells.findIndex((c) => (c.getAttribute("aria-label") ?? "").endsWith("covered"));
  });
  if (covered >= 0) {
    await cells.nth(covered).locator("polygon").click({ button: "right" });
    await page.waitForTimeout(80);
  }

  await page.locator(".frame").screenshot({
    path: path.join(out, `${shape}-${size}.png`),
  });

  // Every glyph on the live board has to sit inside the cell it belongs to.
  const overflow = await page.evaluate(() => {
    const inside = (px: number, py: number, poly: number[][]): boolean => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[j];
        if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) hit = !hit;
      }
      return hit;
    };
    let bad = 0;
    document.querySelectorAll(".shape-cell svg").forEach((svg) => {
      const polygon = svg.querySelector("polygon");
      const text = svg.querySelector("text");
      if (polygon === null || text === null) return;
      const poly = (polygon.getAttribute("points") ?? "").trim().split(/\s+/)
        .map((p) => p.split(",").map(Number));
      const box = (text as unknown as SVGGraphicsElement).getBBox();
      const size = Number(text.getAttribute("font-size"));
      const cy = Number(text.getAttribute("y"));
      const ink = text.getAttribute("data-ink") === "cap" ? 0.729 * size : box.height;
      const corners = [
        [box.x, cy - ink / 2], [box.x + box.width, cy - ink / 2],
        [box.x + box.width, cy + ink / 2], [box.x, cy + ink / 2],
      ];
      if (!corners.every(([x, y]) => inside(x, y, poly))) bad++;
    });
    return bad;
  });
  if (overflow > 0) problems.push(`${shape}/${size}: ${overflow} glyph(s) overflow their cell`);

  // A cell's outline must be what takes the click, not its bounding box --
  // otherwise overlapping boxes send presses to the wrong cell.
  const misrouted = await page.evaluate(() => {
    let wrong = 0;
    document.querySelectorAll(".shape-cell").forEach((cell) => {
      const polygon = cell.querySelector("polygon");
      if (polygon === null) return;
      const r = polygon.getBoundingClientRect();
      // The top-left corner of the bounding box: inside the box, outside the
      // outline for a hex or a triangle.
      const hit = document.elementFromPoint(r.left + 1, r.top + 1);
      if (hit !== null && hit.closest(".shape-cell") === cell && !polygon.contains(hit)) {
        wrong++;
      }
    });
    return wrong;
  });
  if (misrouted > 0) problems.push(`${shape}/${size}: ${misrouted} cell(s) hit test on their box`);

  return problems;
}

async function main(): Promise<void> {
  if (!fs.existsSync(path.join(dist, "shapes", "index.html"))) {
    throw new Error("no build at dist/shapes -- run npm run build first");
  }
  fs.mkdirSync(out, { recursive: true });
  const site = await serve();
  const browser: Browser = await chromium.launch({ executablePath: findChromium() });
  const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();

  const problems: string[] = [];
  for (const shape of ["square", "hex", "triangle"]) {
    for (const size of ["beginner", "expert"]) {
      problems.push(...(await shoot(page, site.url, shape, size)));
    }
  }

  // And the whole page once, chrome included.
  await page.goto(`${site.url}shapes/`);
  await page.selectOption("#shape", "hex");
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(out, "page.png"), fullPage: true });

  // A phone. Cells shrink to fit down to a floor, past which the board
  // scrolls, so what matters here is that the page is still usable.
  const phone = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const small = await phone.newPage();
  for (const shape of ["hex", "triangle"]) {
    await small.goto(`${site.url}shapes/`);
    await small.selectOption("#shape", shape);
    await small.waitForTimeout(150);
    await small.screenshot({ path: path.join(out, `phone-${shape}.png`), fullPage: true });
    const overflowsPage = await small.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    if (overflowsPage) {
      problems.push(`phone/${shape}: the page itself scrolls sideways`);
    }
  }

  // Play until it ends, so the face button and the reveal-everything state
  // get looked at rather than assumed.
  await page.goto(`${site.url}shapes/`);
  await page.selectOption("#shape", "hex");
  await page.selectOption("#difficulty", "beginner");
  await page.waitForTimeout(120);
  for (let i = 0; i < 90; i++) {
    const done = await page.evaluate(() => document.querySelector("#board.is-over") !== null);
    if (done) break;
    const next = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll(".shape-cell"));
      return cells.findIndex((c) => (c.getAttribute("aria-label") ?? "").endsWith("covered"));
    });
    if (next < 0) break;
    await page.locator(".shape-cell").nth(next).locator("polygon").click();
    await page.waitForTimeout(20);
  }
  const face = await page.evaluate(() => ({
    glyph: document.getElementById("face")?.textContent ?? "",
    status: document.getElementById("status")?.textContent ?? "",
  }));
  await page.locator(".frame").screenshot({ path: path.join(out, "endgame.png") });
  console.log(`endgame: status "${face.status}", face ${face.glyph}`);
  if (face.status === "") {
    problems.push("the game never ended, so the face button was not exercised");
  }

  // The heaviest board, timed: 960 cells, each its own button and svg.
  await page.goto(`${site.url}shapes/`);
  await page.selectOption("#shape", "triangle");
  await page.selectOption("#difficulty", "expert");
  await page.waitForTimeout(150);
  const timing = await page.evaluate(() => {
    const cell = document.querySelector(".shape-cell polygon") as SVGElement;
    const box = cell.getBoundingClientRect();
    const start = performance.now();
    (document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) as HTMLElement)
      ?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
    (document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) as HTMLElement)
      ?.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
    return {
      ms: performance.now() - start,
      cells: document.querySelectorAll(".shape-cell").length,
    };
  });
  console.log(
    `triangle expert: ${timing.cells} cells, a press settles and redraws in ${timing.ms.toFixed(0)}ms`
  );

  await phone.close();
  await browser.close();
  site.stop();

  console.log(`wrote screenshots to ${out}`);
  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exitCode = 1;
  } else {
    console.log("every glyph fits, and every cell hit tests on its outline");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
