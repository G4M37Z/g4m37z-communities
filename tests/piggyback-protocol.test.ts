// tests/piggyback-protocol.test.ts
// Byte-level + crypto contract of the piggyback lane. WebCrypto is the
// global one (Node ≥ 20 / browsers), so the ECDH→HKDF→AES-GCM round trip is
// exercised exactly as the browser will run it.

import { describe, expect, it } from "vitest";
import {
  BatchAccumulator,
  PB_BATCH_FRAMES,
  counterIv,
  createKeyOffer,
  decB64,
  deriveDirectionKeys,
  encB64,
  importOfferPub,
  ivPrefixFromSalt,
  openChunk,
  opusHeadDescription,
  packPlaintext,
  RateMeter,
  sealChunk,
  unpackPlaintext,
  type PbKeyOffer,
} from "@/lib/piggyback/protocol";
import type { PbChunkBatch } from "@/lib/piggyback/audio-pipeline";
import type { PbBatch } from "@/lib/piggyback/protocol";

type PbBytes = Uint8Array<ArrayBuffer>;

function frameBytes(len: number, fill: number): PbBytes {
  return new Uint8Array(len) as PbBytes;
}
const bx = (n: number[]): PbBytes => new Uint8Array(n) as PbBytes;


describe("pack/unpack plaintext", () => {
  it("round-trips a batch byte-exactly", () => {
    const frames = [frameBytes(3, 1), frameBytes(10, 2), frameBytes(300, 3)];
    const packed = packPlaintext(1, 1234, frames);
    const unpacked = unpackPlaintext(packed);
    expect(unpacked.kind).toBe(1);
    expect(unpacked.baseMs).toBe(1234);
    expect(unpacked.frames.length).toBe(3);
    expect([...unpacked.frames[0]]).toEqual([...frames[0]]);
    expect([...unpacked.frames[2]]).toEqual([...frames[2]]);
  });

  it("rejects unknown versions", () => {
    const packed = packPlaintext(1, 0, [frameBytes(2, 7)]);
    packed[0] = 2;
    expect(() => unpackPlaintext(packed)).toThrow(/version/);
  });

  it("rejects trailing bytes (short sends can't corrupt the stream)", () => {
    const packed = packPlaintext(1, 0, [frameBytes(4, 9)]);
    const bad = packed.slice();
    bad[bad.length - 1] ^= 0xff; // corrupt a frame byte — still valid structurally
    expect(unpackPlaintext(bad).frames[0].length).toBe(4);
    const truncated = packed.slice(0, packed.length - 1);
    expect(() => unpackPlaintext(truncated)).toThrow(/overrun/);
  });
});

describe("BatchAccumulator", () => {
  it("buffers 5×20 ms and emits one 100 ms batch", () => {
    const acc = new BatchAccumulator(PB_BATCH_FRAMES);
    let emitted: PbChunkBatch | null = null;
    for (let i = 0; i < PB_BATCH_FRAMES; i++) {
      const r = acc.push(frameBytes(2, i), i * 20_000);
      if (r !== "buffering") emitted = r.batch;
    }
    expect(emitted).not.toBeNull();
    expect(emitted!.baseMs).toBe(0);
    expect(emitted!.frames.length).toBe(5);
    expect(acc.size).toBe(0);
  });

  it("emits preserve capture order via baseMs", () => {
    const acc = new BatchAccumulator(PB_BATCH_FRAMES);
    let emitted: PbBatch | null = null;
    for (let i = 0; i < PB_BATCH_FRAMES; i++) {
      const r = acc.push(frameBytes(2, i), 1_200_000 + i * 20_000);
      if (r !== "buffering") emitted = r.batch;
    }
    expect(emitted).not.toBeNull();
    expect(emitted!.baseMs).toBe(1200);
    expect(emitted!.frames.length).toBe(5);
  });
});

