import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';

const commands = [
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Bot joins your current voice channel'),
  new SlashCommandBuilder()
    .setName('record')
    .setDescription('Start recording the current voice channel')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('Which summary style to use (defaults to dev team tasks)')
        .addChoices(
          { name: 'Dev team task list', value: 'dev' },
          { name: 'Camp / general meeting notes', value: 'camp' },
        ),
    ),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop recording and get a meeting summary'),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check if recording is active'),
  new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Force-clear bot state (use if the bot was kicked and can\'t be reinvited)'),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(config.discordToken);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(config.discordClientId), {
      body: commands,
    });
    console.log('Slash commands registered successfully.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
})();
