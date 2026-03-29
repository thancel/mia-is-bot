const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const db = require('../../db');
const { randomColor, fixedEmbed } = require('../../utils/embedUtils');

async function sendLog(guild, embed) {
  const cfg = await db.getGuildConfig(guild.id);
  if (!cfg.logChannelId) return;
  const ch = guild.channels.cache.get(cfg.logChannelId);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

function buildControlPanel(maxBitrate = 96) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tv_lock').setLabel('Lock').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('tv_unlock').setLabel('Unlock').setEmoji('🔓').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('tv_rename').setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tv_limit').setLabel('Limit').setEmoji('👥').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tv_bitrate').setLabel('Bitrate').setEmoji('📡').setStyle(ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tv_info').setLabel('Info').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}

function buildPanelEmbed(client, maxBitrate = 96) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: 'Voice Control Panel', iconURL: client.user.displayAvatarURL() })
    .setDescription(
      'Manage your temporary voice channel using the buttons below.\n\n' +
      '🔒 **Lock / Unlock** • *Control access to your room*\n' +
      '✏️ **Rename** • *Change your room name*\n' +
      '👥 **Limit** • *Set max user count (0–99)*\n' +
      `📡 **Bitrate** • *Set audio quality (8–${maxBitrate}kbps)*\n` +
      'ℹ️ **Info** • *View channel details (only visible to you)*\n\n' +
      '🦵 **Kick a user:** `/tempvoice kick <user>`'
    )
    .setFooter({ text: 'Only the channel owner can use these controls.' });
}

/**
 * The full set of permissions the panel channel should enforce.
 * Members can only view + read history + click buttons.
 */
function panelPermissions(guildId) {
  return [
    {
      id: guildId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.UseExternalEmojis,
      ],
      deny: [
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.CreatePrivateThreads,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.UseApplicationCommands,
      ],
    },
  ];
}

/**
 * Refresh the panel in a channel:
 * - Re-enforce permissions (in case they drifted)
 * - Delete all old bot panel messages
 * - Send a fresh panel
 */
