import { describe, expect, it } from 'vitest';
import { buyLand, EGG, newFarm, parseFarm, plant } from '../game.ts';
import { reachTiles, target } from './interact.ts';
import { beside, onto, route } from './path.ts';
import {
	BUILDINGS,
	H,
	NPCS,
	open,
	PASTURE,
	PEN,
	PLOTS,
	START_HORSE,
	START_PLAYER,
	STEP,
	W,
	type Spot
} from './map.ts';

/** Every tile you can walk to from the start. */
function reachable(): Set<string> {
	const seen = new Set<string>([`${START_PLAYER.x},${START_PLAYER.y}`]);
	const queue: Spot[] = [START_PLAYER];
	while (queue.length) {
		const p = queue.shift()!;
		for (const s of Object.values(STEP)) {
			const x = p.x + s.x;
			const y = p.y + s.y;
			if (!open(x, y) || seen.has(`${x},${y}`)) continue;
			seen.add(`${x},${y}`);
			queue.push({ x, y });
		}
	}
	return seen;
}

const nextTo = (seen: Set<string>, x: number, y: number) =>
	Object.values(STEP).some((s) => seen.has(`${x + s.x},${y + s.y}`));

describe('map', () => {
	const seen = reachable();

	it('starts the player and horse on open ground', () => {
		expect(open(START_PLAYER.x, START_PLAYER.y)).toBe(true);
		expect(open(START_HORSE.x, START_HORSE.y)).toBe(true);
	});

	it('lets you reach every plot, person, building, the pen and the horse', () => {
		for (const p of PLOTS) expect(seen.has(`${p.x},${p.y}`), `plot ${p.x},${p.y}`).toBe(true);
		for (const n of NPCS) expect(nextTo(seen, n.x, n.y), n.id).toBe(true);
		for (const b of BUILDINGS) {
			const tiles = reachTiles(b.x, b.y);
			expect(
				tiles.some((t) => nextTo(seen, t.x, t.y)),
				b.id
			).toBe(true);
		}
		expect(seen.has(`${PEN.x},${PEN.y}`)).toBe(true);
		expect(seen.has(`${PASTURE.x},${PASTURE.y}`)).toBe(true);
		expect(nextTo(seen, START_HORSE.x, START_HORSE.y)).toBe(true);
	});

	it('keeps buildings on the map and apart', () => {
		for (const b of BUILDINGS) {
			expect(b.x >= 2 && b.y >= 2 && b.x + b.w <= W - 2 && b.y + b.h <= H - 2, b.id).toBe(true);
			for (const o of BUILDINGS)
				if (o !== b)
					expect(
						b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h,
						`${b.id} overlaps ${o.id}`
					).toBe(false);
		}
	});
});

describe('target', () => {
	const away = { chicken: [], cow: [], sheep: [] };

	it('works the plot in front', () => {
		const farm = newFarm();
		farm.player = { x: 5, y: 9, facing: 'down' };
		expect(target(farm, 0, away)).toMatchObject({ kind: 'plot', index: 2, action: 'plant' });
		plant(farm, 2, 'carrot');
		expect(target(farm, 0, away)).toMatchObject({ action: 'water' });
	});

	it('knows land that is not bought yet', () => {
		const farm = newFarm();
		farm.player = { x: 5, y: 12, facing: 'down' };
		expect(target(farm, 0, away)).toEqual({ kind: 'land' });
		farm.coins = 15;
		buyLand(farm);
		expect(target(farm, 0, away)).toMatchObject({ kind: 'plot', action: 'plant' });
	});

	it('sees to the hen that needs it from the coop', () => {
		const farm = newFarm();
		farm.animals.chicken = [5, null, 0];
		farm.player = { x: 12, y: 8, facing: 'down' };
		expect(target(farm, 1, away)).toMatchObject({ kind: 'chicken', index: 1, action: 'feed' });
		expect(target(farm, EGG.layMs, away)).toMatchObject({ index: 2, action: 'collect' });
	});

	it('finds the chicken, the horse, people and the shop', () => {
		const farm = newFarm();
		farm.player = { x: 12, y: 13, facing: 'up' };
		expect(target(farm, 0, { ...away, chicken: [{ x: 12, y: 12 }] })).toMatchObject({
			kind: 'chicken',
			action: 'feed'
		});
		farm.player = { x: 33, y: 25, facing: 'right' };
		expect(target(farm, 0, away)).toEqual({ kind: 'horse' });
		farm.player = { x: 20, y: 17, facing: 'left' };
		expect(target(farm, 0, away)).toMatchObject({ kind: 'npc' });
		farm.player = { x: 26, y: 13, facing: 'up' };
		expect(target(farm, 0, away)).toEqual({ kind: 'shop' });
		farm.player = { x: 12, y: 24, facing: 'left' };
		expect(target(farm, 0, away)).toEqual({ kind: 'water' });
		farm.player = { x: 16, y: 25, facing: 'right' };
		expect(target(farm, 0, { ...away, cow: [{ x: 17, y: 25 }] })).toMatchObject({
			kind: 'cow',
			action: 'feed'
		});
		expect(target(farm, 0, { ...away, sheep: [{ x: 17, y: 25 }] })).toMatchObject({
			kind: 'sheep',
			action: 'shear'
		});
	});

	it('can always ride a horse, even one left on a plot', () => {
		const farm = newFarm();
		farm.horse = { x: 5, y: 10 };
		farm.player = { x: 5, y: 9, facing: 'down' };
		expect(target(farm, 0, away)).toEqual({ kind: 'horse' });
	});
});

describe('saves', () => {
	it('moves a player saved somewhere blocked back to the start', () => {
		const farm = { ...newFarm(), player: { x: 0, y: 0, facing: 'up' } };
		expect(parseFarm(JSON.stringify(farm)).player).toEqual({ ...START_PLAYER, facing: 'up' });
	});

	it('puts the horse under a rider', () => {
		const farm = { ...newFarm(), riding: true, player: { x: 22, y: 20, facing: 'down' } };
		expect(parseFarm(JSON.stringify(farm)).horse).toEqual({ x: 22, y: 20 });
	});

	it('upgrades a version 1 save', () => {
		const v1 = { version: 1, coins: 9, seeds: { carrot: 1 }, plots: [], fedAt: null };
		const farm = parseFarm(JSON.stringify(v1));
		expect(farm.version).toBe(4);
		expect(farm.coins).toBe(9);
		expect(farm.player).toEqual(START_PLAYER);
		expect(farm.horse).toEqual(START_HORSE);
	});
});

describe('route', () => {
	const walls = (x: number, y: number) => !open(x, y);

	it('walks round the fence into the field and faces the plot', () => {
		const r = route(START_PLAYER, walls, beside([{ x: 4, y: 12 }]))!;
		expect(r).not.toBeNull();
		let x = START_PLAYER.x;
		let y = START_PLAYER.y;
		for (const d of r.steps) {
			x += STEP[d].x;
			y += STEP[d].y;
			expect(open(x, y)).toBe(true);
		}
		expect(Math.abs(x - 4) + Math.abs(y - 12)).toBe(1);
		expect({ x: x + STEP[r.face!].x, y: y + STEP[r.face!].y }).toEqual({ x: 4, y: 12 });
	});

	it('finds the pond shore from the village', () => {
		const r = route(START_PLAYER, walls, beside(reachTiles(7, 24)));
		expect(r).not.toBeNull();
	});

	it('gives up when there is no way', () => {
		expect(route(START_PLAYER, walls, onto({ x: 0, y: 0 }))).toBeNull();
	});
});
