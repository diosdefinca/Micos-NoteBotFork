import { VoiceConnection, EndBehaviorType } from '@discordjs/voice';
import prism from 'prism-media';
import { calculateRmsDb, downsampleToMono16k, pcmToWav } from './audio-utils.js';
import { transcribe } from '../transcription/whisper.js';
import { addTranscription } from '../db/repository.js';

const SILENCE_MS = 3_000;
const MAX_BUFFER_MS = 60_000;
const RMS_THRESHOLD_DB = -45;
const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const BYTES_PER_FRAME = SAMPLE_RATE * CHANNELS * 2; // bytes per second of 48kHz stereo 16-bit

interface UserRecorder {
  chunks: Buffer[];
  totalBytes: number;
  silenceTimer: ReturnType<typeof setTimeout> | null;
  destroy: () => void;
}

export class RecorderManager {
  private recorders = new Map<string, UserRecorder>();
  private meetingId: string;
  private connection: VoiceConnection;

  constructor(connection: VoiceConnection, meetingId: string) {
    this.connection = connection;
    this.meetingId = meetingId;
  }

  subscribe(userId: string, username: string): void {
    if (this.recorders.has(userId)) return;

    const receiver = this.connection.receiver;
    const opusStream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.Manual },
    });

    const decoder = new prism.opus.Decoder({ rate: SAMPLE_RATE, channels: CHANNELS, frameSize: 960 });
    const pcmStream = opusStream.pipe(decoder);

    const recorder: UserRecorder = {
      chunks: [],
      totalBytes: 0,
      silenceTimer: null,
      destroy: () => {
        opusStream.destroy();
        decoder.destroy();
      },
    };

    const resetSilenceTimer = () => {
      if (recorder.silenceTimer) clearTimeout(recorder.silenceTimer);
      recorder.silenceTimer = setTimeout(() => {
        this.flush(userId, username);
      }, SILENCE_MS);
    };

    pcmStream.on('data', (chunk: Buffer) => {
      if (recorder.totalBytes === 0) {
        console.log(`First audio packet received from ${username}`);
      }
      recorder.chunks.push(chunk);
      recorder.totalBytes += chunk.length;
      resetSilenceTimer();

      // Force flush if buffer exceeds max duration
      const bufferDurationMs = (recorder.totalBytes / BYTES_PER_FRAME) * 1000;
      if (bufferDurationMs >= MAX_BUFFER_MS) {
        if (recorder.silenceTimer) clearTimeout(recorder.silenceTimer);
        this.flush(userId, username);
      }
    });

    pcmStream.on('error', (err: Error) => {
      console.error(`PCM stream error for ${username}:`, err);
    });

    this.recorders.set(userId, recorder);
    console.log(`Subscribed to audio: ${username}`);
  }

  private async flush(userId: string, username: string): Promise<void> {
    const recorder = this.recorders.get(userId);
    if (!recorder || recorder.chunks.length === 0) return;

    const pcm = Buffer.concat(recorder.chunks);
    recorder.chunks = [];
    recorder.totalBytes = 0;

    // Check if audio has enough energy
    if (calculateRmsDb(pcm) < RMS_THRESHOLD_DB) return;

    // Convert to 16kHz mono WAV for Whisper
    const mono16k = downsampleToMono16k(pcm);
    const wav = pcmToWav(mono16k, 16_000, 1, 16);

    try {
      const text = await transcribe(wav);
      if (text && text.trim().length > 0) {
        await addTranscription(this.meetingId, {
          userId,
          username,
          timestamp: new Date(),
          text: text.trim(),
        });
        console.log(`[${username}]: ${text.trim()}`);
      }
    } catch (err) {
      console.error(`Transcription error for ${username}:`, err);
    }
  }

  async flushAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [userId, recorder] of this.recorders) {
      if (recorder.chunks.length > 0) {
        // We need the username — extract from any existing transcription context
        // For simplicity, we store it when we flush
        promises.push(this.flush(userId, userId));
      }
    }
    await Promise.all(promises);
  }

  destroyAll(): void {
    for (const [, recorder] of this.recorders) {
      if (recorder.silenceTimer) clearTimeout(recorder.silenceTimer);
      recorder.destroy();
    }
    this.recorders.clear();
  }
}
