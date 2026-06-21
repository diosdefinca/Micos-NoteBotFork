import { Collection } from 'mongodb';
import { getDb } from './mongo.js';
import { Meeting, Transcription, Attendee, PromptType } from './models.js';

function meetings(): Collection<Meeting> {
  return getDb().collection<Meeting>('meetings');
}

export async function createMeeting(
  meetingId: string,
  guildId: string,
  channelId: string,
  attendees: Attendee[],
  promptType: PromptType,
): Promise<void> {
  await meetings().insertOne({
    meetingId,
    guildId,
    channelId,
    attendees,
    startDate: new Date(),
    endDate: null,
    transcriptions: [],
    title: null,
    summary: null,
    promptType,
    status: 'active',
  });
}

export async function getActiveMeetingByChannel(channelId: string): Promise<Meeting | null> {
  return meetings().findOne({ channelId, status: 'active' });
}

export async function addTranscription(meetingId: string, transcription: Transcription): Promise<void> {
  await meetings().updateOne(
    { meetingId },
    { $push: { transcriptions: transcription } },
  );
}

export async function addAttendee(meetingId: string, attendee: Attendee): Promise<void> {
  await meetings().updateOne(
    { meetingId },
    { $push: { attendees: attendee } },
  );
}

export async function endMeeting(meetingId: string): Promise<void> {
  await meetings().updateOne(
    { meetingId },
    { $set: { endDate: new Date(), status: 'summarizing' as const } },
  );
}

export async function updateSummary(
  meetingId: string,
  title: string,
  summary: string,
): Promise<void> {
  await meetings().updateOne(
    { meetingId },
    { $set: { title, summary, status: 'complete' as const } },
  );
}

export async function setMeetingError(meetingId: string): Promise<void> {
  await meetings().updateOne(
    { meetingId },
    { $set: { status: 'error' as const } },
  );
}

export async function getMeeting(meetingId: string): Promise<Meeting | null> {
  return meetings().findOne({ meetingId });
}
