import OpenAI from 'openai';
import { config } from '../config.js';
import { Meeting } from '../db/models.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

const SYSTEM_PROMPT = `You are a meeting-to-task-list converter for a development team. Your job is to extract EVERY specific, actionable item from a meeting transcript — not summarize it.

Output format (strict):

Line 1: A short meeting title (no prefix, no quotes)
Line 2: blank
Line 3+: The output below

## Context
A paragraph explaining what this meeting was about and what area of the product was discussed.

## Tasks
Extract every concrete task, feature request, bug fix, UI change, or decision that implies work. Each task should be specific enough for a developer or project manager to act on without re-listening to the meeting.

Format each task as:
- **[Task title]**: [Detailed description including specifics mentioned — field names, page names, exact behaviors, data points to track, UI elements to change, etc.]

Rules:
- Be EXHAUSTIVE. If someone said "we need X", that's a task. If someone said "this is broken", that's a bug fix task. If someone said "rename Y to Z", that's a task.
- Include the WHO if mentioned (who requested it, who it's for).
- Include the WHERE — which page, dialog, component, or feature area.
- Include the WHAT — exact fields, labels, behaviors, values, workflows.
- Include the WHY if discussed — business reason, user need, workflow improvement.
- Preserve specific terminology used in the meeting (field names, feature names, tool names).
- Separate UI/cosmetic tasks from functional/logic tasks.
- Do NOT generalize multiple specific items into one vague task. Keep them separate.
- Do NOT omit tasks just because they seem small — renaming a label is a task.
- Skip filler conversation, audio issues, and off-topic chatter.

## Decisions
List any decisions that were made during the meeting that aren't tasks but are important context:
- [Decision]: [What was decided and why]`;

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
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `Here is the meeting transcript:\n\n${transcriptLines}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content ?? '';
  const lines = content.split('\n');
  const title = lines[0]?.trim() || 'Meeting Summary';
  const summary = lines.slice(2).join('\n').trim() || content;

  return { title, summary };
}
