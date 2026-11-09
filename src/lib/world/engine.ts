// The village, running: walking routes tile by tile, the camera, the
// wandering animals, riding, fishing, and drawing each frame. The farm's
// state lives in `Farm` (saved); everything here that isn't in it (animation,
// where the animals have wandered) is just for show.
import {
	chicken as henState,
	cow as cowState,
	progress,
	sheep as sheepState,
	stage,
	type Farm
} from '../game.ts';
import { target, type Animals, type Thing } from './interact.ts';
import {
	BUILDINGS,
	H,
	NPCS,
	open,
	PASTURE,
	PEN,
	plotAt,
	PLOTS,
	STEP,
	TERRAIN,
	W,
	type Area,
	type Dir,
	type Spot
} from './map.ts';
import { route, type Route } from './path.ts';
import {
	background,
	building,
	C,
	chicken,
	cow,
	growing,
	horse,
	icon,
	person,
	PLAYER_LOOK,
	ROOF,
	sheep,
	TILE,
	tree,
	type Icon,
	type Sprite
} from './sprites.ts';

const WALK_MS = 230;
const RIDE_MS = 115;
/** With the keyboard, a quick tap of an arrow just turns; holding walks. */
const TURN_MS = 90;

type Floater = { x: number; y: number; icon: Icon; text: string; born: number };

/** An animal that wanders about inside an area. */
class Wanderer {
	from: Spot | null = null;
	t = 0;
	left = false;
	next = 0;
	constructor(
		public x: number,
		public y: number,
		private area: Area,
		private ms: number
	) {}

	/** Where it's drawn, part way between tiles while moving. */
	pos(): Spot {
		if (!this.from) return { x: this.x, y: this.y };
		return {
			x: this.from.x + (this.x - this.from.x) * this.t,
			y: this.from.y + (this.y - this.from.y) * this.t
		};
	}

	occupies(x: number, y: number) {
		return (this.x === x && this.y === y) || (this.from?.x === x && this.from?.y === y);
	}

	update(dt: number, now: number, stay: boolean, free: (x: number, y: number) => boolean) {
		if (this.from) {
			this.t += dt / this.ms;
			if (this.t >= 1) {
				this.from = null;
				this.t = 0;
			}
			return;
		}
		if (now < this.next) return;
		this.next = now + 1500 + Math.random() * 2500;
		if (stay && Math.random() < 0.7) return;
		const d = (['up', 'down', 'left', 'right'] as Dir[])[Math.floor(Math.random() * 4)];
		const x = this.x + STEP[d].x;
		const y = this.y + STEP[d].y;
		const a = this.area;
		if (x < a.x || x >= a.x + a.w || y < a.y || y >= a.y + a.h || !free(x, y)) return;
		if (d === 'left') this.left = true;
		if (d === 'right') this.left = false;
		this.from = { x: this.x, y: this.y };
		this.x = x;
		this.y = y;
	}
}

export class World {
	/** An arrow key held down (keyboard play). */
	held: Dir | null = null;
	paused = false;
	/** Set while fishing: where the float is, and whether a fish is biting. */
	fishing: { tile: Spot; bite: boolean } | null = null;

	private ctx: CanvasRenderingContext2D;
	private bg: HTMLCanvasElement;
	private from: Spot | null = null;
	private t = 0;
	private steps = 0;
	private heldSince = 0;
	/** The route being walked, where it ends, and what to do on arrival. */
	private walk: {
		steps: Dir[];
		face: Dir | null;
		goal: (x: number, y: number) => Dir | null | undefined;
		marker: Spot;
		arrive?: () => void;
		retries: number;
	} | null = null;
	private hen = new Wanderer(12, 12, PEN, 450);
	private cow = new Wanderer(15, 24, PASTURE, 700);
	private sheep = new Wanderer(18, 23, PASTURE, 550);
	private horseFacing: Dir = 'right';
	private npcFacing = new Map<string, Dir>();
	private floaters: Floater[] = [];
	private frame = 0;
	private last = 0;
	private scale = 4;
	private dpr = 1;
	private cam = { x: 0, y: 0 };

