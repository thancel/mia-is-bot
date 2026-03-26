const { ActivityType } = require('discord.js');
const db = require('../db');
const { refreshPanel } = require('../commands/voice/tempvoice');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`\n🤖 Bot Online: ${client.user.tag}`);
    console.log(`📡 Connected to ${client.guilds.cache.size} server(s)`);

    client.user.setActivity('/help • Mia Bot • Online', {
      type: ActivityType.Streaming,
      url: 'https://www.twitch.tv/discord',
    });

    // Refresh voice panels across all guilds after restart
    let refreshed = 0;
    for (const [, guild] of client.guilds.cache) {
      try {
        const cfg = await db.getGuildConfig(guild.id);
        if (!cfg.voicePanelChannelId) continue;
        const panelCh = guild.channels.cache.get(cfg.voicePanelChannelId);
        if (!panelCh) continue;
        await refreshPanel(panelCh, client);
        refreshed++;
      } catch (err) {
        console.error(`[ready] Failed to refresh panel for guild ${guild.id}:`, err.message);
      }
    }
    if (refreshed > 0) console.log(`🔄 Refreshed ${refreshed} voice panel(s)`);
  },
};
