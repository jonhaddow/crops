// Service worker: keeps the whole game (it's static) so it opens offline.
// Each build gets its own cache; older ones are deleted.
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';

const CACHE = `crops-${version}`;
// '/' isn't listed in prerendered when ssr is off, so it's added by hand.
const ASSETS = [...new Set(['/', ...[...immutable, ...assets, ...prerendered].map((f) => f.path)])];

self.addEventListener('install', (event) =>
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);
			await self.skipWaiting();
		})()
	)
);

self.addEventListener('activate', (event) =>
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
			await self.clients.claim();
		})()
	)
);

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
	// Network first, so a new version shows up when online; the cache when not.
	event.respondWith(
		(async () => {
			try {
				return await fetch(event.request);
			} catch {
				const hit = await caches.match(event.request, { ignoreSearch: true });
				return hit ?? (await caches.match('/')) ?? Response.error();
			}
		})()
	);
});
