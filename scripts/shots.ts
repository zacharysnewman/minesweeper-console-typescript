import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";

// Photographs the specimen page.
//
// `npm run shots` rebuilds the page first, so the screenshots can never be of
// a stale specimen.
//
// The browser is whatever Chromium is already on the machine. Playwright
// wants a build number matching its own version and will otherwise ask to
// download one, which is both slow and unnecessary here, so a build found
// under PLAYWRIGHT_BROWSERS_PATH or named in CHROMIUM_PATH wins over
// Playwright's own lookup.
const root = path.join(__dirname, "..");
const page = path.join(root, ".specimen", "index.html");
const out = path.join(root, ".specimen", "shots");

function findChromium(): string | undefined {
  const fromEnv = process.env.CHROMIUM_PATH;
  if (fromEnv !== undefined && fs.existsSync(fromEnv)) {
    return fromEnv;
  }
  const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (browsers === undefined || !fs.existsSync(browsers)) {
    return undefined;
  }
  for (const entry of fs.readdirSync(browsers)) {
    for (const rel of [
      ["chrome-linux", "chrome"],
      ["chrome-linux", "headless_shell"],
      ["chrome-headless-shell-linux64", "chrome-headless-shell"],
    ]) {
      const candidate = path.join(browsers, entry, ...rel);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

async function main(): Promise<void> {
  if (!fs.existsSync(page)) {
    throw new Error(`no specimen at ${page} -- run npm run specimen first`);
  }
  fs.mkdirSync(out, { recursive: true });

  const executablePath = findChromium();
  console.log(`browser: ${executablePath ?? "playwright default"}`);
  const browser = await chromium.launch({ executablePath });
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const tab = await context.newPage();
  await tab.goto(`file://${page}`);
  await tab.waitForLoadState("networkidle");

  await tab.screenshot({
    path: path.join(out, "specimen-full.png"),
    fullPage: true,
  });

  // One shot per section, so a shape can be looked at closely without
  // squinting at the whole sheet.
  const sections = await tab.locator("section").all();
  for (let i = 0; i < sections.length; i++) {
    const name = (await sections[i].locator("h2").innerText())
      .split(" ")[0]
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
    await sections[i].screenshot({
      path: path.join(out, `${String(i + 1).padStart(2, "0")}-${name}.png`),
    });
  }

  // Re-measure what actually rendered. The font sizes in geometry.ts come
  // from em constants, and em constants are exactly the thing that goes
  // quietly wrong -- bold digits are wider than regular ones, and Noto's
  // emoji are wider than their em box. So rather than trust them, read every
  // glyph's real box out of the browser and put its corners back against the
  // cell outline it is supposed to sit in.
  const overflows = await tab.evaluate(() => {
    const inside = (px: number, py: number, poly: number[][]): boolean => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[j];
        if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) {
          hit = !hit;
        }
      }
      return hit;
    };
    const bad: string[] = [];
    document.querySelectorAll("svg").forEach((svg) => {
      const polygon = svg.querySelector("polygon");
      const text = svg.querySelector("text");
      if (polygon === null || text === null) return;
      const poly = (polygon.getAttribute("points") ?? "")
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(",").map(Number));
      const box = (text as unknown as SVGGraphicsElement).getBBox();
      const size = Number(text.getAttribute("font-size"));
      const cy = Number(text.getAttribute("y"));
      // getBBox returns the line box, which for digits is far taller than the
      // ink -- they have no descender. Cap height is the real extent.
      const inkHeight =
        text.getAttribute("data-ink") === "cap" ? 0.729 * size : box.height;
      const corners = [
        [box.x, cy - inkHeight / 2],
        [box.x + box.width, cy - inkHeight / 2],
        [box.x + box.width, cy + inkHeight / 2],
        [box.x, cy + inkHeight / 2],
      ];
      if (!corners.every(([x, y]) => inside(x, y, poly))) {
        bad.push(
          `${text.textContent ?? "?"} at ${size.toFixed(1)}px ` +
            `(ink ${box.width.toFixed(1)}x${inkHeight.toFixed(1)})`
        );
      }
    });
    return bad;
  });

  await browser.close();
  console.log(`wrote ${sections.length + 1} screenshots to ${out}`);

  if (overflows.length > 0) {
    console.error(`\n${overflows.length} glyph(s) overflow their cell:`);
    for (const line of overflows) {
      console.error(`  ${line}`);
    }
    process.exitCode = 1;
  } else {
    console.log("every glyph measured in the browser fits its cell outline");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
