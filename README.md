# Crops

A gentle pixel-art farming game for younger kids, played on a tablet.

Tap to walk round the village and use things: plant and water seeds, pick what grows, look after animals, fish in the pond, help villagers, sell it all at the market and buy more animals and land, then spend coins with the builder on a bigger house and decorations for the village. Nothing ever dies or goes wrong, and the farm keeps growing while the app is closed. Arrow keys and Space work on a computer.

## Tech stack

- [SvelteKit](https://svelte.dev) (Svelte 5) and TypeScript, as a static, offline PWA
- HTML canvas, with all the pixel art drawn in code
- Saves to the device's localStorage: no server code or sign-in
- Hosted on [Cloudflare Workers](https://workers.cloudflare.com), deployed from `main` by Workers Builds
- [Vitest](https://vitest.dev) and [Playwright](https://playwright.dev) for tests

## Running locally

```sh
npm ci
npm run dev
npm test            # unit tests (the farm's rules)
npm run test:e2e    # Playwright, landscape iPad
npm run check && npm run lint
```
