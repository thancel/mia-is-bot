const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig } = require('../../utils/guildConfig');

// ── Helpers ──
function modEmbed(action, target, mod, reason, color = 0xed4245, extra = []) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🔨 ${action}`)
    .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '👤 Target',    value: `${target} (${target.user.tag})`, inline: true  },
      { name: '🛡️ Moderator', value: `${mod}`,                         inline: true  },
      { name: '📝 Reason',    value: reason || 'No reason provided',   inline: false },
      ...extra,
    )
    .setTimestamp()
    .setFooter({ text: `ID: ${target.id}` });
  return embed;
}

async function sendLog(guild, embed) {
  const logChannelId = getConfig(guild.id).logChannelId;
  if (!logChannelId) return;
  const ch = guild.channels.cache.get(logChannelId);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

// ── /ban ──
const ban = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('🔨 Ban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o =>
      o.setName('user').setDescription('User to ban').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for the ban').setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('duration')
        .setDescription('Temp-ban: duration in hours (leave empty for permanent)')
        .setMinValue(1)
    ),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason   = interaction.options.getString('reason');
    const hours    = interaction.options.getInteger('duration');

    if (!target)          return interaction.reply({ content: '❌ User not found!',            ephemeral: true });
    if (!target.bannable) return interaction.reply({ content: '❌ I cannot ban this user!',    ephemeral: true });
    if (target.id === interaction.user.id)
                          return interaction.reply({ content: '❌ You cannot ban yourself!',   ephemeral: true });

    const durText = hours ? `Temp-ban: **${hours}h**` : 'Permanent';

    try {
      await target.send(
        `🔨 You have been **banned** from **${interaction.guild.name}**.\n` +
        `📝 Reason: ${reason}\n⏱️ Duration: ${durText}`
      ).catch(() => {});

      await target.ban({ deleteMessageSeconds: 0, reason });

      // Schedule unban if temp
      if (hours) {
        setTimeout(async () => {
          try {
            await interaction.guild.members.unban(target.id, 'Temp-ban expired');
          } catch {}
        }, hours * 60 * 60 * 1000);
      }

      const extra = [{ name: '⏱️ Duration', value: durText, inline: true }];
      const embed = modEmbed('Ban', target, interaction.user, reason, 0xed4245, extra);
      await sendLog(interaction.guild, embed);
      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      return interaction.reply({ content: `❌ Ban failed: ${err.message}`, ephemeral: true });
    }
  },
};

// ── /unban ──
const unban = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('🔓 Unban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o =>
      o.setName('userid').setDescription('User ID to unban').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for unban').setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.options.getString('userid');
    const reason = interaction.options.getString('reason');
    try {
      const banInfo = await interaction.guild.bans.fetch(userId);
      await interaction.guild.members.unban(userId, reason);
      const embed = new EmbedBuilder()
        .setColor(0x57f287).setTitle('🔓 Unban')
        .addFields(
          { name: '👤 User',       value: `${banInfo.user.tag} (${userId})`, inline: true },
          { name: '🛡️ Moderator',  value: `${interaction.user}`,             inline: true },
          { name: '📝 Reason',     value: reason,                            inline: false },
        ).setTimestamp();
      await sendLog(interaction.guild, embed);
      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      return interaction.reply({ content: `❌ Unban failed: ${err.message}`, ephemeral: true });
    }
  },
};

// ── /kick ──
const kick = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('👢 Kick a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o =>
      o.setName('user').setDescription('User to kick').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for the kick').setRequired(true)
    ),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');
    if (!target)          return interaction.reply({ content: '❌ User not found!',           ephemeral: true });
    if (!target.kickable) return interaction.reply({ content: '❌ I cannot kick this user!',  ephemeral: true });
    if (target.id === interaction.user.id)
                          return interaction.reply({ content: '❌ You cannot kick yourself!', ephemeral: true });
    try {
      await target.send(
        `👢 You have been **kicked** from **${interaction.guild.name}**.\n📝 Reason: ${reason}`
      ).catch(() => {});
      await target.kick(reason);
      const embed = modEmbed('Kick', target, interaction.user, reason, 0xffa500);
      await sendLog(interaction.guild, embed);
      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      return interaction.reply({ content: `❌ Kick failed: ${err.message}`, ephemeral: true });
    }
  },
};

// ── /mute ──
const mute = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('🔇 Timeout (mute) a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o =>
      o.setName('user').setDescription('User to mute').setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('duration')
        .setDescription('Duration in minutes')
        .setRequired(true).setMinValue(1).setMaxValue(40320)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for the mute').setRequired(true)
    ),

  async execute(interaction) {
    const target   = interaction.options.getMember('user');
    const duration = interaction.options.getInteger('duration');
    const reason   = interaction.options.getString('reason');
    if (!target)              return interaction.reply({ content: '❌ User not found!',            ephemeral: true });
    if (!target.moderatable)  return interaction.reply({ content: '❌ I cannot mute this user!',   ephemeral: true });
    const ms    = duration * 60 * 1000;
    const until = Math.floor((Date.now() + ms) / 1000);
    try {
      await target.timeout(ms, reason);
      const extra = [{ name: '⏱️ Duration', value: `${duration} min (until <t:${until}:R>)`, inline: true }];
      const embed = modEmbed('Mute', target, interaction.user, reason, 0xfee75c, extra);
      await sendLog(interaction.guild, embed);
      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      return interaction.reply({ content: `❌ Mute failed: ${err.message}`, ephemeral: true });
    }
  },
};

// ── /unmute ──
const unmute = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('🔊 Remove timeout from a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o =>
      o.setName('user').setDescription('User to unmute').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for unmute').setRequired(true)
    ),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');
    if (!target) return interaction.reply({ content: '❌ User not found!', ephemeral: true });
    try {
      await target.timeout(null, reason);
      const embed = modEmbed('Unmute', target, interaction.user, reason, 0x57f287);
      await sendLog(interaction.guild, embed);
      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      return interaction.reply({ content: `❌ Unmute failed: ${err.message}`, ephemeral: true });
    }
  },
};

// ── /purge ──
const purge = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('🗑️ Bulk delete messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true).setMinValue(1).setMaxValue(100)
    )
    .addUserOption(o =>
      o.setName('user').setDescription('Filter messages from a specific user')
    ),

  async execute(interaction) {
    const amount     = interaction.options.getInteger('amount');
    const filterUser = interaction.options.getUser('user');
    await interaction.deferReply({ ephemeral: true });
    try {
      let msgs = await interaction.channel.messages.fetch({ limit: 100 });
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      msgs = msgs.filter(m => m.createdTimestamp > twoWeeksAgo);
      if (filterUser) msgs = msgs.filter(m => m.author.id === filterUser.id);
      const toDelete = [...msgs.values()].slice(0, amount);
      const deleted  = await interaction.channel.bulkDelete(toDelete, true);
      return interaction.editReply({ content: `✅ Deleted **${deleted.size}** message(s)!` });
    } catch (err) {
      return interaction.editReply({ content: `❌ Failed to delete: ${err.message}` });
    }
  },
};

module.exports = { ban, unban, kick, mute, unmute, purge };
