import { spawn } from 'node:child_process';

/**
 * Convert audio buffer to 16kHz mono 16-bit PCM WAV using FFmpeg.
 * This is the exact format recommended for OpenAI Whisper.
 */
export function convertToWhisperWav(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',        // read from stdin
      '-ar', '16000',         // 16kHz sample rate
      '-ac', '1',             // mono
      '-c:a', 'pcm_s16le',   // 16-bit PCM
      '-f', 'wav',            // WAV format
      'pipe:1',               // write to stdout
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const chunks: Buffer[] = [];
    let stderr = '';

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    ffmpeg.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });

    ffmpeg.stdin.write(input);
    ffmpeg.stdin.end();
  });
}
