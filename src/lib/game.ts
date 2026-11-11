// The farm's rules, as plain functions on a plain state object, so they can be
// unit tested and saved as JSON. Nothing ever dies or is lost: a plot that
// isn't watered just waits, and an egg waits in its nest.

import {
	H,
	NPCS,
	open,
	plotAt,
	START_HORSE,
	START_PLAYER,
	W,
	type Dir,
	type Spot
} from './world/map.ts';

export const CROPS = {
	carrot: { name: 'Carrot', growMs: 60_000, seedPrice: 1 },
	potato: { name: 'Potato', growMs: 2 * 60_000, seedPrice: 1 },
	strawberry: { name: 'Strawberry', growMs: 3 * 60_000, seedPrice: 2 },
	tomato: { name: 'Tomato', growMs: 4 * 60_000, seedPrice: 2 },
	pumpkin: { name: 'Pumpkin', growMs: 5 * 60_000, seedPrice: 3 },
	corn: { name: 'Corn', growMs: 6 * 60_000, seedPrice: 3 },
	sunflower: { name: 'Sunflower', growMs: 8 * 60_000, seedPrice: 4 },
	watermelon: { name: 'Watermelon', growMs: 10 * 60_000, seedPrice: 5 }
} as const;

export type Crop = keyof typeof CROPS;
export const CROP_NAMES = Object.keys(CROPS) as Crop[];

export const EGG = { layMs: 2 * 60_000 } as const;

export const COW = { milkMs: 3 * 60_000 } as const;
export const SHEEP = { woolMs: 4 * 60_000 } as const;

/** Animals the market sells, and buys back for a bit less. You always keep one of each. */
export const ANIMALS = {
	chicken: { name: 'Chicken', price: 8, sellPrice: 5, max: 4 },
	sheep: { name: 'Sheep', price: 15, sellPrice: 10, max: 3 },
	cow: { name: 'Cow', price: 20, sellPrice: 14, max: 3 }
} as const;

export type Animal = keyof typeof ANIMALS;
export const ANIMAL_NAMES = Object.keys(ANIMALS) as Animal[];

/**
 * The field starts with 12 plots; more land comes 4 plots at a time, then
 * the north field 6 at a time.
 */
export const START_PLOTS = 12;
export const LAND = [
	{ plots: 16, price: 15 },
	{ plots: 20, price: 25 },
	{ plots: 26, price: 35 },
	{ plots: 32, price: 45 },
	{ plots: 38, price: 60 }
] as const;

