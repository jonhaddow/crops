<script lang="ts">
	import DPad from '#lib/DPad.svelte';
	import {
		buy,
		collectEgg,
		CROP_NAMES,
		CROPS,
		feed,
		harvest,
		parseFarm,
		plant,
		PRODUCE,
		rescue,
		sell,
		sellPrice,
		water,
		type Crop,
		type Produce
	} from '#lib/game.ts';
	import { play } from '#lib/sound.ts';
	import { World } from '#lib/world/engine.ts';
	import { label, type Target } from '#lib/world/interact.ts';
	import { PLOTS, type Dir } from '#lib/world/map.ts';
	import { icon, spriteUrl, type Icon } from '#lib/world/sprites.ts';
	import { onMount } from 'svelte';

	const KEY = 'crops-farm';

	const farm = $state(parseFarm(localStorage.getItem(KEY)));
	rescue(farm);
	$effect(() => localStorage.setItem(KEY, JSON.stringify(farm)));

	let canvas: HTMLCanvasElement;
	let world: World;
	let hint = $state<Target | null>(null);
	/** What someone's saying: lines shown one at a time. */
	let dialog = $state<string[] | null>(null);
	let picking = $state<number | null>(null);
	let marketOpen = $state(false);
	/**
	 * Whether the last tap started on a pop-up's backdrop. A acts on finger
	 * down, so the click that follows can land on the pop-up it just opened;
	 * only a tap that starts on the backdrop closes it.
	 */
	let backdropDown = false;
	const backdrop = {
		onpointerdown: (e: PointerEvent) => (backdropDown = e.target === e.currentTarget),
		onclick: (e: MouseEvent) => {
			if (backdropDown && e.target === e.currentTarget) closeAll();
		}
	};

	const busy = $derived(dialog !== null || picking !== null || marketOpen);
	$effect(() => {
		if (world) world.paused = busy;
	});

	const urls: Partial<Record<Icon, string>> = {};
	function img(name: Icon) {
		return (urls[name] ??= spriteUrl(icon(name)));
	}

	function steer(dir: Dir | null) {
		world.held = dir;
	}

	function refresh() {
		hint = world.target(Date.now());
	}

	onMount(() => {
		world = new World(canvas, farm, refresh);
		world.resize();
		world.start();
		refresh();
		const observer = new ResizeObserver(() => world.resize());
		observer.observe(canvas);
		// Crops ripen and eggs get laid without the player moving.
		const timer = setInterval(refresh, 300);
		return () => {
			world.stop();
			observer.disconnect();
			clearInterval(timer);
		};
	});

	function say(...lines: string[]) {
		dialog = lines;
		play('talk');
	}

	function pressA() {
		if (dialog) {
			dialog = dialog.length > 1 ? dialog.slice(1) : null;
			if (dialog) play('talk');
			return;
		}
		if (busy) return;
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
			case 'chicken':
				if (t.action === 'feed') {
					feed(farm, now);
					play('cluck');
				} else if (t.action === 'collect') {
					collectEgg(farm, now);
					play('pop');
					world.float(world.henSpot(), 'egg', '+1');
				} else play('cluck');
				break;
			case 'horse':
				world.mount();
				play('neigh');
				break;
			case 'dismount':
				if (!world.dismount()) play('nope');
				break;
			case 'npc':
				world.faceNpc(t.npc.id);
				say(...t.npc.says);
				break;
			case 'shop':
				world.faceNpc('shopkeeper');
				marketOpen = true;
				play('talk');
				break;
			case 'well':
				say('You drop a coin-shaped pebble in the well...', 'Plop! You make a wish.');
				break;
			case 'home':
				say('Home sweet home!', 'Your farm saves all by itself.');
				break;
			case 'house':
				say('Knock knock!', "Nobody's home right now.");
				break;
			case 'stable':
				say('The stable smells of hay.', 'Your horse is out in the paddock.');
				break;
		}
		refresh();
	}

	function pick(crop: Crop) {
		if (picking !== null && plant(farm, picking, crop)) play('plant');
		picking = null;
		refresh();
	}

	function sellOne(item: Produce) {
		if (!sell(farm, item)) return;
		play('coin');
	}

	function buyOne(crop: Crop) {
		if (buy(farm, crop)) play('plant');
		else play('nope');
	}

	function closeAll() {
		picking = null;
		marketOpen = false;
		dialog = null;
		rescue(farm);
		refresh();
	}

	// Keyboard too: arrows or WASD, and Space, Enter or Z for A.
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
			world.held = dir;
			e.preventDefault();
		} else if (e.key === ' ' || e.key === 'Enter' || e.key === 'z') {
			if (!e.repeat) pressA();
			e.preventDefault();
		} else if (e.key === 'Escape') closeAll();
	}

	function keyup(e: KeyboardEvent) {
		if (KEYS[e.key] === world.held) world.held = null;
	}

	const noSeeds = $derived(CROP_NAMES.every((c) => farm.seeds[c] === 0));
	const aLabel = $derived(dialog ? 'Next' : label(hint));
