// src/lib/piggyback/session.ts
// Orchestrates the piggyback lane for one DM call:
//
//   1. publish own ephemeral ECDH P-256 offer as a PB_KEY row (RLS: members)
//   2. on the peer's PB_KEY: derive per-direction HKDF→AES-GCM keys
//   3. live: Opus frames (PbSender) → sealed chunks → Realtime broadcast
//      on the call's existing channel; the peer's chunks → AES-GCM open →
//      PbReceiver playout clock.
//
// Broadcast transport is NOT access-controlled (Supabase private-channels
// require an extra authorization endpoint), so confidentiality rests entirely
// on the E2E chunk crypto whose keys cross the RLS-gated signaling table.
// Counterparty authenticity: only the peer can INSERT a PB_KEY row in this
// conversation (RLS) and only members can read ours — a channel stranger has
// neither and cannot shape their way into an active MITM without member creds.
//
// Ordering: the per-session send/decrypt chains serialize async crypto so
// chunk counter k always corresponds to the k-th 100 ms window.

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { sendSignal, type SignalPayload, type SignalingMessage } from "@/lib/webrtc-signaling";
import {
  PbReceiver,
  PbSender,
  type PbChunkBatch,
} from "./audio-pipeline";
import {
  RateMeter,
  createKeyOffer,
  decB64,
  deriveDirectionKeys,
  encB64,
  importOfferPub,
  ivPrefixFromSalt,
  openChunk,
  packPlaintext,
  sealChunk,
  unpackPlaintext,
  type PbChunkWire,
} from "./protocol";

export const PB_BROADCAST_EVENT = "pb";

export type PiggybackPhase = "idle" | "keyx" | "live" | "closed";

interface PiggybackDeps {
  supabase: SupabaseClient;
  conversationId: string;
  /** `${conversationId}:${callId}` — mixed into the HKDF info */
  callKey: string;
  myId: string;
  peerId: string;
}

interface PiggybackHooks {
  onLive?: () => void;
  onError?: (err: unknown) => void;
}