describe("IV derivation", () => {
  it("prefix + counter fills 12 bytes, counter in low words", () => {
    const prefix = ivPrefixFromSalt("aabbccdd");
    const iv0 = counterIv(prefix, 0);
    expect(iv0.length).toBe(12);
    expect(iv0.subarray(0, 4)).toEqual(prefix);
    const iv1 = counterIv(prefix, 1);
    expect(iv1[11]).toBe(1);
    const ivBig = counterIv(prefix, 2 ** 20 + 5);
    expect(Array.from(ivBig.subarray(8))[1]).toBe(16); // 0x00100005
    expect(ivBig[11]).toBe(5);
  });

  it("different salts ⇒ different IV streams even at counter 0", () => {
    const a = counterIv(ivPrefixFromSalt("01020304"), 0);
    const b = counterIv(ivPrefixFromSalt("05060708"), 0);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

describe("ECDH → HKDF → AES-GCM end-to-end", () => {
  it("both sides derive matching per-direction keys", async () => {
    const alice = await createKeyOffer();
    const bob = await createKeyOffer();
    const bobPub = await importOfferPub(bob.offer as PbKeyOffer);
    const alicePub = await importOfferPub(alice.offer as PbKeyOffer);
    const ctx = "conv-1:call-9";
    const at = await deriveDirectionKeys(alice.pair.privateKey, bobPub, {
      myId: "user-a",
      peerId: "user-b",
      context: ctx,
    });
    const bt = await deriveDirectionKeys(bob.pair.privateKey, alicePub, {
      myId: "user-b",
      peerId: "user-a",
      context: ctx,
    });
    // Alice sends with her sendKey; Bob must receive with the same key.
    const probe = new TextEncoder().encode("probe") as PbBytes;
    const sealed = await sealChunk(at.sendKey, ivPrefixFromSalt(alice.offer.salt), 0, probe);
    const opened = await openChunk(bt.recvKey, ivPrefixFromSalt(alice.offer.salt), 0, sealed);
    expect(new TextDecoder().decode(opened)).toBe("probe");
  });

  it("seals reject wrong counter and wrong key", async () => {
    const alice = await createKeyOffer();
    const bob = await createKeyOffer();
    const bobPub = await importOfferPub(bob.offer as PbKeyOffer);
    const at = await deriveDirectionKeys(alice.pair.privateKey, bobPub, {
      myId: "user-a",
      peerId: "user-b",
      context: "ctx",
    });
    const pt = frameBytes(16, 42);
    const sealed = await sealChunk(at.sendKey, ivPrefixFromSalt(alice.offer.salt), 7, pt);
    await expect(
      openChunk(at.sendKey, ivPrefixFromSalt(alice.offer.salt), 9, sealed),
    ).rejects.toThrow();
    await expect(
      openChunk(at.recvKey, ivPrefixFromSalt(alice.offer.salt), 7, sealed),
    ).rejects.toThrow();
  });

  it("context binds keys: cross-call keys don't open each other", async () => {
    const alice = await createKeyOffer();
    const bob = await createKeyOffer();
    const bobPub = await importOfferPub(bob.offer as PbKeyOffer);
    const k1 = await deriveDirectionKeys(alice.pair.privateKey, bobPub, {
      myId: "user-a",
      peerId: "user-b",
      context: "conv:call-1",
    });
    const k2 = await deriveDirectionKeys(alice.pair.privateKey, bobPub, {
      myId: "user-a",
      peerId: "user-b",
      context: "conv:call-2",
    });
    const sealed = await sealChunk(k1.sendKey, ivPrefixFromSalt(alice.offer.salt), 0, frameBytes(8, 5));
    await expect(
      openChunk(k2.sendKey, ivPrefixFromSalt(alice.offer.salt), 0, sealed),
    ).rejects.toThrow();
  });
});

describe("base64 codecs", () => {
  it("round-trips arbitrary lengths", () => {
    for (const len of [0, 1, 3, 4, 5, 41, 300]) {
      const bytes = crypto.getRandomValues(new Uint8Array(len)) as PbBytes;
      expect([...decB64(encB64(bytes))]).toEqual([...bytes]);
    }
  });
});

describe("opusHeadDescription", () => {
  it("is the fixed 19-byte RFC 7845 header", () => {
    const head = opusHeadDescription();
    expect(head.length).toBe(19);
    expect(Array.from(head.subarray(0, 8))).toEqual([
      0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64,
    ]);
    expect(head[9]).toBe(1);
  });
});

describe("RateMeter", () => {
  it("measures hits per rolling second and warns over budget", () => {
    const warned: string[] = [];
    const meter = new RateMeter(2, (m) => warned.push(m));
    meter.hit();
    meter.hit();
    meter.tick();
    expect(warned.length).toBe(0);
    for (let i = 0; i < 5; i++) meter.hit();
    meter.tick();
    expect(meter.rate).toBeGreaterThan(2);
    expect(warned.length).toBe(1);
    meter.reset();
    meter.tick();
    expect(meter.rate).toBe(0);
  });
});
