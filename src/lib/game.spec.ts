import { describe, expect, it } from 'vitest';
import {
	buy,
	chicken,
	collectEgg,
	CROPS,
	EGG,
	feed,
	harvest,
	newFarm,
	parseFarm,
	plant,
	rescue,
	sell,
	stage,
	water
} from './game.ts';

describe('growing', () => {
	it('plants, waits for water, grows and harvests', () => {
		const farm = newFarm();
		expect(plant(farm, 0, 'carrot')).toBe(true);
		expect(farm.seeds.carrot).toBe(2);
		expect(stage(farm.plots[0], 0)).toBe('thirsty');
		// A thirsty plant just waits: it never dies.
		expect(stage(farm.plots[0], 10 * CROPS.carrot.growMs)).toBe('thirsty');

		expect(water(farm, 0, 1000)).toBe(true);
		expect(water(farm, 0, 1000)).toBe(false);
		expect(stage(farm.plots[0], 1000)).toBe('sprout');
		expect(stage(farm.plots[0], 1000 + CROPS.carrot.growMs * 0.6)).toBe('growing');
		expect(harvest(farm, 0, 1000 + CROPS.carrot.growMs - 1)).toBe(null);

		expect(harvest(farm, 0, 1000 + CROPS.carrot.growMs)).toBe('carrot');
		expect(farm.basket.carrot).toBe(1);
		expect(farm.plots[0]).toBe(null);
	});

	it("won't plant without a seed or on a full plot", () => {
		const farm = newFarm();
		expect(plant(farm, 0, 'pumpkin')).toBe(false);
		plant(farm, 0, 'carrot');
		expect(plant(farm, 0, 'carrot')).toBe(false);
		expect(farm.seeds.carrot).toBe(2);
	});
});

describe('chicken', () => {
	it('lays an egg a while after being fed', () => {
		const farm = newFarm();
		expect(chicken(farm, 0)).toBe('hungry');
		expect(collectEgg(farm, 0)).toBe(false);
		feed(farm, 0);
		expect(feed(farm, 1)).toBe(false);
		expect(chicken(farm, EGG.layMs - 1)).toBe('eating');
		expect(chicken(farm, EGG.layMs)).toBe('egg');
		expect(collectEgg(farm, EGG.layMs)).toBe(true);
		expect(farm.basket.egg).toBe(1);
		expect(chicken(farm, EGG.layMs)).toBe('hungry');
	});
});

describe('market', () => {
	it('sells from the basket and buys seeds', () => {
		const farm = newFarm();
		farm.basket.pumpkin = 1;
		expect(sell(farm, 'pumpkin')).toBe(true);
		expect(sell(farm, 'pumpkin')).toBe(false);
		expect(farm.coins).toBe(5 + CROPS.pumpkin.sellPrice);

		farm.coins = 2;
		expect(buy(farm, 'pumpkin')).toBe(false);
		expect(buy(farm, 'strawberry')).toBe(true);
		expect(farm.coins).toBe(0);
		expect(farm.seeds.strawberry).toBe(1);
	});
});

describe('rescue', () => {
	it('gives a seed only when there is nothing else to do', () => {
		const farm = newFarm();
		expect(rescue(farm)).toBe(false);
		farm.coins = 0;
		farm.seeds.carrot = 0;
		expect(rescue(farm)).toBe(true);
		expect(farm.seeds.carrot).toBe(1);
	});
});

describe('parseFarm', () => {
	it('round-trips a farm', () => {
		const farm = newFarm();
		plant(farm, 4, 'carrot');
		water(farm, 4, 123);
		feed(farm, 456);
		expect(parseFarm(JSON.stringify(farm))).toEqual(farm);
	});

	it('starts afresh from nothing or junk', () => {
		expect(parseFarm(null)).toEqual(newFarm());
		expect(parseFarm('{oops')).toEqual(newFarm());
		expect(parseFarm('{"version":99}')).toEqual(newFarm());
	});

	it('cleans up bad values', () => {
		const farm = parseFarm(
			JSON.stringify({ version: 1, coins: -3, seeds: { carrot: 'x' }, plots: [{ crop: 'cake' }] })
		);
		expect(farm.coins).toBe(0);
		expect(farm.seeds.carrot).toBe(0);
		expect(farm.plots.every((p) => p === null)).toBe(true);
	});
});
