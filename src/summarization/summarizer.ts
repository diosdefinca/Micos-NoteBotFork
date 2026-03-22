import OpenAI from 'openai';
import { config } from '../config.js';
import { Meeting } from '../db/models.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export async function summarizeMeeting(meeting: Meeting): Promise<{ title: string; summary: string }> {
  const transcriptLines = meeting.transcriptions
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((t) => `${t.username}: ${t.text}`)
    .join('\n');

  if (!transcriptLines) {
    return { title: 'Empty Meeting', summary: 'No transcriptions were captured during this meeting.' };
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a meeting summarizer. Given a transcript of a meeting, provide:\n' +
          '1. A concise title for the meeting (first line, no prefix)\n' +
          '2. A summary with key discussion points and any action items\n\n' +
          'Format:\n' +
          'Title on the first line\n' +
          'Then a blank line\n' +
          'Then the summary',
      },
      {
        role: 'user',
        content: `Here is the meeting transcript:\n\n${transcriptLines}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1024,
  });

  const content = response.choices[0]?.message?.content ?? '';
  const lines = content.split('\n');
  const title = lines[0]?.trim() || 'Meeting Summary';
  const summary = lines.slice(2).join('\n').trim() || content;

  return { title, summary };
}
