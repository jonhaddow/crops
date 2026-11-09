// The farm's rules, as plain functions on a plain state object, so they can be
// unit tested and saved as JSON. Nothing ever dies or is lost: a plot that
// isn't watered just waits, and an egg waits in its nest.

import { H, open, START_HORSE, START_PLAYER, W, type Dir, type Spot } from './world/map.ts';

export const CROPS = {
	carrot: { name: 'Carrot', growMs: 60_000, seedPrice: 1, sellPrice: 2 },
	strawberry: { name: 'Strawberry', growMs: 3 * 60_000, seedPrice: 2, sellPrice: 4 },
	pumpkin: { name: 'Pumpkin', growMs: 5 * 60_000, seedPrice: 3, sellPrice: 5 }
} as const;

export type Crop = keyof typeof CROPS;
export const CROP_NAMES = Object.keys(CROPS) as Crop[];

export const EGG = { name: 'Egg', layMs: 2 * 60_000, sellPrice: 2 } as const;

/** What can be in the basket: any crop, or an egg. */
export type Produce = Crop | 'egg';
export const PRODUCE: Produce[] = [...CROP_NAMES, 'egg'];

export function sellPrice(item: Produce): number {
	return item === 'egg' ? EGG.sellPrice : CROPS[item].sellPrice;
}

/** A planted plot. Growing starts when it's watered. */
export type Plot = { crop: Crop; wateredAt: number | null };

export type Farm = {
	version: 2;
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
};

export const PLOT_COUNT = 9;

export function newFarm(): Farm {
	return {
		version: 2,
		coins: 5,
		seeds: { carrot: 3, strawberry: 0, pumpkin: 0 },
		basket: { carrot: 0, strawberry: 0, pumpkin: 0, egg: 0 },
		plots: Array.from({ length: PLOT_COUNT }, () => null),
		fedAt: null,
		player: { ...START_PLAYER },
		riding: false,
		horse: { ...START_HORSE }
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
 * Version 1 saves (before the village) keep their farm and start at home.
 */
export function parseFarm(json: string | null): Farm {
	if (!json) return newFarm();
	try {
		const saved = JSON.parse(json) as Omit<Partial<Farm>, 'version'> & { version?: number };
		if (saved?.version !== 1 && saved?.version !== 2) return newFarm();
		const fresh = newFarm();
		const plots = Array.isArray(saved.plots) ? saved.plots : [];
		const player = spot(saved.player) ?? fresh.player;
		const facing = saved.player?.facing;
		const riding = saved.riding === true;
		return {
			version: 2,
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
			horse: riding ? { x: player.x, y: player.y } : (spot(saved.horse) ?? fresh.horse)
		};
	} catch {
		return newFarm();
	}
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
