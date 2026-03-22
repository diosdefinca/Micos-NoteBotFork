export interface Transcription {
  userId: string;
  username: string;
  timestamp: Date;
  text: string;
}

export interface Attendee {
  userId: string;
  username: string;
  joinedAt: Date;
}

export interface Meeting {
  meetingId: string;
  guildId: string;
  channelId: string;
  attendees: Attendee[];
  startDate: Date;
  endDate: Date | null;
  transcriptions: Transcription[];
  title: string | null;
  summary: string | null;
  status: 'active' | 'summarizing' | 'complete' | 'error';
}
