import { MongoClient, Db } from 'mongodb';
import { config } from '../config.js';

let client: MongoClient;
let db: Db;

export async function connectToMongo(): Promise<Db> {
  client = new MongoClient(config.mongoUri);
  await client.connect();
  db = client.db(config.mongoDbName);
  await db.command({ ping: 1 });
  console.log(`Connected to MongoDB database: ${config.mongoDbName}`);
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error('MongoDB not connected. Call connectToMongo() first.');
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) await client.close();
}
