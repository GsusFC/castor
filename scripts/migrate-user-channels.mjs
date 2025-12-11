import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function migrate() {
  await client.execute(`CREATE TABLE IF NOT EXISTS user_channels (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    channel_image_url TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    use_count INTEGER NOT NULL DEFAULT 0,
    last_used_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  
  await client.execute('CREATE INDEX IF NOT EXISTS user_channels_user_idx ON user_channels(user_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS user_channels_channel_idx ON user_channels(channel_id)');
  
  console.log('✓ Table user_channels created!');
}

migrate().catch(console.error);
