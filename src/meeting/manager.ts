import { Client, VoiceBasedChannel, GuildMember } from 'discord.js';
import { VoiceConnectionStatus, entersState, getVoiceConnection } from '@discordjs/voice';
import { connectToChannel, disconnectFromGuild } from '../voice/connection.js';
import { RecorderManager } from '../voice/recorder.js';
import * as repo from '../db/repository.js';
import { summarizeMeeting } from '../summarization/summarizer.js';
import { notifyAttendees } from './notifier.js';

interface ActiveMeeting {
  meetingId: string;
  channelId: string;
  guildId: string;
  recorder: RecorderManager;
  usernames: Map<string, string>; // userId -> username
}

const activeMeetings = new Map<string, ActiveMeeting>(); // guildId -> ActiveMeeting

export function getActiveMeeting(guildId: string): ActiveMeeting | undefined {
  return activeMeetings.get(guildId);
}

export async function startRecording(
  client: Client,
  channel: VoiceBasedChannel,
  members: GuildMember[],
): Promise<string> {
  const guildId = channel.guild.id;

  if (activeMeetings.has(guildId)) {
    throw new Error('A recording is already active in this server.');
  }

  const meetingId = `meeting_${Date.now()}`;
  const attendees = members.map((m) => ({
    userId: m.id,
    username: m.user.username,
    joinedAt: new Date(),
  }));

  await repo.createMeeting(meetingId, guildId, channel.id, attendees);

  // Reuse existing connection if already joined via /join, otherwise connect
  let connection = getVoiceConnection(guildId);
  if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
    connection = connectToChannel(channel);
  }

  // Wait for the voice connection to be ready before subscribing to audio
  if (connection.state.status !== VoiceConnectionStatus.Ready) {
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  }
  console.log('Voice connection ready');

  const recorder = new RecorderManager(connection, meetingId);

  const usernames = new Map<string, string>();
  for (const member of members) {
    recorder.subscribe(member.id, member.user.username);
    usernames.set(member.id, member.user.username);
  }

  activeMeetings.set(guildId, {
    meetingId,
    channelId: channel.id,
    guildId,
    recorder,
    usernames,
  });

  console.log(`Recording started: ${meetingId} in #${channel.name}`);
  return meetingId;
}

export function subscribeUser(guildId: string, userId: string, username: string): void {
  const meeting = activeMeetings.get(guildId);
  if (!meeting) return;
  if (meeting.usernames.has(userId)) return;

  meeting.recorder.subscribe(userId, username);
  meeting.usernames.set(userId, username);

  repo.addAttendee(meeting.meetingId, {
    userId,
    username,
    joinedAt: new Date(),
  }).catch((err) => console.error('Failed to add attendee:', err));

  console.log(`Added late joiner: ${username}`);
}

export async function stopRecording(client: Client, guildId: string): Promise<void> {
  const meeting = activeMeetings.get(guildId);
  if (!meeting) {
    throw new Error('No active recording in this server.');
  }

  // Flush remaining audio buffers
  await meeting.recorder.flushAll();
  meeting.recorder.destroyAll();
  activeMeetings.delete(guildId);

  // End meeting in DB
  await repo.endMeeting(meeting.meetingId);

  // Disconnect from voice
  disconnectFromGuild(guildId);

  // Summarize
  try {
    const meetingDoc = await repo.getMeeting(meeting.meetingId);
    if (!meetingDoc) throw new Error('Meeting not found in DB');

    const { title, summary } = await summarizeMeeting(meetingDoc);
    await repo.updateSummary(meeting.meetingId, title, summary);

    // Refetch with summary
    const updated = await repo.getMeeting(meeting.meetingId);
    if (updated) {
      await notifyAttendees(client, updated);
    }
  } catch (err) {
    console.error('Summarization error:', err);
    await repo.setMeetingError(meeting.meetingId);
  }

  console.log(`Recording stopped: ${meeting.meetingId}`);
}