	constructor(
		private canvas: HTMLCanvasElement,
		private farm: Farm,
		/** Called when the player arrives on a tile, turns, or gets on or off the horse. */
		private onMove: () => void
	) {
		this.ctx = canvas.getContext('2d')!;
		this.bg = background();
	}

	start() {
		const loop = (time: number) => {
			const dt = this.last ? Math.min(100, time - this.last) : 0;
			this.last = time;
			this.update(dt, Date.now());
			this.render(time, Date.now());
			this.frame = requestAnimationFrame(loop);
		};
		this.frame = requestAnimationFrame(loop);
	}

	stop() {
		cancelAnimationFrame(this.frame);
	}

	/** Fits the canvas to its box: about 64px per tile on a tablet. */
	resize() {
		const { clientWidth: w, clientHeight: h } = this.canvas;
		this.dpr = window.devicePixelRatio || 1;
		this.canvas.width = Math.round(w * this.dpr);
		this.canvas.height = Math.round(h * this.dpr);
		const short = Math.min(w, h);
		this.scale = short >= 700 ? 4 : short >= 450 ? 3 : 2;
	}

	/** The map tile under a point on the screen. */
	tileAt(clientX: number, clientY: number): Spot {
		const r = this.canvas.getBoundingClientRect();
		return {
			x: Math.floor(((clientX - r.left) / this.scale + this.cam.x) / TILE),
			y: Math.floor(((clientY - r.top) / this.scale + this.cam.y) / TILE)
		};
	}

	/** The middle of a tile on the screen (for tests). */
	screenOf(x: number, y: number): Spot {
		const r = this.canvas.getBoundingClientRect();
		return {
			x: r.left + ((x + 0.5) * TILE - this.cam.x) * this.scale,
			y: r.top + ((y + 0.5) * TILE - this.cam.y) * this.scale
		};
	}

	animals(): Animals {
		const s = (w: Wanderer) => ({ x: w.x, y: w.y });
		return { chicken: s(this.hen), cow: s(this.cow), sheep: s(this.sheep) };
	}

	target(now: number): Thing | null {
		return target(this.farm, now, this.animals());
	}

	/** Whether the player is walking a route or between tiles. */
	busy() {
		return !!this.walk || !!this.from;
	}

	/**
	 * Walks the shortest way to a goal, then faces as it says and calls
	 * `arrive`. False (and nothing happens) if there's no way there.
	 */
	walkTo(
		goal: (x: number, y: number) => Dir | null | undefined,
		marker: Spot,
		arrive?: () => void
	): boolean {
		const r = this.route(goal);
		if (!r) return false;
		this.walk = { ...r, goal, marker, arrive, retries: 3 };
		return true;
	}

	cancelWalk() {
		this.walk = null;
	}

	float(spot: Spot, what: Icon, text: string) {
		this.floaters.push({ x: spot.x, y: spot.y, icon: what, text, born: performance.now() });
	}

	faceNpc(id: string) {
		const npc = NPCS.find((n) => n.id === id);
		if (!npc) return;
		const p = this.farm.player;
		const dx = p.x - npc.x;
		const dy = p.y - npc.y;
		this.npcFacing.set(
			id,
			Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
		);
	}

	/** Gets on the horse in front. */
	mount() {
		const p = this.farm.player;
		this.from = { x: p.x, y: p.y };
		this.t = 0;
		p.x = this.farm.horse.x;
		p.y = this.farm.horse.y;
		this.farm.riding = true;
		this.onMove();
	}

	/** Gets off onto a free tile beside the horse (the one in front if it's free). */
	dismount(): boolean {
		const p = this.farm.player;
		const order: Dir[] = [p.facing, 'down', 'left', 'right', 'up'];
		for (const d of order) {
			const x = p.x + STEP[d].x;
			const y = p.y + STEP[d].y;
			if (this.blocked(x, y)) continue;
			this.walk = null;
			this.farm.horse = { x: p.x, y: p.y };
			this.horseFacing = p.facing;
			this.farm.riding = false;
			this.from = { x: p.x, y: p.y };
			this.t = 0;
			p.x = x;
			p.y = y;
			this.onMove();
			return true;
		}
		return false;
	}

