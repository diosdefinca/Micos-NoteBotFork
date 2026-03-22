import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  discordToken: requireEnv('DISCORD_BOT_TOKEN'),
  discordClientId: requireEnv('DISCORD_CLIENT_ID'),
  openaiApiKey: requireEnv('OPENAI_API_KEY'),
  mongoUri: requireEnv('MONGO_URI'),
  mongoDbName: requireEnv('MONGO_DB_NAME'),
  minParticipants: parseInt(process.env.MIN_PARTICIPANTS ?? '2', 10),
} as const;
