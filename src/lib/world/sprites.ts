// Pixel art, drawn in code: each sprite is flat-coloured rectangles on a small
// canvas, then given a 1px ink outline automatically. Sprites are made once and
// cached. One art pixel becomes several screen pixels when drawn.
import type { Crop } from '../game.ts';
import { BUILDINGS, H, hash, terrain, TERRAIN, W, type Building, type Dir } from './map.ts';

export const TILE = 16;

export const C = {
	ink: '#2b1d14',
	skin: '#f5c99b',
	blush: '#f29a8a',
	cap: '#e8423f',
	capDark: '#b52d2a',
	hair: '#6b4229',
	shirt: '#3a7bd5',
	pants: '#4a3b6b',
	horse: '#a0622d',
	horseDark: '#7a461c',
	mane: '#3b2414',
	muzzle: '#c98a52',
	white: '#ffffff',
	cream: '#f3e2b8',
	comb: '#e8423f',
	beak: '#f5b52b',
	legs: '#f5862b',
	leaf: '#3f9b3a',
	leafDark: '#2f7a2c',
	leafLight: '#8fd16a',
	carrot: '#f5862b',
	berry: '#e8423f',
	pumpkin: '#f39a1d',
	pumpkinDark: '#d27a0c',
	pumpkinLight: '#f8c15c',
	potato: '#c9945a',
	potatoDark: '#9c6b38',
	potatoLight: '#e2b77e',
	tomato: '#e3362f',
	corn: '#ffd23f',
	cornDark: '#e0a82a',
	petal: '#ffcc1f',
	melon: '#ff5a6a',
	rind: '#3f9b3a',
	egg: '#fbeccf',
	coin: '#ffc93c',
	coinDark: '#e09a1a',
	coinLight: '#ffe58a',
	grass: '#6cc24a',
	grassDark: '#58ab3a',
	grassLight: '#86d660',
	path: '#e6c992',
	pathDark: '#cfae74',
	pathEdge: '#b8955c',
	water: '#4aa8e8',
	waterDark: '#3a8fd0',
	waterLight: '#a6dcfa',
	soilDry: '#a8714a',
	soilDryDark: '#8d5a37',
	soilWet: '#6b4229',
	soilWetDark: '#4f2f1b',
	seed: '#e7c48c',
	wood: '#b9783f',
	woodDark: '#8d5527',
	woodLight: '#d9a066',
	wall: '#f3e2c4',
	wallShade: '#dcc6a0',
	glass: '#8fd3f4',
	stone: '#a3a8ad',
	stoneDark: '#777d83',
	straw: '#f2c56b',
	pink: '#f4a6c8',
	pinkDark: '#d9799f',
	udder: '#f4a6b8',
	patch: '#3a3a3a',
	fleece: '#f4f1ea',
	shorn: '#ead7c8'
};

type Rect = (x: number, y: number, w: number, h: number, color: string) => void;

export type Sprite = { canvas: HTMLCanvasElement; w: number; h: number };

/** A w×h sprite (plus a 1px border for the outline), drawn with rectangles. */
function make(w: number, h: number, draw: (r: Rect) => void, outline = true): Sprite {
	const pad = outline ? 1 : 0;
	const canvas = document.createElement('canvas');
	canvas.width = w + pad * 2;
	canvas.height = h + pad * 2;
	const ctx = canvas.getContext('2d')!;
	draw((x, y, rw, rh, color) => {
		ctx.fillStyle = color;
		ctx.fillRect(x + pad, y + pad, rw, rh);
	});
	if (outline) addOutline(ctx, canvas.width, canvas.height);
	return { canvas, w: canvas.width, h: canvas.height };
}

