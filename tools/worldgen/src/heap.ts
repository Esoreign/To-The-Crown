/** Tas binaire minimal (clé flottante, valeur entière) pour Dijkstra multi-sources. */
export class MinHeap {
  private keys: Float64Array;
  private vals: Int32Array;
  size = 0;

  constructor(capacity = 1 << 20) {
    this.keys = new Float64Array(capacity);
    this.vals = new Int32Array(capacity);
  }

  push(key: number, val: number): void {
    if (this.size === this.keys.length) {
      const k = new Float64Array(this.keys.length * 2);
      k.set(this.keys);
      this.keys = k;
      const v = new Int32Array(this.vals.length * 2);
      v.set(this.vals);
      this.vals = v;
    }
    let i = this.size++;
    const keys = this.keys;
    const vals = this.vals;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p]! <= key) break;
      keys[i] = keys[p]!;
      vals[i] = vals[p]!;
      i = p;
    }
    keys[i] = key;
    vals[i] = val;
  }

  /** Retire le minimum ; la clé est disponible dans `lastKey`. */
  lastKey = 0;
  pop(): number {
    const keys = this.keys;
    const vals = this.vals;
    const top = vals[0]!;
    this.lastKey = keys[0]!;
    const n = --this.size;
    if (n > 0) {
      const key = keys[n]!;
      const val = vals[n]!;
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && keys[c + 1]! < keys[c]!) c++;
        if (keys[c]! >= key) break;
        keys[i] = keys[c]!;
        vals[i] = vals[c]!;
        i = c;
      }
      keys[i] = key;
      vals[i] = val;
    }
    return top;
  }
}
