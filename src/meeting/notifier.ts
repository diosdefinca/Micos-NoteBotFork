import { Client } from 'discord.js';
import { Meeting } from '../db/models.js';

const MAX_MSG_LENGTH = 2000;

function splitMessage(text: string): string[] {
  if (text.length <= MAX_MSG_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_MSG_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline before the limit
    let splitAt = remaining.lastIndexOf('\n', MAX_MSG_LENGTH);
    if (splitAt <= 0) {
      // No newline found — split at a space
      splitAt = remaining.lastIndexOf(' ', MAX_MSG_LENGTH);
    }
    if (splitAt <= 0) {
      // No space found — hard split
      splitAt = MAX_MSG_LENGTH;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}

export async function notifyAttendees(client: Client, meeting: Meeting): Promise<void> {
  const startStr = meeting.startDate.toLocaleString();
  const endStr = meeting.endDate ? meeting.endDate.toLocaleString() : 'Ongoing';
  const attendeeNames = meeting.attendees.map((a) => a.username).join(', ');

  const message =
    `# ${meeting.title ?? 'Meeting Summary'}\n` +
    `**Date:** ${startStr} - ${endStr}\n` +
    `**Attendees:** ${attendeeNames}\n` +
    `**Summary:**\n${meeting.summary ?? 'No summary available.'}`;

  const chunks = splitMessage(message);

  for (const attendee of meeting.attendees) {
    try {
      const user = await client.users.fetch(attendee.userId);
      for (const chunk of chunks) {
        await user.send(chunk);
      }
      console.log(`Sent meeting summary to ${attendee.username} (${chunks.length} message(s))`);
    } catch (err) {
      console.error(`Failed to send DM to ${attendee.username}:`, err);
    }
  }
}
