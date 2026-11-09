// The farm's rules, as plain functions on a plain state object, so they can be
// unit tested and saved as JSON. Nothing ever dies or is lost: a plot that
// isn't watered just waits, and an egg waits in its nest.

import { H, NPCS, open, START_HORSE, START_PLAYER, W, type Dir, type Spot } from './world/map.ts';

export const CROPS = {
	carrot: { name: 'Carrot', growMs: 60_000, seedPrice: 1 },
	strawberry: { name: 'Strawberry', growMs: 3 * 60_000, seedPrice: 2 },
	pumpkin: { name: 'Pumpkin', growMs: 5 * 60_000, seedPrice: 3 }
} as const;

export type Crop = keyof typeof CROPS;
export const CROP_NAMES = Object.keys(CROPS) as Crop[];

export const EGG = { layMs: 2 * 60_000 } as const;

export const COW = { milkMs: 3 * 60_000 } as const;
export const SHEEP = { woolMs: 4 * 60_000 } as const;

/** Everything that can go in the basket: its name, and what the market pays. */
const ITEMS = {
	carrot: { one: 'carrot', many: 'carrots', price: 2 },
	strawberry: { one: 'strawberry', many: 'strawberries', price: 4 },
	pumpkin: { one: 'pumpkin', many: 'pumpkins', price: 5 },
	egg: { one: 'egg', many: 'eggs', price: 2 },
	milk: { one: 'bottle of milk', many: 'bottles of milk', price: 3 },
	wool: { one: 'ball of wool', many: 'balls of wool', price: 4 },
	fish: { one: 'fish', many: 'fish', price: 2 },
	bigfish: { one: 'big fish', many: 'big fish', price: 4 },
	goldfish: { one: 'golden fish', many: 'golden fish', price: 8 },
	boot: { one: 'old boot', many: 'old boots', price: 1 }
} as const;

export type Produce = keyof typeof ITEMS;
export const PRODUCE = Object.keys(ITEMS) as Produce[];

export function sellPrice(item: Produce): number {
	return ITEMS[item].price;
}

/** "1 carrot", "3 strawberries", "2 bottles of milk". */
export function amount(item: Produce, count: number): string {
	return `${count} ${count === 1 ? ITEMS[item].one : ITEMS[item].many}`;
}

/** A planted plot. Growing starts when it's watered. */
export type Plot = { crop: Crop; wateredAt: number | null };

/** Villagers who ask for things (everyone but the shopkeeper). */
export const REQUESTERS = NPCS.filter((n) => n.id !== 'shopkeeper').map((n) => n.id);
export type Request = { item: Produce; count: number; reward: number };
/** How long after a request is done before that villager asks again. */
export const REQUEST_GAP_MS = 90_000;
const REQUEST_ITEMS: Produce[] = ['carrot', 'strawberry', 'pumpkin', 'egg', 'milk', 'wool', 'fish'];

export type Farm = {
	version: 3;
	coins: number;
	seeds: Record<Crop, number>;
	basket: Record<Produce, number>;
	plots: (Plot | null)[];
	/** When the chicken was last fed; null when it's hungry. */
	fedAt: number | null;
	/** Where the player is in the village, and which way they face. */
	player: Spot & { facing: Dir };
	riding: boolean;
	/** Where the horse is when nobody's riding it. */
	horse: Spot;
	/** When the cow was last fed; null when it's hungry. */
	cowFedAt: number | null;
	/** When the sheep was last sheared; null when it's woolly. */
	shornAt: number | null;
	/** What each villager wants, if anything. */
	requests: Record<string, Request | null>;
	/** When each villager will next ask for something. */
	requestAt: Record<string, number>;
};

export const PLOT_COUNT = 9;

export function newFarm(): Farm {
	return {
		version: 3,
		coins: 5,
		seeds: { carrot: 3, strawberry: 0, pumpkin: 0 },
		basket: Object.fromEntries(PRODUCE.map((p) => [p, 0])) as Record<Produce, number>,
		plots: Array.from({ length: PLOT_COUNT }, () => null),
		fedAt: null,
		player: { ...START_PLAYER },
		riding: false,
		horse: { ...START_HORSE },
		cowFedAt: null,
		shornAt: null,
		requests: Object.fromEntries(REQUESTERS.map((id) => [id, null])),
		requestAt: Object.fromEntries(REQUESTERS.map((id) => [id, 0]))
	};
}

