import OpenAI, { toFile } from 'openai';
import { config } from '../config.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

const MAX_RETRIES = 3;

export async function transcribe(wavBuffer: Buffer): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const file = await toFile(wavBuffer, 'audio.wav', { type: 'audio/wav' });
      const response = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file,
        language: 'en',
      });
      return response.text;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delayMs = 1000 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  throw lastError;
}
