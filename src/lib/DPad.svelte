<script lang="ts">
	import type { Dir } from './world/map.ts';

	// A thumb-sized D-pad. The direction comes from where the finger is on it,
	// so sliding round it without lifting changes direction.
	let { onchange }: { onchange: (dir: Dir | null) => void } = $props();

	let pad: HTMLDivElement;
	let dir = $state<Dir | null>(null);
	let pointer: number | null = null;

	function set(d: Dir | null) {
		if (d === dir) return;
		dir = d;
		onchange(d);
	}

	function fromPoint(e: PointerEvent) {
		const r = pad.getBoundingClientRect();
		const dx = e.clientX - (r.left + r.width / 2);
		const dy = e.clientY - (r.top + r.height / 2);
		// A small dead zone in the middle.
		if (Math.hypot(dx, dy) < r.width * 0.1) return set(null);
		set(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
	}

	function down(e: PointerEvent) {
		e.preventDefault();
		pointer = e.pointerId;
		pad.setPointerCapture(e.pointerId);
		fromPoint(e);
	}

	function move(e: PointerEvent) {
		if (e.pointerId === pointer) fromPoint(e);
	}

	function up(e: PointerEvent) {
		if (e.pointerId !== pointer) return;
		pointer = null;
		set(null);
	}
</script>

<div
	class="pad"
	bind:this={pad}
	role="group"
	aria-label="Move"
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	oncontextmenu={(e) => e.preventDefault()}
>
	{#each ['up', 'down', 'left', 'right'] as const as d (d)}
		<div class="arm {d}" class:on={dir === d} data-testid="pad-{d}">
			<span></span>
		</div>
	{/each}
	<div class="hub"></div>
</div>

<style>
	.pad {
		--s: min(30vmin, 13rem);
		position: relative;
		width: var(--s);
		height: var(--s);
		touch-action: none;
	}

	.arm,
	.hub {
		position: absolute;
		width: 34%;
		height: 34%;
		background: #4b4f58;
		border: 4px solid var(--ink);
	}

	.hub {
		left: 33%;
		top: 33%;
		border: none;
		width: 34%;
		height: 34%;
		margin: 0;
		box-shadow:
			0 -4px 0 0 #4b4f58,
			0 4px 0 0 #4b4f58;
	}

	.up {
		left: 33%;
		top: 0;
		border-bottom: none;
		border-radius: 8px 8px 0 0;
	}

	.down {
		left: 33%;
		bottom: 0;
		border-top: none;
		border-radius: 0 0 8px 8px;
		box-shadow: 0 6px 0 var(--ink);
	}

	.left {
		left: 0;
		top: 33%;
		border-right: none;
		border-radius: 8px 0 0 8px;
		box-shadow: 0 6px 0 var(--ink);
	}

	.right {
		right: 0;
		top: 33%;
		border-left: none;
		border-radius: 0 8px 8px 0;
		box-shadow: 0 6px 0 var(--ink);
	}

	.on {
		background: #2f323a;
	}

	/* Arrow marks. */
	.arm span {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 0;
		height: 0;
		translate: -50% -50%;
		border: 0.6rem solid transparent;
	}

	.up span {
		border-bottom-color: #c9ccd3;
		border-top-width: 0;
	}

	.down span {
		border-top-color: #c9ccd3;
		border-bottom-width: 0;
	}

	.left span {
		border-right-color: #c9ccd3;
		border-left-width: 0;
	}

	.right span {
		border-left-color: #c9ccd3;
		border-right-width: 0;
	}
</style>
