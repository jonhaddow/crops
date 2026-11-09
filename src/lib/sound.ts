// Little synthesised sounds (no audio files). Browsers only allow audio after
// a tap, which is the only time these play.
let ctx: AudioContext | null = null;

function tone(freq: number, start: number, length: number, type: OscillatorType = 'sine') {
	ctx ??= new AudioContext();
	const t = ctx.currentTime + start;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t);
	gain.gain.setValueAtTime(0.0001, t);
	gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
	gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
	osc.connect(gain).connect(ctx.destination);
	osc.start(t);
	osc.stop(t + length + 0.02);
}

const sounds = {
	plant: () => tone(330, 0, 0.12, 'triangle'),
	water: () => {
		tone(880, 0, 0.08);
		tone(660, 0.07, 0.1);
	},
	pop: () => {
		tone(523, 0, 0.1, 'triangle');
		tone(784, 0.08, 0.16, 'triangle');
	},
	coin: () => {
		tone(988, 0, 0.08, 'square');
		tone(1319, 0.07, 0.18, 'square');
	},
	cluck: () => {
		tone(420, 0, 0.07, 'sawtooth');
		tone(360, 0.09, 0.07, 'sawtooth');
	},
	talk: () => {
		tone(600, 0, 0.05, 'square');
		tone(750, 0.05, 0.05, 'square');
	},
	neigh: () => {
		for (let i = 0; i < 5; i++) tone(700 - i * 60 + (i % 2) * 80, i * 0.06, 0.07, 'sawtooth');
	},
	step: () => tone(520, 0, 0.04, 'triangle'),
	moo: () => {
		tone(140, 0, 0.35, 'sawtooth');
		tone(120, 0.2, 0.3, 'sawtooth');
	},
	baa: () => {
		for (let i = 0; i < 4; i++) tone(420 + (i % 2) * 30, i * 0.07, 0.07, 'sawtooth');
	},
	splash: () => {
		tone(900, 0, 0.06);
		tone(1200, 0.05, 0.06);
		tone(700, 0.1, 0.1);
	},
	nope: () => tone(180, 0, 0.15, 'triangle')
};

export type Sound = keyof typeof sounds;

export function play(sound: Sound) {
	try {
		sounds[sound]();
	} catch {
		// No audio: the game works silently.
	}
}
