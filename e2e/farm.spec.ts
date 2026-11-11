import { expect, test, type Page } from '@playwright/test';

type Save = Record<string, unknown>;

const base = {
	version: 3,
	coins: 5,
	seeds: { carrot: 3, strawberry: 0, pumpkin: 0 },
	basket: {},
	plots: Array(9).fill(null),
	fedAt: null,
	riding: false,
	horse: { x: 34, y: 25 },
	// Nobody asks for anything for now.
	requestAt: { rosie: 9e15, sam: 9e15, grandpa: 9e15 }
};

/** Opens the game with a save, once (later reloads keep what the game saved). */
async function start(page: Page, save: Save) {
	await page.clock.install();
	await page.addInitScript((s) => {
		if (sessionStorage.getItem('seeded')) return;
		sessionStorage.setItem('seeded', '1');
		localStorage.setItem('crops-farm', s);
	}, JSON.stringify(save));
	await page.goto('/');
	// Let time run (taps wait on animation frames), jumping ahead where needed.
	await page.clock.resume();
	await page.waitForFunction(() => 'world' in window);
	// The camera finds the player on the first frame: taps before it miss.
	await page.evaluate(
		() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
	);
}

type Spot = { x: number; y: number };
type WorldHandle = {
	busy(): boolean;
	screenOf(x: number, y: number): Spot;
	animals(): Record<'chicken' | 'cow' | 'sheep', Spot[]>;
};

/** Taps a map tile on the screen. */
async function tapTile(page: Page, x: number, y: number) {
	const at = await page.evaluate(
		([x, y]) => (window as unknown as { world: WorldHandle }).world.screenOf(x, y),
		[x, y]
	);
	await page.touchscreen.tap(at.x, at.y);
	// Wait until the walk (and whatever it does on arrival) is done.
	await page.waitForFunction(() => !(window as unknown as { world: WorldHandle }).world.busy());
}

async function tapAnimal(page: Page, which: 'chicken' | 'cow' | 'sheep') {
	const at = await page.evaluate(
		(w) => (window as unknown as { world: WorldHandle }).world.animals()[w][0],
		which
	);
	await tapTile(page, at.x, at.y);
}

const basket = (page: Page, item: string) => page.getByTestId(`basket-${item}`);

test('walk into the field, plant, water and pick a carrot', async ({ page }) => {
	await start(page, { ...base, player: { x: 6, y: 8, facing: 'down' } });
	await tapTile(page, 5, 11);
	await page.getByRole('button', { name: 'Plant Carrot' }).tap();
	await tapTile(page, 5, 11);
	await page.clock.fastForward('01:05');
	await tapTile(page, 5, 11);
	await expect(basket(page, 'carrot')).toHaveText('1');
});

test('feed the chicken and collect its egg', async ({ page }) => {
	await start(page, { ...base, player: { x: 12, y: 13, facing: 'up' } });
	await tapTile(page, 12, 10); // the coop
	await page.clock.fastForward('02:05');
	await tapTile(page, 12, 10);
	await expect(basket(page, 'egg')).toHaveText('1');
});

test('shear the sheep and milk the cow', async ({ page }) => {
	await start(page, { ...base, player: { x: 17, y: 26, facing: 'up' } });
	await tapAnimal(page, 'sheep');
	await expect(basket(page, 'wool')).toHaveText('1');
	await tapAnimal(page, 'cow'); // feeds it
	await page.clock.fastForward('03:05');
	await tapAnimal(page, 'cow');
	await expect(basket(page, 'milk')).toHaveText('1');
});

test('go fishing', async ({ page }) => {
	await start(page, { ...base, player: { x: 12, y: 22, facing: 'left' } });
	await tapTile(page, 10, 23);
	await expect(page.getByTestId('fishing')).toHaveText('Wait for the splash...');
	await page.clock.fastForward('00:06');
	await expect(page.getByTestId('fishing')).toHaveText('Tap now!');
	await page.touchscreen.tap(400, 400);
	await expect(page.getByTestId('fishing')).toBeHidden();
	await expect(page.getByText('Empty', { exact: true })).toBeHidden();
});

test('the basket folds away', async ({ page }) => {
	await start(page, { ...base, basket: { carrot: 2, egg: 3 } });
	await page.getByRole('button', { name: 'Basket' }).tap();
	await expect(page.getByTestId('basket-total')).toHaveText('5');
	await expect(basket(page, 'carrot')).toBeHidden();
	await page.getByRole('button', { name: 'Basket' }).tap();
	await expect(basket(page, 'carrot')).toHaveText('2');
});

