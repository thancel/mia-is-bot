const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const db = require('../../db');
const { randomColor } = require('../../utils/embedUtils');

async function sendLog(guild, embed) {
  const cfg = await db.getGuildConfig(guild.id);
  if (!cfg.logChannelId) return;
  const ch = guild.channels.cache.get(cfg.logChannelId);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('⚠️ Manage user warnings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('➕ Add a warning to a user')
      .addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for the warning').setRequired(true).setMinLength(1).setMaxLength(500))
    )
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('📋 List all warnings of a user')
      .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('🗑️ Remove a specific warning by number')
      .addUserOption(opt => opt.setName('user').setDescription('User whose warning to remove').setRequired(true))
      .addIntegerOption(opt => opt.setName('number').setDescription('Warning number to remove (see /warn list)').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub => sub
      .setName('clear')
      .setDescription('🧹 Clear all warnings for a user')
      .addUserOption(opt => opt.setName('user').setDescription('User to clear warnings for').setRequired(true))
    ),

  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const target = interaction.options.getMember('user');

    if (!target) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ User not found in this server.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── add ──────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const reason = interaction.options.getString('reason');
      if (target.user.bot) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ You cannot warn a bot.')],
          flags: MessageFlags.Ephemeral,
        });
      }
      if (target.id === interaction.user.id) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ You cannot warn yourself.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      await db.addWarning(interaction.guild.id, target.id, {
        reason,
        modId:  interaction.user.id,
        modTag: interaction.user.tag,
      });

      const warnings = await db.getWarnings(interaction.guild.id, target.id);

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle('⚠️ Warning Added')
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: '👤 User',            value: `${target} (${target.user.tag})`, inline: false },
          { name: '🛡️ Moderator',       value: `${interaction.user}`,            inline: false },
          { name: '📊 Total Warnings',  value: `${warnings.length}`,             inline: false },
          { name: '📝 Reason',          value: reason,                           inline: false },
        )
        .setTimestamp();

      await sendLog(interaction.guild, embed);
      try {
        await target.user.send(
          `⚠️ You received a warning in **${interaction.guild.name}**!\n` +
          `📝 Reason: ${reason}\n📊 Total warnings: ${warnings.length}`
        );
      } catch {}

      return interaction.reply({ embeds: [embed] });
    }

    // ── list ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const list = await db.getWarnings(interaction.guild.id, target.id);
      if (!list.length) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(randomColor())
            .setDescription(`✅ **${target.displayName}** has no warnings.`)],
          flags: MessageFlags.Ephemeral,
        });
      }
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle(`📋 Warnings — ${target.user.tag}`)
          .setThumbnail(target.user.displayAvatarURL())
          .setDescription(
            list.map((w, i) =>
              `**#${i + 1}** — ${w.reason}\n🛡️ ${w.mod} • <t:${Math.floor(w.timestamp / 1000)}:R>`
            ).join('\n\n')
          )
          .setFooter({ text: `Total: ${list.length} warning(s)` })],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── remove ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const number = interaction.options.getInteger('number');
      const list   = await db.getWarnings(interaction.guild.id, target.id);
      if (!list.length) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ **${target.displayName}** has no warnings.`)],
          flags: MessageFlags.Ephemeral,
        });
      }
      const index = number - 1;
      if (index < 0 || index >= list.length) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(
            `❌ Warning #${number} does not exist. This user has **${list.length}** warning(s).`
          )],
          flags: MessageFlags.Ephemeral,
        });
      }
      const removed = list[index];
      await db.removeWarning(interaction.guild.id, target.id, index);

      const logEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🗑️ Warning Removed')
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: '👤 User',       value: `${target} (${target.user.tag})`, inline: false },
          { name: '🛡️ Moderator',  value: `${interaction.user}`,            inline: false },
          { name: '📝 Removed',    value: removed.reason,                   inline: false },
          { name: '📊 Remaining',  value: `${list.length - 1} warning(s)`,  inline: false },
        )
        .setTimestamp();
      await sendLog(interaction.guild, logEmbed);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(randomColor())
          .setDescription(
            `✅ Removed warning **#${number}** from **${target.displayName}**.\n` +
            `📝 "${removed.reason}"\n` +
            `They now have **${list.length - 1}** warning(s).`
          )],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── clear ─────────────────────────────────────────────────────────────────
    if (sub === 'clear') {
      const had = await db.clearWarnings(interaction.guild.id, target.id);

      const logEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('🧹 All Warnings Cleared')
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: '👤 User',      value: `${target} (${target.user.tag})`, inline: false },
          { name: '🛡️ Moderator', value: `${interaction.user}`,            inline: false },
          { name: '🗑️ Removed',   value: `${had} warning(s)`,              inline: false },
        )
        .setTimestamp();
      await sendLog(interaction.guild, logEmbed);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(randomColor())
          .setDescription(`✅ Cleared **${had}** warning(s) from **${target.displayName}**.`)],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
