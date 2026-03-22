import { Interaction, GuildMember, ChannelType } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import { connectToChannel, disconnectFromGuild } from '../voice/connection.js';
import { startRecording, stopRecording, getActiveMeeting } from '../meeting/manager.js';

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;

  switch (interaction.commandName) {
    case 'join':
      await handleJoin(interaction, member);
      break;
    case 'record':
      await handleRecord(interaction, member);
      break;
    case 'stop':
      await handleStop(interaction, member);
      break;
    case 'status':
      await handleStatus(interaction, member);
      break;
  }
}

async function handleJoin(interaction: Interaction & { reply: Function }, member: GuildMember): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    await interaction.reply({ content: 'You need to be in a voice channel first.', ephemeral: true });
    return;
  }

  const existing = getVoiceConnection(interaction.guild!.id);
  if (existing) {
    await interaction.reply({ content: `Already connected to a voice channel.`, ephemeral: true });
    return;
  }

  connectToChannel(voiceChannel);
  await interaction.reply(`Joined **${voiceChannel.name}**.`);
}

async function handleRecord(interaction: Interaction & { reply: Function }, member: GuildMember): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guild!.id;

  if (getActiveMeeting(guildId)) {
    await interaction.reply({ content: 'A recording is already in progress.', ephemeral: true });
    return;
  }

  const voiceChannel = member.voice.channel;
  if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
    await interaction.reply({ content: 'You need to be in a voice channel first.', ephemeral: true });
    return;
  }

  const nonBotMembers = voiceChannel.members.filter((m) => !m.user.bot);

  await interaction.deferReply();

  try {
    await startRecording(interaction.client, voiceChannel, [...nonBotMembers.values()]);
    await interaction.editReply(`Recording started in **${voiceChannel.name}**.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await interaction.editReply(`Failed to start recording: ${msg}`);
  }
}

async function handleStop(interaction: Interaction & { reply: Function }, member: GuildMember): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guild!.id;

  if (!getActiveMeeting(guildId)) {
    await interaction.reply({ content: 'No recording is currently active.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    await stopRecording(interaction.client, guildId);
    await interaction.editReply('Recording stopped. Summary sent to attendees.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await interaction.editReply(`Error stopping recording: ${msg}`);
  }
}

async function handleStatus(interaction: Interaction & { reply: Function }, member: GuildMember): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guild!.id;
  const meeting = getActiveMeeting(guildId);

  if (!meeting) {
    await interaction.reply({ content: 'Not currently recording.', ephemeral: true });
    return;
  }

  const startTime = parseInt(meeting.meetingId.split('_')[1] ?? '0', 10);
  const durationMs = Date.now() - startTime;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1000);
  const attendees = [...meeting.usernames.values()].join(', ');

  await interaction.reply(
    `**Recording active**\n` +
    `Channel: <#${meeting.channelId}>\n` +
    `Duration: ${minutes}m ${seconds}s\n` +
    `Attendees: ${attendees}`,
  );
}
