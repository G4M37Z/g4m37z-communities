// src/lib/piggyback/protocol.ts
// Piggyback lane — pure wire format + E2E crypto. No browser-only APIs live
// here so every byte-level decision is unit-testable.
//
// Wire format (one broadcast message = one sealed chunk, 100 ms of audio):
//
//   unsealed plaintext:
//     u8  version (=1)
//     u8  kind    (=1 audio)
//     u16 nFrames (BE)
//     u32 baseMs  (BE — ms since capture start for frame 0)
//     n × { u16 len (BE), len bytes }   — raw Opus packets, 20 ms each
//
//   sealed = AES-GCM-256(key, plaintext, iv)
//   iv (12 B) = u32 saltPrefix (BE) | u64 counter (BE)
//
// Direction keys come from an ECDH P-256 exchange performed over
// webrtc_signals rows (RLS: members only). HKDF-SHA256 derives one key per
// direction, so each side's IV counters can never collide.
//
// Budget: 1 chunk / 100 ms = 10 msg/s sender-side (Supabase Free allows 100
// msg/s project-wide; a 1:1 call ≈ 40 msg/s incl. both directions).

export const PB_VERSION = 1;
export const PB_KIND_AUDIO = 1;
export const PB_BATCH_FRAMES = 5;
export const PB_BATCH_US = PB_BATCH_FRAMES * 20_000; // one chunk = 100 ms
export const PB_HEADER_BYTES = 8;

export interface PbBatch {
  kind: number;
  baseMs: number;
  frames: PbBytes[];
}

export interface PbChunkWire {
  v: number;
  k: string; // sender's key id
  c: number; // sender chunk counter (also replay/oo-guard)
  d: string; // base64 sealed plaintext
}

export type PbBytes = Uint8Array<ArrayBuffer>;

const MAX_FRAMES_IN_CHUNK = 255;

function need(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`piggyback: ${msg}`);
}

/** Serialize unsealed plaintext. Frames must be ≤ 60_000 B each. */
export function packPlaintext(kind: number, baseMs: number, frames: PbBytes[]): PbBytes {
  need(frames.length > 0, "pack with zero frames");
  need(frames.length <= MAX_FRAMES_IN_CHUNK, "too many frames for one chunk");
  let body = 0;
  for (const f of frames) {
    need(f.length <= 0xffff, "frame too big");
    body += 2 + f.length;
  }
  const out = new Uint8Array(PB_HEADER_BYTES + body) as PbBytes;
  const dv = new DataView(out.buffer);
  dv.setUint8(0, PB_VERSION);
  dv.setUint8(1, kind);
  dv.setUint16(2, frames.length, false);
  dv.setUint32(4, baseMs >>> 0, false);
  let off = PB_HEADER_BYTES;
  for (const f of frames) {
    dv.setUint16(off, f.length, false);
    out.set(f, off + 2);
    off += 2 + f.length;
  }
  return out;
}

/** Inverse of packPlaintext. Validates version/kind/lengths strictly. */
export function unpackPlaintext(b: PbBytes): PbBatch {
  need(b.length >= PB_HEADER_BYTES, "chunk truncated");
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  need(dv.getUint8(0) === PB_VERSION, "unknown piggyback version");
  const kind = dv.getUint8(1);
  const n = dv.getUint16(2, false);
  const baseMs = dv.getUint32(4, false);
  need(n > 0, "zero frames in chunk");
  const frames: PbBytes[] = [];
  let off = PB_HEADER_BYTES;
  for (let i = 0; i < n; i++) {
    need(off + 2 <= b.byteLength, "length overrun");
    const len = dv.getUint16(off, false);
    off += 2;
    need(off + len <= b.byteLength, "frame overrun");
    frames.push(b.slice(off, off + len));
    off += len;
  }
  need(off === b.byteLength, "trailing bytes in chunk");
  return { kind, baseMs, frames };
}

/** base64 for broadcast JSON transport (browser + Node). */
export function encB64(b: PbBytes): string {
  let s = "";
  const step = 0x8000;
  for (let i = 0; i < b.length; i += step) {
    s += String.fromCharCode(...b.subarray(i, i + step));
  }
  return btoa(s);
}

