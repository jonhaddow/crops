<script lang="ts">
	import Art from '#lib/Art.svelte';
	import {
		buy,
		chicken,
		collectEgg,
		CROP_NAMES,
		CROPS,
		feed,
		harvest,
		parseFarm,
		plant,
		PRODUCE,
		progress,
		rescue,
		sell,
		sellPrice,
		stage,
		water,
		type Crop,
		type Produce
	} from '#lib/game.ts';
	import { play } from '#lib/sound.ts';

	const KEY = 'crops-farm';

	const farm = $state(parseFarm(localStorage.getItem(KEY)));
	rescue(farm);
	let now = $state(Date.now());

	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
	$effect(() => localStorage.setItem(KEY, JSON.stringify(farm)));

	/** The plot whose seed picker is open. */
	let picking = $state<number | null>(null);
	let marketOpen = $state(false);
	let wiggle = $state<number | null>(null);

	type Floater = { id: number; x: number; y: number; art: Produce | 'coin'; text: string };
	let floaters = $state<Floater[]>([]);
	let nextId = 0;

	function float(e: MouseEvent, art: Floater['art'], text: string) {
		const id = nextId++;
		floaters.push({ id, x: e.clientX, y: e.clientY, art, text });
		setTimeout(() => (floaters = floaters.filter((f) => f.id !== id)), 1000);
	}

	function tapPlot(i: number, e: MouseEvent) {
		now = Date.now();
		const s = stage(farm.plots[i], now);
		if (s === 'empty') {
			picking = i;
		} else if (s === 'thirsty') {
			water(farm, i, now);
			play('water');
		} else if (s === 'ripe') {
			const crop = harvest(farm, i, now);
			if (crop) {
				play('pop');
				float(e, crop, '+1');
			}
		} else {
			// Still growing: a wiggle says "not yet".
			wiggle = i;
			setTimeout(() => (wiggle = null), 400);
		}
	}

	function pick(crop: Crop) {
		if (picking !== null && plant(farm, picking, crop)) play('plant');
		picking = null;
	}

	function tapChicken(e: MouseEvent) {
		now = Date.now();
		if (collectEgg(farm, now)) {
			play('pop');
			float(e, 'egg', '+1');
		} else if (feed(farm, now)) {
			play('cluck');
		}
	}

	function sellOne(item: Produce, e: MouseEvent) {
		if (!sell(farm, item)) return;
		play('coin');
		float(e, 'coin', `+${sellPrice(item)}`);
	}

	function buyOne(crop: Crop) {
		if (buy(farm, crop)) play('plant');
		else play('nope');
	}

	function closeMarket() {
		marketOpen = false;
		rescue(farm);
	}

	const hen = $derived(chicken(farm, now));
	const noSeeds = $derived(CROP_NAMES.every((c) => farm.seeds[c] === 0));
</script>

