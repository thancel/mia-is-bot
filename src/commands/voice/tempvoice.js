const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  AttachmentBuilder,
} = require('discord.js');
const path = require('path');
const db = require('../../db');
const { randomColor, fixedEmbed } = require('../../utils/embedUtils');

async function sendLog(guild, embed) {
  const cfg = await db.getGuildConfig(guild.id);
  if (!cfg.logChannelId) return;
  const ch = guild.channels.cache.get(cfg.logChannelId);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

function buildControlPanel() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tv_rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_limit').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_privacy').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_waitingroom').setEmoji('⏳').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_trust').setEmoji('👤').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tv_block').setEmoji('🚫').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_invite').setEmoji('📩').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_kick').setEmoji('🦶').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_claim').setEmoji('👑').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tv_transfer').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tv_delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
  );
  return [row1, row2, row3];
}

function buildPanelEmbed(client) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Voice Interface')
    .setDescription(
      'This **interface** can be used to manage temporary voice channels.\n' +
      'All controls are accessible via the buttons below.'
    )
    .setImage('attachment://voice-panel.png')
    .setFooter({ text: 'Press the buttons below to use the interface' });
}

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

async function refreshPanel(panelChannel, client) {
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

  const attachment = new AttachmentBuilder(path.join(__dirname, '../../assets/voice-panel.png'), { name: 'voice-panel.png' });

  await panelChannel.send({
    embeds: [buildPanelEmbed(client)],
    components: buildControlPanel(),
    files: [attachment],
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voice')
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

    if (sub === 'setup') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({
          embeds: fixedEmbed(0xED4245, '❌ **Admin Only:** You do not have the required permissions.'),
        });
      }

      // Check for existing setup - block if both channels exist
      const foundVoice = guild.channels.cache.find(c => c.name === '➕ Create Voice' && c.type === ChannelType.GuildVoice);
      const foundPanel = guild.channels.cache.find(c => c.name === '🎙️・interface' && c.type === ChannelType.GuildText);

      if (foundVoice && foundPanel) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ Setup Already Active')
            .setDescription(
              `Temp Voice is already fully set up.\n\n` +
              `🔊 **Trigger:** ${foundVoice}\n` +
              `💬 **Panel:** ${foundPanel}\n\n` +
              `If you want to re-setup, delete one of these channels first.`
            )
          ],
        });
      }

      // Cleanup: Search and delete if incomplete (only one exists or name matches)
      const channelsToDelete = guild.channels.cache.filter(c => 
        c.name === '➕ Create Voice' || c.name === '🎙️・interface'
      );
      
      for (const [, ch] of channelsToDelete) {
        try {
          await ch.delete('Cleanup before new temp voice setup');
        } catch (err) {
          console.warn(`[Voice Setup] Failed to delete old channel ${ch.name}:`, err.message);
        }
      }

      await db.setGuildConfig(guild.id, { voicePanelChannelId: null });

      const category = interaction.options.getChannel('category');
      try {
        const triggerCh = await guild.channels.create({
          name: '➕ Create Voice',
          type: ChannelType.GuildVoice,
          parent: category.id,
        });

        const panelCh = await guild.channels.create({
          name: '🎙️・interface',
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: panelPermissions(guild.id),
        });

        await db.setGuildConfig(guild.id, { voicePanelChannelId: panelCh.id });

        const attachment = new AttachmentBuilder(path.join(__dirname, '../../assets/voice-panel.png'), { name: 'voice-panel.png' });

        await panelCh.send({
          embeds: [buildPanelEmbed(client)],
          components: buildControlPanel(),
          files: [attachment],
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

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Setup Complete!')
            .addFields(
              { name: '🔊 Trigger Channel', value: `${triggerCh}`, inline: true },
              { name: '💬 Panel Channel',   value: `${panelCh}`,   inline: true },
            )
            .setFooter({ text: 'Users join the trigger channel to create their own room.' })],
        });
      } catch (err) {
        return interaction.editReply({
          embeds: fixedEmbed(0xED4245, `❌ Setup failed: ${err.message}`),
        });
      }
    }

    if (sub === 'panel') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({
          embeds: fixedEmbed(0xED4245, '❌ **Admin Only.**'),
        });
      }

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

      await interaction.editReply({ content: '✅ Panel successfully refreshed!' });
    }
  },
};
