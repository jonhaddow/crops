// The village, running: tile-by-tile movement, the camera, the wandering
// chicken, riding, and drawing each frame. The farm's state lives in `Farm`
// (saved); everything here that isn't in it (animation, the chicken's spot)
// is just for show.
import { chicken as henState, progress, stage, type Farm } from '../game.ts';
import { facingTile, target, type Target } from './interact.ts';
import {
	BUILDINGS,
	H,
	NPCS,
	open,
	PEN,
	PLOTS,
	STEP,
	TERRAIN,
	W,
	type Dir,
	type Spot
} from './map.ts';
import {
	background,
	building,
	C,
	chicken,
	growing,
	horse,
	icon,
	person,
	PLAYER_LOOK,
	ROOF,
	TILE,
	tree,
	type Icon,
	type Sprite
} from './sprites.ts';

const WALK_MS = 230;
const RIDE_MS = 115;
/** A quick tap on the D-pad just turns; holding longer walks. */
const TURN_MS = 90;

type Floater = { x: number; y: number; icon: Icon; text: string; born: number };

export class World {
	held: Dir | null = null;
	paused = false;

	private ctx: CanvasRenderingContext2D;
	private bg: HTMLCanvasElement;
	private from: Spot | null = null;
	private t = 0;
	private steps = 0;
	private heldSince = 0;
	private hen = { x: 12, y: 12, from: null as Spot | null, t: 0, left: false, next: 0 };
	private horseFacing: Dir = 'right';
	private npcFacing = new Map<string, Dir>();
	private floaters: Floater[] = [];
	private frame = 0;
	private last = 0;
	private scale = 4;
	private dpr = 1;

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

	henSpot(): Spot {
		return { x: this.hen.x, y: this.hen.y };
	}

	target(now: number): Target | null {
		return target(this.farm, now, this.henSpot());
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

	private blocked(x: number, y: number): boolean {
		if (!open(x, y)) return true;
		if (x === this.hen.x && y === this.hen.y) return true;
		if (this.hen.from && x === this.hen.from.x && y === this.hen.from.y) return true;
		const h = this.farm.horse;
		return !this.farm.riding && x === h.x && y === h.y;
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

		if (!this.from && this.held && !this.paused) {
			const dir = this.held;
			if (p.facing !== dir) {
				p.facing = dir;
				this.heldSince = performance.now();
				this.onMove();
			} else if (performance.now() - this.heldSince >= TURN_MS) {
				const x = p.x + STEP[dir].x;
				const y = p.y + STEP[dir].y;
				if (!this.blocked(x, y)) {
					this.from = { x: p.x, y: p.y };
					p.x = x;
					p.y = y;
					if (this.farm.riding) this.farm.horse = { x, y };
				}
			}
		} else if (!this.held) {
			this.heldSince = 0;
		}

		this.wanderHen(dt, now);
	}

	private wanderHen(dt: number, now: number) {
		const hen = this.hen;
		if (hen.from) {
			hen.t += dt / 450;
			if (hen.t >= 1) {
				hen.from = null;
				hen.t = 0;
			}
			return;
		}
		if (now < hen.next) return;
		hen.next = now + 1500 + Math.random() * 2500;
		// Stays put to eat.
		if (henState(this.farm, now) === 'eating' && Math.random() < 0.7) return;
		const dirs: Dir[] = ['up', 'down', 'left', 'right'];
		const d = dirs[Math.floor(Math.random() * 4)];
		const x = hen.x + STEP[d].x;
		const y = hen.y + STEP[d].y;
		const inPen = x >= PEN.x && x < PEN.x + PEN.w && y >= PEN.y && y < PEN.y + PEN.h;
		const p = this.farm.player;
		if (!inPen || (p.x === x && p.y === y) || (this.from && this.from.x === x && this.from.y === y))
			return;
		if (d === 'left') hen.left = true;
		if (d === 'right') hen.left = false;
		hen.from = { x: hen.x, y: hen.y };
		hen.x = x;
		hen.y = y;
	}

	/** Where the player is drawn, part way between tiles while moving. */
	private playerPos(): Spot {
		const p = this.farm.player;
		if (!this.from) return { x: p.x, y: p.y };
		const t = ease(this.t);
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

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.fillStyle = C.leafDark;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.imageSmoothingEnabled = false;
		ctx.setTransform(s, 0, 0, s, -camX * s, -camY * s);
		ctx.drawImage(this.bg, 0, 0);

		const bob = Math.floor(time / 400) % 2;
		this.drawPlots(now, bob);

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
			items.push({
				y: npc.y * TILE + 14,
				draw: () =>
					this.blit(person(dir, 0, look), npc.x * TILE - 1, npc.y * TILE - 3, dir === 'left')
			});
		}

		const hen = this.hen;
		const ht = ease(hen.t);
		const hx = hen.from ? hen.from.x + (hen.x - hen.from.x) * ht : hen.x;
		const hy = hen.from ? hen.from.y + (hen.y - hen.from.y) * ht : hen.y;
		const hs = henState(this.farm, now);
		items.push({
			y: hy * TILE + 13,
			draw: () => {
				const pecking = hs === 'eating' && Math.floor(time / 300) % 2 === 0;
				this.blit(chicken(pecking), hx * TILE + 1, hy * TILE + 2, hen.left);
				if (hs === 'egg') this.blit(icon('egg'), hx * TILE + 9, hy * TILE + 6 - bob, false, 10);
				if (hs === 'hungry') this.bubble(hx * TILE + 8, hy * TILE - 4 - bob, 'grain');
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
				if (this.farm.riding) {
					this.drawRider(pos, facing, step);
				} else {
					this.blit(
						person(facing, step, PLAYER_LOOK),
						pos.x * TILE - 1,
						pos.y * TILE - 3,
						facing === 'left'
					);
				}
			}
		});

		items.sort((a, b) => a.y - b.y);
		for (const item of items) item.draw();

		// A blinking frame round whatever A would act on.
		const t = this.paused || this.from ? null : this.target(now);
		if (t && t.kind !== 'dismount' && Math.floor(time / 500) % 2 === 0) {
			const f = facingTile(this.farm);
			ctx.strokeStyle = C.white;
			ctx.lineWidth = 1;
			ctx.strokeRect(f.x * TILE + 0.5, f.y * TILE + 0.5, TILE - 1, TILE - 1);
		}

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

	/** A little white thought bubble with an icon in it. */
	private bubble(cx: number, cy: number, what: Icon) {
		const { ctx } = this;
		ctx.fillStyle = C.ink;
		ctx.fillRect(cx - 6, cy - 7, 12, 12);
		ctx.fillRect(cx - 7, cy - 6, 14, 10);
		ctx.fillStyle = C.white;
		ctx.fillRect(cx - 5, cy - 6, 10, 10);
		ctx.fillRect(cx - 6, cy - 5, 12, 8);
		this.blit(icon(what), cx - 5, cy - 6, false, 10);
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

function ease(t: number) {
	return Math.min(1, Math.max(0, t));
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
