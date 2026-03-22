/**
 * Calculate RMS energy in dB for a 16-bit PCM buffer.
 */
export function calculateRmsDb(pcm: Buffer): number {
  const samples = pcm.length / 2; // 16-bit = 2 bytes per sample
  if (samples === 0) return -Infinity;

  let sumSquares = 0;
  for (let i = 0; i < pcm.length; i += 2) {
    const sample = pcm.readInt16LE(i);
    sumSquares += sample * sample;
  }

  const rms = Math.sqrt(sumSquares / samples);
  if (rms === 0) return -Infinity;
  return 20 * Math.log10(rms / 32768);
}

/**
 * Downsample mono PCM from 48kHz to 16kHz.
 * Input: 48kHz, 16-bit, 1 channel
 * Output: 16kHz, 16-bit, 1 channel
 */
export function downsampleTo16k(pcm: Buffer): Buffer {
  const ratio = 3; // 48000 / 16000
  const inputSamples = pcm.length / 2; // 16-bit = 2 bytes per sample
  const outputSamples = Math.floor(inputSamples / ratio);
  const output = Buffer.alloc(outputSamples * 2);

  for (let i = 0; i < outputSamples; i++) {
    const srcOffset = i * ratio * 2;
    const sample = pcm.readInt16LE(srcOffset);
    output.writeInt16LE(sample, i * 2);
  }

  return output;
}

/**
 * Wrap raw PCM data in a WAV container.
 */
export function pcmToWav(pcm: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);

  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);

  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);           // sub-chunk size
  header.writeUInt16LE(1, 20);            // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 30);
  header.writeUInt16LE(bitsPerSample, 32);

  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}
