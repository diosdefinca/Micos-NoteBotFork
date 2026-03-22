import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from './config.js';
import { connectToMongo } from './db/mongo.js';
import { handleInteraction } from './bot/commands.js';
import { handleVoiceStateUpdate } from './bot/events.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.id}/${c.user.tag}`);
  console.log('------');
});

client.on(Events.InteractionCreate, handleInteraction);
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  handleVoiceStateUpdate(oldState, newState);
});

async function main() {
  await connectToMongo();
  await client.login(config.discordToken);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});