export type Stage = 'empty' | 'thirsty' | 'sprout' | 'growing' | 'ripe';

/** How far along a plot is, from 0 (just watered) to 1 (ripe). */
export function progress(plot: Plot, now: number): number {
	if (plot.wateredAt === null) return 0;
	return Math.min(1, Math.max(0, (now - plot.wateredAt) / CROPS[plot.crop].growMs));
}

export function stage(plot: Plot | null, now: number): Stage {
	if (!plot) return 'empty';
	if (plot.wateredAt === null) return 'thirsty';
	const p = progress(plot, now);
	if (p >= 1) return 'ripe';
	return p < 0.5 ? 'sprout' : 'growing';
}

export function plant(farm: Farm, index: number, crop: Crop): boolean {
	if (farm.plots[index] || farm.seeds[crop] < 1) return false;
	farm.seeds[crop]--;
	farm.plots[index] = { crop, wateredAt: null };
	return true;
}

export function water(farm: Farm, index: number, now: number): boolean {
	const plot = farm.plots[index];
	if (!plot || plot.wateredAt !== null) return false;
	plot.wateredAt = now;
	return true;
}

/** Picks a ripe crop into the basket; returns what was picked. */
export function harvest(farm: Farm, index: number, now: number): Crop | null {
	const plot = farm.plots[index];
	if (stage(plot, now) !== 'ripe' || !plot) return null;
	farm.basket[plot.crop]++;
	farm.plots[index] = null;
	return plot.crop;
}

export type ChickenState = 'hungry' | 'eating' | 'egg';

export function chicken(farm: Farm, now: number): ChickenState {
	if (farm.fedAt === null) return 'hungry';
	return now - farm.fedAt >= EGG.layMs ? 'egg' : 'eating';
}

export function feed(farm: Farm, now: number): boolean {
	if (farm.fedAt !== null) return false;
	farm.fedAt = now;
	return true;
}

export function collectEgg(farm: Farm, now: number): boolean {
	if (chicken(farm, now) !== 'egg') return false;
	farm.basket.egg++;
	farm.fedAt = null;
	return true;
}

export type CowState = 'hungry' | 'eating' | 'milk';

export function cow(farm: Farm, now: number): CowState {
	if (farm.cowFedAt === null) return 'hungry';
	return now - farm.cowFedAt >= COW.milkMs ? 'milk' : 'eating';
}

export function feedCow(farm: Farm, now: number): boolean {
	if (farm.cowFedAt !== null) return false;
	farm.cowFedAt = now;
	return true;
}

export function milk(farm: Farm, now: number): boolean {
	if (cow(farm, now) !== 'milk') return false;
	farm.basket.milk++;
	farm.cowFedAt = null;
	return true;
}

/** The sheep is woolly, or its wool is growing back. */
export function sheep(farm: Farm, now: number): 'woolly' | 'growing' {
	return farm.shornAt === null || now - farm.shornAt >= SHEEP.woolMs ? 'woolly' : 'growing';
}

export function shear(farm: Farm, now: number): boolean {
	if (sheep(farm, now) !== 'woolly') return false;
	farm.basket.wool++;
	farm.shornAt = now;
	return true;
}

/** What comes up on the line, from a random number 0–1. */
export function catchFor(roll: number): Produce {
	if (roll < 0.08) return 'boot';
	if (roll < 0.13) return 'goldfish';
	if (roll < 0.45) return 'bigfish';
	return 'fish';
}

/** Gives villagers whose turn has come something new to ask for. */
export function updateRequests(farm: Farm, now: number, random = Math.random) {
	for (const id of REQUESTERS) {
		if (farm.requests[id] || now < (farm.requestAt[id] ?? 0)) continue;
		const item = REQUEST_ITEMS[Math.floor(random() * REQUEST_ITEMS.length)];
		const count = 1 + Math.floor(random() * (item === 'pumpkin' ? 2 : 3));
		farm.requests[id] = { item, count, reward: count * sellPrice(item) + 2 };
	}
}

/** Hands a villager what they asked for, if it's in the basket; returns the coins earned. */
export function fulfil(farm: Farm, id: string, now: number): number {
	const r = farm.requests[id];
	if (!r || farm.basket[r.item] < r.count) return 0;
	farm.basket[r.item] -= r.count;
	farm.coins += r.reward;
	farm.requests[id] = null;
	farm.requestAt[id] = now + REQUEST_GAP_MS;
	return r.reward;
}

