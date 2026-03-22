import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import OpenAI from 'openai';
import { config } from '../config.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

const MAX_RETRIES = 3;

export async function transcribe(wavBuffer: Buffer): Promise<string> {
  // Write to temp file — more reliable than in-memory toFile
  const tmpPath = path.join(os.tmpdir(), `notebot-${Date.now()}.wav`);
  fs.writeFileSync(tmpPath, wavBuffer);

  let lastError: unknown;

  try {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await openai.audio.transcriptions.create({
          model: 'whisper-1',
          file: fs.createReadStream(tmpPath),
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
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(tmpPath); } catch {}
  }

  throw lastError;
}