</script>

<svelte:window onkeydown={keydown} onkeyup={keyup} />

<canvas
	bind:this={canvas}
	data-testid="world"
	data-x={farm.player.x}
	data-y={farm.player.y}
	data-facing={farm.player.facing}
	data-riding={farm.riding}
></canvas>

<div class="hud">
	<div class="panel coins" aria-label="{farm.coins} coins">
		<img src={img('coin')} alt="" />
		<span class="num" data-testid="coins">{farm.coins}</span>
	</div>
	<div class="panel basket" aria-label="Basket">
		{#each PRODUCE as item (item)}
			<span class="item" class:none={farm.basket[item] === 0}>
				<img src={img(item)} alt="" />
				<span class="num" data-testid="basket-{item}">{farm.basket[item]}</span>
			</span>
		{/each}
	</div>
</div>

<div class="controls">
	<DPad onchange={steer} />
	<div class="a-wrap">
		{#if aLabel}<div class="a-label" data-testid="a-label">{aLabel}</div>{/if}
		<button
			class="a"
			class:idle={!aLabel}
			aria-label="A"
			onpointerdown={(e) => {
				e.preventDefault();
				pressA();
			}}>A</button
		>
	</div>
</div>

{#if dialog}
	<button class="dialog" onclick={pressA}>
		<span>{dialog[0]}</span>
		<span class="more">▼</span>
	</button>
{/if}

{#if picking !== null}
	<div class="overlay" role="presentation" {...backdrop}>
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
	<div class="overlay" role="presentation" {...backdrop}>
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
				{#each PRODUCE as item (item)}
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

	.item.none {
		opacity: 0.4;
	}

	.controls {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		padding: 0 max(1.2rem, env(safe-area-inset-right)) max(1.2rem, env(safe-area-inset-bottom))
			max(1.2rem, env(safe-area-inset-left));
		pointer-events: none;
	}

	.controls > :global(*) {
		pointer-events: auto;
	}

	.a-wrap {
		display: grid;
		justify-items: center;
		gap: 0.5rem;
	}

	.a {
		--s: min(20vmin, 8rem);
		width: var(--s);
		height: var(--s);
		border-radius: 50%;
		background: #d9413d;
		color: #fff;
		font-size: 2.6rem;
		touch-action: none;
	}

	.a.idle {
		background: #a0605e;
	}

	.a-label {
		padding: 0.1rem 0.8rem;
		background: var(--card);
		border: var(--outline);
		border-radius: 6px;
		font-size: 1.5rem;
	}

	/* What people say: a text box along the bottom. */
	.dialog {
		position: fixed;
		left: 50%;
		translate: -50% 0;
		bottom: max(1.2rem, env(safe-area-inset-bottom));
		width: min(60vw, 40rem);
		min-height: 6rem;
		padding: 1rem 1.4rem;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		text-align: left;
		font-size: 1.7rem;
		line-height: 1.25;
		border-radius: 6px;
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

	@media (orientation: portrait) {
		.basket {
			flex-direction: column;
			gap: 0.3rem;
		}
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
</style>
