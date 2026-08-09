/**
 * Deterministic PRNG (mulberry32) seeded by a string or number.
 * The same seed always produces the same paper, on every platform.
 */
export type Seed = string | number;

export class Rng {
  private state: number;

  constructor(seed: Seed) {
    this.state = typeof seed === "number" ? seed >>> 0 : hashString(String(seed));
    // Warm up so nearby numeric seeds diverge immediately.
    for (let i = 0; i < 4; i++) this.next();
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Integer in [lo, hi], inclusive. */
  range(lo: number, hi: number): number {
    return lo + this.int(hi - lo + 1);
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  /** n distinct elements, order randomized (n clamped to arr.length). */
  sample<T>(arr: readonly T[], n: number): T[] {
    const copy = [...arr];
    const out: T[] = [];
    const take = Math.min(n, copy.length);
    for (let i = 0; i < take; i++) out.push(copy.splice(this.int(copy.length), 1)[0]);
    return out;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Weighted pick from [value, weight] pairs. */
  weighted<T>(pairs: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, w] of pairs) total += w;
    let roll = this.next() * total;
    for (const [v, w] of pairs) {
      roll -= w;
      if (roll <= 0) return v;
    }
    return pairs[pairs.length - 1][0];
  }
}

/** xmur3 string hash, for string seeds. */
function hashString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
