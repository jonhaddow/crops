# Crops

A top-down pixel-art farming game for a 6–8 year old on a tablet (touch, landscape first): walk a village with an on-screen D-pad and A button, farm a field, keep a chicken, shop at the market and ride a horse. A static PWA at https://crops.app.haddow.me: one prerendered page, no server code, no D1 and no sign-in. The farm saves to the device's localStorage (`crops-farm`).

## Worth knowing

- `src/lib/game.ts` holds all the rules: pure functions on a plain JSON `Farm`, unit tested. Keep it that way, and keep `parseFarm` accepting old saves: a child's farm must never be wiped by an update.
- Growth uses real timestamps, so crops keep growing while the app is closed.
- `src/lib/world/`: `map.ts` (terrain, buildings, people; built in code), `interact.ts` (what A does for the tile in front: pure, tested), `engine.ts` (canvas loop: tile-by-tile movement, camera, chicken, riding), `sprites.ts` (all the pixel art).
- Art is drawn in code: flat rectangles on small canvases with an automatic 1px ink outline, at 16px per tile, scaled up to about 64px on a tablet. No image files apart from the app icons. Menus show sprites as data URLs.
- `map.spec.ts` checks every plot, person, building and the horse can be reached from the start: run it after moving things on the map.
- Numbers use Press Start 2P; words use Pixelify Sans (its 5 looks like an S).
- A acts on finger down, so pop-ups only close on taps that start on their backdrop.
- Kid rules: nothing dies or is lost, icons over words, big touch targets, and `rescue()` hands over a carrot seed if the farm is ever stuck.
- `node scripts/shot.mjs <url> <out.png> [w] [h] [farm.json]` screenshots the game with a given save.
- Planned features: `docs/roadmap.md`.

## Review focus

Save compatibility (`parseFarm`), touch on iPad Safari, and anything a young child could get stuck on.
