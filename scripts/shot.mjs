// Screenshots the game, optionally with a saved farm (a JSON file in the
// localStorage format, see parseFarm in src/lib/game.ts).
// Usage: node scripts/shot.mjs <url> <out.png> [width] [height] [farm.json]
// Defaults to a landscape iPad (1180×820). Prints page errors.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const [url, out, w = '1180', h = '820', farmFile] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, hasTouch: true });
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
if (farmFile) {
	const farm = readFileSync(farmFile, 'utf8');
	await page.addInitScript((f) => localStorage.setItem('crops-farm', f), farm);
}
await page.goto(url);
await page.waitForTimeout(1000);
await page.screenshot({ path: out });
await browser.close();
