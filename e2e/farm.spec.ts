import { expect, test } from '@playwright/test';

test('grow, collect, sell and buy, and it all survives a reload', async ({ page }) => {
	await page.clock.install();
	await page.goto('/');
	// Let time run (taps wait on animation frames), jumping ahead where needed.
	await page.clock.resume();
	const coins = page.getByTestId('coins');
	await expect(coins).toHaveText('5');

	// Plant a carrot, water it, wait for it to grow, then pick it.
	await page.getByRole('button', { name: 'Empty plot' }).first().tap();
	await page.getByRole('button', { name: 'Plant Carrot' }).tap();
	const carrot = page.getByRole('button', { name: /^Carrot/ });
	await expect(carrot).toHaveAccessibleName('Carrot, thirsty');
	await carrot.tap();
	await expect(carrot).toHaveAccessibleName('Carrot, sprout');
	await page.clock.fastForward('01:05');
	await expect(carrot).toHaveAccessibleName('Carrot, ripe');
	await carrot.tap();
	await expect(page.getByTestId('basket-carrot')).toHaveText('1');

	// Feed the chicken and collect its egg.
	await page.getByRole('button', { name: 'Chicken, hungry' }).tap();
	await page.clock.fastForward('02:05');
	await page.getByRole('button', { name: 'Chicken, egg' }).tap();
	await expect(page.getByTestId('basket-egg')).toHaveText('1');

	// Sell both, then buy a pumpkin seed.
	await page.getByRole('button', { name: 'Market' }).tap();
	await page.getByRole('button', { name: 'Sell carrot' }).tap();
	await page.getByRole('button', { name: 'Sell egg' }).tap();
	await expect(page.getByRole('button', { name: 'Sell egg' })).toBeDisabled();
	await page.getByRole('button', { name: 'Buy pumpkin seed' }).tap();
	await page.getByRole('button', { name: 'Close' }).tap();
	await expect(coins).toHaveText('6');

	await page.reload();
	await expect(coins).toHaveText('6');
	await page.getByRole('button', { name: 'Empty plot' }).first().tap();
	await expect(page.getByRole('button', { name: 'Plant Pumpkin' })).toBeEnabled();
});