/** Paints ink on every empty pixel that touches a filled one. */
function addOutline(ctx: CanvasRenderingContext2D, w: number, h: number) {
	const img = ctx.getImageData(0, 0, w, h);
	const a = (x: number, y: number) =>
		x >= 0 && y >= 0 && x < w && y < h && img.data[(y * w + x) * 4 + 3] > 0;
	const ink = [0x2b, 0x1d, 0x14];
	const edge: number[] = [];
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++)
			if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)))
				edge.push((y * w + x) * 4);
	for (const i of edge) {
		img.data.set(ink, i);
		img.data[i + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
}

function disc(r: Rect, cx: number, cy: number, radius: number, color: string) {
	for (let y = -radius; y <= radius; y++) {
		const half = Math.round(Math.sqrt(radius * radius - y * y));
		r(cx - half, cy + y, half * 2, 1, color);
	}
}

const cache = new Map<string, Sprite>();
function cached(key: string, fn: () => Sprite): Sprite {
	let s = cache.get(key);
	if (!s) cache.set(key, (s = fn()));
	return s;
}

export type Look = { hair: string; shirt: string; cap: boolean };
export const PLAYER_LOOK: Look = { hair: C.hair, shirt: C.shirt, cap: true };

/**
 * A person, 16×16. `step` 0–3 is the walk cycle (1 and 3 lift a leg).
 * Left is right, mirrored, when drawn. `riding` leaves the legs astride.
 */
export function person(dir: Dir, step: number, look: Look, riding = false): Sprite {
	const d = dir === 'left' ? 'right' : dir;
	const key = `person:${d}:${step % 4}:${look.hair}:${look.shirt}:${look.cap}:${riding}`;
	return cached(key, () =>
		make(16, 16, (r) => {
			const shirtDark = shade(look.shirt, -0.2);
			const lift = step % 4;
			if (d === 'right') {
				if (riding) {
					r(7, 12, 2, 3, C.pants);
					r(7, 14, 3, 1, C.ink);
				} else if (lift === 0 || lift === 2) {
					r(6, 12, 3, 3, C.pants);
					r(6, 14, 4, 1, C.ink);
				} else {
					r(5, 12, 2, 3, C.pants);
					r(9, 12, 2, 2, C.pants);
					r(4, 14, 3, 1, C.ink);
					r(9, 13, 3, 1, C.ink);
				}
				r(5, 8, 6, 4, look.shirt);
				if (lift === 1 || lift === 3) {
					r(8, 9, 3, 2, shirtDark);
					r(11, 9, 1, 2, C.skin);
				} else {
					r(7, 8, 2, 3, shirtDark);
					r(7, 11, 2, 1, C.skin);
				}
				r(5, 2, 7, 6, C.skin);
				r(5, 2, 3, 4, look.hair);
				r(10, 4, 1, 2, C.ink);
				r(10, 6, 1, 1, C.blush);
				if (look.cap) {
					r(5, 1, 7, 2, C.cap);
					r(11, 3, 3, 1, C.capDark);
				} else {
					r(5, 1, 7, 2, look.hair);
				}
				return;
			}
			// Facing down (front) or up (back).
			if (riding) {
				r(3, 11, 2, 3, C.pants);
				r(11, 11, 2, 3, C.pants);
			} else {
				r(5, 12, 2, lift === 1 ? 2 : 3, C.pants);
				r(9, 12, 2, lift === 3 ? 2 : 3, C.pants);
				r(5, lift === 1 ? 13 : 14, 2, 1, C.ink);
				r(9, lift === 3 ? 13 : 14, 2, 1, C.ink);
			}
			r(4, 8, 8, 4, look.shirt);
			r(3, 8, 1, 3, shirtDark);
			r(12, 8, 1, 3, shirtDark);
			r(3, 11, 1, 1, C.skin);
			r(12, 11, 1, 1, C.skin);
			if (d === 'down') {
				r(4, 2, 8, 6, C.skin);
				r(4, 3, 1, 3, look.hair);
				r(11, 3, 1, 3, look.hair);
				r(6, 5, 1, 2, C.ink);
				r(9, 5, 1, 2, C.ink);
				r(5, 7, 1, 1, C.blush);
				r(10, 7, 1, 1, C.blush);
				if (look.cap) {
					r(4, 1, 8, 2, C.cap);
					r(4, 3, 8, 1, C.capDark);
				} else {
					r(4, 1, 8, 3, look.hair);
				}
			} else {
				r(4, 2, 8, 6, look.hair);
				if (look.cap) r(4, 1, 8, 3, C.cap);
				else r(4, 1, 8, 2, look.hair);
			}
		})
	);
}

/** The horse: side view 30×22 (facing right; mirrored for left), front and back 18×22. */
export function horse(dir: Dir, step: number): Sprite {
	const d = dir === 'left' ? 'right' : dir;
	const s = step % 2;
	return cached(`horse:${d}:${s}`, () => {
		if (d === 'right')
			return make(30, 22, (r) => {
				r(1, 6, 4, 9, C.mane);
				const legs = s ? [4, 10, 16, 22] : [5, 9, 17, 21];
				for (const x of legs) {
					r(x, 14, 3, 7, C.horseDark);
					r(x, 20, 3, 1, C.ink);
				}
				r(4, 7, 19, 8, C.horse);
				r(5, 14, 17, 1, C.horseDark);
				r(19, 3, 5, 8, C.horse);
				r(21, 1, 7, 5, C.horse);
				r(25, 3, 4, 4, C.muzzle);
				r(28, 4, 1, 1, C.ink);
				r(21, 0, 2, 1, C.horse);
				r(18, 1, 2, 9, C.mane);
				r(20, 0, 1, 2, C.mane);
				r(23, 2, 1, 1, C.ink);
			});
		if (d === 'down')
			return make(18, 22, (r) => {
				r(4, 16, 3, s ? 5 : 6, C.horseDark);
				r(11, 16, 3, s ? 6 : 5, C.horseDark);
				r(4, s ? 20 : 21, 3, 1, C.ink);
				r(11, s ? 21 : 20, 3, 1, C.ink);
				r(3, 9, 12, 8, C.horse);
				r(5, 2, 8, 9, C.horse);
				r(6, 8, 6, 4, C.muzzle);
				r(7, 10, 1, 1, C.ink);
				r(10, 10, 1, 1, C.ink);
				r(7, 5, 1, 1, C.ink);
				r(10, 5, 1, 1, C.ink);
				r(5, 0, 2, 3, C.horse);
				r(11, 0, 2, 3, C.horse);
				r(8, 1, 2, 4, C.mane);
			});
		return make(18, 22, (r) => {
			r(4, 16, 3, s ? 5 : 6, C.horseDark);
			r(11, 16, 3, s ? 6 : 5, C.horseDark);
			r(3, 7, 12, 10, C.horse);
			r(8, 13, 2, 8, C.mane);
			r(5, 1, 8, 7, C.horse);
			r(8, 1, 2, 8, C.mane);
			r(5, 0, 2, 2, C.horse);
			r(11, 0, 2, 2, C.horse);
		});
	});
}

/** The chicken, 14×12, facing right (mirrored for left). */
export function chicken(pecking: boolean): Sprite {
	return cached(`chicken:${pecking}`, () =>
		make(14, 12, (r) => {
			r(4, 9, 1, 2, C.legs);
			r(7, 9, 1, 2, C.legs);
			r(0, 3, 3, 4, C.white);
			r(2, 4, 8, 5, C.white);
			r(3, 5, 4, 3, C.cream);
			const y = pecking ? 4 : 1;
			r(7, y, 4, 4, C.white);
			r(8, y - 1, 2, 1, C.comb);
			r(11, y + 1, 2, 1, C.beak);
			r(10, y + 3, 1, 1, C.comb);
			r(9, y + 1, 1, 1, C.ink);
		})
	);
}

/** The cow, 25×16, facing right (mirrored for left). Head down while eating. */
export function cow(eating: boolean): Sprite {
	return cached(`cow:${eating}`, () =>
		make(25, 16, (r) => {
			for (const x of [4, 8, 15, 18]) {
				r(x, 11, 2, 5, C.white);
				r(x, 15, 2, 1, C.ink);
			}
			r(0, 4, 2, 6, C.white);
			r(0, 9, 2, 2, C.patch);
			r(2, 4, 18, 8, C.white);
			r(5, 5, 5, 4, C.patch);
			r(13, 7, 4, 4, C.patch);
			r(12, 11, 4, 2, C.udder);
			const y = eating ? 4 : 1;
			r(19, y, 5, 6, C.white);
			r(20, y + 4, 5, 3, C.udder);
			r(21, y + 2, 1, 1, C.ink);
			r(18, y + 1, 1, 2, C.patch);
			r(19, y - 1, 1, 1, C.cream);
			r(23, y - 1, 1, 1, C.cream);
		})
	);
}

/** The sheep, 18×14, facing right; fluffy, or thin after shearing. */
export function sheep(woolly: boolean): Sprite {
	return cached(`sheep:${woolly}`, () =>
		make(18, 14, (r) => {
			r(4, 10, 2, 4, C.patch);
			r(11, 10, 2, 4, C.patch);
			if (woolly) {
				r(1, 2, 14, 9, C.fleece);
				r(2, 1, 4, 1, C.fleece);
				r(8, 1, 4, 1, C.fleece);
				r(0, 4, 1, 5, C.fleece);
				r(4, 4, 2, 1, C.wallShade);
				r(9, 7, 2, 1, C.wallShade);
			} else {
				r(3, 4, 11, 6, C.shorn);
			}
			r(13, 3, 5, 6, C.patch);
			r(15, 4, 1, 1, C.white);
			r(12, 3, 2, 1, C.patch);
		})
	);
}

export type Icon =
	| 'carrot'
	| 'strawberry'
	| 'pumpkin'
	| 'potato'
	| 'tomato'
	| 'corn'
	| 'sunflower'
	| 'watermelon'
	| 'egg'
	| 'coin'
	| 'drop'
	| 'grain'
	| 'seed'
	| 'sprout'
	| 'milk'
	| 'wool'
	| 'fish'
	| 'bigfish'
	| 'goldfish'
	| 'goldsquid'
	| 'boot'
	| 'hay';

/** Small 16×16 pictures, used in the world and (as images) in menus. */
export function icon(name: Icon): Sprite {
	return cached(`icon:${name}`, () =>
		make(16, 16, (r) => {
			switch (name) {
				case 'carrot':
					r(4, 5, 7, 2, C.carrot);
					r(5, 7, 5, 2, C.carrot);
					r(5, 9, 4, 2, C.carrot);
					r(6, 11, 3, 2, C.carrot);
					r(7, 13, 1, 2, C.carrot);
					r(6, 7, 2, 1, C.pumpkinDark);
					r(7, 10, 1, 1, C.pumpkinDark);
					r(5, 1, 1, 4, C.leaf);
					r(7, 0, 2, 5, C.leafLight);
					r(9, 1, 1, 4, C.leaf);
					return;
				case 'strawberry':
					r(3, 5, 10, 4, C.berry);
					r(4, 9, 8, 2, C.berry);
					r(5, 11, 6, 2, C.berry);
					r(7, 13, 2, 1, C.berry);
					for (const [x, y] of [
						[5, 6],
						[9, 6],
						[7, 8],
						[11, 7],
						[5, 9],
						[9, 10],
						[7, 11]
					])
						r(x, y, 1, 1, C.coinLight);
					r(4, 4, 8, 2, C.leaf);
					r(7, 2, 2, 2, C.leaf);
					return;
				case 'pumpkin':
					r(7, 1, 2, 4, C.woodDark);
					r(9, 2, 3, 2, C.leaf);
					r(3, 4, 10, 10, C.pumpkin);
					r(1, 6, 14, 6, C.pumpkin);
					r(5, 5, 1, 8, C.pumpkinDark);
					r(10, 5, 1, 8, C.pumpkinDark);
					r(7, 6, 2, 6, C.pumpkinLight);
					return;
				case 'potato':
					r(4, 5, 8, 8, C.potato);
					r(2, 7, 12, 5, C.potato);
					r(3, 6, 10, 7, C.potato);
					r(5, 6, 3, 1, C.potatoLight);
					r(3, 8, 1, 2, C.potatoLight);
					for (const [x, y] of [
						[6, 9],
						[10, 7],
						[9, 11],
						[12, 10]
					])
						r(x, y, 1, 1, C.potatoDark);
					return;
				case 'tomato':
					disc(r, 8, 9, 6, C.tomato);
					r(5, 6, 2, 2, C.blush);
					r(4, 4, 8, 2, C.leaf);
					r(6, 3, 4, 1, C.leaf);
					r(7, 1, 2, 3, C.leafDark);
					return;
				case 'corn':
					r(6, 1, 4, 12, C.corn);
					r(5, 3, 6, 9, C.corn);
					for (const y of [3, 5, 7, 9, 11]) {
						r(6, y, 1, 1, C.cornDark);
						r(9, y, 1, 1, C.cornDark);
					}
					r(8, 2, 1, 1, C.cornDark);
					r(3, 7, 2, 7, C.leaf);
					r(11, 7, 2, 7, C.leaf);
					r(4, 11, 8, 4, C.leafLight);
					r(7, 13, 2, 2, C.leaf);
					return;
				case 'sunflower':
					r(7, 11, 2, 5, C.leaf);
					r(9, 12, 4, 2, C.leafLight);
					disc(r, 8, 6, 6, C.petal);
					for (const [x, y] of [
						[2, 6],
						[8, 0],
						[13, 6],
						[8, 11]
					])
						r(x, y, 1, 1, C.coinDark);
					disc(r, 8, 6, 3, C.woodDark);
					r(7, 5, 1, 1, C.wood);
					r(9, 7, 1, 1, C.wood);
					return;
				case 'watermelon':
					// A slice: rind round the bottom, red inside, dark seeds.
					for (let y = 0; y <= 7; y++) {
						const half = Math.round(Math.sqrt(64 - y * y));
						r(8 - half, 5 + y, half * 2, 1, C.rind);
						if (y < 7) {
							const inner = Math.round(Math.sqrt(36 - y * y));
							r(8 - inner, 5 + y, inner * 2, 1, y < 6 ? C.melon : C.leafLight);
						}
					}
					r(2, 5, 12, 1, C.melon);
					for (const [x, y] of [
						[5, 6],
						[8, 7],
						[11, 6],
						[6, 9],
						[10, 9]
					])
						r(x, y, 1, 1, C.ink);
					return;
				case 'egg':
					r(5, 2, 6, 12, C.egg);
					r(4, 5, 8, 8, C.egg);
					r(6, 5, 1, 3, C.white);
					return;
				case 'coin':
					disc(r, 8, 8, 7, C.coinDark);
					disc(r, 8, 7, 6, C.coin);
					r(7, 3, 2, 8, C.coinLight);
					r(5, 6, 6, 2, C.coinLight);
					return;
				case 'drop':
					r(7, 2, 2, 2, C.water);
					r(6, 4, 4, 2, C.water);
					r(5, 6, 6, 5, C.water);
					r(6, 11, 4, 2, C.water);
					r(6, 7, 1, 3, C.white);
					return;
				case 'grain':
					for (const [x, y] of [
						[4, 8],
						[8, 5],
						[10, 10],
						[6, 11],
						[11, 6]
					])
						r(x, y, 2, 3, C.seed);
					return;
				case 'seed':
					r(3, 11, 10, 3, C.soilDryDark);
					r(5, 10, 6, 1, C.soilDryDark);
					r(6, 10, 1, 2, C.seed);
					r(9, 11, 1, 2, C.seed);
					return;
				case 'sprout':
					r(7, 7, 2, 7, C.leaf);
					r(3, 6, 4, 3, C.leafLight);
					r(9, 5, 4, 3, C.leaf);
					return;
				case 'milk':
					r(6, 1, 4, 2, C.berry);
					r(6, 3, 4, 2, C.white);
					r(4, 5, 8, 10, C.white);
					r(4, 8, 8, 3, C.glass);
					return;
				case 'wool':
					disc(r, 8, 8, 6, C.pink);
					r(4, 6, 8, 1, C.pinkDark);
					r(3, 9, 10, 1, C.pinkDark);
					r(6, 3, 1, 10, C.pinkDark);
					r(12, 13, 3, 1, C.pink);
					return;
				case 'fish':
				case 'bigfish':
				case 'goldfish': {
					const c = name === 'fish' ? '#5aa7e0' : name === 'bigfish' ? '#5cb85c' : C.coin;
					const big = name === 'bigfish';
					r(big ? 1 : 3, big ? 4 : 6, big ? 11 : 9, big ? 8 : 5, c);
					r(big ? 2 : 4, big ? 3 : 5, big ? 9 : 7, big ? 10 : 7, c);
					r(12, 7, 2, 3, c);
					r(14, big ? 3 : 5, 2, big ? 11 : 7, c);
					r(big ? 3 : 5, big ? 6 : 7, 1, 1, C.ink);
					r(7, big ? 2 : 4, 3, 1, shade(c, -0.25));
					if (name === 'goldfish') {
						r(9, 7, 1, 1, C.white);
						r(6, 10, 1, 1, C.white);
					}
					return;
				}
				case 'goldsquid':
					// Pointy head, round body, wavy tentacles.
					r(7, 0, 2, 1, C.coin);
					r(6, 1, 4, 2, C.coin);
					r(5, 3, 6, 6, C.coin);
					r(4, 5, 8, 3, C.coin);
					r(3, 4, 1, 2, C.coinDark);
					r(12, 4, 1, 2, C.coinDark);
					r(6, 2, 1, 3, C.coinLight);
					r(6, 6, 1, 1, C.ink);
					r(9, 6, 1, 1, C.ink);
					for (const x of [4, 6, 9, 11]) {
						r(x, 9, 1, 4, C.coinDark);
						r(x + (x < 8 ? -1 : 1), 13, 1, 2, C.coinDark);
					}
					r(7, 9, 2, 6, C.coin);
					r(9, 1, 1, 1, C.white);
					r(10, 8, 1, 1, C.white);
					return;
				case 'boot':
					r(4, 2, 5, 9, '#7a4a2a');
					r(4, 9, 10, 4, '#7a4a2a');
					r(4, 13, 10, 1, C.ink);
					r(5, 4, 3, 1, C.cream);
					r(5, 6, 3, 1, C.cream);
					return;
				case 'hay':
					r(3, 4, 10, 9, C.straw);
					for (const x of [4, 7, 10]) r(x, 4, 1, 9, '#c9a13a');
					r(3, 8, 10, 2, C.woodDark);
					return;
			}
		})
	);
}

/** A half-grown crop, with a hint of what's coming. */
export function growing(crop: Crop): Sprite {
	return cached(`growing:${crop}`, () =>
		make(16, 16, (r) => {
			r(7, 4, 2, 10, C.leaf);
			r(2, 6, 5, 3, C.leafLight);
			r(9, 3, 5, 3, C.leaf);
			r(3, 10, 4, 2, C.leaf);
			r(9, 9, 5, 2, C.leafLight);
			switch (crop) {
				case 'carrot':
					return r(5, 13, 6, 2, C.carrot);
				case 'potato':
					return r(4, 13, 3, 2, C.potato);
				case 'strawberry':
					r(2, 4, 2, 2, C.white);
					return r(12, 8, 2, 2, C.berry);
				case 'tomato':
					r(2, 9, 2, 2, C.leafLight);
					return r(12, 6, 2, 2, C.tomato);
				case 'corn':
					r(7, 0, 2, 4, C.leafLight);
					return r(9, 7, 2, 3, C.corn);
				case 'pumpkin':
					return r(10, 11, 4, 4, C.leafLight);
				case 'sunflower':
					r(7, 0, 2, 4, C.leaf);
					return r(6, 0, 4, 2, C.petal);
				case 'watermelon':
					return r(9, 11, 5, 4, C.rind);
			}
		})
	);
}

/** A tree, 16×24, drawn so its trunk stands on its tile. */
export function tree(variant: number): Sprite {
	return cached(`tree:${variant % 2}`, () =>
		make(16, 24, (r) => {
			r(6, 16, 4, 7, C.woodDark);
			r(5, 22, 6, 1, C.woodDark);
			const top = variant % 2 ? C.leaf : '#4aa843';
			r(2, 3, 12, 13, top);
			r(0, 6, 16, 8, top);
			r(4, 1, 8, 17, top);
			r(3, 14, 10, 3, C.leafDark);
			r(4, 4, 3, 2, C.leafLight);
			r(9, 8, 2, 2, C.leafLight);
			r(3, 9, 2, 2, C.leafLight);
		})
	);
}

/** Lighten (amount > 0) or darken a hex colour. */
export function shade(hex: string, amount: number): string {
	const n = parseInt(hex.slice(1), 16);
	const mix = (c: number) =>
		Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)
			.toString(16)
			.padStart(2, '0');
	return `#${mix(n >> 16)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

/** How far a building's sprite reaches above its footprint (its roof). */
export const ROOF: Record<Building['kind'], number> = {
	house: 10,
	stable: 12,
	barn: 12,
	coop: 8,
	stall: 12,
	well: 14
};

export function building(b: Building): Sprite {
	const w = b.w * TILE;
	const h = b.h * TILE + ROOF[b.kind];
	const dark = shade(b.color, -0.3);
	return cached(`building:${b.id}`, () =>
		make(w, h, (r) => {
			const top = ROOF[b.kind];
			if (b.kind === 'house') {
				r(4, top + 30, w - 8, h - top - 31, C.wall);
				r(4, h - 5, w - 8, 4, C.wallShade);
				r(w - 22, 0, 8, 14, C.stone);
				r(w - 23, 0, 10, 2, C.stoneDark);
				r(0, 4, w, top + 28, b.color);
				for (let y = 10; y < top + 30; y += 6) r(0, y, w, 1, dark);
				r(0, 4, w, 3, dark);
				r(0, top + 30, w, 2, dark);
				const door = Math.floor(w / 2) - 6;
				r(door, h - 22, 12, 21, C.woodDark);
				r(door + 1, h - 21, 10, 20, C.wood);
				r(door + 8, h - 12, 1, 1, C.ink);
				for (const x of [10, w - 24]) {
					r(x, top + 36, 14, 12, C.woodLight);
					r(x + 1, top + 37, 12, 10, C.glass);
					r(x + 7, top + 37, 1, 10, C.woodLight);
					r(x + 1, top + 41, 12, 1, C.woodLight);
					r(x + 2, top + 38, 2, 2, C.white);
				}
			} else if (b.kind === 'stable' || b.kind === 'barn') {
				r(4, top + 14, w - 8, h - top - 15, b.color);
				for (let x = 8; x < w - 4; x += 6) r(x, top + 14, 1, h - top - 15, dark);
				r(0, 4, w, top + 12, C.woodDark);
				for (let y = 8; y < top + 16; y += 5) r(0, y, w, 1, C.mane);
				const door = w / 2 - 12;
				r(door, h - 26, 24, 25, C.wood);
				for (let i = 0; i < 24; i++) {
					r(door + i, h - 26 + Math.round((i * 25) / 24), 1, 2, C.white);
					r(door + 23 - i, h - 26 + Math.round((i * 25) / 24), 1, 2, C.white);
				}
				r(door, h - 26, 24, 2, C.white);
				r(door, h - 3, 24, 2, C.white);
				r(12, top + 20, 12, 10, C.straw);
				r(w - 24, top + 20, 12, 10, C.straw);
			} else if (b.kind === 'coop') {
				r(4, top + 16, w - 8, h - top - 17, C.wood);
				for (let y = top + 20; y < h - 2; y += 5) r(4, y, w - 8, 1, C.woodDark);
				r(0, 4, w, top + 14, b.color);
				for (let y = 9; y < top + 18; y += 5) r(0, y, w, 1, dark);
				r(w / 2 - 6, h - 16, 12, 15, C.woodDark);
				r(w / 2 - 4, h - 14, 8, 13, C.ink);
				r(8, top + 22, 6, 6, C.straw);
			} else if (b.kind === 'stall') {
				r(3, 12, 3, h - 13, C.woodDark);
				r(w - 6, 12, 3, h - 13, C.woodDark);
				r(2, h - 18, w - 4, 17, C.wood);
				r(1, h - 20, w - 2, 4, C.woodLight);
				r(8, h - 25, 5, 5, C.carrot);
				r(16, h - 25, 5, 5, C.berry);
				r(25, h - 27, 7, 7, C.pumpkin);
				r(36, h - 25, 4, 5, C.egg);
				for (let x = 0; x < w; x += 8) {
					const c = (x / 8) % 2 ? C.white : b.color;
					r(x, 2, 8, 14, c);
					r(x + 1, 16, 6, 2, c);
				}
			} else {
				r(2, top + 12, w - 4, h - top - 13, C.stone);
				for (let y = top + 16; y < h - 2; y += 5) r(2, y, w - 4, 1, C.stoneDark);
				r(6, top + 12, w - 12, 5, C.waterDark);
				r(4, 8, 3, top + 6, C.woodDark);
				r(w - 7, 8, 3, top + 6, C.woodDark);
				r(0, 2, w, 8, b.color);
				r(15, 10, 1, 8, C.ink);
				r(13, 18, 5, 5, C.woodLight);
			}
		})
	);
}

/** The ground of the whole map, drawn once: grass, flowers, paths, water and fences. */
export function background(): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = W * TILE;
	canvas.height = H * TILE;
	const ctx = canvas.getContext('2d')!;
	const r: Rect = (x, y, w, h, color) => {
		ctx.fillStyle = color;
		ctx.fillRect(x, y, w, h);
	};
	const is = (x: number, y: number, t: string) => TERRAIN[y]?.[x] === t;
	const flowers = [C.white, '#f7a8c4', '#ffd84a', '#a8c8ff'];

	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			const t = terrain(x, y);
			const px = x * TILE;
			const py = y * TILE;
			if (t === 'water') {
				r(px, py, TILE, TILE, C.water);
				for (let i = 0; i < 2; i++) {
					const h = hash(x * 3 + i, y * 5);
					r(px + (h % 10), py + 3 + ((h >> 4) % 10), 4, 1, C.waterLight);
				}
				const shore = 3;
				if (!is(x, y - 1, 'water')) r(px, py, TILE, shore, C.path);
				if (!is(x, y + 1, 'water')) r(px, py + TILE - shore, TILE, shore, C.path);
				if (!is(x - 1, y, 'water')) r(px, py, shore, TILE, C.path);
				if (!is(x + 1, y, 'water')) r(px + TILE - shore, py, shore, TILE, C.path);
				continue;
			}
			if (t === 'path') {
				r(px, py, TILE, TILE, C.path);
				for (let i = 0; i < 3; i++) {
					const h = hash(x * 7 + i, y * 11);
					r(px + (h % 14), py + ((h >> 5) % 14), 2, 1, C.pathDark);
				}
				const edge = (nx: number, ny: number) =>
					!is(nx, ny, 'path') && !is(nx, ny, 'soil') && !buildingTile(nx, ny);
				if (edge(x, y - 1)) r(px, py, TILE, 1, C.pathEdge);
				if (edge(x, y + 1)) r(px, py + TILE - 1, TILE, 1, C.pathEdge);
				if (edge(x - 1, y)) r(px, py, 1, TILE, C.pathEdge);
				if (edge(x + 1, y)) r(px + TILE - 1, py, 1, TILE, C.pathEdge);
				continue;
			}
			// Everything else stands on grass.
			r(px, py, TILE, TILE, C.grass);
			for (let i = 0; i < 4; i++) {
				const h = hash(x * 13 + i, y * 17 + i);
				const c = i % 2 ? C.grassDark : C.grassLight;
				r(px + (h % 15), py + ((h >> 6) % 14), 1, 2, c);
			}
			if (t === 'flowers') {
				for (let i = 0; i < 2; i++) {
					const h = hash(x + i * 31, y * 19);
					const fx = px + 3 + (h % 9);
					const fy = py + 3 + ((h >> 5) % 9);
					const c = flowers[(h >> 9) % flowers.length];
					r(fx - 1, fy, 3, 1, c);
					r(fx, fy - 1, 1, 3, c);
					r(fx, fy, 1, 1, C.coin);
				}
			}
			if (t === 'fence') {
				const f = (nx: number, ny: number) => is(nx, ny, 'fence');
				if (f(x - 1, y) || f(x + 1, y)) {
					const from = f(x - 1, y) ? 0 : 7;
					const to = f(x + 1, y) ? 16 : 9;
					for (const ry of [5, 10]) {
						r(px + from, py + ry, to - from, 2, C.wood);
						r(px + from, py + ry + 2, to - from, 1, C.woodDark);
					}
				}
				if (f(x, y - 1)) r(px + 7, py, 2, 6, C.wood);
				if (f(x, y + 1)) r(px + 7, py + 8, 2, 8, C.wood);
				r(px + 5, py + 2, 6, 12, C.ink);
				r(px + 6, py + 3, 4, 10, C.wood);
				r(px + 6, py + 3, 4, 1, C.woodLight);
			}
		}
	return canvas;
}

function buildingTile(x: number, y: number) {
	return BUILDINGS.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
}

/** A sprite as an image URL, for menus. */
export function spriteUrl(s: Sprite): string {
	return s.canvas.toDataURL();
}
