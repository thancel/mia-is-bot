require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const { loadCommands } = require('./src/handlers/commandHandler');
const { loadEvents }   = require('./src/handlers/eventHandler');
const db               = require('./src/db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.GuildMember, Partials.Message],
});

client.commands          = new Collection();
client.tempVoiceChannels = new Map(); // in-memory mirror: channelId → ownerId (String)

(async () => {
  try {
    // 1. Connect to database
    await db.connect();

    // 2. Restore temp voice channels from DB into memory map (survive bot restarts)
    const existing = await db.getAllTempVoices();
    for (const record of existing) {
      client.tempVoiceChannels.set(record.channelId, String(record.ownerId));
    }
    if (existing.length > 0) {
      console.log(`🔄 Restored ${existing.length} temp voice channel(s) from database`);
    }

    // 3. Load commands & events, then login
    await loadCommands(client);
    await loadEvents(client);
    await client.login(process.env.TOKEN);
  } catch (err) {
    console.error('❌ Startup failed:', err);
    process.exit(1);
  }
})();