export function sell(farm: Farm, item: Produce): boolean {
	if (farm.basket[item] < 1) return false;
	farm.basket[item]--;
	farm.coins += sellPrice(item);
	return true;
}

export function buy(farm: Farm, crop: Crop): boolean {
	const price = CROPS[crop].seedPrice;
	if (farm.coins < price) return false;
	farm.coins -= price;
	farm.seeds[crop]++;
	return true;
}

/**
 * Never leave a child stuck: with no coins, no seeds, nothing planted and
 * nothing to sell, a carrot seed turns up. (The chicken can always earn an
 * egg too, but that's slow.)
 */
export function rescue(farm: Farm): boolean {
	const anything =
		farm.coins >= CROPS.carrot.seedPrice ||
		CROP_NAMES.some((c) => farm.seeds[c] > 0) ||
		PRODUCE.some((p) => farm.basket[p] > 0) ||
		farm.plots.some(Boolean);
	if (anything) return false;
	farm.seeds.carrot++;
	return true;
}

/**
 * Reads a saved farm, falling back to a new one if it's missing or broken.
 * Version 1 saves (before the village) keep their farm and start at home;
 * version 2 saves (before the cow, sheep and requests) gain them.
 */
export function parseFarm(json: string | null): Farm {
	if (!json) return newFarm();
	try {
		const saved = JSON.parse(json) as Omit<Partial<Farm>, 'version'> & { version?: number };
		if (![1, 2, 3].includes(saved?.version as number)) return newFarm();
		const fresh = newFarm();
		const plots = Array.isArray(saved.plots) ? saved.plots : [];
		const player = spot(saved.player) ?? fresh.player;
		const facing = saved.player?.facing;
		const riding = saved.riding === true;
		return {
			version: 3,
			coins: num(saved.coins),
			seeds: counts(fresh.seeds, saved.seeds),
			basket: counts(fresh.basket, saved.basket),
			plots: fresh.plots.map((_, i) => {
				const p = plots[i];
				return p && p.crop in CROPS
					? { crop: p.crop, wateredAt: typeof p.wateredAt === 'number' ? p.wateredAt : null }
					: null;
			}),
			fedAt: typeof saved.fedAt === 'number' ? saved.fedAt : null,
			player: {
				x: player.x,
				y: player.y,
				facing: facing && facing in DIRS ? facing : 'down'
			},
			riding,
			// While riding, the horse is under the player.
			horse: riding ? { x: player.x, y: player.y } : (spot(saved.horse) ?? fresh.horse),
			cowFedAt: typeof saved.cowFedAt === 'number' ? saved.cowFedAt : null,
			shornAt: typeof saved.shornAt === 'number' ? saved.shornAt : null,
			requests: Object.fromEntries(REQUESTERS.map((id) => [id, request(saved.requests?.[id])])),
			requestAt: Object.fromEntries(
				REQUESTERS.map((id) => [
					id,
					typeof saved.requestAt?.[id] === 'number' ? saved.requestAt[id] : 0
				])
			)
		};
	} catch {
		return newFarm();
	}
}

function request(r: unknown): Request | null {
	const q = r as Partial<Request> | null | undefined;
	if (!q || !PRODUCE.includes(q.item as Produce)) return null;
	const count = num(q.count);
	return count > 0 ? { item: q.item as Produce, count, reward: num(q.reward) } : null;
}

const DIRS: Record<Dir, true> = { up: true, down: true, left: true, right: true };

/** A saved position, if it's still somewhere you can stand on the map. */
function spot(s: unknown): Spot | null {
	const p = s as Partial<Spot> | null | undefined;
	if (!p || !Number.isInteger(p.x) || !Number.isInteger(p.y)) return null;
	const { x, y } = p as Spot;
	return x >= 0 && y >= 0 && x < W && y < H && open(x, y) ? { x, y } : null;
}

function num(n: unknown): number {
	return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function counts<K extends string>(base: Record<K, number>, saved: unknown): Record<K, number> {
	const s = (saved ?? {}) as Partial<Record<K, unknown>>;
	const out = { ...base };
	for (const k of Object.keys(base) as K[]) out[k] = num(s[k]);
	return out;
}