test('bring a villager what they asked for', async ({ page }) => {
	await start(page, {
		...base,
		basket: { carrot: 2 },
		requests: { rosie: { item: 'carrot', count: 2, reward: 6 } },
		player: { x: 21, y: 17, facing: 'left' }
	});
	await tapTile(page, 19, 17);
	await expect(page.getByText('2 carrots! Thank you!')).toBeVisible();
	await expect(page.getByTestId('coins')).toHaveText('11');
});

test('sell at the market stall and buy seeds; it all survives a reload', async ({ page }) => {
	await start(page, {
		...base,
		basket: { carrot: 1, egg: 1 },
		player: { x: 22, y: 15, facing: 'up' }
	});
	await tapTile(page, 26, 11);
	await page.getByRole('button', { name: 'Sell carrot' }).tap();
	await page.getByRole('button', { name: 'Sell egg' }).tap();
	await expect(page.getByRole('button', { name: 'Sell egg' })).toBeDisabled();
	await page.getByRole('button', { name: 'Buy pumpkin seed' }).tap();
	await page.getByRole('button', { name: 'Close' }).tap();
	await expect(page.getByTestId('coins')).toHaveText('6');

	const world = page.getByTestId('world');
	const y = await world.getAttribute('data-y');
	await page.reload();
	await expect(page.getByTestId('coins')).toHaveText('6');
	await expect(world).toHaveAttribute('data-y', y!);
});

test('buy a cow, more land, and sell a hen', async ({ page }) => {
	await start(page, {
		...base,
		version: 4,
		coins: 40,
		plots: Array(12).fill(null),
		animals: { chicken: [null, null], sheep: [null], cow: [null] },
		player: { x: 22, y: 15, facing: 'up' }
	});
	await tapTile(page, 26, 11);
	await page.getByRole('button', { name: 'Buy a cow' }).tap();
	await page.getByRole('button', { name: 'Buy land' }).tap();
	await page.getByRole('button', { name: 'Sell a chicken' }).tap();
	await expect(page.getByRole('button', { name: 'Sell a chicken' })).toBeDisabled();
	await expect(page.getByTestId('coins')).toHaveText(String(40 - 20 - 15 + 5));
	await page.getByRole('button', { name: 'Close' }).tap();
	await expect
		.poll(() =>
			page.evaluate(() => (window as unknown as { world: WorldHandle }).world.animals().cow.length)
		)
		.toBe(2);
	// The new land can be planted.
	// (In short hops: a tap has to land on the screen.)
	await tapTile(page, 17, 15);
	await tapTile(page, 9, 14);
	await tapTile(page, 4, 13);
	await expect(page.getByRole('dialog', { name: 'Plant a seed' })).toBeVisible();
});

test('the builder upgrades the house and builds a statue', async ({ page }) => {
	await start(page, {
		...base,
		version: 4,
		coins: 200,
		plots: Array(12).fill(null),
		player: { x: 22, y: 18, facing: 'right' }
	});
	await tapTile(page, 24, 18);
	await page.getByRole('button', { name: 'Build Window boxes' }).tap();
	await expect(page.getByText('Bang, bang, bang... all done!')).toBeVisible();
	await expect(page.getByTestId('coins')).toHaveText('170');
	await page.getByText('Bang, bang, bang... all done!').tap();
	await page.getByText('Go and look at your house!').tap();
	await tapTile(page, 24, 18);
	// The next upgrade is offered, and the statue is too dear to build twice.
	await expect(page.getByRole('button', { name: 'Build A porch' })).toBeVisible();
	await page.getByRole('button', { name: 'Build a horse statue' }).tap();
	await expect(page.getByTestId('coins')).toHaveText('20');
	await page.getByText('Bang, bang, bang... all done!').tap();
	await page.getByText('Go and look at the statue!').tap();
	await tapTile(page, 26, 23);
	await expect(page.getByText('A golden horse!')).toBeVisible();
});

test('ride the horse and hop off', async ({ page }) => {
	await start(page, { ...base, player: { x: 32, y: 25, facing: 'right' } });
	const world = page.getByTestId('world');
	await tapTile(page, 34, 25);
	await expect(world).toHaveAttribute('data-riding', 'true');
	await tapTile(page, 30, 25);
	await expect(world).toHaveAttribute('data-x', '30');
	await page.getByRole('button', { name: 'Hop off' }).tap();
	await expect(world).toHaveAttribute('data-riding', 'false');
});

test('old saves keep their farm', async ({ page }) => {
	await start(page, { version: 1, coins: 9, seeds: { carrot: 1 }, plots: [], fedAt: null });
	await expect(page.getByTestId('coins')).toHaveText('9');
	await expect(page.getByTestId('world')).toHaveAttribute('data-x', '6');
});
