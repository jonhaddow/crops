// The village map: terrain, buildings, and where everything starts. Built in
// code rather than typed out, so it's easy to move things about. Coordinates
// are tiles; (0, 0) is the top-left.

export const W = 44;
export const H = 32;

export type Terrain = 'grass' | 'flowers' | 'path' | 'water' | 'tree' | 'fence' | 'soil';
export type Dir = 'up' | 'down' | 'left' | 'right';
export type Spot = { x: number; y: number };

export const STEP: Record<Dir, Spot> = {
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 }
};

export type BuildingKind = 'house' | 'stable' | 'barn' | 'coop' | 'stall' | 'well';
export type Building = {
	id: string;
	kind: BuildingKind;
	x: number;
	y: number;
	w: number;
	h: number;
	/** Roof (or awning) colour. */
	color: string;
};

export const BUILDINGS: Building[] = [
	{ id: 'home', kind: 'house', x: 4, y: 3, w: 5, h: 4, color: '#d9534f' },
	{ id: 'blue-house', kind: 'house', x: 25, y: 3, w: 5, h: 4, color: '#4a7fd4' },
	{ id: 'green-house', kind: 'house', x: 32, y: 3, w: 5, h: 4, color: '#3f9b5a' },
	{ id: 'yellow-house', kind: 'house', x: 33, y: 11, w: 5, h: 4, color: '#e0a526' },
	{ id: 'coop', kind: 'coop', x: 11, y: 9, w: 3, h: 3, color: '#a0522d' },
	{ id: 'stall', kind: 'stall', x: 25, y: 11, w: 3, h: 2, color: '#e8423f' },
	{ id: 'well', kind: 'well', x: 17, y: 11, w: 2, h: 2, color: '#8d5527' },
	{ id: 'stable', kind: 'stable', x: 31, y: 20, w: 6, h: 3, color: '#b03a2e' },
	{ id: 'barn', kind: 'barn', x: 14, y: 18, w: 5, h: 3, color: '#c0703a' }
];

/** The field's nine plots, in the order of Farm.plots. */
export const PLOTS: Spot[] = [10, 11, 12].flatMap((y) => [4, 5, 6].map((x) => ({ x, y })));

export type Area = { x: number; y: number; w: number; h: number };

/** The chicken wanders inside its pen. */
export const PEN: Area = { x: 11, y: 12, w: 4, h: 2 };
/** The cow and sheep wander in the pasture below the barn. */
export const PASTURE: Area = { x: 14, y: 22, w: 6, h: 5 };

export type Npc = { id: string; x: number; y: number; hair: string; shirt: string; says: string[] };

export const NPCS: Npc[] = [
	{
		id: 'shopkeeper',
		x: 28,
		y: 12,
		hair: '#3b2a1e',
		shirt: '#e8423f',
		says: ['Welcome to the market!']
	},
	{
		id: 'rosie',
		x: 19,
		y: 17,
		hair: '#f2c56b',
		shirt: '#b05cc8',
		says: [
			'Hello! Have you met the horse?',
			'The stable is down the road. Press A next to the horse to ride!'
		]
	},
	{
		id: 'sam',
		x: 31,
		y: 9,
		hair: '#6b4229',
		shirt: '#3f9b5a',
		says: ['Pumpkins take ages to grow...', '...but they sell for 5 coins!']
	},
	{
		id: 'grandpa',
		x: 11,
		y: 20,
		hair: '#dddddd',
		shirt: '#4a7fd4',
		says: ['Ahh, the pond is lovely today.', 'Water your seeds, or they will just sleep!']
	}
];

export const START_PLAYER = { x: 6, y: 8, facing: 'down' as Dir };
export const START_HORSE: Spot = { x: 34, y: 25 };

const TREES: Spot[] = [
	[12, 4],
	[15, 5],
	[18, 3],
	[20, 6],
	[3, 17],
	[6, 19],
	[24, 23],
	[17, 28],
	[26, 28],
	[40, 9],
	[41, 12],
	[39, 5],
	[12, 28],
	[24, 21],
	[11, 18],
	[40, 22],
	[40, 27],
	[27, 18],
	[3, 28]
].map(([x, y]) => ({ x, y }));

