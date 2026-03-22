import { VoiceState } from 'discord.js';
import { getActiveMeeting, subscribeUser } from '../meeting/manager.js';

export function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): void {
  // Ignore bot voice state changes
  if (newState.member?.user.bot) return;

  const meeting = getActiveMeeting(oldState.guild.id);
  if (!meeting) return;

  // User joined the recorded channel
  if (
    newState.channelId === meeting.channelId &&
    oldState.channelId !== meeting.channelId
  ) {
    const member = newState.member;
    if (member) {
      subscribeUser(oldState.guild.id, member.id, member.user.username);
    }
  }
}
