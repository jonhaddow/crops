// What's on a tile, and so what tapping it does: the player walks up to it,
// faces it, and acts. Pure, so it can be tested.
import { chicken, cow, sheep, stage, type Farm } from '../game.ts';
import { buildingAt, npcAt, plotAt, STEP, terrain, type Npc, type Spot } from './map.ts';

/** Where the animals are right now (they wander, so the engine knows). */
export type Animals = { chicken: Spot; cow: Spot; sheep: Spot };

export type Thing =
	| { kind: 'plot'; index: number; action: 'plant' | 'water' | 'pick' | 'wait' }
	| { kind: 'chicken'; action: 'feed' | 'collect' | 'wait' }
	| { kind: 'cow'; action: 'feed' | 'milk' | 'wait' }
	| { kind: 'sheep'; action: 'shear' | 'wait' }
	| { kind: 'horse' }
	| { kind: 'npc'; npc: Npc }
	| { kind: 'shop' }
	| { kind: 'water' }
	/** A building with nothing to do but look at: home, houses, the well, stable, barn. */
	| { kind: 'building'; id: string };

const at = (s: Spot, x: number, y: number) => s.x === x && s.y === y;

export function thingAt(
	farm: Farm,
	x: number,
	y: number,
	now: number,
	animals: Animals
): Thing | null {
	// The horse first, so it can always be ridden away, wherever it's left.
	if (!farm.riding && at(farm.horse, x, y)) return { kind: 'horse' };

	const plot = plotAt(x, y);
	if (plot >= 0) {
		const s = stage(farm.plots[plot], now);
		const action =
			s === 'empty' ? 'plant' : s === 'thirsty' ? 'water' : s === 'ripe' ? 'pick' : 'wait';
		return { kind: 'plot', index: plot, action };
	}

	const b = buildingAt(x, y);
	if (at(animals.chicken, x, y) || b?.kind === 'coop') {
		const c = chicken(farm, now);
		return { kind: 'chicken', action: c === 'hungry' ? 'feed' : c === 'egg' ? 'collect' : 'wait' };
	}
	if (at(animals.cow, x, y)) {
		const c = cow(farm, now);
		return { kind: 'cow', action: c === 'hungry' ? 'feed' : c === 'milk' ? 'milk' : 'wait' };
	}
	if (at(animals.sheep, x, y))
		return { kind: 'sheep', action: sheep(farm, now) === 'woolly' ? 'shear' : 'wait' };

	const npc = npcAt(x, y);
	if (npc) return npc.id === 'shopkeeper' ? { kind: 'shop' } : { kind: 'npc', npc };
	if (b?.kind === 'stall') return { kind: 'shop' };
	if (b) return { kind: 'building', id: b.id };
	if (terrain(x, y) === 'water') return { kind: 'water' };
	return null;
}

export function facingTile(farm: Farm): Spot {
	const s = STEP[farm.player.facing];
	return { x: farm.player.x + s.x, y: farm.player.y + s.y };
}

/** What's in front of the player. */
export function target(farm: Farm, now: number, animals: Animals): Thing | null {
	const f = facingTile(farm);
	return thingAt(farm, f.x, f.y, now, animals);
}

/**
 * The tiles to stand next to, to reach what was tapped at (x, y): all of a
 * building (so any side will do), the nearby water for fishing, or just the
 * tile itself.
 */
export function reachTiles(x: number, y: number): Spot[] {
	const b = buildingAt(x, y);
	if (b)
		return Array.from({ length: b.w * b.h }, (_, i) => ({
			x: b.x + (i % b.w),
			y: b.y + Math.floor(i / b.w)
		}));
	if (terrain(x, y) === 'water') {
		const near: Spot[] = [];
		for (let dy = -3; dy <= 3; dy++)
			for (let dx = -3; dx <= 3; dx++)
				if (Math.abs(dx) + Math.abs(dy) <= 3 && terrain(x + dx, y + dy) === 'water')
					near.push({ x: x + dx, y: y + dy });
		return near;
	}
	return [{ x, y }];
}