	private route(goal: (x: number, y: number) => Dir | null | undefined): Route | null {
		return route(this.farm.player, (x, y) => this.blocked(x, y), goal);
	}

	private blocked(x: number, y: number): boolean {
		if (!open(x, y)) return true;
		// Horses stay off the crops.
		if (this.farm.riding && plotAt(x, y) >= 0) return true;
		if (this.hen.occupies(x, y) || this.cow.occupies(x, y) || this.sheep.occupies(x, y))
			return true;
		const h = this.farm.horse;
		return !this.farm.riding && x === h.x && y === h.y;
	}

	/** Takes one step, if the way is clear. */
	private step(dir: Dir): boolean {
		const p = this.farm.player;
		const x = p.x + STEP[dir].x;
		const y = p.y + STEP[dir].y;
		p.facing = dir;
		if (this.blocked(x, y)) return false;
		this.from = { x: p.x, y: p.y };
		p.x = x;
		p.y = y;
		if (this.farm.riding) this.farm.horse = { x, y };
		return true;
	}

	private update(dt: number, now: number) {
		const p = this.farm.player;
		const stepMs = this.farm.riding ? RIDE_MS : WALK_MS;

		if (this.from) {
			this.t += dt / stepMs;
			if (this.t >= 1) {
				this.from = null;
				this.t = 0;
				this.steps++;
				this.onMove();
			}
		}

		if (!this.from && !this.paused && this.walk) this.followRoute();
		else if (!this.from && this.held && !this.paused) {
			const dir = this.held;
			if (p.facing !== dir) {
				p.facing = dir;
				this.heldSince = performance.now();
				this.onMove();
			} else if (performance.now() - this.heldSince >= TURN_MS) this.step(dir);
		}

		const free = (x: number, y: number) =>
			!(p.x === x && p.y === y) && !(this.from?.x === x && this.from?.y === y);
		// Animals hold still while the player walks over to use something.
		if (this.walk?.arrive) return;
		this.hen.update(dt, now, henState(this.farm, now) === 'eating', free);
		const animalFree = (x: number, y: number) =>
			free(x, y) && !this.cow.occupies(x, y) && !this.sheep.occupies(x, y);
		this.cow.update(dt, now, cowState(this.farm, now) === 'eating', animalFree);
		this.sheep.update(dt, now, false, animalFree);
	}

	private followRoute() {
		const walk = this.walk!;
		const next = walk.steps[0];
		if (next) {
			if (this.step(next)) {
				walk.steps.shift();
				return;
			}
			// Something wandered into the way: find another way.
			const r = walk.retries-- > 0 ? this.route(walk.goal) : null;
			if (r) Object.assign(walk, r);
			else this.walk = null;
			return;
		}
		this.walk = null;
		if (walk.face) this.farm.player.facing = walk.face;
		this.onMove();
		walk.arrive?.();
	}

	/** Where the player is drawn, part way between tiles while moving. */
	private playerPos(): Spot {
		const p = this.farm.player;
		if (!this.from) return { x: p.x, y: p.y };
		const t = this.t;
		return { x: this.from.x + (p.x - this.from.x) * t, y: this.from.y + (p.y - this.from.y) * t };
	}

