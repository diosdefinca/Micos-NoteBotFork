import {
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} from '@discordjs/voice';
import type { VoiceBasedChannel } from 'discord.js';

export function connectToChannel(channel: VoiceBasedChannel): VoiceConnection {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: true,
  });

  connection.on('stateChange', (oldState, newState) => {
    console.log(`Voice connection: ${oldState.status} -> ${newState.status}`);
  });

  connection.on('error', (err) => {
    console.error('Voice connection error:', err);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
      // Reconnecting — do nothing
    } catch {
      // Could not reconnect
      connection.destroy();
    }
  });

  return connection;
}

export function disconnectFromGuild(guildId: string): void {
  const connection = getVoiceConnection(guildId);
  if (connection) {
    connection.destroy();
  }
}

export function getConnection(guildId: string): VoiceConnection | undefined {
  return getVoiceConnection(guildId);
}
