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

function checkNativeModules() {
  // Check encryption (required for voice)
  const encryptionLibs = ['sodium-native', 'sodium', 'libsodium-wrappers', 'tweetnacl'];
  let encLoaded = false;
  for (const lib of encryptionLibs) {
    try {
      require(lib);
      console.log(`Encryption: ${lib} loaded`);
      encLoaded = true;
      break;
    } catch {
      // try next
    }
  }
  if (!encLoaded) console.error('WARNING: No encryption library loaded — voice will NOT work!');

  // Check opus
  const opusLibs = ['@discordjs/opus', 'opusscript'];
  let opusLoaded = false;
  for (const lib of opusLibs) {
    try {
      require(lib);
      console.log(`Opus: ${lib} loaded`);
      opusLoaded = true;
      break;
    } catch {
      // try next
    }
  }
  if (!opusLoaded) console.error('WARNING: No opus library loaded — voice decoding will NOT work!');
}

async function main() {
  checkNativeModules();
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
