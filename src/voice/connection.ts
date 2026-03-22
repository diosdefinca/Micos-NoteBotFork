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
    // Log networking details when entering connecting state
    if ('networking' in newState) {
      const networking = (newState as any).networking;
      if (networking) {
        networking.on('stateChange', (nOld: any, nNew: any) => {
          console.log(`Voice networking: ${nOld.code} -> ${nNew.code}`);
          if (nNew.code === 'UdpHandshaking') {
            console.log('UDP handshake started — waiting for IP discovery...');
          }
          if (nNew.reason) {
            console.log(`Voice networking reason: ${nNew.reason}`);
          }
          if (nNew.closeCode) {
            console.log(`Voice networking closeCode: ${nNew.closeCode}`);
          }
        });
        networking.on('error', (err: Error) => {
          console.error('Voice networking error:', err);
        });
      }
    }
  });

  connection.on('error', (err) => {
    console.error('Voice connection error:', err);
  });

  connection.on('debug', (msg) => {
    console.log(`Voice debug: ${msg}`);
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
