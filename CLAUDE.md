# Crops

A top-down pixel-art farming game for a 6–8 year old on a tablet (touch, landscape first): tap to walk round a village and use things: farm a field (more land to buy), keep chickens, cows and sheep (more to buy at the market), fish in the pond, help villagers with requests, shop at the market and ride a horse. A static PWA at https://crops.app.haddow.me: one prerendered page, no server code, no D1 and no sign-in. The farm saves to the device's localStorage (`crops-farm`).

## Worth knowing

- `src/lib/game.ts` holds all the rules: pure functions on a plain JSON `Farm`, unit tested. Keep it that way, and keep `parseFarm` accepting old saves: a child's farm must never be wiped by an update.
- `Farm.animals` holds one timer per animal; the market sells more (up to a limit) and buys them back, but never the last of a kind. `Farm.plots.length` is the land owned: 12 to start, then strips of 4 (`LAND`) in `PLOTS` order. Version 3 saves (3×3 field) are moved onto the same tiles.
- Growth uses real timestamps, so crops keep growing while the app is closed.
- `src/lib/world/`: `map.ts` (terrain, buildings, people; built in code), `interact.ts` (what's on a tile, and so what tapping it does: pure, tested), `path.ts` (shortest walk, breadth first: pure, tested), `engine.ts` (canvas loop: walking routes, camera, wandering animals, riding, fishing line), `sprites.ts` (all the pixel art).
- Tapping something walks beside it, faces it and uses it (`act` in `+page.svelte`). Animals hold still while you walk to them. A horse can't go on the crops, so tapping a plot it can't reach hops off first. Animals keep clear of the tiles by their gates.
- Art is drawn in code: flat rectangles on small canvases with an automatic 1px ink outline, at 16px per tile, scaled up to about 64px on a tablet. No image files apart from the app icons. Menus show sprites as data URLs.
- `map.spec.ts` checks every plot, person, building and the horse can be reached from the start: run it after moving things on the map. A saved position that ends up blocked resets to the start.
- Numbers use Press Start 2P; words use Pixelify Sans (its 5 looks like an S).
- Kid rules: nothing dies or is lost, icons over words, big touch targets, and `rescue()` hands over a carrot seed if the farm is ever stuck.
- In dev, `window.world` is the engine: e2e tests tap tiles with `world.screenOf(x, y)`.
- `node scripts/shot.mjs <url> <out.png> [w] [h] [farm.json]` screenshots the game with a given save.
- Planned features: `docs/roadmap.md`.

## Review focus

Save compatibility (`parseFarm`), touch on iPad Safari, and anything a young child could get stuck on.
