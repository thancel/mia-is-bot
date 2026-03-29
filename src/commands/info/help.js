const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { randomColor } = require('../../utils/embedUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('📖 Show all available commands'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(randomColor())
      .setTitle('📖 Command List')
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .addFields(
        {
          name: '🎙️ Temp Voice',
          value: [
            '`/tempvoice setup <category>` — [Admin] Create trigger channel + control panel',
            '`/tempvoice kick <user>` — Kick a user from your temporary channel',
            '`/tempvoice panel` — [Admin] Refresh and resend the control panel',
            '',
            '**Panel Buttons** *(in #voice-panel)*',
            '🔒 **Lock / Unlock** — Toggle channel access',
            '✏️ **Rename** — Change channel name',
            '👥 **Limit** — Set max user count',
            '📡 **Bitrate** — Adjust audio quality',
            'ℹ️ **Info** — View channel info (only you can see)',
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
          name: '🛡️ Moderation',
          value: [
            '`/ban <user> <reason> [hours]` — Ban a user (optional: temporary)',
            '`/unban <id> <reason>` — Unban a user by ID',
            '`/kick <user> <reason>` — Kick a user from the server',
            '`/mute <user> <duration> <reason>` — Timeout a user',
            '`/unmute <user> <reason>` — Remove a user\'s timeout',
            '`/warn add/list/remove/clear` — Manage user warnings',
            '`/purge <amount> [user]` — Bulk delete messages (max 100)',
            '`/log set/remove/status` — Configure the moderation log channel',
          ].join('\n'),
        },
        {
          name: '👋 Welcome & Goodbye',
          value: [
            '`/welcome setup/remove/background/text/color/preview/reset`',
            '`/goodbye setup/remove/background/text/color/preview/reset`',
          ].join('\n'),
        },
        {
          name: '🏷️ Auto-Role',
          value: [
            '`/autorole set <role>` — Set auto-role for new members',
            '`/autorole remove` — Remove the auto-role',
            '`/autorole status` — Show current auto-role config',
          ].join('\n'),
        },
        {
          name: '🎭 Reaction Role',
          value: [
            '`/reactionrole create <channel> <title>` — Create a role panel',
            '`/reactionrole add <panel_id> <role> <label>` — Add a role button',
            '`/reactionrole remove <panel_id> <role>` — Remove a role button',
            '`/reactionrole edit <panel_id> [title] [desc] [color]` — Edit a panel',
            '`/reactionrole delete <panel_id>` — Delete a panel',
            '`/reactionrole list` — List all panels',
          ].join('\n'),
        },
        {
          name: '🎉 Giveaway',
          value: [
            '`/giveaway start <prize> <duration> <channel>` — Start a giveaway',
            '`/giveaway end <id>` — End early',
            '`/giveaway reroll <id>` — Reroll winner(s)',
            '`/giveaway delete <id>` — Cancel & delete',
            '`/giveaway list` — List all giveaways',
          ].join('\n'),
        },
        {
          name: 'ℹ️ Info',
          value: [
            '`/help` — Show this message',
            '`/serverinfo` — Display server information',
            '`/userinfo [user]` — Display user information',
            '`/say <message> [channel]` — Send a message as the bot',
          ].join('\n'),
        },
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
