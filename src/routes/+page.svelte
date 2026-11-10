<script lang="ts">
	import {
		amount,
		ANIMAL_NAMES,
		ANIMALS,
		buy,
		buyAnimal,
		buyLand,
		catchFor,
		collectEgg,
		CROP_NAMES,
		CROPS,
		feed,
		feedCow,
		fulfil,
		harvest,
		milk,
		nextLand,
		parseFarm,
		plant,
		PRODUCE,
		rescue,
		sell,
		sellAnimal,
		sellPrice,
		shear,
		updateRequests,
		water,
		type Animal,
		type Crop,
		type Produce
	} from '#lib/game.ts';
	import { play } from '#lib/sound.ts';
	import { World } from '#lib/world/engine.ts';
	import { facingTile, reachTiles, thingAt } from '#lib/world/interact.ts';
	import { NPCS, open, PLOTS, type Dir, type Spot } from '#lib/world/map.ts';
	import { beside, onto } from '#lib/world/path.ts';
	import {
		chicken as chickenSprite,
		cow as cowSprite,
		icon,
		sheep as sheepSprite,
		spriteUrl,
		type Icon
	} from '#lib/world/sprites.ts';
	import { onMount } from 'svelte';

	const KEY = 'crops-farm';

	const farm = $state(parseFarm(localStorage.getItem(KEY)));
	rescue(farm);
	updateRequests(farm, Date.now());
	$effect(() => localStorage.setItem(KEY, JSON.stringify(farm)));

	let canvas: HTMLCanvasElement;
	let world: World;
	/** What someone's saying: lines shown one at a time. */
	let dialog = $state<string[] | null>(null);
	let picking = $state<number | null>(null);
	let marketOpen = $state(false);
	/**
	 * What the market lists: what was in the basket when it opened. Rows stay
	 * put (greyed out once sold) so repeated taps don't sell the next thing.
	 */
	let forSale = $state<Produce[]>([]);
	/** Likewise for animals: kinds there's more than one of (the last one stays). */
	let animalsForSale = $state<Animal[]>([]);
	/** Fishing: waiting for a bite, or a fish is biting (tap now!). */
	let fishing = $state<'wait' | 'bite' | null>(null);
	let fishTimer: ReturnType<typeof setTimeout> | undefined;

	const busy = $derived(dialog !== null || picking !== null || marketOpen);
	$effect(() => {
		if (world) world.paused = busy;
	});

	const urls: Partial<Record<Icon, string>> = {};
	function img(name: Icon) {
		return (urls[name] ??= spriteUrl(icon(name)));
	}

	const animalImg: Record<Animal, string> = {
		chicken: spriteUrl(chickenSprite(false)),
		cow: spriteUrl(cowSprite(false)),
		sheep: spriteUrl(sheepSprite(true))
	};

	onMount(() => {
		world = new World(canvas, farm);
		world.resize();
		world.start();
		const observer = new ResizeObserver(() => world.resize());
		observer.observe(canvas);
		// Villagers think of new things to ask for.
		const timer = setInterval(() => updateRequests(farm, Date.now()), 1000);
		if (import.meta.env.DEV) (window as unknown as { world: World }).world = world;
		return () => {
			world.stop();
			observer.disconnect();
			clearInterval(timer);
			clearTimeout(fishTimer);
		};
	});

	function say(...lines: string[]) {
		dialog = lines;
		play('talk');
	}

	function nextLine() {
		dialog = dialog && dialog.length > 1 ? dialog.slice(1) : null;
		if (dialog) play('talk');
	}

	/** A tap on the world: walk there, or walk up to what was tapped and use it. */
	function tap(e: MouseEvent) {
		if (dialog) return nextLine();
		if (fishing) return reel();
		if (busy) return;
		const tile = world.tileAt(e.clientX, e.clientY);
		const p = farm.player;
		if (tile.x === p.x && tile.y === p.y) return;
		const thing = thingAt(farm, tile.x, tile.y, Date.now(), world.animals());
		const goal = thing || !open(tile.x, tile.y) ? beside(reachTiles(tile.x, tile.y)) : onto(tile);
		const go = () => world.walkTo(goal, tile, thing ? act : undefined);
		// A horse can't go everywhere (not onto the crops): hop off and walk.
		if (go() || (farm.riding && world.dismount() && go())) play('step');
		else play('nope');
	}

	/** Uses whatever's in front of the player. */
	function act() {
		const now = Date.now();
		const t = world.target(now);
		if (!t) return;
		switch (t.kind) {
			case 'plot': {
				const spot = PLOTS[t.index];
				if (t.action === 'plant') picking = t.index;
				else if (t.action === 'water') {
					water(farm, t.index, now);
					play('water');
				} else if (t.action === 'pick') {
					const crop = harvest(farm, t.index, now);
					if (crop) {
						play('pop');
						world.float(spot, crop, '+1');
					}
				} else play('nope');
				break;
			}
			case 'land':
				say('This land is for sale!', 'Buy it at the market to grow more.');
				break;
			case 'chicken':
				if (t.action === 'feed') {
					feed(farm, now, t.index);
					play('cluck');
				} else if (t.action === 'collect') {
					collectEgg(farm, now, t.index);
					play('pop');
					world.float(world.animals().chicken[t.index], 'egg', '+1');
				} else play('cluck');
				break;
			case 'cow':
				if (t.action === 'feed') {
					feedCow(farm, now, t.index);
					play('moo');
				} else if (t.action === 'milk') {
					milk(farm, now, t.index);
					play('pop');
					world.float(world.animals().cow[t.index], 'milk', '+1');
				} else play('moo');
				break;
			case 'sheep':
				if (t.action === 'shear') {
					shear(farm, now, t.index);
					play('pop');
					world.float(world.animals().sheep[t.index], 'wool', '+1');
				} else play('baa');
				break;
			case 'horse':
				world.mount();
				play('neigh');
				break;
			case 'npc':
				talk(t.npc.id, now);
				break;
			case 'shop':
				world.faceNpc('shopkeeper');
				forSale = basketItems;
				animalsForSale = ANIMAL_NAMES.filter((a) => farm.animals[a].length > 1);
				marketOpen = true;
				play('talk');
				break;
			case 'water':
				startFishing();
				break;
			case 'building':
				say(...(LOOKS[t.id] ?? LOOKS.house));
				break;
		}
	}

	const LOOKS: Record<string, string[]> = {
		home: ['Home sweet home!', 'Your farm saves all by itself.'],
		house: ['Knock knock!', "Nobody's home right now."],
		well: ['You drop a pebble in the well...', 'Plop! You make a wish.'],
		stable: ['The stable smells of hay.', 'Your horse is out in the paddock.'],
		barn: ['Moo! Baa!', 'The cows and sheep live here.', 'You can buy more at the market.']
	};

	/** A villager: hands over what they asked for, or says what they'd like. */
	function talk(id: string, now: number) {
		world.faceNpc(id);
		const npc = NPCS.find((n) => n.id === id)!;
		const req = farm.requests[id];
		if (!req) return say(...npc.says);
		const reward = fulfil(farm, id, now);
		if (reward) {
			play('coin');
			world.float(npc, 'coin', `+${reward}`);
			say(`${amount(req.item, req.count)}! Thank you!`, `Here are ${reward} coins.`);
		} else {
			say(
				`Could you bring me ${amount(req.item, req.count)}?`,
				`I'll give you ${req.reward} coins!`
			);
		}
	}

	function startFishing() {
		const s = world.target(Date.now());
		if (s?.kind !== 'water') return;
		world.fishing = { tile: facingTile(farm), bite: false };
		play('water');
		waitForBite();
	}

	function waitForBite() {
		fishing = 'wait';
		if (world.fishing) world.fishing.bite = false;
		clearTimeout(fishTimer);
		fishTimer = setTimeout(
			() => {
				fishing = 'bite';
				if (world.fishing) world.fishing.bite = true;
				play('splash');
				// Too slow: it gets away, and another comes along.
				fishTimer = setTimeout(waitForBite, 1500);
			},
			2000 + Math.random() * 3000
		);
	}

	function reel() {
		if (fishing === 'wait') {
			// Too soon: the fish swims off, and you wait again.
			play('nope');
			waitForBite();
			return;
		}
		const caught = catchFor(Math.random());
		farm.basket[caught]++;
		const at: Spot = world.fishing?.tile ?? farm.player;
		stopFishing();
		play('pop');
		world.float(at, caught, '+1');
		if (caught === 'goldfish') say('Wow, a golden fish!', 'They are very rare.');
		if (caught === 'boot') say('An old boot!', 'Well, somebody might buy it...');
	}

	function stopFishing() {
		clearTimeout(fishTimer);
		fishing = null;
		world.fishing = null;
	}

	function pick(crop: Crop) {
		if (picking !== null && plant(farm, picking, crop)) play('plant');
		picking = null;
	}

	function sellOne(item: Produce) {
		if (sell(farm, item)) play('coin');
	}

	function buyOne(crop: Crop) {
		if (buy(farm, crop)) play('plant');
		else play('nope');
	}

	function buyAnimalOne(kind: Animal) {
		if (buyAnimal(farm, kind)) play(kind === 'chicken' ? 'cluck' : kind === 'cow' ? 'moo' : 'baa');
		else play('nope');
	}

	function sellAnimalOne(kind: Animal) {
		if (sellAnimal(farm, kind, Date.now())) play('coin');
		else play('nope');
	}

	function buyLandOne() {
		if (buyLand(farm)) play('plant');
		else play('nope');
	}

	function closeAll() {
		picking = null;
		marketOpen = false;
		dialog = null;
		rescue(farm);
	}

	// Keyboard too: arrows or WASD to walk, Space or Enter to use what's in front.
	const KEYS: Record<string, Dir> = {
		ArrowUp: 'up',
		ArrowDown: 'down',
		ArrowLeft: 'left',
		ArrowRight: 'right',
		w: 'up',
		s: 'down',
		a: 'left',
		d: 'right'
	};

	function keydown(e: KeyboardEvent) {
		const dir = KEYS[e.key];
		if (dir) {
			if (fishing) stopFishing();
			world.cancelWalk();
			world.held = dir;
			e.preventDefault();
		} else if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			if (e.repeat) return;
			if (dialog) nextLine();
			else if (fishing) reel();
			else if (busy) return;
			else if (world.target(Date.now())) act();
			else if (farm.riding) world.dismount();
		} else if (e.key === 'Escape') {
			closeAll();
			if (fishing) stopFishing();
		}
	}

	function keyup(e: KeyboardEvent) {
		if (KEYS[e.key] === world.held) world.held = null;
	}

	const basketItems = $derived(PRODUCE.filter((p) => farm.basket[p] > 0));
	const noSeeds = $derived(CROP_NAMES.every((c) => farm.seeds[c] === 0));
	const land = $derived(nextLand(farm));
