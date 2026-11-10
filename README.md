# Crops

A pixel-art farming game for a 6–8 year old, played on a tablet. Tap to walk round the village and use things: plant and water seeds, pick what grows, feed the chicken, milk the cow, shear the sheep, fish in the pond, help villagers with what they need, sell it all at the market, buy more animals and land, and ride the horse. Nothing ever dies or goes wrong. Arrow keys and Space work on a computer.

Live at https://crops.app.haddow.me. Add it to the home screen to play full screen and offline.

## Development

```
npm ci
npm run dev
npm test            # unit (the farm's rules)
npm run test:e2e    # Playwright, landscape iPad
npm run check && npm run lint
```
