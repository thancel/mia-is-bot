const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getConfig } = require('../../utils/guildConfig');

const warnStore = new Map();

async function sendLog(guild, embed) {
  const logChannelId = getConfig(guild.id).logChannelId;
  if (!logChannelId) return;
  const ch = guild.channels.cache.get(logChannelId);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('⚠️ Manage user warnings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

    // /warn add @user reason
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('➕ Add a warning to a user')
      .addUserOption(opt => opt
        .setName('user')
        .setDescription('User to warn')
        .setRequired(true)
      )
      .addStringOption(opt => opt
        .setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(500)
      )
    )

    // /warn list @user
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('📋 List all warnings of a user')
      .addUserOption(opt => opt
        .setName('user')
        .setDescription('User to check')
        .setRequired(true)
      )
    )

    // /warn remove @user number
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('🗑️ Remove a specific warning by number')
      .addUserOption(opt => opt
        .setName('user')
        .setDescription('User whose warning to remove')
        .setRequired(true)
      )
      .addIntegerOption(opt => opt
        .setName('number')
        .setDescription('Warning number to remove (see /warn list)')
        .setRequired(true)
        .setMinValue(1)
      )
    )

    // /warn clear @user
    .addSubcommand(sub => sub
      .setName('clear')
      .setDescription('🧹 Clear all warnings for a user')
      .addUserOption(opt => opt
        .setName('user')
        .setDescription('User to clear warnings for')
        .setRequired(true)
      )
    ),

  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const target = interaction.options.getMember('user');

    if (!target) {
      return interaction.reply({ content: '❌ User not found in this server!', ephemeral: true });
    }

    const key  = `${interaction.guild.id}-${target.id}`;
    const list = warnStore.get(key) || [];

    // ── add ──
    if (sub === 'add') {
      const reason = interaction.options.getString('reason');
      if (target.user.bot) return interaction.reply({ content: '❌ You cannot warn a bot!', ephemeral: true });
      if (target.id === interaction.user.id) return interaction.reply({ content: '❌ You cannot warn yourself!', ephemeral: true });

      if (!warnStore.has(key)) warnStore.set(key, []);
      warnStore.get(key).push({ reason, mod: interaction.user.tag, modId: interaction.user.id, timestamp: Date.now() });
      const count = warnStore.get(key).length;

      const embed = new EmbedBuilder()
        .setColor(0xfee75c).setTitle('⚠️ Warning Added')
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: '👤 User',        value: `${target} (${target.user.tag})`, inline: false },
          { name: '🛡️ Moderator',   value: `${interaction.user}`,            inline: false },
          { name: '📊 Total Warns', value: `${count}`,                       inline: false },
          { name: '📝 Reason',      value: reason,                           inline: false },
        ).setTimestamp();

      await sendLog(interaction.guild, embed);
      try { await target.user.send(`⚠️ You received a warning in **${interaction.guild.name}**!\n📝 Reason: ${reason}\n📊 Total: ${count}`); } catch {}
      return interaction.reply({ embeds: [embed] });
    }

    // ── list ──
    if (sub === 'list') {
      if (!list.length) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`✅ **${target.displayName}** has no warnings.`)],
          ephemeral: true,
        });
      }
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xfee75c)
          .setTitle(`📋 Warnings: ${target.user.tag}`)
          .setThumbnail(target.user.displayAvatarURL())
          .setDescription(list.map((w, i) => `**#${i + 1}** — ${w.reason}\n🛡️ ${w.mod} • <t:${Math.floor(w.timestamp / 1000)}:R>`).join('\n\n'))
          .setFooter({ text: `Total: ${list.length} warning(s)` })],
        ephemeral: true,
      });
    }

    // ── remove ──
    if (sub === 'remove') {
      const number = interaction.options.getInteger('number');
      if (!list.length) return interaction.reply({ content: `❌ **${target.displayName}** has no warnings!`, ephemeral: true });
      const index = number - 1;
      if (index < 0 || index >= list.length) {
        return interaction.reply({ content: `❌ Warning #${number} does not exist. This user has **${list.length}** warning(s).`, ephemeral: true });
      }
      const removed = list.splice(index, 1)[0];
      warnStore.set(key, list);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x57f287)
          .setDescription(`✅ Removed warning **#${number}** from **${target.displayName}**.\n📝 "${removed.reason}"\nThey now have **${list.length}** warning(s).`)],
        ephemeral: true,
      });
    }

    // ── clear ──
    if (sub === 'clear') {
      const had = list.length;
      warnStore.delete(key);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`✅ Cleared **${had}** warning(s) from **${target.displayName}**.`)],
        ephemeral: true,
      });
    }
  },

  warnStore,
};
