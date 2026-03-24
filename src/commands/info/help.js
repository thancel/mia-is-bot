const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('📖 Show all bot commands'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📖 Bot Commands')
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .addFields(
        {
          name: '⚙️ Server Settings',
          value: [
            '`/set view` — View all current settings',
            '`/set welcome <#channel>` — Set welcome channel',
            '`/set goodbye <#channel>` — Set goodbye channel',
            '`/set log <#channel>` — Set moderation log channel',
            '`/set mutedrole <@role>` — Set muted role',
            '`/set remove <setting>` — Remove a setting',
            '`/set reset` — Reset all settings',
          ].join('\n'),
        },
        {
          name: '🎌 Anime & Manga',
          value: [
            '`/anime <title>` — Search anime via AniList',
            '`/manga <title>` — Search manga via AniList',
          ].join('\n'),
        },
        {
          name: '🎙️ Temp Voice',
          value: [
            '`/tempvc setup <category>` — [Admin] Setup temp voice',
            '`/tempvc rename <name>` — Rename your channel',
            '`/tempvc limit <amount>` — Set user limit',
            '`/tempvc kick <user>` — Kick user from channel',
            '`/tempvc lock` — Toggle lock/unlock',
            '`/tempvc transfer <user>` — Transfer ownership',
            '`/tempvc info` — View channel info',
          ].join('\n'),
        },
        {
          name: '🛡️ Moderation',
          value: [
            '`/ban <user> <reason> [hours]` — Ban user (optional temp)',
            '`/unban <id> <reason>` — Unban user',
            '`/kick <user> <reason>` — Kick user',
            '`/mute <user> <duration> <reason>` — Timeout user',
            '`/unmute <user> <reason>` — Remove timeout',
            '`/warn add/list/remove/clear` — Manage warnings',
            '`/purge <amount> [user]` — Bulk delete messages',
          ].join('\n'),
        },
        {
          name: 'ℹ️ Info',
          value: [
            '`/help` — Show this message',
            '`/serverinfo` — Server information',
            '`/userinfo [user]` — User information',
          ].join('\n'),
        },
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