function build(): Terrain[][] {
	const t: Terrain[][] = Array.from({ length: H }, () => Array<Terrain>(W).fill('grass'));
	const set = (x: number, y: number, v: Terrain) => {
		if (x >= 0 && y >= 0 && x < W && y < H) t[y][x] = v;
	};
	const rect = (x: number, y: number, w: number, h: number, v: Terrain) => {
		for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, v);
	};

	// Flowers dotted about (a fixed pattern, so the map never changes).
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) if (hash(x, y) % 17 === 0) set(x, y, 'flowers');

	// Roads: the main road across, one down through the village, and lanes.
	rect(2, 15, W - 4, 2, 'path');
	rect(21, 8, 2, 21, 'path');
	rect(21, 8, 14, 1, 'path'); // to the blue and green houses
	rect(27, 7, 1, 1, 'path');
	rect(34, 7, 1, 1, 'path');
	rect(5, 7, 5, 2, 'path'); // home's front yard
	rect(9, 7, 1, 8, 'path');
	rect(23, 26, 6, 1, 'path'); // to the paddock gate
	rect(35, 15, 1, 1, 'path'); // yellow house
	rect(20, 13, 8, 2, 'path'); // the square by the well and stall
	rect(16, 13, 4, 2, 'path');

	// The pond.
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++)
			if (((x - 7.5) / 4.6) ** 2 + ((y - 24) / 3.1) ** 2 <= 1) set(x, y, 'water');

	// Field: soil plots inside a fence with a gate at the top.
	for (const p of PLOTS) set(p.x, p.y, 'soil');
	fence(set, 3, 9, 5, 5, [{ x: 5, y: 9 }]);

	// Chicken pen below the coop, gate at the bottom.
	fence(set, 10, 11, 6, 4, [{ x: 12, y: 14 }], true);

	// Pasture below the barn, gate onto the road on the right.
	fence(set, 13, 21, 8, 7, [{ x: 20, y: 24 }]);

	// Paddock round the stable, gate on the left.
	fence(set, 29, 19, 10, 10, [{ x: 29, y: 26 }]);

	for (const tree of TREES) set(tree.x, tree.y, 'tree');

	// A forest all round the edge.
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) set(x, y, 'tree');

	return t;
}

/** A fence round a rectangle, leaving gaps for gates (and the top open if `openTop`). */
function fence(
	set: (x: number, y: number, v: Terrain) => void,
	x: number,
	y: number,
	w: number,
	h: number,
	gates: Spot[],
	openTop = false
) {
	const gate = (i: number, j: number) => gates.some((g) => g.x === i && g.y === j);
	for (let i = x; i < x + w; i++) {
		if (!openTop && !gate(i, y)) set(i, y, 'fence');
		if (!gate(i, y + h - 1)) set(i, y + h - 1, 'fence');
	}
	for (let j = y; j < y + h; j++) {
		if (!gate(x, j)) set(x, j, 'fence');
		if (!gate(x + w - 1, j)) set(x + w - 1, j, 'fence');
	}
}

/** A small deterministic hash, for scattering flowers and grass detail. */
export function hash(x: number, y: number): number {
	let h = (x * 374761393 + y * 668265263) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return (h ^ (h >>> 16)) >>> 0;
}

export const TERRAIN = build();

export function terrain(x: number, y: number): Terrain {
	return TERRAIN[y]?.[x] ?? 'tree';
}

export function buildingAt(x: number, y: number): Building | undefined {
	return BUILDINGS.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
}

export function npcAt(x: number, y: number): Npc | undefined {
	return NPCS.find((n) => n.x === x && n.y === y);
}

/** Whether the ground itself can be walked on (ignoring animals and people). */
export function open(x: number, y: number): boolean {
	const t = terrain(x, y);
	return (
		(t === 'grass' || t === 'flowers' || t === 'path' || t === 'soil') &&
		!buildingAt(x, y) &&
		!npcAt(x, y)
	);
}

export function plotAt(x: number, y: number): number {
	return PLOTS.findIndex((p) => p.x === x && p.y === y);
}
