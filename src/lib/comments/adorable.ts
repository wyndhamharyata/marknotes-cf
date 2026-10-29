// TypeScript port of github.com/ipsn/go-adorable.
// MIT, Péter Szilágyi. The face parts and the PRNG are the original's, so a
// seed picks the same eyes, nose, mouth and background the old Go site picked.
// Source: github.com/wyndhamharyata/go-adorable, ts/src/index.ts.

import { sha3_256 } from "@noble/hashes/sha3.js";
import { hmac } from "@noble/hashes/hmac.js";

export interface Face {
  /** Index into the nine eyes images. */
  eyes: number;
  /** Index into the eight nose images. */
  nose: number;
  /** Index into the eight mouth images. */
  mouth: number;
  /** Opaque sRGB background, one byte per channel. */
  background: readonly [number, number, number];
}

// go-colorful's D65 reference white.
const D65 = [0.95047, 1.0, 1.08883] as const;
const MAX_U64 = (1n << 64n) - 1n;

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

// HKDF-SHA3-256 with a nil salt and no info, as golang.org/x/crypto/hkdf reads it.
class HkdfStream {
  private readonly prk: Uint8Array;
  private block: Uint8Array = new Uint8Array(0);
  private buf: Uint8Array = new Uint8Array(0);
  private counter = 0;

  constructor(prk: Uint8Array) {
    this.prk = prk;
  }

  read(n: number): Uint8Array {
    while (this.buf.length < n) {
      this.block = hmac(sha3_256, this.prk, concat(this.block, Uint8Array.of(++this.counter)));
      this.buf = concat(this.buf, this.block);
    }
    const out = this.buf.slice(0, n);
    this.buf = this.buf.slice(n);
    return out;
  }
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n;
}

// crypto/rand.Int: read k bytes, mask the high byte, retry while >= max.
function randomInt(stream: HkdfStream, max: bigint): bigint {
  if (max <= 0n) throw new RangeError("max must be positive");
  if (max === 1n) return 0n;

  const bitLen = (max - 1n).toString(2).length;
  const k = Math.ceil(bitLen / 8);
  const bits = bitLen % 8 || 8;
  const mask = (1 << bits) - 1;

  for (;;) {
    const bytes = stream.read(k);
    bytes[0] &= mask;
    const n = bytesToBigInt(bytes);
    if (n < max) return n;
  }
}

function randomFloat(stream: HkdfStream): number {
  return Number(randomInt(stream, MAX_U64)) / Number(MAX_U64);
}

function labFinv(t: number): number {
  if (t > 6.0 / 29.0) return t * t * t;
  return ((3.0 * 6.0) / 29.0) * ((6.0 / 29.0) * (t - 4.0 / 29.0));
}

function delinearize(v: number): number {
  if (v <= 0.0031308) return 12.92 * v;
  return 1.055 * Math.pow(v, 1.0 / 2.4) - 0.055;
}

const clamp01 = (v: number) => Math.max(0, Math.min(v, 1));

// colorful.Hcl(h, c, l).Clamped() for the D65 white point.
function hclToRgb(h: number, c: number, l: number): [number, number, number] {
  const H = 0.01745329251994329576 * h;
  const a = c * Math.cos(H);
  const b = c * Math.sin(H);
  const l2 = (l + 0.16) / 1.16;
  const x = D65[0] * labFinv(l2 + a / 5.0);
  const y = D65[1] * labFinv(l2);
  const z = D65[2] * labFinv(l2 - b / 2.0);
  const r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const g = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const b2 = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return [clamp01(delinearize(r)), clamp01(delinearize(g)), clamp01(delinearize(b2))];
}

/** The deterministic face for a seed, as go-adorable's PseudoRandom picks it. */
export function pseudoRandom(seed: string | Uint8Array): Face {
  const secret = typeof seed === "string" ? new TextEncoder().encode(seed) : seed;
  const prk = hmac(sha3_256, new Uint8Array(32), secret);
  const stream = new HkdfStream(prk);

  const h = 360 * randomFloat(stream);
  const c = 0.5 + 0.5 * randomFloat(stream);
  const l = 0.5 + 0.4 * randomFloat(stream);
  const [r, g, b] = hclToRgb(h, c, l).map((v) => Math.trunc(255 * v)) as [number, number, number];

  return {
    eyes: Number(randomInt(stream, 9n)),
    nose: Number(randomInt(stream, 8n)),
    mouth: Number(randomInt(stream, 8n)),
    background: [r, g, b],
  };
}