<main>
	<header>
		<div class="coins" aria-label="{farm.coins} coins">
			<Art kind="coin" size="2.6rem" />
			<span data-testid="coins">{farm.coins}</span>
		</div>
		<button class="market-btn" onclick={() => (marketOpen = true)}>
			<Art kind="stall" size="3.4rem" />
			<span>Market</span>
		</button>
	</header>

	<section class="field" aria-label="Field">
		{#each farm.plots as plot, i (i)}
			{@const s = stage(plot, now)}
			<button
				class="plot {s}"
				class:wet={plot?.wateredAt != null}
				class:wiggle={wiggle === i}
				aria-label={plot ? `${CROPS[plot.crop].name}, ${s}` : 'Empty plot'}
				onclick={(e) => tapPlot(i, e)}
			>
				{#if plot}
					<div class="plant">
						{#if s === 'thirsty'}
							<Art kind="seed" />
						{:else if s === 'sprout'}
							<Art kind="sprout" />
						{:else if s === 'growing'}
							<Art kind={plot.crop} growing />
						{:else}
							<Art kind={plot.crop} />
						{/if}
					</div>
					{#if s === 'thirsty'}
						<div class="bubble"><Art kind="drop" /></div>
					{:else if s !== 'ripe'}
						<div class="bar"><div style="width: {progress(plot, now) * 100}%"></div></div>
					{/if}
				{/if}
			</button>
		{/each}
	</section>

	<aside>
		<button class="coop is-{hen}" aria-label="Chicken, {hen}" onclick={tapChicken}>
			{#if hen === 'hungry'}
				<div class="think"><Art kind="grain" /></div>
			{/if}
			<div class="hen"><Art kind="chicken" /></div>
			<div class="nest">
				<Art kind="nest" />
				{#if hen === 'egg'}
					<div class="egg"><Art kind="egg" /></div>
				{/if}
			</div>
			{#if hen === 'eating'}
				<div class="grain"><Art kind="grain" /></div>
			{/if}
		</button>

		<div class="basket" aria-label="Basket">
			<div class="basket-icon"><Art kind="basket" /></div>
			{#each PRODUCE as item (item)}
				<div class="item" class:none={farm.basket[item] === 0}>
					<Art kind={item} size="2.4rem" />
					<span data-testid="basket-{item}">{farm.basket[item]}</span>
				</div>
			{/each}
		</div>
	</aside>
</main>

{#if picking !== null}
	<div class="overlay" role="presentation" onclick={() => (picking = null)}>
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
						<Art kind={crop} size="5rem" />
						<span class="count">{farm.seeds[crop]}</span>
					</button>
				{/each}
			</div>
			{#if noSeeds}
				<button
					class="go-market"
					onclick={() => {
						picking = null;
						marketOpen = true;
					}}
				>
					<Art kind="stall" size="3rem" /> Buy seeds
				</button>
			{/if}
		</div>
	</div>
{/if}

{#if marketOpen}
	<div class="overlay" role="presentation" onclick={closeMarket}>
		<div
			class="card market"
			role="dialog"
			aria-label="Market"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
		>
			<button class="close" aria-label="Close" onclick={closeMarket}>✕</button>
			<div class="coins in-card">
				<Art kind="coin" size="2.6rem" />
				<span>{farm.coins}</span>
			</div>

			<h2>Sell</h2>
			<div class="rows">
				{#each PRODUCE as item (item)}
					<button
						class="row"
						disabled={farm.basket[item] === 0}
						aria-label="Sell {item}"
						onclick={(e) => sellOne(item, e)}
					>
						<Art kind={item} size="3.4rem" />
						<span class="have">×{farm.basket[item]}</span>
						<span class="price"><Art kind="coin" size="1.8rem" />{sellPrice(item)}</span>
					</button>
				{/each}
			</div>

			<h2>Buy seeds</h2>
			<div class="rows">
				{#each CROP_NAMES as crop (crop)}
					<button
						class="row seedrow"
						disabled={farm.coins < CROPS[crop].seedPrice}
						aria-label="Buy {crop} seed"
						onclick={() => buyOne(crop)}
					>
						<span class="mini-packet"><Art kind={crop} size="2.8rem" /></span>
						<span class="have">×{farm.seeds[crop]}</span>
						<span class="price"><Art kind="coin" size="1.8rem" />{CROPS[crop].seedPrice}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}

{#each floaters as f (f.id)}
	<div class="floater" style="left: {f.x}px; top: {f.y}px">
		<Art kind={f.art} size="3rem" />
		<span>{f.text}</span>
	</div>
{/each}

<style>
	main {
		height: 100dvh;
		display: grid;
		grid-template:
			'head head' auto
			'field side' 1fr / auto 1fr;
		gap: 2dvh 3vw;
		padding: max(2dvh, env(safe-area-inset-top)) 3vw 3dvh;
		align-items: center;
	}

	header {
		grid-area: head;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.coins {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--card);
		border: var(--outline);
		border-radius: 999px;
		padding: 0.25rem 1.4rem 0.25rem 0.4rem;
		font-size: 2.4rem;
		line-height: 1;
	}

	.market-btn {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 1.4rem 0.4rem 0.8rem;
		font-size: 2rem;
	}

	/* The field: a 3×3 patch of soil in a wooden frame. */
	.field {
		grid-area: field;
		--size: min(58vw, 100dvh - 9rem);
		width: var(--size);
		height: var(--size);
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 3%;
		padding: 3%;
		background: var(--wood);
		border: var(--outline);
		border-radius: 28px;
		box-shadow:
			inset 0 0 0 6px var(--wood-dark),
			var(--lift);
	}

	.plot {
		position: relative;
		border-radius: 18%;
		background: repeating-linear-gradient(
			var(--soil-dry) 0 18%,
			color-mix(in srgb, var(--soil-dry), var(--ink) 15%) 18% 22%
		);
		box-shadow: inset 0 -6px 0 rgb(0 0 0 / 0.15);
	}

	.plot:active {
		box-shadow: inset 0 -6px 0 rgb(0 0 0 / 0.15);
	}

	.plot.wet {
		background: repeating-linear-gradient(
			var(--soil-wet) 0 18%,
			color-mix(in srgb, var(--soil-wet), var(--ink) 25%) 18% 22%
		);
	}

	.plant {
		position: absolute;
		inset: 10%;
	}

	.ripe .plant {
		animation: bob 1.2s ease-in-out infinite;
	}

	.wiggle .plant {
		animation: wiggle 0.4s;
	}

	.bubble {
		position: absolute;
		top: -8%;
		right: -6%;
		width: 42%;
		padding: 6%;
		background: #fff;
		border: var(--outline);
		border-radius: 50%;
		animation: bob 1.4s ease-in-out infinite;
	}

	.bar {
		position: absolute;
		left: 14%;
		right: 14%;
		bottom: 7%;
		height: 9%;
		background: var(--card);
		border: 3px solid var(--ink);
		border-radius: 999px;
		overflow: hidden;
	}

	.bar div {
		height: 100%;
		background: var(--leaf-light);
		transition: width 1s linear;
	}

	aside {
		grid-area: side;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 3dvh;
		justify-content: center;
	}

	/* The coop: chicken, nest and (when hungry) a thought bubble. */
	.coop {
		position: relative;
		flex: 1;
		max-height: 46dvh;
		background:
			linear-gradient(transparent 70%, var(--straw) 70%),
			repeating-linear-gradient(90deg, var(--wood) 0 30px, var(--wood-dark) 30px 34px);
		border-radius: 28px 28px 22px 22px;
	}

	.hen {
		position: absolute;
		left: 12%;
		bottom: 8%;
		width: 52%;
	}

	.is-eating .hen {
		animation: peck 0.6s ease-in-out infinite;
		transform-origin: 40% 90%;
	}

	.nest {
		position: absolute;
		right: 6%;
		bottom: 4%;
		width: 34%;
	}

	.egg {
		position: absolute;
		left: 25%;
		bottom: 34%;
		width: 50%;
		animation: bob 1.2s ease-in-out infinite;
	}

	.grain {
		position: absolute;
		left: 52%;
		bottom: 4%;
		width: 14%;
	}

	.think {
		position: absolute;
		left: 46%;
		top: 6%;
		width: 22%;
		padding: 3%;
		background: #fff;
		border: var(--outline);
		border-radius: 50%;
		animation: bob 1.4s ease-in-out infinite;
	}

	.basket {
		display: flex;
		align-items: center;
		justify-content: space-around;
		gap: 0.4rem;
		padding: 0.6rem 1rem;
		background: var(--card);
		border: var(--outline);
		border-radius: 22px;
		font-size: 1.8rem;
	}

	.basket-icon {
		width: 3.4rem;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 0.15rem;
	}

	.item.none {
		opacity: 0.35;
	}

	/* Pop-up cards: the seed picker and the market. */
	.overlay {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgb(59 42 30 / 0.45);
		animation: fade 0.15s;
	}

	.card {
		position: relative;
		background: var(--card);
		border: var(--outline);
		border-radius: 32px;
		box-shadow: 0 10px 0 var(--ink);
		padding: 1.4rem 2rem 2rem;
		text-align: center;
		animation: pop 0.2s;
	}

	h2 {
		margin: 0 0 1rem;
		font-size: 2.2rem;
		line-height: 1.1;
	}

	.packets {
		display: flex;
		gap: 1.4rem;
	}

	.packet {
		position: relative;
		width: 9rem;
		height: 11rem;
		display: grid;
		place-items: center;
		background: linear-gradient(var(--sun-light) 0 70%, var(--straw) 70%);
		border-radius: 14px;
	}

	.count {
		position: absolute;
		right: -0.8rem;
		top: -0.8rem;
		min-width: 3rem;
		height: 3rem;
		display: grid;
		place-items: center;
		background: var(--leaf-light);
		border: var(--outline);
		border-radius: 999px;
		font-size: 1.8rem;
	}

	.go-market {
		margin-top: 1.4rem;
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 1.4rem 0.4rem 0.8rem;
		font-size: 1.8rem;
	}

	.market {
		width: min(94vw, 46rem);
		max-height: 94dvh;
		overflow: auto;
	}

	.close {
		position: absolute;
		right: 1rem;
		top: 1rem;
		width: 3.6rem;
		height: 3.6rem;
		border-radius: 50%;
		font-size: 1.8rem;
	}

	.coins.in-card {
		position: absolute;
		left: 1rem;
		top: 1rem;
		font-size: 2rem;
	}

	.market h2 {
		margin-top: 0.6rem;
	}

	.rows {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 1rem;
		margin-bottom: 1.4rem;
	}

	.row {
		display: grid;
		justify-items: center;
		gap: 0.2rem;
		padding: 0.6rem 0.4rem 0.4rem;
		font-size: 1.6rem;
	}

	.have {
		line-height: 1;
	}

	.price {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.1rem 0.8rem 0.1rem 0.3rem;
		background: var(--sun-light);
		border: 3px solid var(--ink);
		border-radius: 999px;
	}

	.mini-packet {
		padding: 0.3rem;
		background: linear-gradient(var(--sun-light) 0 70%, var(--straw) 70%);
		border: 3px solid var(--ink);
		border-radius: 8px;
	}

	.floater {
		position: fixed;
		translate: -50% -50%;
		display: flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 2.4rem;
		-webkit-text-stroke: 1.5px var(--ink);
		color: #fff;
		pointer-events: none;
		animation: rise 1s ease-out forwards;
	}

	@media (orientation: portrait) {
		main {
			grid-template:
				'head' auto
				'field' auto
				'side' 1fr / 1fr;
			justify-items: center;
		}

		.field {
			--size: min(92vw, 58dvh);
		}

		header,
		aside {
			justify-self: stretch;
		}

		aside {
			flex-direction: row;
		}

		.hen {
			width: 40%;
		}

		.coop {
			max-height: none;
		}

		.basket {
			flex-direction: column;
			justify-content: center;
		}
	}

	@keyframes bob {
		50% {
			translate: 0 -6%;
		}
	}

	@keyframes wiggle {
		25% {
			rotate: -8deg;
		}
		75% {
			rotate: 8deg;
		}
	}

	@keyframes peck {
		50% {
			rotate: 14deg;
		}
	}

	@keyframes pop {
		from {
			scale: 0.8;
		}
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}

	@keyframes rise {
		to {
			translate: -50% -180%;
			opacity: 0;
		}
	}
</style>
