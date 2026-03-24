const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`\n🤖 Bot Online!: ${client.user.tag}`);
    console.log(`📡 Terhubung ke ${client.guilds.cache.size} server`);
    
    client.user.setActivity('/help • Mia is my wife • On development', { 
        type: ActivityType.Streaming,
        url: 'https://www.twitch.tv/discord' 
    });
  },
};