/** Everything that can go in the basket: its name, and what the market pays. */
const ITEMS = {
	carrot: { one: 'carrot', many: 'carrots', price: 2 },
	potato: { one: 'potato', many: 'potatoes', price: 3 },
	strawberry: { one: 'strawberry', many: 'strawberries', price: 4 },
	tomato: { one: 'tomato', many: 'tomatoes', price: 5 },
	pumpkin: { one: 'pumpkin', many: 'pumpkins', price: 5 },
	corn: { one: 'corn cob', many: 'corn cobs', price: 6 },
	sunflower: { one: 'sunflower', many: 'sunflowers', price: 8 },
	watermelon: { one: 'watermelon', many: 'watermelons', price: 12 },
	egg: { one: 'egg', many: 'eggs', price: 2 },
	milk: { one: 'bottle of milk', many: 'bottles of milk', price: 3 },
	wool: { one: 'ball of wool', many: 'balls of wool', price: 4 },
	fish: { one: 'fish', many: 'fish', price: 2 },
	bigfish: { one: 'big fish', many: 'big fish', price: 4 },
	goldfish: { one: 'golden fish', many: 'golden fish', price: 8 },
	goldsquid: { one: 'golden squid', many: 'golden squid', price: 30 },
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
const REQUEST_ITEMS: Produce[] = [...CROP_NAMES, 'egg', 'milk', 'wool', 'fish'];
/** Slow crops: villagers only ask for one or two. */
const BIG: Produce[] = ['pumpkin', 'corn', 'sunflower', 'watermelon'];

export type Farm = {
	version: 4;
	coins: number;
	seeds: Record<Crop, number>;
	basket: Record<Produce, number>;
	plots: (Plot | null)[];
	/** Where the player is in the village, and which way they face. */
	player: Spot & { facing: Dir };
	riding: boolean;
	/** Where the horse is when nobody's riding it. */
	horse: Spot;
	/**
	 * One entry per animal. Chickens and cows: when last fed (null when
	 * hungry). Sheep: when last sheared (null when woolly).
	 */
	animals: Record<Animal, (number | null)[]>;
	/** What each villager wants, if anything. */
	requests: Record<string, Request | null>;
	/** When each villager will next ask for something. */
	requestAt: Record<string, number>;
};

export function newFarm(): Farm {
	return {
		version: 4,
		coins: 5,
		seeds: Object.fromEntries(CROP_NAMES.map((c) => [c, c === 'carrot' ? 3 : 0])) as Record<
			Crop,
			number
		>,
		basket: Object.fromEntries(PRODUCE.map((p) => [p, 0])) as Record<Produce, number>,
		plots: Array.from({ length: START_PLOTS }, () => null),
		player: { ...START_PLAYER },
		riding: false,
		horse: { ...START_HORSE },
		animals: { chicken: [null], sheep: [null], cow: [null] },
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

export function chicken(farm: Farm, now: number, i = 0): ChickenState {
	const fedAt = farm.animals.chicken[i] ?? null;
	if (fedAt === null) return 'hungry';
	return now - fedAt >= EGG.layMs ? 'egg' : 'eating';
}

export function feed(farm: Farm, now: number, i = 0): boolean {
	if (chicken(farm, now, i) !== 'hungry' || i >= farm.animals.chicken.length) return false;
	farm.animals.chicken[i] = now;
	return true;
}

export function collectEgg(farm: Farm, now: number, i = 0): boolean {
	if (chicken(farm, now, i) !== 'egg') return false;
	farm.basket.egg++;
	farm.animals.chicken[i] = null;
	return true;
}

export type CowState = 'hungry' | 'eating' | 'milk';

export function cow(farm: Farm, now: number, i = 0): CowState {
	const fedAt = farm.animals.cow[i] ?? null;
	if (fedAt === null) return 'hungry';
	return now - fedAt >= COW.milkMs ? 'milk' : 'eating';
}

export function feedCow(farm: Farm, now: number, i = 0): boolean {
	if (cow(farm, now, i) !== 'hungry' || i >= farm.animals.cow.length) return false;
	farm.animals.cow[i] = now;
	return true;
}

export function milk(farm: Farm, now: number, i = 0): boolean {
	if (cow(farm, now, i) !== 'milk') return false;
	farm.basket.milk++;
	farm.animals.cow[i] = null;
	return true;
}

/** The sheep is woolly, or its wool is growing back. */
export function sheep(farm: Farm, now: number, i = 0): 'woolly' | 'growing' {
	const shornAt = farm.animals.sheep[i] ?? null;
	return shornAt === null || now - shornAt >= SHEEP.woolMs ? 'woolly' : 'growing';
}

export function shear(farm: Farm, now: number, i = 0): boolean {
	if (i >= farm.animals.sheep.length || sheep(farm, now, i) !== 'woolly') return false;
	farm.basket.wool++;
	farm.animals.sheep[i] = now;
	return true;
}

/** A new animal arrives hungry (or woolly), ready to look after. */
export function buyAnimal(farm: Farm, kind: Animal): boolean {
	const a = ANIMALS[kind];
	if (farm.coins < a.price || farm.animals[kind].length >= a.max) return false;
	farm.coins -= a.price;
	farm.animals[kind].push(null);
	return true;
}

/**
 * Sells the newest animal of a kind, but never the last one. Anything it has
 * ready (an egg, milk, wool) goes in the basket first.
 */
export function sellAnimal(farm: Farm, kind: Animal, now: number): boolean {
	const herd = farm.animals[kind];
	if (herd.length <= 1) return false;
	const last = herd.length - 1;
	if (kind === 'chicken') collectEgg(farm, now, last);
	if (kind === 'cow') milk(farm, now, last);
	if (kind === 'sheep') shear(farm, now, last);
	herd.pop();
	farm.coins += ANIMALS[kind].sellPrice;
	return true;
}

/** The next bit of land for sale, if there's any left. */
export function nextLand(farm: Farm) {
	return LAND.find((l) => l.plots > farm.plots.length) ?? null;
}

export function buyLand(farm: Farm): boolean {
	const land = nextLand(farm);
	if (!land || farm.coins < land.price) return false;
	farm.coins -= land.price;
	while (farm.plots.length < land.plots) farm.plots.push(null);
	return true;
}

/**
 * What comes up on the line, from a random number 0–1: a fish 45%, a big
 * fish 32%, a golden squid 10%, an old boot 8%, a golden fish 5%.
 */
export function catchFor(roll: number): Produce {
	if (roll < 0.08) return 'boot';
	if (roll < 0.18) return 'goldsquid';
	if (roll < 0.23) return 'goldfish';
	if (roll < 0.45) return 'bigfish';
	return 'fish';
}

/** Gives villagers whose turn has come something new to ask for. */
export function updateRequests(farm: Farm, now: number, random = Math.random) {
	for (const id of REQUESTERS) {
		if (farm.requests[id] || now < (farm.requestAt[id] ?? 0)) continue;
		const item = REQUEST_ITEMS[Math.floor(random() * REQUEST_ITEMS.length)];
		const count = 1 + Math.floor(random() * (BIG.includes(item) ? 2 : 3));
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
 * version 2 saves (before the cow, sheep and requests) gain them; version 3
 * saves (one of each animal, a 3×3 field) keep their crops where they were.
 */
export function parseFarm(json: string | null): Farm {
	if (!json) return newFarm();
	try {
		const saved = JSON.parse(json) as Omit<Partial<Farm>, 'version'> & {
			version?: number;
			fedAt?: unknown;
			cowFedAt?: unknown;
			shornAt?: unknown;
		};
		if (![1, 2, 3, 4].includes(saved?.version as number)) return newFarm();
		const fresh = newFarm();
		const savedPlots: (Plot | null)[] = Array.isArray(saved.plots) ? saved.plots : [];
		// Before version 4 the field was 3×3, one in from the fence: same tiles, new indexes.
		const plots = saved.version === 4 ? savedPlots : Array<Plot | null>(START_PLOTS).fill(null);
		if (saved.version !== 4)
			savedPlots
				.slice(0, 9)
				.forEach((p, i) => (plots[plotAt(4 + (i % 3), 10 + Math.floor(i / 3))] = p));
		// Only whole strips of land: the biggest size the save has room for.
		const owned = [START_PLOTS, ...LAND.map((l) => l.plots)]
			.filter((n) => n <= Math.max(START_PLOTS, plots.length))
			.at(-1)!;
		const time = (t: unknown) => (typeof t === 'number' ? t : null);
		const herd = (kind: Animal, old: unknown) => {
			const list = saved.version === 4 ? saved.animals?.[kind] : [old];
			const out = (Array.isArray(list) ? list : []).slice(0, ANIMALS[kind].max).map(time);
			return out.length ? out : [null];
		};
		const player = spot(saved.player) ?? fresh.player;
		const facing = saved.player?.facing;
		const riding = saved.riding === true;
		return {
			version: 4,
			coins: num(saved.coins),
			seeds: counts(fresh.seeds, saved.seeds),
			basket: counts(fresh.basket, saved.basket),
			plots: Array.from({ length: owned }, (_, i) => {
				const p = plots[i];
				return p && p.crop in CROPS
					? { crop: p.crop, wateredAt: typeof p.wateredAt === 'number' ? p.wateredAt : null }
					: null;
			}),
			player: {
				x: player.x,
				y: player.y,
				facing: facing && facing in DIRS ? facing : 'down'
			},
			riding,
			// While riding, the horse is under the player.
			horse: riding ? { x: player.x, y: player.y } : (spot(saved.horse) ?? fresh.horse),
			animals: {
				chicken: herd('chicken', saved.fedAt),
				sheep: herd('sheep', saved.shornAt),
				cow: herd('cow', saved.cowFedAt)
			},
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
