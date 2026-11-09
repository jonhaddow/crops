// What the A button does: it acts on the tile the player is facing.
import { chicken, stage, type Farm } from '../game.ts';
import { buildingAt, npcAt, plotAt, STEP, type Npc, type Spot } from './map.ts';

export type Target =
	| { kind: 'plot'; index: number; action: 'plant' | 'water' | 'pick' | 'wait' }
	| { kind: 'chicken'; action: 'feed' | 'collect' | 'wait' }
	| { kind: 'horse' }
	| { kind: 'dismount' }
	| { kind: 'npc'; npc: Npc }
	| { kind: 'shop' }
	| { kind: 'well' }
	| { kind: 'home' }
	| { kind: 'house' }
	| { kind: 'stable' };

export const LABELS: Record<string, string> = {
	plant: 'Plant',
	water: 'Water',
	pick: 'Pick',
	wait: 'Growing',
	feed: 'Feed',
	collect: 'Egg!',
	chickenwait: 'Cluck',
	horse: 'Ride',
	dismount: 'Hop off',
	npc: 'Talk',
	shop: 'Shop',
	well: 'Wish',
	home: 'Home',
	house: 'Knock',
	stable: 'Look'
};

export function label(t: Target | null): string {
	if (!t) return '';
	if (t.kind === 'plot') return LABELS[t.action];
	if (t.kind === 'chicken') return LABELS[t.action === 'wait' ? 'chickenwait' : t.action];
	return LABELS[t.kind];
}

export function facingTile(farm: Farm): Spot {
	const s = STEP[farm.player.facing];
	return { x: farm.player.x + s.x, y: farm.player.y + s.y };
}

/** What's in front of the player, given where the chicken is right now. */
export function target(farm: Farm, now: number, hen: Spot): Target | null {
	if (farm.riding) return { kind: 'dismount' };
	const { x, y } = facingTile(farm);

	const plot = plotAt(x, y);
	if (plot >= 0) {
		const s = stage(farm.plots[plot], now);
		const action =
			s === 'empty' ? 'plant' : s === 'thirsty' ? 'water' : s === 'ripe' ? 'pick' : 'wait';
		return { kind: 'plot', index: plot, action };
	}
	// The chicken itself, or its coop.
	if ((hen.x === x && hen.y === y) || buildingAt(x, y)?.kind === 'coop') {
		const c = chicken(farm, now);
		return { kind: 'chicken', action: c === 'hungry' ? 'feed' : c === 'egg' ? 'collect' : 'wait' };
	}
	if (farm.horse.x === x && farm.horse.y === y) return { kind: 'horse' };

	const npc = npcAt(x, y);
	if (npc) return npc.id === 'shopkeeper' ? { kind: 'shop' } : { kind: 'npc', npc };

	const b = buildingAt(x, y);
	if (b?.kind === 'stall') return { kind: 'shop' };
	if (b?.kind === 'well') return { kind: 'well' };
	if (b?.kind === 'stable') return { kind: 'stable' };
	if (b?.id === 'home') return { kind: 'home' };
	if (b?.kind === 'house') return { kind: 'house' };
	return null;
}