	private render(time: number, now: number) {
		const { ctx, canvas } = this;
		const s = this.scale * this.dpr;
		const viewW = canvas.width / s;
		const viewH = canvas.height / s;
		const pos = this.playerPos();
		const camX = snap(clampCam(pos.x * TILE + 8 - viewW / 2, W * TILE, viewW), s);
		const camY = snap(clampCam(pos.y * TILE + 8 - viewH / 2, H * TILE, viewH), s);
		this.cam = { x: camX, y: camY };

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.fillStyle = C.leafDark;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.imageSmoothingEnabled = false;
		ctx.setTransform(s, 0, 0, s, -camX * s, -camY * s);
		ctx.drawImage(this.bg, 0, 0);

		const bob = Math.floor(time / 400) % 2;
		this.drawPlots(now, bob);
		if (this.walk) this.drawMarker(this.walk.marker, time);

		// Things that stand up, drawn from the back (top) to the front.
		const items: { y: number; draw: () => void }[] = [];
		const inView = (x: number, y: number) =>
			x * TILE > camX - 32 &&
			x * TILE < camX + viewW + 16 &&
			y * TILE > camY - 16 &&
			y * TILE < camY + viewH + 40;

		for (let y = 0; y < H; y++)
			for (let x = 0; x < W; x++)
				if (TERRAIN[y][x] === 'tree' && inView(x, y))
					items.push({
						y: y * TILE + 15,
						draw: () => this.blit(tree(x * 7 + y), x * TILE - 1, y * TILE - 9)
					});

		for (const b of BUILDINGS)
			items.push({
				y: (b.y + b.h) * TILE - 1,
				draw: () => this.blit(building(b), b.x * TILE - 1, b.y * TILE - ROOF[b.kind] - 1)
			});

		for (const npc of NPCS) {
			const dir = this.npcFacing.get(npc.id) ?? 'down';
			const look = { hair: npc.hair, shirt: npc.shirt, cap: false };
			const req = this.farm.requests[npc.id];
			items.push({
				y: npc.y * TILE + 14,
				draw: () => {
					this.blit(person(dir, 0, look), npc.x * TILE - 1, npc.y * TILE - 3, dir === 'left');
					if (req) this.bubble(npc.x * TILE + 8, npc.y * TILE - 8 - bob, req.item, req.count);
				}
			});
		}

		const hp = this.hen.pos();
		const hs = henState(this.farm, now);
		items.push({
			y: hp.y * TILE + 13,
			draw: () => {
				const pecking = hs === 'eating' && Math.floor(time / 300) % 2 === 0;
				this.blit(chicken(pecking), hp.x * TILE + 1, hp.y * TILE + 2, this.hen.left);
				if (hs === 'egg') this.blit(icon('egg'), hp.x * TILE + 9, hp.y * TILE + 6 - bob, false, 10);
				if (hs === 'hungry') this.bubble(hp.x * TILE + 8, hp.y * TILE - 4 - bob, 'grain');
			}
		});

		const cp = this.cow.pos();
		const cs = cowState(this.farm, now);
		items.push({
			y: cp.y * TILE + 14,
			draw: () => {
				const eating = cs === 'eating' && Math.floor(time / 500) % 2 === 0;
				this.blit(cow(eating), cp.x * TILE - 4, cp.y * TILE, this.cow.left);
				if (cs === 'milk') this.bubble(cp.x * TILE + 8, cp.y * TILE - 6 - bob, 'milk');
				if (cs === 'hungry') this.bubble(cp.x * TILE + 8, cp.y * TILE - 6 - bob, 'hay');
			}
		});

		const sp = this.sheep.pos();
		const woolly = sheepState(this.farm, now) === 'woolly';
		items.push({
			y: sp.y * TILE + 14,
			draw: () => {
				this.blit(sheep(woolly), sp.x * TILE - 1, sp.y * TILE + 1, this.sheep.left);
				if (woolly) this.bubble(sp.x * TILE + 8, sp.y * TILE - 6 - bob, 'wool');
			}
		});

		if (!this.farm.riding) {
			const h = this.farm.horse;
			items.push({
				y: h.y * TILE + 14,
				draw: () => this.drawHorse(h.x, h.y, this.horseFacing, 0)
			});
		}

		const step = this.from ? (this.steps % 2) * 2 + (this.t < 0.5 ? 1 : 0) : 0;
		const facing = this.farm.player.facing;
		items.push({
			y: pos.y * TILE + 14.5,
			draw: () => {
				if (this.farm.riding) this.drawRider(pos, facing, step);
				else
					this.blit(
						person(facing, step, PLAYER_LOOK),
						pos.x * TILE - 1,
						pos.y * TILE - 3,
						facing === 'left'
					);
				if (this.fishing) this.drawLine(pos, this.fishing.tile, this.fishing.bite, time);
			}
		});

		items.sort((a, b) => a.y - b.y);
		for (const item of items) item.draw();

		this.drawFloaters();
	}

