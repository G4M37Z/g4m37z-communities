// src/lib/piggyback/audio-pipeline.ts
// Browser-only encode/decode plumbing for the piggyback lane.
//
// Sender:  MediaStream → ScriptProcessorNode → AudioData → WebCodecs
//          AudioEncoder (Opus, 20 ms frames, 24 kbps) → BatchAccumulator
//          (5 frames = 100 ms) → ordered seal chain (session supplies AES-GCM)
// Receiver: sealed chunk → AES-GCM open (session) → Opus packets → WebCodecs
//          AudioDecoder → AudioData PCM → WebAudio playout clock.
//
// Capture timing is anchored on an internal media clock (μs since encode
// start); playout maps that clock onto the AudioContext clock with an initial
// 250 ms pause buffer and resyncs forward (never backward) on underruns.
// Muted tracks arrive as silence and cost ~1 kbps on DTX — no special case.

import {
  BatchAccumulator,
  PB_BATCH_FRAMES,
  opusHeadDescription,
  type PbBatch,
  type PbBytes,
} from "./protocol";

export const PB_PLAYBACK_SAMPLE_RATE = 48_000;
export const PB_OPUS_BITRATE = 24_000;
export const PB_OPUS_FRAME_US = 20_000;
/** Initial pause between chunk arrival and scheduled playback. */
export const PB_PLAYOUT_LEAD_S = 0.25;
/** If a frame is scheduled less than this far ahead, the clock resyncs. */
export const PB_RESYNC_MARGIN_S = 0.03;

export interface PbChunkBatch {
  /** ms since capture start of frame 0 */
  baseMs: number;
  frames: PbBytes[];
}

// ---------------------------------------------------------------------------
// Sender
// ---------------------------------------------------------------------------

export class PbSender {
  private ctx: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;
  private encoder: AudioEncoder | null = null;
  private accumulator = new BatchAccumulator(PB_BATCH_FRAMES);
  private capturedFrames = 0;
  private stopped = false;
  private readonly onBatch: (batch: PbChunkBatch) => void;
  private readonly onError: (err: unknown) => void;

  constructor(args: { onBatch: (batch: PbChunkBatch) => void; onError?: (err: unknown) => void }) {
    this.onBatch = args.onBatch;
    this.onError = args.onError ?? ((e) => console.warn("piggyback send:", e));
  }

  static supported(): boolean {
    return (
      typeof AudioEncoder === "function" &&
      typeof AudioData === "function" &&
      typeof ScriptProcessorNode === "function"
    );
  }

  async start(stream: MediaStream): Promise<void> {
    if (this.stopped) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(2048, 1, 1);
    this.node = node;
    const sink = ctx.createGain();
    sink.gain.value = 0; // keep the graph alive without echoing to speakers
    src.connect(node);
    node.connect(sink);
    sink.connect(ctx.destination);

    // Ingest: every processor tick becomes one AudioData on the encoder queue.
    // The node's buffer size (2048 ≈ 42.7 ms @48k) doesn't have to match the
    // encoder's 20 ms frames — AudioEncoder buffers internally.
    node.onaudioprocess = (e: AudioProcessingEvent) => {
      if (this.stopped || this.stopping) return;
      const input = e.inputBuffer.getChannelData(0);
      const tsUs = (this.capturedFrames * 1_000_000) / ctx.sampleRate;
      this.capturedFrames += input.length;
      let data: AudioData | null = null;
      try {
        data = new AudioData({
          format: "f32",
          sampleRate: ctx.sampleRate,
          numberOfFrames: input.length,
          numberOfChannels: 1,
          timestamp: tsUs,
          data: new Float32Array(input),
        });
        this.encoder?.encode(data);
      } catch (err) {
        this.onError(err);
      } finally {
        data?.close();
      }
    };

    const encoder = new AudioEncoder({
      output: (chunk) => {
        if (this.stopped || this.stopping) return;
        const bytes = new Uint8Array(chunk.byteLength);
        chunk.copyTo(bytes);
        const res = this.accumulator.push(bytes, chunk.timestamp);
        if (res !== "buffering") {
          this.onBatch({ baseMs: res.batch.baseMs, frames: res.batch.frames });
        }
      },
      error: (err) => this.onError(err),
    });
    this.encoder = encoder;
    const config: AudioEncoderConfig = {
      codec: "opus",
      sampleRate: ctx.sampleRate,
      numberOfChannels: 1,
      bitrate: PB_OPUS_BITRATE,
      opus: { frameDuration: PB_OPUS_FRAME_US },
    };
    const support = await AudioEncoder.isConfigSupported(config);
    if (!support.supported) {
      throw new Error("piggyback: Opus encoder config unsupported");
    }
    encoder.configure(config);
    void ctx.resume().catch(() => {});
  }

