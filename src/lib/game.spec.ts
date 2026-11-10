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
	water,
	amount,
	catchFor,
	COW,
	feedCow,
	fulfil,
	milk,
	REQUEST_GAP_MS,
	REQUESTERS,
	sellPrice,
	shear,
	SHEEP,
	updateRequests,
	ANIMALS,
	buyAnimal,
	buyLand,
	nextLand,
	sellAnimal,
	START_PLOTS,
	LAND
} from './game.ts';
import { PLOTS } from './world/map.ts';

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
		expect(farm.coins).toBe(5 + sellPrice('pumpkin'));

		farm.coins = 2;
		expect(buy(farm, 'pumpkin')).toBe(false);
		expect(buy(farm, 'strawberry')).toBe(true);
		expect(farm.coins).toBe(0);
		expect(farm.seeds.strawberry).toBe(1);
	});
});

describe('cow, sheep and fishing', () => {
	it('milks a fed cow and shears a woolly sheep', () => {
		const farm = newFarm();
		expect(milk(farm, 0)).toBe(false);
		feedCow(farm, 0);
		expect(milk(farm, COW.milkMs)).toBe(true);
		expect(farm.basket.milk).toBe(1);
		expect(shear(farm, 0)).toBe(true);
		expect(shear(farm, SHEEP.woolMs - 1)).toBe(false);
		expect(shear(farm, SHEEP.woolMs)).toBe(true);
		expect(farm.basket.wool).toBe(2);
	});

	it('catches mostly fish, sometimes something else', () => {
		expect(catchFor(0.01)).toBe('boot');
		expect(catchFor(0.1)).toBe('goldfish');
		expect(catchFor(0.3)).toBe('bigfish');
		expect(catchFor(0.9)).toBe('fish');
	});
});

describe('requests', () => {
	it('asks, then pays more than the market once it has what it wants', () => {
		const farm = newFarm();
		// First item (carrot), count 2.
		updateRequests(farm, 0, () => 0.4);
		const [id] = REQUESTERS;
		const req = farm.requests[id]!;
		expect(req.count).toBeGreaterThan(0);
		expect(req.reward).toBeGreaterThan(req.count * sellPrice(req.item));
		expect(fulfil(farm, id, 0)).toBe(0);
		farm.basket[req.item] = req.count;
		expect(fulfil(farm, id, 0)).toBe(req.reward);
		expect(farm.basket[req.item]).toBe(0);
		expect(farm.coins).toBe(5 + req.reward);
		// A rest before the next one.
		updateRequests(farm, REQUEST_GAP_MS - 1);
		expect(farm.requests[id]).toBeNull();
		updateRequests(farm, REQUEST_GAP_MS);
		expect(farm.requests[id]).not.toBeNull();
	});

	it('says amounts nicely', () => {
		expect(amount('strawberry', 3)).toBe('3 strawberries');
		expect(amount('milk', 1)).toBe('1 bottle of milk');
		expect(amount('fish', 2)).toBe('2 fish');
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

describe('animals for sale', () => {
	it('buys animals up to a limit, and sells all but the last', () => {
		const farm = newFarm();
		farm.coins = ANIMALS.cow.price - 1;
		expect(buyAnimal(farm, 'cow')).toBe(false);
		farm.coins = 100;
		expect(buyAnimal(farm, 'cow')).toBe(true);
		expect(farm.coins).toBe(100 - ANIMALS.cow.price);
		expect(farm.animals.cow).toEqual([null, null]);
		expect(buyAnimal(farm, 'cow')).toBe(true);
		expect(buyAnimal(farm, 'cow')).toBe(false);
		expect(sellAnimal(farm, 'cow', 0)).toBe(true);
		expect(sellAnimal(farm, 'cow', 0)).toBe(true);
		expect(sellAnimal(farm, 'cow', 0)).toBe(false);
		expect(farm.animals.cow).toHaveLength(1);
		expect(farm.coins).toBe(100 - 2 * ANIMALS.cow.price + 2 * ANIMALS.cow.sellPrice);
	});

	it('hands over what an animal has ready before it goes', () => {
		const farm = newFarm();
		farm.coins = 100;
		buyAnimal(farm, 'chicken');
		feed(farm, 0, 1);
		expect(sellAnimal(farm, 'chicken', EGG.layMs)).toBe(true);
		expect(farm.basket.egg).toBe(1);
		buyAnimal(farm, 'sheep');
		expect(sellAnimal(farm, 'sheep', 0)).toBe(true);
		expect(farm.basket.wool).toBe(1);
	});

	it('looks after each animal separately', () => {
		const farm = newFarm();
		farm.coins = 100;
		buyAnimal(farm, 'chicken');
		feed(farm, 0, 1);
		expect(chicken(farm, EGG.layMs, 0)).toBe('hungry');
		expect(chicken(farm, EGG.layMs, 1)).toBe('egg');
		expect(collectEgg(farm, EGG.layMs, 1)).toBe(true);
		expect(feed(farm, 0, 5)).toBe(false);
		expect(shear(farm, 0, 1)).toBe(false);
	});
});

describe('land', () => {
	it('sells exactly the plots the map has', () => {
		expect(LAND.at(-1)!.plots).toBe(PLOTS.length);
		expect(LAND[0].plots).toBeGreaterThan(START_PLOTS);
	});

	it('keeps only whole strips of land from a save', () => {
		const farm = parseFarm(JSON.stringify({ version: 4, plots: Array(14).fill(null) }));
		expect(farm.plots).toHaveLength(START_PLOTS);
	});

	it('grows the field four plots at a time', () => {
		const farm = newFarm();
		expect(farm.plots).toHaveLength(START_PLOTS);
		farm.coins = 14;
		expect(buyLand(farm)).toBe(false);
		farm.coins = 100;
		expect(buyLand(farm)).toBe(true);
		expect(farm.plots).toHaveLength(16);
		expect(buyLand(farm)).toBe(true);
		expect(farm.plots).toHaveLength(20);
		expect(nextLand(farm)).toBe(null);
		expect(buyLand(farm)).toBe(false);
		expect(farm.coins).toBe(60);
	});
});

describe('parseFarm', () => {
	it('upgrades a version 3 save: crops stay put, animals carry on', () => {
		const plots = Array(9).fill(null);
		plots[0] = { crop: 'pumpkin', wateredAt: 7 }; // (4, 10)
		plots[8] = { crop: 'carrot', wateredAt: null }; // (6, 12)
		const farm = parseFarm(
			JSON.stringify({ version: 3, plots, fedAt: 1, cowFedAt: null, shornAt: 3 })
		);
		expect(farm.plots).toHaveLength(START_PLOTS);
		expect(farm.plots[1]).toEqual(plots[0]);
		expect(farm.plots[11]).toEqual(plots[8]);
		expect(farm.plots.filter(Boolean)).toHaveLength(2);
		expect(farm.animals).toEqual({ chicken: [1], sheep: [3], cow: [null] });
	});

	it('keeps bought land and animals, within limits', () => {
		const farm = parseFarm(
			JSON.stringify({
				version: 4,
				plots: Array(16).fill(null),
				animals: { chicken: [1, null, 'x', 4, 5, 6], sheep: [], cow: 'oops' }
			})
		);
		expect(farm.plots).toHaveLength(16);
		expect(farm.animals).toEqual({ chicken: [1, null, null, 4], sheep: [null], cow: [null] });
	});

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
