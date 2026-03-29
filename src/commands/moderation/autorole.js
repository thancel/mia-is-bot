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
    .setName('autorole')
    .setDescription('🏷️ Manage auto-role for new members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('🔧 Set a role to be automatically assigned to new members')
      .addRoleOption(opt => opt
        .setName('role')
        .setDescription('The role to assign automatically')
        .setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('🗑️ Remove the auto-role configuration')
    )
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('📋 Show the current auto-role configuration')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── set ──────────────────────────────────────────────────────────────────
    if (sub === 'set') {
      const role = interaction.options.getRole('role');

      // Prevent assigning @everyone
      if (role.id === interaction.guild.id) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ You cannot set `@everyone` as auto-role.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Prevent assigning managed roles (bot roles, booster role, etc.)
      if (role.managed) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ That role is managed by an integration and cannot be assigned as auto-role.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Check if the bot's highest role is above the target role
      const botMember = interaction.guild.members.me;
      if (botMember.roles.highest.position <= role.position) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(
            `❌ I cannot assign **${role.name}** because it is at or above my highest role.\n` +
            `Move my role higher in **Server Settings → Roles**.`
          )],
          flags: MessageFlags.Ephemeral,
        });
      }

      await db.setGuildConfig(interaction.guild.id, { autoRoleId: role.id });

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🏷️ Auto-Role Configured')
        .setDescription(`New members will now automatically receive ${role}.`)
        .addFields(
          { name: '🎯 Role',      value: `${role} (\`${role.id}\`)`, inline: true },
          { name: '🛡️ Set by',   value: `${interaction.user}`,       inline: true },
        )
        .setTimestamp();

      await sendLog(interaction.guild, embed);

      return interaction.reply({ embeds: [embed] });
    }

    // ── remove ───────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const cfg = await db.getGuildConfig(interaction.guild.id);

      if (!cfg.autoRoleId) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ No auto-role is currently configured.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      const oldRoleId = cfg.autoRoleId;
      await db.setGuildConfig(interaction.guild.id, { autoRoleId: null });

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('🗑️ Auto-Role Removed')
        .setDescription(`Auto-role has been disabled. New members will no longer receive <@&${oldRoleId}> automatically.`)
        .addFields(
          { name: '🛡️ Removed by', value: `${interaction.user}`, inline: true },
        )
        .setTimestamp();

      await sendLog(interaction.guild, embed);

      return interaction.reply({ embeds: [embed] });
    }

    // ── status ───────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const cfg = await db.getGuildConfig(interaction.guild.id);

      if (!cfg.autoRoleId) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(randomColor())
            .setTitle('📋 Auto-Role Status')
            .setDescription('⚠️ No auto-role is currently configured.\n\nUse `/autorole set <role>` to set one.')
            .setTimestamp()],
          flags: MessageFlags.Ephemeral,
        });
      }

      const role = interaction.guild.roles.cache.get(cfg.autoRoleId);
      const botMember = interaction.guild.members.me;
      const canAssign = role && botMember.roles.highest.position > role.position && !role.managed;

      const embed = new EmbedBuilder()
        .setColor(randomColor())
        .setTitle('📋 Auto-Role Status')
        .addFields(
          { name: '🎯 Role',       value: role ? `${role} (\`${role.id}\`)` : `\`${cfg.autoRoleId}\` *(deleted)*`, inline: false },
          { name: '✅ Can Assign', value: canAssign ? '`Yes` — working correctly' : '`No` — check role hierarchy or if the role still exists', inline: false },
        )
        .setTimestamp();

      if (role) {
        embed.setColor(role.color || randomColor());
        embed.addFields(
          { name: '👥 Members',  value: `\`${role.members.size}\` member(s) have this role`, inline: true },
          { name: '🎨 Color',   value: role.hexColor,                                        inline: true },
          { name: '📊 Position', value: `\`${role.position}\``,                               inline: true },
        );
      }

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