async function refreshPanel(panelChannel, client) {
  // Re-apply strict permissions every time
  try {
    await panelChannel.permissionOverwrites.set(panelPermissions(panelChannel.guild.id));
  } catch (_) {}

  try {
    const messages = await panelChannel.messages.fetch({ limit: 20 });
    const botPanels = messages.filter(
      m => m.author.id === client.user.id && m.components.length > 0
    );
    for (const [, msg] of botPanels) {
      await msg.delete().catch(() => {});
    }
  } catch (_) {}

  const maxBitrate = [96, 128, 256, 384][panelChannel.guild.premiumTier] || 96;
  await panelChannel.send({
    embeds: [buildPanelEmbed(client, maxBitrate)],
    components: buildControlPanel(maxBitrate),
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempvoice')
    .setDescription('🎙️ Temp Voice Channel management')
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('[Admin] Create the trigger channel and control panel')
      .addChannelOption(opt => opt
        .setName('category')
        .setDescription('Category where channels will be created')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
      )
    )
    .addSubcommand(sub => sub
      .setName('kick')
      .setDescription('🦵 Kick a user from your temporary channel')
      .addUserOption(opt => opt
        .setName('user')
        .setDescription('The user to kick')
        .setRequired(true)
      )
    )
    .addSubcommand(sub => sub
      .setName('panel')
      .setDescription('🎛️ [Admin] Refresh and resend the control panel to this channel')
    ),

  buildControlPanel,
  buildPanelEmbed,
  refreshPanel,

  async execute(interaction, client) {
    const sub        = interaction.options.getSubcommand();
    const member     = interaction.member;
    const guild      = interaction.guild;
    const maxBitrate = [96, 128, 256, 384][guild.premiumTier] || 96;

    // ── SETUP ──────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          embeds: fixedEmbed(0xED4245, '❌ **Admin Only:** You do not have the required permissions.'),
          flags: MessageFlags.Ephemeral,
        });
      }
      // Check if temp voice is already set up in this server
      const existingCfg = await db.getGuildConfig(guild.id);
      if (existingCfg.voicePanelChannelId) {
        const existingPanel = guild.channels.cache.get(existingCfg.voicePanelChannelId);
        if (existingPanel) {
          return interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xed4245)
              .setDescription(
                `❌ Temp Voice is already set up in this server!\n\n` +
                `📺 Panel channel: ${existingPanel}\n\n` +
                `To re-setup, delete the existing **➕ Create Voice** and **🎙️・voice-panel** channels first, then run this command again.`
              )],
            flags: MessageFlags.Ephemeral,
          });
        }
        // Panel channel no longer exists — clear stale config and allow re-setup
        await db.setGuildConfig(guild.id, { voicePanelChannelId: null });
      }

      const category = interaction.options.getChannel('category');
      try {
        const triggerCh = await guild.channels.create({
          name: '➕ Create Voice',
          type: ChannelType.GuildVoice,
          parent: category.id,
        });

        const panelCh = await guild.channels.create({
          name: '🎙️・voice-panel',
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: panelPermissions(guild.id),
        });

        // Save panel channel in guild config for restart recovery
        await db.setGuildConfig(guild.id, { voicePanelChannelId: panelCh.id });

        await panelCh.send({
          embeds: [buildPanelEmbed(client, maxBitrate)],
          components: buildControlPanel(maxBitrate),
        });

        await sendLog(guild, new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🎙️ Temp Voice Setup')
          .addFields(
            { name: '🛡️ Admin',           value: `${interaction.user}`, inline: false },
            { name: '🔊 Trigger Channel', value: `${triggerCh}`,        inline: true  },
            { name: '💬 Panel Channel',   value: `${panelCh}`,          inline: true  },
            { name: '📁 Category',        value: category.name,         inline: false },
          )
          .setTimestamp()
        );

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(randomColor())
            .setTitle('✅ Setup Complete!')
            .addFields(
              { name: '🔊 Trigger Channel', value: `${triggerCh}`, inline: true },
              { name: '💬 Panel Channel',   value: `${panelCh}`,   inline: true },
            )
            .setFooter({ text: 'Users join the trigger channel to create their own room.' })],
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        return interaction.reply({
          embeds: fixedEmbed(0xED4245, `❌ Setup failed: ${err.message}`),
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // ── KICK ───────────────────────────────────────────────────────────────
    if (sub === 'kick') {
      const voiceChannel = member.voice?.channel;
      if (!voiceChannel) {
        return interaction.reply({
          embeds: fixedEmbed(0xED4245, '❌ You must be in a voice channel!'),
          flags: MessageFlags.Ephemeral,
        });
      }

      const storedOwnerId = client.tempVoiceChannels.get(voiceChannel.id);
      if (String(storedOwnerId) !== String(member.id)) {
        return interaction.reply({
          embeds: fixedEmbed(0xED4245, '❌ You are not the owner of this channel!'),
          flags: MessageFlags.Ephemeral,
        });
      }

      const target = interaction.options.getMember('user');
      if (!target || target.id === member.id || target.voice?.channelId !== voiceChannel.id) {
        return interaction.reply({
          embeds: fixedEmbed(0xED4245, '❌ Invalid target — that user is not in your channel.'),
          flags: MessageFlags.Ephemeral,
        });
      }

      await target.voice.disconnect();

      await sendLog(guild, new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle('🦵 Voice Kick')
        .addFields(
          { name: '👑 Channel Owner', value: `${member} (${member.user.tag})`,   inline: false },
          { name: '👤 Kicked User',   value: `${target} (${target.user.tag})`,   inline: false },
          { name: '🎙️ Channel',       value: voiceChannel.name,                  inline: false },
        )
        .setTimestamp()
      );

      return interaction.reply({
        embeds: fixedEmbed(0x57F287, `✅ **${target.displayName}** has been kicked from the channel.`),
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── PANEL ──────────────────────────────────────────────────────────────
    if (sub === 'panel') {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          embeds: fixedEmbed(0xED4245, '❌ **Admin Only.**'),
          flags: MessageFlags.Ephemeral,
        });
      }

      // Delete old panel messages, then send fresh panel — no public reply
      await refreshPanel(interaction.channel, client);

      await sendLog(guild, new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🎛️ Voice Panel Refreshed')
        .addFields(
          { name: '🛡️ Admin',   value: `${interaction.user}`,        inline: false },
          { name: '💬 Channel', value: `${interaction.channel}`,     inline: false },
        )
        .setTimestamp()
      );

      await interaction.reply({ content: '✅', flags: MessageFlags.Ephemeral });
      await interaction.deleteReply().catch(() => {});
    }
  },
};