	private drawPlots(now: number, bob: number) {
		const { ctx } = this;
		PLOTS.forEach((spot, i) => {
			const plot = this.farm.plots[i];
			const x = spot.x * TILE;
			const y = spot.y * TILE;
			const wet = plot?.wateredAt != null;
			ctx.fillStyle = wet ? C.soilWet : C.soilDry;
			ctx.fillRect(x, y, TILE, TILE);
			ctx.fillStyle = wet ? C.soilWetDark : C.soilDryDark;
			for (const fy of [3, 8, 13]) ctx.fillRect(x + 1, y + fy, TILE - 2, 1);
			if (!plot) return;
			const st = stage(plot, now);
			if (st === 'thirsty') {
				this.blit(icon('seed'), x - 1, y - 1);
				this.bubble(x + 11, y + 6 - bob, 'drop');
			} else if (st === 'sprout') this.blit(icon('sprout'), x - 1, y - 1);
			else if (st === 'growing') this.blit(growing(plot.crop), x - 1, y - 1);
			else this.blit(icon(plot.crop), x - 1, y - 2 - bob);
			if (st === 'sprout' || st === 'growing') {
				ctx.fillStyle = C.ink;
				ctx.fillRect(x + 2, y + 14, 12, 2);
				ctx.fillStyle = C.leafLight;
				ctx.fillRect(x + 2, y + 14, Math.round(12 * progress(plot, now)), 2);
			}
		});
	}

	/** Corner brackets round where the player is heading. */
	private drawMarker(m: Spot, time: number) {
		const { ctx } = this;
		const x = m.x * TILE;
		const y = m.y * TILE;
		const g = Math.floor(time / 250) % 2;
		ctx.fillStyle = C.white;
		for (const [cx, cy, sx, sy] of [
			[x - g, y - g, 1, 1],
			[x + TILE + g, y - g, -1, 1],
			[x - g, y + TILE + g, 1, -1],
			[x + TILE + g, y + TILE + g, -1, -1]
		]) {
			ctx.fillRect(sx > 0 ? cx : cx - 4, sy > 0 ? cy : cy - 1, 4, 1);
			ctx.fillRect(sx > 0 ? cx : cx - 1, sy > 0 ? cy : cy - 4, 1, 4);
		}
	}

	/** The fishing line and float; the float dips when a fish bites. */
	private drawLine(pos: Spot, tile: Spot, bite: boolean, time: number) {
		const { ctx } = this;
		const hx = pos.x * TILE + 8 + STEP[this.farm.player.facing].x * 6;
		const hy = pos.y * TILE + 6;
		const dip = bite ? (Math.floor(time / 120) % 2) + 1 : Math.floor(time / 700) % 2;
		const fx = tile.x * TILE + 8;
		const fy = tile.y * TILE + 8 + dip;
		ctx.strokeStyle = C.white;
		ctx.lineWidth = 0.5;
		ctx.beginPath();
		ctx.moveTo(hx, hy);
		ctx.quadraticCurveTo((hx + fx) / 2, Math.min(hy, fy) - 10, fx, fy);
		ctx.stroke();
		ctx.fillStyle = C.ink;
		ctx.fillRect(fx - 3, fy - 3, 6, 6);
		ctx.fillStyle = C.berry;
		ctx.fillRect(fx - 2, fy - 2, 4, 2);
		ctx.fillStyle = C.white;
		ctx.fillRect(fx - 2, fy, 4, 2);
		if (bite) {
			ctx.fillStyle = C.waterLight;
			ctx.fillRect(fx - 6, fy + 3, 3, 1);
			ctx.fillRect(fx + 3, fy + 3, 3, 1);
			this.bubbleText(pos.x * TILE + 8, pos.y * TILE - 8, '!');
		}
	}

