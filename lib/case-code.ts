/**
 * Reversible, keyed obfuscation of the integer case id for use in URLs.
 *
 * The database keeps simple sequential integer ids (easy to browse), but we
 * never expose them directly. `encodeCaseId` turns id 3 into an opaque 7-char
 * token like "K7X2QM4"; `decodeCaseId` reverses it. This is obfuscation (à la
 * hashids), not encryption — access control is still enforced in the API. It
 * only stops users from reading/guessing "/portal/cases/3".
 *
 * Uses a 32-bit Feistel permutation keyed from PORTAL_JWT_SECRET, so the
 * mapping is a stable bijection over the id space with no per-id state.
 */
import { createHash } from 'crypto'

const SECRET = process.env.PORTAL_JWT_SECRET ?? 'dev-insecure-secret'
const ROUNDS = 4
const MASK16 = 0xffff
// Crockford base32 (no I, L, O, U) — 7 chars encode a full 32-bit value.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LEN = 7

// Deterministic round keys derived from the app secret.
const KEYS: number[] = Array.from({ length: ROUNDS }, (_, i) =>
  createHash('sha256').update(`${SECRET}:case-code:${i}`).digest().readUInt32BE(0)
)

function roundFn(half: number, key: number): number {
  const t = Math.imul((half ^ key) >>> 0, 0x9e3779b1) >>> 0
  return (t >>> 16) & MASK16
}

function feistelEncrypt(x: number): number {
  let l = (x >>> 16) & MASK16
  let r = x & MASK16
  for (let i = 0; i < ROUNDS; i++) {
    const nl = r
    const nr = (l ^ roundFn(r, KEYS[i])) & MASK16
    l = nl
    r = nr
  }
  return (((l << 16) >>> 0) | r) >>> 0
}

function feistelDecrypt(y: number): number {
  let l = (y >>> 16) & MASK16
  let r = y & MASK16
  for (let i = ROUNDS - 1; i >= 0; i--) {
    const rPrev = l
    const lPrev = (r ^ roundFn(l, KEYS[i])) & MASK16
    l = lPrev
    r = rPrev
  }
  return (((l << 16) >>> 0) | r) >>> 0
}

function toBase32(n: number): string {
  let v = n >>> 0
  let s = ''
  for (let i = 0; i < CODE_LEN; i++) {
    s = ALPHABET[v % 32] + s
    v = Math.floor(v / 32)
  }
  return s
}

function fromBase32(token: string): number | null {
  if (token.length !== CODE_LEN) return null
  let v = 0
  for (const ch of token) {
    const idx = ALPHABET.indexOf(ch)
    if (idx < 0) return null
    v = v * 32 + idx
  }
  return v >>> 0
}

/** Encode an internal integer id (or its string form) to a public URL token. */
export function encodeCaseId(id: number | string): string {
  const n = typeof id === 'number' ? id : parseInt(id, 10)
  if (!Number.isInteger(n) || n < 0) return ''
  return toBase32(feistelEncrypt(n >>> 0))
}

/**
 * Decode a public URL token back to the internal integer id.
 * Returns -1 for anything malformed so callers' WHERE clauses match nothing.
 */
export function decodeCaseId(token: string | number): number {
  if (typeof token === 'number') return Number.isInteger(token) && token > 0 ? token : -1
  const scrambled = fromBase32(token.toUpperCase())
  if (scrambled === null) return -1
  const id = feistelDecrypt(scrambled)
  return id > 0 && id < 0x7fffffff ? id : -1
}
