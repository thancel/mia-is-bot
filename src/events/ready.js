const { ActivityType } = require('discord.js');
const db = require('../db');
const { refreshPanel } = require('../commands/voice/tempvoice');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    const asciiArt = `
 ███╗   ███╗██╗ █████╗ 
 ████╗ ████║██║██╔══██╗
 ██╔████╔██║██║███████║
 ██║╚██╔╝██║██║██╔══██║
 ██║ ╚═╝ ██║██║██║  ██║
 ╚═╝     ╚═╝╚═╝╚═╝  ╚═╝
    `;
    const os = require('os');
    
    // Measure CPU usage over 100ms interval
    const getCpuUsage = () => {
      let idle = 0, total = 0;
      for (const cpu of os.cpus()) {
        for (const type in cpu.times) total += cpu.times[type];
        idle += cpu.times.idle;
      }
      return { idle, total };
    };

    const startUsage = getCpuUsage();
    await new Promise(res => setTimeout(res, 100));
    const endUsage = getCpuUsage();

    const idleDiff = endUsage.idle - startUsage.idle;
    const totalDiff = endUsage.total - startUsage.total;
    const cpuPercent = totalDiff === 0 ? "0.00" : (100 - (100 * idleDiff / totalDiff)).toFixed(2);

    const cpuModel = os.cpus()[0].model;
    const cpuCores = os.cpus().length;
    const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const usedRam = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(2);
    const botRam = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

    console.log(asciiArt);
    console.log(`🤖 Bot Online:     ${client.user.tag}`);
    console.log(`📡 Servers:          ${client.guilds.cache.size}`);
    console.log(`💻 CPU:              ${cpuModel} (${cpuCores} Cores) | ${cpuPercent}% Load`);
    console.log(`🖥️  System RAM:     ${usedRam} GB / ${totalRam} GB`);
    console.log(`🧠 Bot RAM:         ${botRam} MB`);
    console.log(``);

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

    // Restore giveaway timers across all guilds after restart
    const { scheduleGiveaway } = require('../commands/moderation/giveaway');
    let gwRestored = 0;
    for (const [, guild] of client.guilds.cache) {
      try {
        const cfg = await db.getGuildConfig(guild.id);
        const giveaways = cfg.giveaways || {};
        for (const gw of Object.values(giveaways)) {
          if (!gw.ended) {
            scheduleGiveaway(client, guild.id, gw);
            gwRestored++;
          }
        }
      } catch (err) {
        console.error(`[ready] Failed to restore giveaways for guild ${guild.id}:`, err.message);
      }
    }
    if (gwRestored > 0) console.log(`🎉 Restored ${gwRestored} active giveaway timer(s)`);
  },
};