  private stopping = false;

  /** Flush what's buffered (under 5 frames) and stop capture/encode. */
  async stop(): Promise<void> {
    if (this.stopping || this.stopped) return;
    this.stopping = true;
    try {
      if (this.node) this.node.onaudioprocess = null;
      if (this.encoder) {
        this.encoder.flush().catch(() => {});
        await new Promise((r) => setTimeout(r, 30));
        this.encoder.close();
      }
      if (this.ctx) {
        await this.ctx.close().catch(() => {});
      }
    } catch (err) {
      this.onError(err);
    } finally {
      this.node = null;
      this.encoder = null;
      this.ctx = null;
      this.stopped = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Receiver
// ---------------------------------------------------------------------------

export class PbReceiver {
  private ctx: AudioContext | null = null;
  private decoder: AudioDecoder | null = null;
  /** ctx clock anchor for the first scheduled frame */
  private anchorCtx = -1;
  /** media clock (μs, capture-side base) mapped onto anchorCtx */
  private anchorMedia = 0;
  /** media clock offset from the first received frame */
  private mediaBase = -1;
  private lastScheduledCtx = -1;
  private stopped = false;
  private readonly onError: (err: unknown) => void;

  constructor(args: { onError?: (err: unknown) => void }) {
    this.onError = args.onError ?? ((e) => console.warn("piggyback recv:", e));
  }

  static supported(): boolean {
    return typeof AudioDecoder === "function" && typeof AudioData === "function";
  }

  /** Configure the decoder once per lane. Idempotent. */
  async configure(): Promise<void> {
    if (this.decoder) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    void ctx.resume().catch(() => {});
    const decoder = new AudioDecoder({
      output: (data) => {
        try {
          this.playout(data);
        } catch (err) {
          this.onError(err);
          data.close();
        }
      },
      error: (err) => this.onError(err),
    });
    decoder.configure({
      codec: "opus",
      sampleRate: PB_PLAYBACK_SAMPLE_RATE,
      numberOfChannels: 1,
      description: opusHeadDescription(),
    });
    this.decoder = decoder;
  }

  /** Feed one decrypted batch. Ordering handled by the session; gaps pass
   * through as missing audio (Opus packet-loss concealment yields silence). */
  consume(batch: PbBatch): void {
    if (this.stopped || !this.decoder) return;
    if (this.mediaBase < 0) this.mediaBase = batch.baseMs;
    for (let i = 0; i < batch.frames.length; i++) {
      const tsUs = (batch.baseMs - this.mediaBase) * 1000 + i * PB_OPUS_FRAME_US;
      try {
        this.decoder.decode(
          new EncodedAudioChunk({
            type: "key",
            timestamp: tsUs,
            data: batch.frames[i],
          }),
        );
      } catch (err) {
        this.onError(err);
      }
    }
  }

  /** Map a decoded AudioData onto the playout clock and schedule it. */
  private playout(data: AudioData): void {
    if (this.stopped || !this.ctx) {
      data.close();
      return;
    }
    const ctx = this.ctx;
    let at: number;
    try {
      if (this.anchorCtx < 0) {
        this.anchorCtx = ctx.currentTime + PB_PLAYOUT_LEAD_S;
        this.anchorMedia = data.timestamp;
      }
      at = this.anchorCtx + (data.timestamp - this.anchorMedia) / 1e6;
      if (at < ctx.currentTime + PB_RESYNC_MARGIN_S) {
        // Underrun (network stall): jump the clock forward; never backward —
        // a clock jump backward would desync anything already scheduled.
        this.anchorMedia = data.timestamp;
        this.anchorCtx = ctx.currentTime + PB_PLAYOUT_LEAD_S;
        at = this.anchorCtx;
      }
      if (at < this.lastScheduledCtx) {
        // A late-but-not-quite-underrun frame would stack onto an already
        // scheduled slot; drop it rather than overlap.
        data.close();
        return;
      }
      const frames = data.numberOfFrames;
      const sr = data.sampleRate;
      const buffer = ctx.createBuffer(data.numberOfChannels, frames, sr);
      for (let plane = 0; plane < data.numberOfChannels; plane++) {
        const f32 = new Float32Array(frames);
        data.copyTo(f32, { planeIndex: plane, format: "f32" });
        buffer.copyToChannel(f32, plane);
      }
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(ctx.destination);
      node.start(at);
      this.lastScheduledCtx = at;
    } catch (err) {
      this.onError(err);
    } finally {
      data.close();
    }
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    try {
      this.decoder?.close();
    } catch {
      // close after stop is safe to ignore
    }
    this.decoder = null;
    try {
      await this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
  }
}
