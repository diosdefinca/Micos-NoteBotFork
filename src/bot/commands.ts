import { ChatInputCommandInteraction, GuildMember, ChannelType, Interaction } from 'discord.js';
import { getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { connectToChannel } from '../voice/connection.js';
import { startRecording, stopRecording, getActiveMeeting, forceReset } from '../meeting/manager.js';

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;

  try {
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
      case 'reset':
        await handleReset(interaction);
        break;
    }
  } catch (err) {
    console.error(`Command error (${interaction.commandName}):`, err);
    try {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`Error: ${msg}`);
      } else {
        await interaction.reply({ content: `Error: ${msg}`, ephemeral: true });
      }
    } catch {
      // Interaction expired or already handled — nothing we can do
    }
  }
}

async function handleJoin(interaction: ChatInputCommandInteraction, member: GuildMember): Promise<void> {
  await interaction.deferReply();

  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    await interaction.editReply('You need to be in a voice channel first.');
    return;
  }

  const existing = getVoiceConnection(interaction.guild!.id);
  if (existing) {
    if (existing.state.status === VoiceConnectionStatus.Destroyed ||
        existing.state.status === VoiceConnectionStatus.Disconnected) {
      existing.destroy();
    } else {
      await interaction.editReply('Already connected to a voice channel.');
      return;
    }
  }

  connectToChannel(voiceChannel);
  await interaction.editReply(`Joined **${voiceChannel.name}**.`);
}

async function handleRecord(interaction: ChatInputCommandInteraction, member: GuildMember): Promise<void> {
  await interaction.deferReply();

  const guildId = interaction.guild!.id;

  if (getActiveMeeting(guildId)) {
    await interaction.editReply('A recording is already in progress.');
    return;
  }

  const voiceChannel = member.voice.channel;
  if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
    await interaction.editReply('You need to be in a voice channel first.');
    return;
  }

  const nonBotMembers = voiceChannel.members.filter((m) => !m.user.bot);

  await startRecording(interaction.client, voiceChannel, [...nonBotMembers.values()]);
  await interaction.editReply(`Recording started in **${voiceChannel.name}**.`);
}

async function handleStop(interaction: ChatInputCommandInteraction, member: GuildMember): Promise<void> {
  await interaction.deferReply();

  const guildId = interaction.guild!.id;

  if (!getActiveMeeting(guildId)) {
    await interaction.editReply('No recording is currently active.');
    return;
  }

  await stopRecording(interaction.client, guildId);
  await interaction.editReply('Recording stopped. Summary sent to attendees.');
}

async function handleReset(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const guildId = interaction.guild!.id;
  const result = await forceReset(interaction.client, guildId);

  if (!result.hadMeeting) {
    await interaction.editReply('No active meeting. Voice connection cleared — ready to be reinvited.');
    return;
  }

  if (result.summarized) {
    await interaction.editReply(`Reset complete. Meeting \`${result.meetingId}\` was finalized and the summary was sent to attendees.`);
  } else {
    await interaction.editReply(`Reset complete. Meeting \`${result.meetingId}\` could not be summarized and was marked as errored. Ready to be reinvited.`);
  }
}

async function handleStatus(interaction: ChatInputCommandInteraction, member: GuildMember): Promise<void> {
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
