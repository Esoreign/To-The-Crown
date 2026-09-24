/**
 * Audio entièrement synthétisé (WebAudio) : effets, musique modale
 * procédurale et ambiance de vent. Aucune ressource sonore externe.
 */
import type { SoundKey } from '@ttc/shared';
import { useSettings } from '../state/settings';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let ambientBus: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let musicTimer: number | null = null;
let windSource: AudioBufferSourceNode | null = null;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  ambientBus = ctx.createGain();
  reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 2.6, 2.2);
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  reverb.connect(wet).connect(master);
  sfxBus.connect(master);
  musicBus.connect(master);
  musicBus.connect(reverb);
  ambientBus.connect(master);
  master.connect(ctx.destination);
  applyVolumes();
  useSettings.subscribe(applyVolumes);
  return ctx;
}

function impulse(c: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function applyVolumes(): void {
  if (!ctx || !master || !sfxBus || !musicBus || !ambientBus) return;
  const s = useSettings.getState();
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(s.masterVolume, t, 0.05);
  sfxBus.gain.setTargetAtTime(s.sfxVolume, t, 0.05);
  musicBus.gain.setTargetAtTime(s.musicVolume * 0.5, t, 0.3);
  ambientBus.gain.setTargetAtTime(s.ambientVolume * 0.25, t, 0.3);
}

/** À appeler après une interaction utilisateur (politique d'autoplay). */
export function unlockAudio(): void {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; at?: number; attack?: number; bus?: GainNode | null; detune?: number; filter?: number } = {}): void {
  const c = ensure();
  if (!c) return;
  const start = c.currentTime + (opts.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = opts.filter ?? 3200;
  osc.type = opts.type ?? 'triangle';
  osc.frequency.value = freq;
  osc.detune.value = opts.detune ?? 0;
  const peak = opts.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + (opts.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(f).connect(g).connect(opts.bus ?? sfxBus!);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noiseBurst(dur: number, gain: number, freq: number, at = 0): void {
  const c = ensure();
  if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(sfxBus!);
  src.start(c.currentTime + at);
}

const NOTE = (n: number) => 220 * Math.pow(2, n / 12);

export function playSound(key: SoundKey | 'click'): void {
  if (!ensure()) return;
  switch (key) {
    case 'click':
      tone(NOTE(19), 0.06, { type: 'square', gain: 0.03, filter: 1800 });
      break;
    case 'notify':
      tone(NOTE(12), 0.25, { gain: 0.08 });
      tone(NOTE(19), 0.35, { gain: 0.06, at: 0.08 });
      break;
    case 'event':
      [0, 3, 7, 12].forEach((n, i) => tone(NOTE(n), 1.2, { gain: 0.07, at: i * 0.09, type: 'sine' }));
      break;
    case 'confirm':
      tone(NOTE(7), 0.18, { gain: 0.07 });
      tone(NOTE(12), 0.25, { gain: 0.07, at: 0.07 });
      break;
    case 'error':
      tone(NOTE(-5), 0.22, { type: 'sawtooth', gain: 0.05, filter: 900 });
      tone(NOTE(-6), 0.3, { type: 'sawtooth', gain: 0.04, at: 0.1, filter: 800 });
      break;
    case 'coin':
      tone(NOTE(24), 0.12, { type: 'square', gain: 0.03, filter: 5000 });
      tone(NOTE(31), 0.25, { type: 'square', gain: 0.03, at: 0.06, filter: 5000 });
      break;
    case 'build':
      noiseBurst(0.08, 0.2, 900);
      noiseBurst(0.08, 0.18, 700, 0.18);
      tone(NOTE(0), 0.4, { gain: 0.05, at: 0.3 });
      break;
    case 'war':
      [0, 0, 5].forEach((n, i) => tone(NOTE(n - 12), 0.5, { type: 'sawtooth', gain: 0.07, at: i * 0.22, filter: 1200 }));
      noiseBurst(0.4, 0.15, 180, 0.1);
      break;
    case 'battle':
      noiseBurst(0.25, 0.25, 2500);
      noiseBurst(0.3, 0.2, 400, 0.12);
      tone(NOTE(-12), 0.6, { type: 'sawtooth', gain: 0.05, filter: 600 });
      break;
    case 'death':
      [0, -2, -5, -9].forEach((n, i) => tone(NOTE(n - 12), 1.6, { type: 'sine', gain: 0.08, at: i * 0.35, attack: 0.2 }));
      break;
    case 'birth':
      [0, 4, 7, 12, 16].forEach((n, i) => tone(NOTE(n + 12), 0.6, { type: 'sine', gain: 0.05, at: i * 0.07 }));
      break;
    case 'fanfare':
      [0, 4, 7, 12].forEach((n, i) => tone(NOTE(n), 0.5, { type: 'sawtooth', gain: 0.045, at: i * 0.12, filter: 2000 }));
      tone(NOTE(12), 1.2, { type: 'sawtooth', gain: 0.05, at: 0.5, filter: 2200 });
      break;
  }
}

// ---------------------------------------------------------------- Musique
const SCALE = [0, 2, 3, 5, 7, 9, 10]; // dorien

export function startMusic(): void {
  const c = ensure();
  if (!c || musicTimer !== null) return;
  let step = 0;
  let root = -12;
  const loop = () => {
    const s = useSettings.getState();
    if (s.musicVolume > 0 && s.masterVolume > 0) {
      if (step % 16 === 0) {
        root = [-12, -10, -7, -9][Math.floor(step / 16) % 4]!;
        tone(NOTE(root - 12), 7.5, { type: 'sine', gain: 0.05, attack: 1.8, bus: musicBus });
        tone(NOTE(root - 5), 7.5, { type: 'sine', gain: 0.03, attack: 2.2, bus: musicBus, detune: 4 });
      }
      if (Math.random() < 0.55) {
        const deg = SCALE[Math.floor(Math.random() * SCALE.length)]!;
        const oct = Math.random() < 0.3 ? 12 : 0;
        tone(NOTE(root + 12 + deg + oct), 1.8, { type: 'triangle', gain: 0.035, bus: musicBus, filter: 1800 });
      }
    }
    step++;
    musicTimer = window.setTimeout(loop, 520);
  };
  loop();
  startWind();
}

export function stopMusic(): void {
  if (musicTimer !== null) window.clearTimeout(musicTimer);
  musicTimer = null;
}

function startWind(): void {
  const c = ensure();
  if (!c || windSource) return;
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + (Math.random() * 2 - 1) * 0.02) * 0.995;
    d[i] = last * 3;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 500;
  src.connect(f).connect(ambientBus!);
  src.start();
  windSource = src;
}