</script>

<svelte:window onkeydown={keydown} onkeyup={keyup} />

<canvas
	bind:this={canvas}
	data-testid="world"
	data-x={farm.player.x}
	data-y={farm.player.y}
	data-facing={farm.player.facing}
	data-riding={farm.riding}
	onclick={tap}
></canvas>

<div class="hud">
	<div class="panel coins" aria-label="{farm.coins} coins">
		<img src={img('coin')} alt="" />
		<span class="num" data-testid="coins">{farm.coins}</span>
	</div>
	<div class="panel basket" aria-label="Basket">
		{#each basketItems as item (item)}
			<span class="item">
				<img src={img(item)} alt="" />
				<span class="num" data-testid="basket-{item}">{farm.basket[item]}</span>
			</span>
		{:else}
			<span class="empty">Basket empty</span>
		{/each}
	</div>
</div>

{#if fishing}
	<div class="fishing panel" class:bite={fishing === 'bite'}>
		<span data-testid="fishing">{fishing === 'bite' ? 'Tap now!' : 'Wait for the splash...'}</span>
		<button class="stop" onclick={stopFishing}>Stop</button>
	</div>
{/if}

{#if farm.riding && !busy && !fishing}
	<button class="hop" onclick={() => world.dismount()}>Hop off</button>
{/if}

{#if dialog}
	<button class="dialog" onclick={nextLine}>
		<span>{dialog[0]}</span>
		<span class="more">▼</span>
	</button>
{/if}

{#if picking !== null}
	<div class="overlay" role="presentation" onclick={closeAll}>
		<div
			class="card"
			role="dialog"
			aria-label="Plant a seed"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
		>
			<h2>Plant a seed</h2>
			<div class="packets">
				{#each CROP_NAMES as crop (crop)}
					<button
						class="packet"
						disabled={farm.seeds[crop] === 0}
						aria-label="Plant {CROPS[crop].name}"
						onclick={() => pick(crop)}
					>
						<img src={img(crop)} alt="" />
						<span class="count num">{farm.seeds[crop]}</span>
					</button>
				{/each}
			</div>
			{#if noSeeds}
				<p>No seeds! Visit the market stall in the village.</p>
			{/if}
		</div>
	</div>
{/if}

{#if marketOpen}
	<div class="overlay" role="presentation" onclick={closeAll}>
		<div
			class="card market"
			role="dialog"
			aria-label="Market"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
		>
			<button class="close" aria-label="Close" onclick={closeAll}>✕</button>
			<div class="panel coins in-card">
				<img src={img('coin')} alt="" />
				<span class="num">{farm.coins}</span>
			</div>

			<h2>Sell</h2>
			<div class="rows">
				{#each forSale as item (item)}
					<button
						class="row"
						disabled={farm.basket[item] === 0}
						aria-label="Sell {item}"
						onclick={() => sellOne(item)}
					>
						<img class="big" src={img(item)} alt="" />
						<span class="num">×{farm.basket[item]}</span>
						<span class="price"
							><img src={img('coin')} alt="" /><span class="num">{sellPrice(item)}</span></span
						>
					</button>
				{/each}
				{#each animalsForSale as kind (kind)}
					<button
						class="row"
						disabled={farm.animals[kind].length <= 1}
						aria-label="Sell a {kind}"
						onclick={() => sellAnimalOne(kind)}
					>
						<img class="big" src={animalImg[kind]} alt="" />
						<span class="num">×{farm.animals[kind].length}</span>
						<span class="price"
							><img src={img('coin')} alt="" /><span class="num">{ANIMALS[kind].sellPrice}</span
							></span
						>
					</button>
				{/each}
				{#if !forSale.length && !animalsForSale.length}
					<p class="nothing">Nothing to sell yet.</p>
				{/if}
			</div>

			<h2>Buy seeds</h2>
			<div class="rows">
				{#each CROP_NAMES as crop (crop)}
					<button
						class="row"
						disabled={farm.coins < CROPS[crop].seedPrice}
						aria-label="Buy {crop} seed"
						onclick={() => buyOne(crop)}
					>
						<span class="mini-packet"><img src={img(crop)} alt="" /></span>
						<span class="num">×{farm.seeds[crop]}</span>
						<span class="price"
							><img src={img('coin')} alt="" /><span class="num">{CROPS[crop].seedPrice}</span
							></span
						>
					</button>
				{/each}
			</div>

			<h2>Buy for the farm</h2>
			<div class="rows">
				{#each ANIMAL_NAMES as kind (kind)}
					{@const full = farm.animals[kind].length >= ANIMALS[kind].max}
					<button
						class="row"
						disabled={full || farm.coins < ANIMALS[kind].price}
						aria-label="Buy a {kind}"
						onclick={() => buyAnimalOne(kind)}
					>
						<img class="big" src={animalImg[kind]} alt="" />
						<span class="num">×{farm.animals[kind].length}</span>
						{#if full}
							<span class="full">Full!</span>
						{:else}
							<span class="price"
								><img src={img('coin')} alt="" /><span class="num">{ANIMALS[kind].price}</span
								></span
							>
						{/if}
					</button>
				{/each}
				{#if land}
					<button
						class="row"
						disabled={farm.coins < land.price}
						aria-label="Buy land"
						onclick={buyLandOne}
					>
						<span class="mini-land"><img src={img('sprout')} alt="" /></span>
						<span class="num">+{land.plots - farm.plots.length}</span>
						<span class="price"
							><img src={img('coin')} alt="" /><span class="num">{land.price}</span></span
						>
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	canvas {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		touch-action: manipulation;
	}

	img {
		image-rendering: pixelated;
		width: 2rem;
		height: 2rem;
	}

	.panel {
		background: var(--card);
		border: var(--outline);
		border-radius: 6px;
		box-shadow: 0 4px 0 var(--ink);
	}

	.hud {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: max(0.8rem, env(safe-area-inset-top)) 1rem 0;
		pointer-events: none;
	}

	.coins {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.2rem 1rem 0.2rem 0.4rem;
		font-size: 2rem;
		line-height: 1;
	}

	.basket {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		max-width: 60vw;
		gap: 0.8rem;
		padding: 0.3rem 0.8rem;
		font-size: 1.6rem;
		line-height: 1;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.empty {
		font-size: 1.2rem;
		padding: 0.3rem 0;
	}

	/* Fishing: what to do, along the top. */
	.fishing {
		position: fixed;
		top: max(5rem, calc(env(safe-area-inset-top) + 4rem));
		left: 50%;
		translate: -50% 0;
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.4rem 0.6rem 0.4rem 1.2rem;
		font-size: 1.7rem;
	}

	.fishing.bite {
		background: var(--sun-light);
		animation: shake 0.2s infinite;
	}

	.stop {
		padding: 0.2rem 0.8rem;
		font-size: 1.3rem;
	}

	.hop {
		position: fixed;
		right: max(1.2rem, env(safe-area-inset-right));
		bottom: max(1.2rem, env(safe-area-inset-bottom));
		padding: 0.8rem 1.6rem;
		font-size: 1.8rem;
		background: #d9413d;
		color: #fff;
	}

	/* What people say: a text box along the bottom. */
	.dialog {
		position: fixed;
		left: 50%;
		translate: -50% 0;
		bottom: max(1.2rem, env(safe-area-inset-bottom));
		width: min(90vw, 40rem);
		min-height: 6rem;
		padding: 1rem 1.4rem;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		text-align: left;
		font-size: 1.7rem;
		line-height: 1.25;
	}

	.more {
		align-self: flex-end;
		animation: blink 0.8s steps(1) infinite;
	}

	.overlay {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgb(30 20 14 / 0.5);
	}

	.card {
		position: relative;
		background: var(--card);
		border: var(--outline);
		border-radius: 8px;
		box-shadow: 0 8px 0 var(--ink);
		padding: 1.2rem 2rem 1.6rem;
		text-align: center;
	}

	h2 {
		margin: 0 0 1rem;
		font-size: 2rem;
		line-height: 1.1;
	}

	p {
		font-size: 1.4rem;
		margin: 1.2rem 0 0;
	}

	.nothing {
		grid-column: 1 / -1;
		margin: 0;
	}

	.packets {
		display: flex;
		gap: 1.4rem;
	}

	.packet {
		position: relative;
		width: 8rem;
		height: 9.5rem;
		display: grid;
		place-items: center;
		background: linear-gradient(var(--straw-light) 0 70%, var(--straw) 70%);
	}

	.packet img {
		width: 4.5rem;
		height: 4.5rem;
	}

	.count {
		position: absolute;
		right: -0.8rem;
		top: -0.8rem;
		min-width: 2.8rem;
		height: 2.8rem;
		display: grid;
		place-items: center;
		background: var(--leaf-light);
		border: var(--outline);
		border-radius: 6px;
		font-size: 1.6rem;
	}

	.market {
		width: min(94vw, 44rem);
		max-height: 94dvh;
		overflow: auto;
	}

	.close {
		position: absolute;
		right: 0.8rem;
		top: 0.8rem;
		width: 3.4rem;
		height: 3.4rem;
		font-size: 1.6rem;
	}

	.in-card {
		position: absolute;
		left: 0.8rem;
		top: 0.8rem;
		font-size: 1.7rem;
		box-shadow: none;
	}

	.rows {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
		gap: 1rem;
		margin-bottom: 1.4rem;
	}

	.row {
		display: grid;
		justify-items: center;
		gap: 0.2rem;
		padding: 0.6rem 0.4rem 0.5rem;
		font-size: 1.5rem;
	}

	.row img.big {
		width: 3.2rem;
		height: 3.2rem;
	}

	.price {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0 0.6rem 0 0.2rem;
		background: var(--straw-light);
		border: 3px solid var(--ink);
		border-radius: 4px;
	}

	.price img {
		width: 1.6rem;
		height: 1.6rem;
	}

	.mini-packet {
		padding: 0.2rem;
		background: linear-gradient(var(--straw-light) 0 70%, var(--straw) 70%);
		border: 3px solid var(--ink);
		border-radius: 4px;
	}

	.mini-packet img {
		width: 2.6rem;
		height: 2.6rem;
	}

	.mini-land {
		padding: 0.2rem;
		background: var(--soil-dry);
		border: 3px solid var(--ink);
		border-radius: 4px;
	}

	.mini-land img {
		width: 2.6rem;
		height: 2.6rem;
	}

	.full {
		font-size: 1.2rem;
		line-height: 1.6rem;
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}

	@keyframes shake {
		25% {
			translate: -52% 0;
		}
		75% {
			translate: -48% 0;
		}
	}
</style>