	private drawHorse(x: number, y: number, dir: Dir, step: number) {
		const sprite = horse(dir, step);
		const side = dir === 'left' || dir === 'right';
		this.blit(
			sprite,
			side ? x * TILE - 8 : x * TILE - 2,
			y * TILE + 16 - sprite.h + 1,
			dir === 'left'
		);
	}

	private drawRider(pos: Spot, dir: Dir, step: number) {
		const rider = person(dir, 0, PLAYER_LOOK, true);
		const x = pos.x * TILE;
		const y = pos.y * TILE;
		const horseStep = step % 2;
		if (dir === 'up') {
			this.drawHorse(pos.x, pos.y, dir, horseStep);
			this.blit(rider, x - 1, y - 12);
		} else if (dir === 'down') {
			this.blit(rider, x - 1, y - 14);
			this.drawHorse(pos.x, pos.y, dir, horseStep);
		} else {
			this.drawHorse(pos.x, pos.y, dir, horseStep);
			this.blit(rider, dir === 'right' ? x - 2 : x, y - 9, dir === 'left');
		}
	}

	/** A little white speech bubble with an icon (and a number) in it. */
	private bubble(cx: number, cy: number, what: Icon, count?: number) {
		const wide = count !== undefined;
		const w = wide ? 23 : 12;
		const left = cx - w / 2;
		this.box(left, cy - 7, w, 12);
		this.blit(icon(what), left + 1, cy - 6, false, 10);
		if (wide) this.text(String(count), left + 12, cy + 1, 7);
	}

	private bubbleText(cx: number, cy: number, text: string) {
		this.box(cx - 5, cy - 7, 10, 12);
		this.text(text, cx - 3, cy + 2, 8);
	}

	private box(x: number, y: number, w: number, h: number) {
		const { ctx } = this;
		ctx.fillStyle = C.ink;
		ctx.fillRect(x, y + 1, w, h - 2);
		ctx.fillRect(x + 1, y, w - 2, h);
		ctx.fillStyle = C.white;
		ctx.fillRect(x + 1, y + 2, w - 2, h - 4);
		ctx.fillRect(x + 2, y + 1, w - 4, h - 2);
	}

	private text(text: string, x: number, y: number, size: number) {
		const { ctx } = this;
		ctx.font = `${size}px "Press Start 2P", monospace`;
		ctx.fillStyle = C.ink;
		ctx.fillText(text, x, y);
	}

	private drawFloaters() {
		const { ctx } = this;
		const now = performance.now();
		this.floaters = this.floaters.filter((f) => now - f.born < 1000);
		for (const f of this.floaters) {
			const age = (now - f.born) / 1000;
			const x = f.x * TILE;
			const y = f.y * TILE - 6 - age * 20;
			ctx.globalAlpha = 1 - age * age;
			this.blit(icon(f.icon), x - 4, y - 4, false, 12);
			ctx.font = '8px "Press Start 2P", monospace';
			ctx.lineWidth = 3;
			ctx.strokeStyle = C.ink;
			ctx.fillStyle = C.white;
			ctx.strokeText(f.text, x + 9, y + 6);
			ctx.fillText(f.text, x + 9, y + 6);
			ctx.globalAlpha = 1;
		}
	}

	private blit(sprite: Sprite, x: number, y: number, flip = false, size?: number) {
		const { ctx } = this;
		const w = size ?? sprite.w;
		const h = size ? (size * sprite.h) / sprite.w : sprite.h;
		if (!flip) {
			ctx.drawImage(sprite.canvas, x, y, w, h);
			return;
		}
		ctx.save();
		ctx.translate(x + w, y);
		ctx.scale(-1, 1);
		ctx.drawImage(sprite.canvas, 0, 0, w, h);
		ctx.restore();
	}
}

/** Keeps the camera on the map, or centres the map if it's smaller than the screen. */
function clampCam(c: number, size: number, view: number) {
	if (view >= size) return (size - view) / 2;
	return Math.min(size - view, Math.max(0, c));
}

/** Rounds to a whole screen pixel, so pixel art doesn't shimmer. */
function snap(v: number, s: number) {
	return Math.round(v * s) / s;
}
