// Finding the way: the shortest walk (breadth first, tile by tile) from the
// player to a tile, or to stand next to something and face it.
import { H, STEP, W, type Dir, type Spot } from './map.ts';

export type Route = { steps: Dir[]; face: Dir | null };

const DIRS = Object.keys(STEP) as Dir[];

/**
 * The shortest route from `from` to any tile where `goal` gives a direction to
 * face (or null to keep facing as you are). Null if there's no way there.
 */
export function route(
	from: Spot,
	blocked: (x: number, y: number) => boolean,
	goal: (x: number, y: number) => Dir | null | undefined
): Route | null {
	const came = new Map<number, { prev: number; dir: Dir }>();
	const key = (x: number, y: number) => y * W + x;
	const start = key(from.x, from.y);
	const queue = [start];
	const seen = new Set([start]);
	for (let i = 0; i < queue.length; i++) {
		const k = queue[i];
		const x = k % W;
		const y = Math.floor(k / W);
		const face = goal(x, y);
		if (face !== undefined) {
			const steps: Dir[] = [];
			for (let c = k; c !== start;) {
				const step = came.get(c)!;
				steps.unshift(step.dir);
				c = step.prev;
			}
			return { steps, face };
		}
		for (const d of DIRS) {
			const nx = x + STEP[d].x;
			const ny = y + STEP[d].y;
			if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
			const n = key(nx, ny);
			if (seen.has(n) || blocked(nx, ny)) continue;
			seen.add(n);
			came.set(n, { prev: k, dir: d });
			queue.push(n);
		}
	}
	return null;
}

/** A goal of standing on `to`. */
export function onto(to: Spot) {
	return (x: number, y: number) => (x === to.x && y === to.y ? null : undefined);
}

/** A goal of standing next to any of `tiles` (not on one), facing it. */
export function beside(tiles: Spot[]) {
	const set = new Set(tiles.map((t) => `${t.x},${t.y}`));
	return (x: number, y: number): Dir | null | undefined => {
		if (set.has(`${x},${y}`)) return undefined;
		for (const d of DIRS) if (set.has(`${x + STEP[d].x},${y + STEP[d].y}`)) return d;
		return undefined;
	};
}
