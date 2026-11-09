# Crops

A farming game for a 6–8 year old on a tablet (touch, landscape first). A static PWA at https://crops.app.haddow.me: one prerendered page, no server code, no D1 and no sign-in. The farm saves to the device's localStorage (`crops-farm`).

## Worth knowing

- `src/lib/game.ts` holds all the rules: pure functions on a plain JSON `Farm`, unit tested. Keep it that way, and keep `parseFarm` accepting old saves: a child's farm must never be wiped by an update.
- Growth uses real timestamps, so crops keep growing while the app is closed.
- Art is inline SVG in `Art.svelte` (100×100 grid, `--ink` outline). No image files apart from the icons.
- Kid rules: nothing dies or is lost, icons over words, big touch targets, and `rescue()` hands over a carrot seed if the farm is ever stuck.
- `node scripts/shot.mjs <url> <out.png> [w] [h] [farm.json]` screenshots the game with a given save.
- Planned features: `docs/roadmap.md`.

## Review focus

Save compatibility (`parseFarm`), touch on iPad Safari, and anything a young child could get stuck on.
