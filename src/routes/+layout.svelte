<script lang="ts">
	import '@fontsource-variable/baloo-2';
	import '../app.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

{@render children()}
