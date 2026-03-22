import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';

const commands = [
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Bot joins your current voice channel'),
  new SlashCommandBuilder()
    .setName('record')
    .setDescription('Start recording the current voice channel'),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop recording and get a meeting summary'),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check if recording is active'),
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