export class PiggybackSession {
  private phase: PiggybackPhase = "idle";
  private dead = false;
  private published = false;
  private pair: CryptoKeyPair | null = null;
  private myOffer: { kid: string; salt: string } | null = null;
  private peerOffer: SignalPayload & { kid?: string } | null = null;
  private deriving = false;
  private sendKey: CryptoKey | null = null;
  private recvKey: CryptoKey | null = null;
  private sendCounter = 0;
  private lastInCounter = -1;
  private sendChain: Promise<void> = Promise.resolve();
  private sender: PbSender | null = null;
  private receiver: PbReceiver | null = null;
  private channel: RealtimeChannel | null = null;
  private localStream: MediaStream | null = null;
  private budget = new RateMeter(50, (m) => console.warn(m));
  private budgetTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly deps: PiggybackDeps,
    private readonly hooks: PiggybackHooks = {},
  ) {}

  get state(): PiggybackPhase {
    return this.phase;
  }

  /** Bind the (already-subscribed) call channel for media broadcast. */
  attachChannel(channel: RealtimeChannel): void {
    if (this.dead || !channel) return;
    this.channel = channel;
    channel.on(
      "broadcast",
      { event: PB_BROADCAST_EVENT },
      (msg: { payload?: unknown }) => {
        void this.onBroadcast(msg?.payload as PbChunkWire | undefined);
      },
    );
  }

  begin(localStream: MediaStream): void {
    if (this.dead || this.phase !== "idle") return;
    this.localStream = localStream;
    this.phase = "keyx";
    this.budgetTimer = setInterval(() => this.budget.tick(), 3000);
    void this.publishKey();
  }

  /** Feed one (already id-deduped) signaling row. Own rows are ignored. */
  handleSignal(msg: SignalingMessage): void {
    if (this.dead || (this.phase !== "keyx" && this.phase !== "live")) return;
    if (msg.type !== "PB_KEY") return;
    if (msg.from_user !== this.deps.peerId) return;
    const p = msg.payload;
    if (!p.kid || !p.salt || !p.jwk) return;
    if (this.peerOffer?.kid) return; // first valid offer wins; retries ignored
    this.peerOffer = p;
    void this.maybeGoLive();
  }

  stop(): void {
    if (this.dead) return;
    this.dead = true;
    this.phase = "closed";
    if (this.budgetTimer) clearInterval(this.budgetTimer);
    this.budgetTimer = null;
    void this.sender?.stop();
    void this.receiver?.stop();
    this.sender = null;
    this.receiver = null;
    this.channel = null;
    this.localStream = null;
  }

  // -------------------------------------------------------------------------
  // internals
  // -------------------------------------------------------------------------

  private async publishKey(): Promise<void> {
    try {
      if (this.published || this.dead) return;
      const { pair, offer } = await createKeyOffer();
      if (this.dead) return;
      this.pair = pair;
      this.myOffer = { kid: offer.kid, salt: offer.salt };
      const res = await sendSignal(this.deps.supabase, {
        conversationId: this.deps.conversationId,
        toUser: this.deps.peerId,
        type: "PB_KEY",
        payload: { kid: offer.kid, jwk: offer.jwk, salt: offer.salt } as SignalPayload,
      });
      if (!res.ok) throw new Error(res.error);
      this.published = true;
    } catch (err) {
      if (!this.dead) this.hooks.onError?.(err);
    }
  }

  private async maybeGoLive(): Promise<void> {
    if (
      this.dead ||
      this.deriving ||
      !this.pair ||
      !this.myOffer ||
      !this.peerOffer?.kid ||
      !this.peerOffer.jwk ||
      !this.peerOffer.salt ||
      !this.localStream
    ) {
      return;
    }
    this.deriving = true;
    try {
      if (!PbSender.supported() || !PbReceiver.supported()) {
        throw new Error("piggyback: WebCodecs unsupported in this browser");
      }
      const pub = await importOfferPub(
        this.peerOffer as { kid: string; jwk: JsonWebKey; salt: string },
      );
      const keys = await deriveDirectionKeys(this.pair.privateKey, pub, {
        myId: this.deps.myId,
        peerId: this.deps.peerId,
        context: this.deps.callKey,
      });
      this.sendKey = keys.sendKey;
      this.recvKey = keys.recvKey;

      this.receiver = new PbReceiver({});
      await this.receiver.configure();

      this.sender = new PbSender({
        onBatch: (batch: PbChunkBatch) => void this.enqueueBatch(batch),
        onError: (e) => this.hooks.onError?.(e),
      });
      await this.sender.start(this.localStream);
      if (this.dead) return;
      this.phase = "live";
      this.hooks.onLive?.();
    } catch (err) {
      if (!this.dead) this.hooks.onError?.(err);
    } finally {
      this.deriving = false;
    }
  }

  /** Seal + broadcast one 100 ms batch, strictly in capture order. */
  private enqueueBatch(batch: PbChunkBatch): void {
    if (this.dead || this.phase !== "live" || !this.sendKey || !this.myOffer) return;
    const counter = this.sendCounter++;
    const wire: PbChunkWire = {
      v: 1,
      k: this.myOffer.kid,
      c: counter,
      d: "", // filled by the chain below
    };
    this.sendChain = this.sendChain.then(async () => {
      try {
        const sealed = await sealChunk(
          this.sendKey!,
          ivPrefixFromSalt(this.myOffer!.salt),
          counter,
          packPlaintext(1, batch.baseMs, batch.frames),
        );
        wire.d = encB64(sealed);
        this.budget.hit();
        await this.channel?.send({
          type: "broadcast",
          event: PB_BROADCAST_EVENT,
          payload: wire,
        });
      } catch (err) {
        // A failed chunk is dropped — the next one carries a fresh counter and
        // the playout clock resyncs; no retransmits on this lane.
        console.warn("piggyback send chain:", err);
      }
    });
  }

  private async onBroadcast(wire?: PbChunkWire): Promise<void> {
    try {
      if (this.dead || this.phase !== "live") return;
      if (!wire || wire.v !== 1 || !wire.k || typeof wire.c !== "number") return;
      if (wire.k === this.myOffer?.kid) return; // our own echo
      if (this.peerOffer && wire.k !== this.peerOffer.kid) return;
      if (!this.recvKey || !this.peerOffer) return;
      if (this.lastInCounter >= 0 && wire.c <= this.lastInCounter) return; // stale
      this.budget.hit();
      const sealed = decB64(wire.d);
      this.lastInCounter = wire.c;
      // Decryption must preserve arrival order for timestamp mapping; keep a
      // per-direction chain separate from the send chain.
      await (this.recvChain = this.recvChain.then(async () => {
        const plain = await openChunk(
          this.recvKey!,
          ivPrefixFromSalt(this.peerOffer!.salt as string),
          wire.c,
          sealed,
        );
        this.receiver?.consume(unpackPlaintext(plain));
      }));
    } catch (err) {
      console.warn("piggyback recv chain:", err);
    }
  }

  private recvChain: Promise<void> = Promise.resolve();
}