export function decB64(s: string): PbBytes {
  const bin = atob(s);
  const out = new Uint8Array(bin.length) as PbBytes;
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** IV = saltPrefix(4) | counter(8, BE). Counters stay < 2^32 per call. */
export function counterIv(prefix: PbBytes, counter: number): PbBytes {
  need(prefix.length === 4, "iv prefix must be 4 bytes");
  need(counter >= 0 && counter < 2 ** 31, "counter out of range");
  const iv = new Uint8Array(12) as PbBytes;
  iv.set(prefix, 0);
  const dv = new DataView(iv.buffer);
  dv.setUint32(4, Math.floor(counter / 2 ** 32), false);
  dv.setUint32(8, counter >>> 0, false);
  return iv;
}

const subtle = (): SubtleCrypto => {
  const c = globalThis.crypto as Crypto | undefined;
  need(c?.subtle, "WebCrypto unavailable");
  return c.subtle;
};

const encUtf8 = (s: string): PbBytes => new TextEncoder().encode(s) as PbBytes;

export interface PbKeyOffer {
  /** stable short id of the published key (12 hex) */
  kid: string;
  /** ephemeral ECDH P-256 public key */
  jwk: JsonWebKey;
  /** 4-byte hex (8 chars) — becomes THIS publisher's IV prefix */
  salt: string;
}

const hex = (bytes: PbBytes): string =>
  Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join("");

export async function randomHex(bytes: number): Promise<string> {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return hex(b);
}

/** Generate the session keypair + offer to publish via a PB_KEY row. */
export async function createKeyOffer(): Promise<{
  pair: CryptoKeyPair;
  offer: PbKeyOffer;
}> {
  const pair = await subtle().generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const jwk = await subtle().exportKey("jwk", pair.publicKey);
  const raw = await subtle().exportKey("raw", pair.publicKey);
  const kidHex = hex(new Uint8Array(await subtle().digest("SHA-256", raw))).slice(0, 12);
  const salt = await randomHex(4);
  return { pair, offer: { kid: kidHex, jwk, salt } };
}

export async function importOfferPub(offer: PbKeyOffer): Promise<CryptoKey> {
  return subtle().importKey(
    "jwk",
    offer.jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
}

/**
 * Derive both direction keys for this call. All inputs are public, the secret
 * is the ECDH shared secret; the identity/CallSession context is mixed into
 * HKDF info so keys can't be reused across conversations.
 */
export async function deriveDirectionKeys(
  myPriv: CryptoKey,
  theirPub: CryptoKey,
  args: {
    myId: string;
    peerId: string;
    /** call context string, e.g. `${conversationId}:${callId}` */
    context: string;
  },
): Promise<{ sendKey: CryptoKey; recvKey: CryptoKey }> {
  const { myId, peerId, context } = args;
  const ss = await subtle().deriveBits(
    { name: "ECDH", public: theirPub },
    myPriv,
    256,
  );
  const hkdf = await subtle().importKey("raw", ss, "HKDF", false, ["deriveKey"]);
  const salt = encUtf8(`gz-pb-v1|${context}`);
  const a = myId < peerId ? myId : peerId;
  const b = myId < peerId ? peerId : myId;
  const derive = (dir: "a" | "b") =>
    subtle().deriveKey(
      { name: "HKDF", hash: "SHA-256", salt, info: encUtf8(`gz-pb-v1|${a}|${b}|${dir}`) },
      hkdf,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  // myId === a ⟹ I am the "a" direction sender.
  return myId === a
    ? { sendKey: await derive("a"), recvKey: await derive("b") }
    : { sendKey: await derive("b"), recvKey: await derive("a") };
}

/** Prefix bytes (4) of an offer salt → the IV prefix that sender uses. */
export function ivPrefixFromSalt(salt: string): PbBytes {
  need(salt.length === 8, "salt must be 8 hex chars");
  const out = new Uint8Array(4) as PbBytes;
  for (let i = 0; i < 4; i++) out[i] = parseInt(salt.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function sealChunk(
  key: CryptoKey,
  prefix: PbBytes,
  counter: number,
  plaintext: PbBytes,
): Promise<PbBytes> {
  const sealed = await subtle().encrypt(
    { name: "AES-GCM", iv: counterIv(prefix, counter) },
    key,
    plaintext,
  );
  return new Uint8Array(sealed) as PbBytes;
}

export async function openChunk(
  key: CryptoKey,
  prefix: PbBytes,
  counter: number,
  sealed: PbBytes,
): Promise<PbBytes> {
  const plain = await subtle().decrypt(
    { name: "AES-GCM", iv: counterIv(prefix, counter) },
    key,
    sealed,
  );
  return new Uint8Array(plain) as PbBytes;
}

/**
 * Collects 20 ms Opus frames into 100 ms chunks. Pure and synchronous: the
 * caller owns sealing/ordering.
 */
export class BatchAccumulator {
  private frames: { bytes: PbBytes; tsMs: number }[] = [];
  constructor(private readonly limit: number = PB_BATCH_FRAMES) {}

  push(bytes: PbBytes, tsUs: number): "buffering" | { batch: PbBatch } {
    this.frames.push({ bytes, tsMs: Math.max(0, Math.round(tsUs / 1000)) });
    if (this.frames.length >= this.limit) {
      const batch = this.take();
      return { batch };
    }
    return "buffering";
  }

  take(): PbBatch {
    const kept = this.frames;
    this.frames = [];
    if (kept.length === 0) return { kind: PB_KIND_AUDIO, baseMs: 0, frames: [] };
    const baseMs = kept[0].tsMs;
    const frames = kept.map((f) => f.bytes);
    return { kind: PB_KIND_AUDIO, baseMs, frames };
  }

  get size(): number {
    return this.frames.length;
  }
}

/**
 * Rolling-rate meter for the message budget guard. Signals the lane when the
 * send+receive rate would exceed the plan budget (Free = 100 msg/s).
 */
export class RateMeter {
  private hitsPerSecond = new Map<number, number>();
  /** measured msg/s, refreshed on every tick() call */
  rate = 0;
  constructor(
    private readonly warnPerSec: number,
    private readonly onWarn?: (msg: string) => void,
  ) {}

  hit(count = 1): void {
    const s = Math.floor(Date.now() / 1000);
    this.hitsPerSecond.set(s, (this.hitsPerSecond.get(s) ?? 0) + count);
  }

  tick(): void {
    const now = Math.floor(Date.now() / 1000);
    for (const key of this.hitsPerSecond.keys()) {
      if (key < now - 3) this.hitsPerSecond.delete(key);
    }
    let sum = 0;
    for (const v of this.hitsPerSecond.values()) sum += v;
    this.rate = sum / Math.max(1, this.hitsPerSecond.size);
    if (this.rate > this.warnPerSec) {
      this.onWarn?.(
        `piggyback rate ${this.rate.toFixed(1)} msg/s exceeds budget ${this.warnPerSec}`,
      );
    }
  }

  reset(): void {
    this.hitsPerSecond.clear();
    this.rate = 0;
  }
}

/**
 * Deterministic OpusHead (RFC 7845 §5.1) for the decoder config. Both ends
 * build the same 19-byte description from constants, so the receiver needs no
 * extra handshake round-trip. pre-skip 312 matches libopus's standard 20 ms
 * trim for the default complexity path on Chrome/Android builds.
 */
export function opusHeadDescription(
  sampleRate = 48_000,
  channels = 1,
  preSkip = 312,
): PbBytes {
  const out = new Uint8Array(19) as PbBytes;
  const dv = new DataView(out.buffer);
  out.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // "OpusHead"
  dv.setUint8(8, 1); // version
  dv.setUint8(9, channels);
  dv.setUint16(10, preSkip, true); // LE
  dv.setUint32(12, sampleRate, true); // input sample rate, LE
  dv.setInt16(16, 0, true); // output gain
  dv.setUint8(18, 0); // channel mapping family
  return out;
}
