/**
 * PRNG déterministe xoshiro128**. L'état (4 × uint32) vit dans GameState.rng :
 * même état + mêmes commandes ⇒ mêmes résultats. Math.random est interdit
 * dans game-core (règle ESLint).
 */
export type RngState = [number, number, number, number];

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** Initialise l'état à partir d'une graine (splitmix32). */
export function seedRng(seed: number): RngState {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  const st: RngState = [next(), next(), next(), next()];
  if (st.every((v) => v === 0)) st[0] = 1;
  return st;
}

/** Tire un uint32 et fait avancer l'état (muté en place). */
export function nextU32(st: RngState): number {
  const result = Math.imul(rotl(Math.imul(st[1], 5) >>> 0, 7), 9) >>> 0;
  const t = (st[1] << 9) >>> 0;
  st[2] = (st[2] ^ st[0]) >>> 0;
  st[3] = (st[3] ^ st[1]) >>> 0;
  st[1] = (st[1] ^ st[2]) >>> 0;
  st[0] = (st[0] ^ st[3]) >>> 0;
  st[2] = (st[2] ^ t) >>> 0;
  st[3] = rotl(st[3], 11);
  return result;
}

/** Interface de tirage utilisée par tous les systèmes. */
export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  weighted<T>(items: readonly T[], weight: (t: T) => number): T | undefined;
  shuffle<T>(arr: T[]): T[];
  normal(mean: number, sd: number): number;
}

export function makeRng(st: RngState): Rng {
  const rng: Rng = {
    next: () => nextU32(st) / 4294967296,
    int: (min, max) => min + Math.floor(rng.next() * (max - min + 1)),
    chance: (p) => rng.next() < p,
    pick: (arr) => {
      if (!arr.length) throw new Error('pick sur tableau vide');
      return arr[Math.floor(rng.next() * arr.length)]!;
    },
    weighted: (items, weight) => {
      let total = 0;
      for (const it of items) total += Math.max(0, weight(it));
      if (total <= 0) return undefined;
      let r = rng.next() * total;
      for (const it of items) {
        r -= Math.max(0, weight(it));
        if (r <= 0) return it;
      }
      return items[items.length - 1];
    },
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      }
      return arr;
    },
    normal: (mean, sd) => {
      const u = Math.max(1e-9, rng.next());
      const v = rng.next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
  return rng;
}

/** RNG d'un état de partie (mute state.rng — à utiliser dans un draft). */
export function gameRng(state: { rng: RngState }): Rng {
  return makeRng(state.rng);
}
