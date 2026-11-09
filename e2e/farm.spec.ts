import { expect, test, type Page } from '@playwright/test';

type Save = Record<string, unknown>;

const base = {
	version: 2,
	coins: 5,
	seeds: { carrot: 3, strawberry: 0, pumpkin: 0 },
	basket: { carrot: 0, strawberry: 0, pumpkin: 0, egg: 0 },
	plots: Array(9).fill(null),
	fedAt: null,
	riding: false,
	horse: { x: 34, y: 25 }
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
}

const label = (page: Page) => page.getByTestId('a-label');
const pressA = (page: Page) => page.getByRole('button', { name: 'A' }).tap();

test('plant, water and pick a carrot', async ({ page }) => {
	// At the field's gate, facing the middle top plot.
	await start(page, { ...base, player: { x: 5, y: 9, facing: 'down' } });
	await expect(label(page)).toHaveText('Plant');
	await pressA(page);
	await page.getByRole('button', { name: 'Plant Carrot' }).tap();
	await expect(label(page)).toHaveText('Water');
	await pressA(page);
	await expect(label(page)).toHaveText('Growing');
	await page.clock.fastForward('01:05');
	await expect(label(page)).toHaveText('Pick');
	await pressA(page);
	await expect(page.getByTestId('basket-carrot')).toHaveText('1');
	await expect(label(page)).toHaveText('Plant');
});

test('feed the chicken and collect its egg', async ({ page }) => {
	// In the pen, facing the coop.
	await start(page, { ...base, player: { x: 13, y: 12, facing: 'up' } });
	await expect(label(page)).toHaveText('Feed');
	await page.keyboard.press('Space');
	await page.clock.fastForward('02:05');
	await expect(label(page)).toHaveText('Egg!');
	await page.keyboard.press('Space');
	await expect(page.getByTestId('basket-egg')).toHaveText('1');
});

test('sell at the market stall and buy seeds; it all survives a reload', async ({ page }) => {
	await start(page, {
		...base,
		basket: { carrot: 1, strawberry: 0, pumpkin: 0, egg: 1 },
		player: { x: 26, y: 13, facing: 'up' }
	});
	await expect(label(page)).toHaveText('Shop');
	await pressA(page);
	await page.getByRole('button', { name: 'Sell carrot' }).tap();
	await page.getByRole('button', { name: 'Sell egg' }).tap();
	await expect(page.getByRole('button', { name: 'Sell egg' })).toBeDisabled();
	await page.getByRole('button', { name: 'Buy pumpkin seed' }).tap();
	await page.getByRole('button', { name: 'Close' }).tap();
	await expect(page.getByTestId('coins')).toHaveText('6');

	await page.reload();
	await expect(page.getByTestId('coins')).toHaveText('6');
	await expect(page.getByTestId('world')).toHaveAttribute('data-x', '26');
});

test('talk to a villager', async ({ page }) => {
	await start(page, { ...base, player: { x: 20, y: 17, facing: 'left' } });
	await expect(label(page)).toHaveText('Talk');
	await page.keyboard.press('Space');
	await expect(page.getByText('Have you met the horse?')).toBeVisible();
	await page.keyboard.press('Space');
	await expect(page.getByText('The stable is down the road')).toBeVisible();
	await page.keyboard.press('Space');
	await expect(page.getByText('The stable is down the road')).toBeHidden();
});

test('ride the horse and hop off', async ({ page }) => {
	await start(page, { ...base, player: { x: 33, y: 25, facing: 'right' } });
	const world = page.getByTestId('world');
	await expect(label(page)).toHaveText('Ride');
	await page.keyboard.press('Space');
	await expect(world).toHaveAttribute('data-riding', 'true');
	await expect(world).toHaveAttribute('data-x', '34');
	await expect(label(page)).toHaveText('Hop off');

	// Ride up until the stable's fence stops us.
	await page.keyboard.down('ArrowUp');
	await expect(world).toHaveAttribute('data-y', '23');
	await page.waitForTimeout(400);
	await page.keyboard.up('ArrowUp');
	await expect(world).toHaveAttribute('data-y', '23');

	await page.keyboard.press('Space');
	await expect(world).toHaveAttribute('data-riding', 'false');
	await expect(label(page)).not.toHaveText('Hop off');
});

test('a save from before the village keeps its farm', async ({ page }) => {
	const old = { ...base, version: 1, coins: 9 } as Save;
	delete old.riding;
	delete old.horse;
	await start(page, old);
	await expect(page.getByTestId('coins')).toHaveText('9');
	await expect(page.getByTestId('world')).toHaveAttribute('data-x', '6');
});
