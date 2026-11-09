<script lang="ts">
	import '@fontsource-variable/pixelify-sans';
	import '@fontsource/press-start-2p/latin-400.css';
	import '../app.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

{@render children()}
