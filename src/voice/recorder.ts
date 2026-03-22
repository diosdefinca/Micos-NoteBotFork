import { VoiceConnection, EndBehaviorType } from '@discordjs/voice';
import { createOggOpus } from './ogg-muxer.js';
import { convertToWhisperWav } from './audio-utils.js';
import { transcribe } from '../transcription/whisper.js';
import { addTranscription } from '../db/repository.js';

const SILENCE_MS = 3_000;
const MAX_PACKETS = 3000; // ~60 seconds at 20ms per packet
const MIN_PACKETS = 25;   // ~0.5 seconds — skip very short bursts

interface UserRecorder {
  packets: Buffer[];
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

    const recorder: UserRecorder = {
      packets: [],
      silenceTimer: null,
      destroy: () => {
        opusStream.destroy();
      },
    };

    const resetSilenceTimer = () => {
      if (recorder.silenceTimer) clearTimeout(recorder.silenceTimer);
      recorder.silenceTimer = setTimeout(() => {
        this.flush(userId, username);
      }, SILENCE_MS);
    };

    opusStream.on('data', (packet: Buffer) => {
      if (recorder.packets.length === 0) {
        console.log(`First audio packet received from ${username} (${packet.length} bytes)`);
      }
      recorder.packets.push(packet);
      resetSilenceTimer();

      if (recorder.packets.length >= MAX_PACKETS) {
        if (recorder.silenceTimer) clearTimeout(recorder.silenceTimer);
        this.flush(userId, username);
      }
    });

    opusStream.on('error', (err: Error) => {
      console.error(`Opus stream error for ${username}:`, err);
    });

    this.recorders.set(userId, recorder);
    console.log(`Subscribed to audio: ${username}`);
  }

  private async flush(userId: string, username: string): Promise<void> {
    const recorder = this.recorders.get(userId);
    if (!recorder || recorder.packets.length === 0) return;

    const packets = recorder.packets.splice(0);

    if (packets.length < MIN_PACKETS) {
      console.log(`Skipping ${packets.length} packets from ${username} — too short`);
      return;
    }

    const durationSec = (packets.length * 20) / 1000;
    console.log(`Flush ${username}: ${packets.length} packets (${durationSec.toFixed(1)}s)`);

    // Wrap raw Opus packets in OGG container
    const ogg = createOggOpus(packets, 48_000, 2);

    // Use FFmpeg to convert OGG/Opus → 16kHz mono 16-bit PCM WAV
    const wav = await convertToWhisperWav(ogg);
    console.log(`WAV: ${wav.length} bytes`);

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
      if (recorder.packets.length > 0) {
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
