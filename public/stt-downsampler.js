// AudioWorklet processor for the teleprompter STT client.
//
// Downsamples the recording's mic audio to 16 kHz mono Int16 PCM and posts it to
// the main thread in ~40 ms batches, which the client forwards over the WebSocket
// to the self-hosted speech-to-text server. See utils/sttClient.js and the STT
// hand-off plan for the wire protocol.
class STTDownsampler extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.targetRate = opts.targetRate || 16000;
    this.pending = [];
    this.flushAt = Math.round(this.targetRate * 0.04); // ~40 ms per message
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0]; // first channel (mono)
    // `sampleRate` is a global in the AudioWorkletGlobalScope (usually 48000).
    const ratio = sampleRate / this.targetRate;

    for (let i = 0; i < ch.length; i += ratio) {
      const start = Math.floor(i);
      const end = Math.min(ch.length, Math.floor(i + ratio));
      let sum = 0;
      let n = 0;
      for (let j = start; j < end; j += 1) { sum += ch[j]; n += 1; }
      let s = n ? sum / n : 0;
      s = Math.max(-1, Math.min(1, s));
      this.pending.push(s < 0 ? s * 0x8000 : s * 0x7fff);
    }

    if (this.pending.length >= this.flushAt) {
      const pcm = Int16Array.from(this.pending);
      this.pending.length = 0;
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}

registerProcessor('stt-downsampler', STTDownsampler);
