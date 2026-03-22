import { Client } from 'discord.js';
import { Meeting } from '../db/models.js';

export async function notifyAttendees(client: Client, meeting: Meeting): Promise<void> {
  const startStr = meeting.startDate.toLocaleString();
  const endStr = meeting.endDate ? meeting.endDate.toLocaleString() : 'Ongoing';
  const attendeeNames = meeting.attendees.map((a) => a.username).join(', ');

  const message =
    `# ${meeting.title ?? 'Meeting Summary'}\n` +
    `**Date:** ${startStr} - ${endStr}\n` +
    `**Attendees:** ${attendeeNames}\n` +
    `**Summary:**\n${meeting.summary ?? 'No summary available.'}`;

  for (const attendee of meeting.attendees) {
    try {
      const user = await client.users.fetch(attendee.userId);
      await user.send(message);
      console.log(`Sent meeting summary to ${attendee.username}`);
    } catch (err) {
      console.error(`Failed to send DM to ${attendee.username}:`, err);
    }
  }
}
