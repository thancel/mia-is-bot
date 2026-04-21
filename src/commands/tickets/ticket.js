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
const { fixedEmbed } = require('../../utils/embedUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('🎫 Management commands for the ticket system')
    // ── Setup Subcommand
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('[Admin] Set up the ticket system')
      .addChannelOption(opt => opt
        .setName('logs')
        .setDescription('Channel to log closed tickets (Transcripts)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
      .addRoleOption(opt => opt
        .setName('role')
        .setDescription('Role that manages tickets (Support team)')
        .setRequired(false))
    )
    // ── Panel Subcommand
    .addSubcommand(sub => sub
      .setName('panel')
      .setDescription('[Admin] Resend the ticket opening panel')
    )
    // ── Add User Subcommand
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add a user to the current ticket')
      .addUserOption(opt => opt
        .setName('user')
        .setDescription('User to add')
        .setRequired(true))
    )
    // ── Remove User Subcommand
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a user from the current ticket')
      .addUserOption(opt => opt
        .setName('user')
        .setDescription('User to remove')
        .setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guild, member, channel } = interaction;

    if (sub === 'setup') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({ embeds: fixedEmbed(0xed4245, '❌ **Admin Only:** You lack permission.') });
      }

      const logCh = interaction.options.getChannel('logs');
      const adminRole = interaction.options.getRole('role');

      try {
        const cfg = await db.getGuildConfig(guild.id);
        
        // Cleanup old setup if it exists
        if (cfg.ticketPanelChannelId) {
          const oldPanel = guild.channels.cache.get(cfg.ticketPanelChannelId);
          if (oldPanel) await oldPanel.delete('Ticket system re-setup').catch(() => {});
        }
        
        let categoryCh = guild.channels.cache.get(cfg.ticketCategoryId);
        
        // Build auto channels if possible
        if (!categoryCh) {
          categoryCh = await guild.channels.create({
            name: '🎫 Support Tickets',
            type: ChannelType.GuildCategory,
          });
        }

        const panelCh = await guild.channels.create({
          name: '🎫・ticket',
          type: ChannelType.GuildText,
          parent: categoryCh.id,
          permissionOverwrites: [
             {
               id: guild.roles.everyone.id,
               allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
               deny: [PermissionFlagsBits.SendMessages],
             }
          ]
        });

        await db.setGuildConfig(guild.id, {
          ticketPanelChannelId: panelCh.id,
          ticketCategoryId: categoryCh.id,
          ticketLogChannelId: logCh ? logCh.id : null,
          ticketAdminRoleId: adminRole ? adminRole.id : null,
        });

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🎫 Support Tickets')
          .setDescription('Click the button below to open a private ticket for support.')
          .setFooter({ text: 'Our support team will be with you shortly.' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_create')
            .setEmoji('📩')
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Primary)
        );

        await panelCh.send({ embeds: [embed], components: [row] });
        
        try {
          return await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0x57f287)
              .setTitle('✅ Ticket System Set Up!')
              .addFields(
                { name: '💬 Panel Channel', value: `${panelCh}`, inline: true },
                { name: '📁 Category', value: `${categoryCh}`, inline: true },
                { name: '📜 Log Channel', value: logCh ? `${logCh}` : 'None', inline: true },
                { name: '🛡️ Role', value: adminRole ? `${adminRole}` : 'None', inline: true }
              )
            ]
          });
        } catch (ignored) {
          // The interaction channel might have been deleted (e.g. if the user ran /ticket setup in the old panel channel)
        }
      } catch (err) {
        return interaction.editReply({ embeds: fixedEmbed(0xed4245, `❌ Failed to run setup: ${err.message}`) });
      }
    }

    if (sub === 'panel') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({ embeds: fixedEmbed(0xed4245, '❌ **Admin Only:** You lack permission.') });
      }

      const cfg = await db.getGuildConfig(guild.id);
      if (!cfg.ticketPanelChannelId) {
        return interaction.editReply({ embeds: fixedEmbed(0xed4245, '❌ Ticket system has not been set up. Use `/ticket setup` first.') });
      }

      const panelCh = guild.channels.cache.get(cfg.ticketPanelChannelId);
      if (!panelCh) {
        return interaction.editReply({ embeds: fixedEmbed(0xed4245, '❌ The configured panel channel no longer exists. Please run `/ticket setup` again.') });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎫 Support Tickets')
        .setDescription('Click the button below to open a private ticket for support.')
        .setFooter({ text: 'Our support team will be with you shortly.' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_create')
          .setEmoji('📩')
          .setLabel('Create Ticket')
          .setStyle(ButtonStyle.Primary)
      );

      try {
        await panelCh.send({ embeds: [embed], components: [row] });
        return interaction.editReply({ embeds: fixedEmbed(0x57f287, '✅ Panel resent successfully!') });
      } catch (err) {
        return interaction.editReply({ embeds: fixedEmbed(0xed4245, `❌ Failed to resend panel: ${err.message}`) });
      }
    }

    // Common check for inside a ticket
    if (['add', 'remove'].includes(sub)) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Identify if this is a ticket channel (very basic name matching + check if category matches config)
      const cfg = await db.getGuildConfig(guild.id);
      
      const isTicket = channel.name.startsWith('ticket-') && channel.parentId === cfg.ticketCategoryId;
      
      if (!isTicket) {
        return interaction.editReply({ embeds: fixedEmbed(0xed4245, '❌ This command can only be used inside a ticket channel.') });
      }

      const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) ||
        (cfg.ticketAdminRoleId && member.roles.cache.has(cfg.ticketAdminRoleId));
      
      const channelTopic = channel.topic || '';
      const isOwner = channelTopic.includes(`Ticket Owner: ${member.id}`);

      if (!isAdmin && !isOwner) {
         return interaction.editReply({ embeds: fixedEmbed(0xed4245, '❌ You do not have permission to manage this ticket.') });
      }

      if (sub === 'add') {
        const targetUser = interaction.options.getUser('user');
        try {
          await channel.permissionOverwrites.edit(targetUser, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true,
          });
          channel.send({ embeds: fixedEmbed(0x57f287, `✅ ${targetUser} has been added to the ticket by ${member}.`) });
          return interaction.editReply({ embeds: fixedEmbed(0x57f287, `User added.`) });
        } catch (err) {
           return interaction.editReply({ embeds: fixedEmbed(0xed4245, `❌ Failed to add user: ${err.message}`) });
        }
      }

      if (sub === 'remove') {
        const targetUser = interaction.options.getUser('user');
        if (channelTopic.includes(`Ticket Owner: ${targetUser.id}`)) {
          return interaction.editReply({ embeds: fixedEmbed(0xed4245, `❌ You cannot remove the ticket owner.`) });
        }
        try {
          await channel.permissionOverwrites.delete(targetUser);
          channel.send({ embeds: fixedEmbed(0xffa500, `🗑️ ${targetUser} has been removed from the ticket by ${member}.`) });
          return interaction.editReply({ embeds: fixedEmbed(0x57f287, `User removed.`) });
        } catch (err) {
           return interaction.editReply({ embeds: fixedEmbed(0xed4245, `❌ Failed to remove user: ${err.message}`) });
        }
      }
    }
  },
};
