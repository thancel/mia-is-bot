const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} = require('discord.js');
const db = require('../../db');
const { randomColor } = require('../../utils/embedUtils');

// ── What gets logged ──────────────────────────────────────────────────────────
const LOG_EVENTS = [
  { emoji: '🔨', name: 'Ban',                      desc: 'User banned (permanent or temporary)' },
  { emoji: '🔓', name: 'Unban',                    desc: 'User unbanned' },
  { emoji: '👢', name: 'Kick',                     desc: 'User kicked from server' },
  { emoji: '🔇', name: 'Mute',                     desc: 'User timed out' },
  { emoji: '🔊', name: 'Unmute',                   desc: 'Timeout removed' },
  { emoji: '🗑️', name: 'Purge',                    desc: 'Messages bulk deleted' },
  { emoji: '⚠️', name: 'Warn Add',                 desc: 'Warning added to a user' },
  { emoji: '🗑️', name: 'Warn Remove',              desc: 'A warning removed from a user' },
  { emoji: '🧹', name: 'Warn Clear',               desc: 'All warnings cleared for a user' },
  { emoji: '🎙️', name: 'Voice Created',            desc: 'Temp voice room created' },
  { emoji: '🗑️', name: 'Voice Deleted',            desc: 'Temp voice room deleted (empty)' },
  { emoji: '👑', name: 'Voice Ownership Transfer', desc: 'Temp voice ownership changed' },
  { emoji: '🦵', name: 'Voice Kick',               desc: 'User kicked from temp voice' },
  { emoji: '🎛️', name: 'Panel Refresh',            desc: 'Voice panel refreshed by admin' },
  { emoji: '🎙️', name: 'Voice Setup',              desc: 'Temp voice system configured' },
  { emoji: '👋', name: 'Welcome Setup/Change',     desc: 'Welcome settings changed by admin' },
  { emoji: '👋', name: 'Goodbye Setup/Change',     desc: 'Goodbye settings changed by admin' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log')
    .setDescription('📋 Configure the moderation log channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // /log set <channel>
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('✅ Set the channel where moderation actions are logged')
      .addChannelOption(opt => opt
        .setName('channel')
        .setDescription('Text channel to send logs to')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
      )
    )

    // /log remove
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('🗑️ Disable moderation logging')
    )

    // /log status
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('👁️ Show the current log channel configuration')
    ),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── /log set ──────────────────────────────────────────────────────────────
    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel');

      // Check the bot can actually send messages there
      const botMember = interaction.guild.members.me;
      if (!channel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xed4245)
            .setDescription(`❌ I don't have permission to send messages in ${channel}.\nPlease adjust the channel permissions and try again.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      await db.setGuildConfig(guildId, { logChannelId: channel.id });

      // Send a test message to the log channel
      const testEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('📋 Moderation Log Enabled')
        .setDescription('This channel has been set as the moderation log channel.\nAll moderation actions will be recorded here.')
        .addFields(
          { name: '📌 Configured by', value: `${interaction.user}`, inline: true },
          { name: '📅 Date',           value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        )
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      await channel.send({ embeds: [testEmbed] }).catch(() => {});

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(randomColor())
          .setTitle('✅ Log Channel Set')
          .setDescription(`Moderation actions will now be logged in ${channel}.`)
          .addFields({
            name: '📋 Events logged',
            value: LOG_EVENTS.map(e => `${e.emoji} **${e.name}** — ${e.desc}`).join('\n'),
          })
          .setFooter({ text: 'Use /log remove to disable logging.' })],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── /log remove ───────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const cfg = await db.getGuildConfig(guildId);

      if (!cfg.logChannelId) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xed4245)
            .setDescription('❌ No log channel is currently configured.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      await db.setGuildConfig(guildId, { logChannelId: null });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(randomColor())
          .setDescription('🗑️ Moderation logging has been **disabled**.\nNo moderation actions will be logged until you run `/log set` again.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── /log status ───────────────────────────────────────────────────────────
    if (sub === 'status') {
      const cfg = await db.getGuildConfig(guildId);

      const isActive     = Boolean(cfg.logChannelId);
      const channelValue = cfg.logChannelId
        ? `<#${cfg.logChannelId}>`
        : '`Not configured`';

      // Check if the channel still exists
      let channelNote = '';
      if (cfg.logChannelId && !interaction.guild.channels.cache.has(cfg.logChannelId)) {
        channelNote = '\n⚠️ **Warning:** The configured channel no longer exists. Run `/log set` to update it.';
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(isActive ? randomColor() : 0x99aab5)
          .setTitle('📋 Log Channel Status')
          .setDescription(`**Status:** ${isActive ? '🟢 Active' : '🔴 Disabled'}${channelNote}`)
          .addFields(
            { name: '📌 Log Channel', value: channelValue, inline: false },
            {
              name: '📋 Events logged',
              value: LOG_EVENTS.map(e => `${e.emoji} **${e.name}** — ${e.desc}`).join('\n'),
              inline: false,
            },
          )
          .setFooter({ text: isActive ? 'Use /log remove to disable.' : 'Use /log set to enable.' })],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
