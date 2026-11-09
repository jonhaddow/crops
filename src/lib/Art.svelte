<script lang="ts" module>
	export type ArtKind =
		| 'carrot'
		| 'strawberry'
		| 'pumpkin'
		| 'egg'
		| 'coin'
		| 'sprout'
		| 'seed'
		| 'drop'
		| 'chicken'
		| 'stall'
		| 'basket'
		| 'grain'
		| 'nest';
</script>

<script lang="ts">
	import type { Crop } from './game.ts';

	// All the farm's pictures, drawn on a 100×100 grid with a thick ink outline.
	// `growing` draws a half-grown plant of `kind`'s crop.
	let {
		kind,
		growing = false,
		size = '100%'
	}: { kind: ArtKind; growing?: boolean; size?: string } = $props();

	const crop = $derived(
		growing && ['carrot', 'strawberry', 'pumpkin'].includes(kind) ? (kind as Crop) : null
	);
</script>

<svg
	viewBox="0 0 100 100"
	width={size}
	height={size}
	aria-hidden="true"
	stroke="var(--ink)"
	stroke-width="4"
	stroke-linejoin="round"
	stroke-linecap="round"
>
	{#if crop}
		<!-- Half grown: a leafy bush, with a peek of what's coming. -->
		<path d="M50 82 Q30 60 22 40 Q40 46 50 70 Q60 46 78 40 Q70 60 50 82Z" fill="var(--leaf)" />
		<path d="M50 80 Q44 50 50 22 Q56 50 50 80Z" fill="var(--leaf-light)" />
		{#if crop === 'carrot'}
			<path d="M38 84 Q50 74 62 84Z" fill="var(--carrot)" />
		{:else if crop === 'strawberry'}
			<circle cx="30" cy="66" r="7" fill="#fff" />
			<circle cx="30" cy="66" r="2" fill="var(--sun)" stroke="none" />
			<circle cx="70" cy="64" r="6" fill="var(--berry-light)" />
		{:else}
			<circle cx="70" cy="72" r="10" fill="var(--leaf-light)" />
			<path d="M70 62 v-6" />
		{/if}
	{:else if kind === 'carrot'}
		<path d="M50 94 L30 40 Q50 30 70 40 Z" fill="var(--carrot)" />
		<path d="M40 52 h8 M44 64 h8 M46 76 h6" stroke-width="3" />
		<path d="M50 36 Q34 18 28 6 Q44 12 50 36Z" fill="var(--leaf)" />
		<path d="M50 36 Q50 14 56 2 Q62 20 50 36Z" fill="var(--leaf-light)" />
		<path d="M50 36 Q64 18 76 12 Q70 28 50 36Z" fill="var(--leaf)" />
	{:else if kind === 'strawberry'}
		<path d="M50 94 C18 72 14 42 28 32 Q50 24 72 32 C86 42 82 72 50 94Z" fill="var(--berry)" />
		<g fill="var(--sun)" stroke="none">
			<ellipse cx="38" cy="48" rx="2.5" ry="3.5" />
			<ellipse cx="60" cy="46" rx="2.5" ry="3.5" />
			<ellipse cx="50" cy="60" rx="2.5" ry="3.5" />
			<ellipse cx="36" cy="64" rx="2.5" ry="3.5" />
			<ellipse cx="64" cy="64" rx="2.5" ry="3.5" />
			<ellipse cx="50" cy="78" rx="2.5" ry="3.5" />
		</g>
		<path
			d="M24 30 L38 30 L42 16 L50 28 L58 16 L62 30 L76 30 L62 38 L50 34 L38 38Z"
			fill="var(--leaf)"
		/>
		<path d="M50 28 V12" />
	{:else if kind === 'pumpkin'}
		<path d="M48 30 Q46 18 54 10" stroke-width="7" />
		<path d="M48 30 Q46 18 54 10" stroke="var(--wood)" stroke-width="3" />
		<ellipse cx="50" cy="62" rx="44" ry="32" fill="var(--pumpkin)" />
		<ellipse cx="50" cy="62" rx="24" ry="32" fill="var(--pumpkin)" />
		<ellipse cx="50" cy="62" rx="7" ry="32" fill="var(--pumpkin-light)" />
		<path d="M56 22 Q72 10 80 24 Q66 30 56 22Z" fill="var(--leaf)" />
	{:else if kind === 'egg'}
		<ellipse cx="50" cy="56" rx="28" ry="36" fill="var(--egg)" />
		<ellipse cx="40" cy="42" rx="6" ry="9" fill="#fff" stroke="none" />
	{:else if kind === 'coin'}
		<circle cx="50" cy="50" r="42" fill="var(--sun)" />
		<circle cx="50" cy="50" r="31" fill="var(--sun-light)" stroke-width="3" />
		<path
			d="M50 30 L56 44 L71 45 L59 55 L63 70 L50 61 L37 70 L41 55 L29 45 L44 44Z"
			fill="var(--sun)"
			stroke-width="3"
		/>
	{:else if kind === 'sprout'}
		<path d="M50 84 V54" stroke-width="5" />
		<path d="M50 60 Q30 62 24 42 Q44 38 50 60Z" fill="var(--leaf-light)" />
		<path d="M50 56 Q66 56 76 36 Q54 32 50 56Z" fill="var(--leaf)" />
	{:else if kind === 'seed'}
		<path d="M24 82 Q50 56 76 82Z" fill="var(--soil-dry)" />
		<ellipse cx="42" cy="74" rx="4" ry="6" fill="var(--seed)" stroke-width="2.5" />
		<ellipse cx="58" cy="72" rx="4" ry="6" fill="var(--seed)" stroke-width="2.5" />
	{:else if kind === 'drop'}
		<path d="M50 8 Q80 50 78 64 A28 28 0 0 1 22 64 Q20 50 50 8Z" fill="var(--water)" />
		<path d="M36 62 Q36 74 46 78" stroke="#fff" stroke-width="5" />
	{:else if kind === 'chicken'}
		<path d="M78 82 L74 94 M66 84 L62 96" stroke-width="5" stroke="var(--carrot)" />
		<path d="M30 70 Q8 56 14 26 Q28 40 36 44Z" fill="#fff" />
		<ellipse cx="54" cy="64" rx="32" ry="24" fill="#fff" />
		<path d="M38 60 Q54 52 66 64 Q52 80 38 60Z" fill="var(--egg)" stroke-width="3" />
		<path d="M70 26 Q72 14 78 18 Q80 8 86 16 Q92 12 90 26Z" fill="var(--berry)" />
		<circle cx="78" cy="38" r="16" fill="#fff" />
		<path d="M92 36 L102 42 L92 46Z" fill="var(--sun)" stroke-width="3" />
		<circle cx="82" cy="35" r="3" fill="var(--ink)" stroke="none" />
		<path d="M88 50 Q92 58 86 60 Q82 54 88 50Z" fill="var(--berry)" stroke-width="2.5" />
	{:else if kind === 'nest'}
		<path d="M6 60 Q50 100 94 60 Q50 74 6 60Z" fill="var(--straw)" />
		<path d="M14 66 L30 72 M40 74 L58 74 M70 72 L86 66" stroke-width="3" />
	{:else if kind === 'grain'}
		<g fill="var(--seed)" stroke-width="3">
			<ellipse cx="34" cy="60" rx="8" ry="11" transform="rotate(-20 34 60)" />
			<ellipse cx="56" cy="50" rx="8" ry="11" transform="rotate(15 56 50)" />
			<ellipse cx="68" cy="72" rx="8" ry="11" transform="rotate(-10 68 72)" />
			<ellipse cx="44" cy="80" rx="8" ry="11" transform="rotate(30 44 80)" />
		</g>
	{:else if kind === 'basket'}
		<path d="M24 44 Q50 0 76 44" fill="none" stroke-width="7" />
		<path d="M24 44 Q50 0 76 44" fill="none" stroke="var(--straw)" stroke-width="3" />
		<path d="M10 44 H90 L80 90 H20Z" fill="var(--straw)" />
		<path d="M14 58 H86 M17 74 H83 M36 44 L38 90 M64 44 L62 90" stroke-width="3" />
	{:else if kind === 'stall'}
		<path d="M14 50 V94 M86 50 V94" stroke-width="7" />
		<rect x="18" y="64" width="64" height="30" fill="var(--wood)" />
		<path d="M18 76 H82" stroke-width="3" />
		<path d="M4 50 L14 14 H86 L96 50Z" fill="#fff" />
		<path
			d="M14 14 L4 50 H22 L26 14Z M38 14 L40 50 H58 L56 14Z M74 14 L76 50 H96 L86 14Z"
			fill="var(--berry)"
		/>
		<circle cx="34" cy="60" r="7" fill="var(--carrot)" />
		<circle cx="52" cy="60" r="7" fill="var(--berry)" />
		<circle cx="68" cy="60" r="7" fill="var(--pumpkin)" />
	{/if}
</svg>

<style>
	svg {
		display: block;
		overflow: visible;
	}
</style>
