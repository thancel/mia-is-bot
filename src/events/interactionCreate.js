const {
  EmbedBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
  UserSelectMenuBuilder,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { randomColor, fixedEmbed } = require('../utils/embedUtils');
const db = require('../db');

async function sendLog(guild, embed) {
  const cfg = await db.getGuildConfig(guild.id);
  if (!cfg.logChannelId) return;
  const ch = guild.channels.cache.get(cfg.logChannelId);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

async function handleTicketClose(interaction, client, cfg) {
  const { channel, user, guild } = interaction;
  const closeReason = interaction.reason || 'No reason provided';
  
  // Send a closing message first
  await channel.send({ embeds: fixedEmbed(0xffa500, '⏳ Ticket is closing. Saving transcript...') });
  
  // Try to generate simple text transcript
  try {
    let transcriptText = `Transcript for ${channel.name}\nClosed by: ${user.tag}\nReason: ${closeReason}\n\n`;
    const messages = await channel.messages.fetch({ limit: 100 });
    const sortedMessages = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    
    for (const m of sortedMessages) {
      if (m.author.bot) continue;
      const time = new Date(m.createdTimestamp).toLocaleString();
      transcriptText += `[${time}] ${m.author.tag}: ${m.content}\n`;
      if (m.attachments.size > 0) {
        transcriptText += `  [Attachments: ${m.attachments.map(a => a.url).join(', ')}]\n`;
      }
    }
    
    // Log to log channel
    if (cfg.ticketLogChannelId) {
      const logChannel = guild.channels.cache.get(cfg.ticketLogChannelId);
      if (logChannel) {
        const transcriptBuffer = Buffer.from(transcriptText, 'utf-8');
        const { AttachmentBuilder } = require('discord.js');
        const attachment = new AttachmentBuilder(transcriptBuffer, { name: `${channel.name}-transcript.txt` });
        
        const logEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🎫 Ticket Closed')
          .addFields(
             { name: 'Channel', value: channel.name, inline: true },
             { name: 'Closed By', value: `${user} (${user.tag})`, inline: true },
             { name: 'Reason', value: closeReason, inline: false }
          )
          .setTimestamp();
          
        await logChannel.send({ embeds: [logEmbed], files: [attachment] }).catch(() => {});
      }
    }
  } catch (err) {
    console.error(`Failed to generate transcript: ${err.message}`);
  }

  // Delete channel
  await channel.delete('Ticket closed').catch(() => {});
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ── Slash Commands ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`❌ Error in /${interaction.commandName}:`, err);
        const msg = {
          embeds: fixedEmbed(0xed4245, '❌ An error occurred while running this command!'),
          flags: MessageFlags.Ephemeral,
        };
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
        else await interaction.reply(msg);
      }
      return;
    }

    // ── Autocomplete ────────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command?.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error(`❌ Autocomplete error in /${interaction.commandName}:`, err);
      }
      return;
    }

    // ── Button Interactions ─────────────────────────────────────────────────
    if (interaction.isButton()) {
      const { customId, member, guild } = interaction;

      // ── Giveaway Entry Button ────────────────────────────────────────────
      if (customId.startsWith('gw_enter_')) {
        const giveawayId = customId.slice(9); // gw_enter_<id>
        
        await interaction.deferUpdate();

        // RE-FETCH FRESH CONFIG to prevent race conditions during heavy clicks
        const cfg = await db.getGuildConfig(guild.id);
        const giveaways = cfg.giveaways || {};
        const gw = giveaways[giveawayId];

        if (!gw || gw.ended) {
          return interaction.followUp({
            embeds: fixedEmbed(0xed4245, '❌ This giveaway has ended.'),
            flags: MessageFlags.Ephemeral,
          });
        }

        const userId = member.id;
        const idx = gw.entries.indexOf(userId);

        if (idx === -1) {
          gw.entries.push(userId);
        } else {
          gw.entries.splice(idx, 1);
        }

        // Save back to DB
        await db.setGuildConfig(guild.id, { giveaways });

        // Update the message
        try {
          const { buildGiveawayButton, buildGiveawayEmbed } = require('../commands/moderation/giveaway');
          const row = buildGiveawayButton(gw);
          const embed = buildGiveawayEmbed(gw);
          await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (err) {
          console.error(`❌ Failed to update giveaway message: ${err.message}`);
        }

        return;
      }

      // ── Reaction Role Buttons ──────────────────────────────────────────
      if (customId.startsWith('rr_')) {
        const roleId = customId.slice(3); // rr_<roleId>
        const role = guild.roles.cache.get(roleId);

        if (!role) {
          return interaction.reply({
            embeds: fixedEmbed(0xed4245, '❌ This role no longer exists. Please contact an admin.'),
            flags: MessageFlags.Ephemeral,
          });
        }

        try {
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(role, 'Reaction role toggle');
            return interaction.reply({
              embeds: [new EmbedBuilder()
                .setColor(0xed4245)
                .setDescription(`❌ Removed role ${role} from you.`)],
              flags: MessageFlags.Ephemeral,
            });
          } else {
            await member.roles.add(role, 'Reaction role toggle');
            return interaction.reply({
              embeds: [new EmbedBuilder()
                .setColor(0x57f287)
                .setDescription(`✅ You now have the ${role} role!`)],
              flags: MessageFlags.Ephemeral,
            });
          }
        } catch (err) {
          console.error('❌ Reaction role error:', err.message);
          return interaction.reply({
            embeds: fixedEmbed(0xed4245, '❌ Failed to update your role. The bot may lack permissions.'),
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      // ── Ticket Buttons ──────────────────────────────────────────────────
      if (customId === 'ticket_create') {
        const cfg = await db.getGuildConfig(guild.id);
        if (!cfg.ticketCategoryId) {
           return interaction.reply({ embeds: fixedEmbed(0xed4245, '❌ Ticket system incomplete. Missing category in config.'), flags: MessageFlags.Ephemeral });
        }

        const modal = new ModalBuilder().setCustomId('ticket_modal_create').setTitle('🎫 Open Ticket');
        const input = new TextInputBuilder()
          .setCustomId('ticket_reason')
          .setLabel('Reason')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Why are you opening this ticket?')
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
      
      if (customId === 'ticket_accept') {
        const cfg = await db.getGuildConfig(guild.id);
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) ||
             (cfg.ticketAdminRoleId && member.roles.cache.has(cfg.ticketAdminRoleId));
        if (!isAdmin) return interaction.reply({ embeds: fixedEmbed(0xed4245, '❌ Admin only.'), flags: MessageFlags.Ephemeral });
        
        const ownerMatch = interaction.channel.topic?.match(/Ticket Owner: (\d+)/);
        if (ownerMatch) {
            await interaction.channel.permissionOverwrites.edit(ownerMatch[1], { SendMessages: true });
        }
        
        await interaction.message.edit({ components: [
            new ActionRowBuilder().addComponents(
               new ButtonBuilder().setCustomId('ticket_close_btn').setEmoji('🔒').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
            )
        ] });
        
        return interaction.reply({
            content: ownerMatch ? `<@${ownerMatch[1]}>` : null,
            embeds: fixedEmbed(0x57f287, '✅ **Ticket Accepted!** Staff will assist you shortly. You may now send messages.')
        });
      }
      
      if (customId === 'ticket_reject') {
        const cfg = await db.getGuildConfig(guild.id);
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) ||
             (cfg.ticketAdminRoleId && member.roles.cache.has(cfg.ticketAdminRoleId));
        if (!isAdmin) return interaction.reply({ embeds: fixedEmbed(0xed4245, '❌ Admin only.'), flags: MessageFlags.Ephemeral });
        
        interaction.reason = 'Rejected by ' + interaction.user.tag;
        await interaction.reply({ embeds: fixedEmbed(0xed4245, '❌ Rejecting and closing ticket...'), flags: MessageFlags.Ephemeral });
        await handleTicketClose(interaction, client, cfg);
        return;
      }

      if (customId === 'ticket_close_btn') {
        const cfg = await db.getGuildConfig(guild.id);
        
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) ||
             (cfg.ticketAdminRoleId && member.roles.cache.has(cfg.ticketAdminRoleId));
             
        const isOwner = interaction.channel.topic?.includes(`Ticket Owner: ${member.id}`);
        
        if (!isAdmin && !isOwner) {
           return interaction.reply({ embeds: fixedEmbed(0xed4245, '❌ You do not have permission to close this ticket.'), flags: MessageFlags.Ephemeral });
        }
        
        interaction.reason = 'Closed via button by ' + interaction.user.tag;
        
        // Let them know we're processing
        await interaction.reply({ embeds: fixedEmbed(0x57f287, '🔒 Closing ticket...'), flags: MessageFlags.Ephemeral });
        
        await handleTicketClose(interaction, client, cfg);
        return;
      }

      // ── Temp Voice Buttons ─────────────────────────────────────────────
      const tvButtons = [
        'tv_rename', 'tv_limit', 'tv_privacy', 'tv_waitingroom',
        'tv_trust', 'tv_untrust', 'tv_invite', 'tv_kick',
        'tv_block', 'tv_unblock', 'tv_claim', 'tv_transfer', 'tv_delete',
      ];
      if (!tvButtons.includes(customId)) return;

      const voiceChannel = member.voice?.channel;

      // Claim doesn't require being the owner
      if (customId === 'tv_claim') {
        if (!voiceChannel) {
          return interaction.reply({
            embeds: fixedEmbed(0xed4245, '❌ You must be in a voice channel first!'),
            flags: MessageFlags.Ephemeral,
          });
        }

        if (!client.tempVoiceChannels.has(voiceChannel.id)) {
          return interaction.reply({
            embeds: fixedEmbed(0xed4245, '❌ This is not a temporary voice channel!'),
            flags: MessageFlags.Ephemeral,
          });
        }

        const currentOwnerId = client.tempVoiceChannels.get(voiceChannel.id);
        const currentOwner = voiceChannel.members.get(currentOwnerId);

        if (currentOwner) {
          return interaction.reply({
            embeds: fixedEmbed(0xed4245, '❌ The current owner is still in the channel! You can only claim when the owner has left.'),
            flags: MessageFlags.Ephemeral,
          });
        }

        // Transfer ownership
        const newOwnerId = String(member.id);
        await db.updateTempVoiceOwner(voiceChannel.id, newOwnerId);
        client.tempVoiceChannels.set(voiceChannel.id, newOwnerId);

        try {
          // Remove old owner perms, add new owner perms
          await voiceChannel.permissionOverwrites.edit(member.id, {
            ManageChannels: true,
            MoveMembers: true,
            MuteMembers: true,
            Connect: true,
            Speak: true,
            Stream: true,
          });
        } catch (_) {}

        await sendLog(guild, new EmbedBuilder()
          .setColor(0xffa500)
          .setTitle('👑 Voice Channel Claimed')
          .addFields(
            { name: '👤 New Owner', value: `${member} (${member.user.tag})`, inline: false },
            { name: '🔊 Channel',   value: voiceChannel.name,                inline: false },
          )
          .setTimestamp()
        );

        return interaction.reply({
          embeds: fixedEmbed(0x57f287, '👑 You have claimed ownership of this channel!'),
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!voiceChannel) {
        return interaction.reply({
          embeds: fixedEmbed(0xed4245, '❌ You must be in a voice channel first!'),
          flags: MessageFlags.Ephemeral,
        });
      }

      const storedOwnerId = client.tempVoiceChannels.get(voiceChannel.id);
      const isOwner = storedOwnerId !== undefined && String(storedOwnerId) === String(member.id);

      if (!isOwner) {
        return interaction.reply({
          embeds: fixedEmbed(0xed4245, '❌ You are not the owner of this temporary channel!'),
          flags: MessageFlags.Ephemeral,
        });
      }

      // Convert certain buttons into User Select Menu ephemeral messages
      const selectMenuActions = ['trust', 'invite', 'kick', 'block', 'transfer'];
      const actionName = customId.replace('tv_', '');

      if (selectMenuActions.includes(actionName)) {
        const actionLabels = {
          trust: '👤 Select a user to Trust / Untrust',
          invite: '📩 Select a user to Invite',
          kick: '🦶 Select a user to Kick',
          block: '🚫 Select a user to Block / Unblock',
          transfer: '🔄 Select user for Ownership Transfer',
        };

        const row = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(`tv_select_${actionName}`)
            .setPlaceholder(actionLabels[actionName])
            .setMinValues(1)
            .setMaxValues(1)
        );

        return interaction.reply({
          content: `**${actionLabels[actionName]}**`,
          components: [row],
          flags: MessageFlags.Ephemeral,
        });
      }

      switch (customId) {
        // ── RENAME ────────────────────────────────────────────────────────
        case 'tv_rename': {
          const modal = new ModalBuilder().setCustomId('tv_modal_rename').setTitle('✏️ Rename Channel');
          const input = new TextInputBuilder()
            .setCustomId('input_rename').setLabel('New Channel Name').setStyle(TextInputStyle.Short)
            .setPlaceholder(voiceChannel.name).setMinLength(1).setMaxLength(50).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }

        // ── LIMIT ─────────────────────────────────────────────────────────
        case 'tv_limit': {
          const modal = new ModalBuilder().setCustomId('tv_modal_limit').setTitle('🔒 Set User Limit');
          const input = new TextInputBuilder()
            .setCustomId('input_limit').setLabel('Limit (0 = unlimited, max 99)')
            .setStyle(TextInputStyle.Short).setPlaceholder('0')
            .setValue(`${voiceChannel.userLimit}`).setMinLength(1).setMaxLength(2).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }

        // ── PRIVACY (Lock / Unlock toggle) ────────────────────────────────
        case 'tv_privacy': {
          const isLocked = voiceChannel.permissionOverwrites.cache.get(guild.id)?.deny.has(PermissionFlagsBits.Connect);
          if (isLocked) {
            await voiceChannel.permissionOverwrites.edit(guild.id, { [PermissionFlagsBits.Connect]: null });
            return interaction.reply({
              embeds: fixedEmbed(0x57f287, '🔓 **Channel unlocked!** Everyone can join now.'),
              flags: MessageFlags.Ephemeral,
            });
          } else {
            // Un-trust all members that are not in the channel currently, to actually enforce lock
            await voiceChannel.permissionOverwrites.edit(guild.id, { [PermissionFlagsBits.Connect]: false });
            return interaction.reply({
              embeds: fixedEmbed(0xed4245, '🔒 **Channel locked!** No new users can join.'),
              flags: MessageFlags.Ephemeral,
            });
          }
        }

        // ── WAITING ROOM ──────────────────────────────────────────────────
        case 'tv_waitingroom': {
          // Toggle: deny Speak for @everyone in the voice channel
          const speakDenied = voiceChannel.permissionOverwrites.cache.get(guild.id)?.deny.has(PermissionFlagsBits.Speak);
          if (speakDenied) {
            await voiceChannel.permissionOverwrites.edit(guild.id, { [PermissionFlagsBits.Speak]: null });
            return interaction.reply({
              embeds: fixedEmbed(0x57f287, '⏳ **Waiting room disabled.** Users can speak when they join.'),
              flags: MessageFlags.Ephemeral,
            });
          } else {
            await voiceChannel.permissionOverwrites.edit(guild.id, { [PermissionFlagsBits.Speak]: false });
            return interaction.reply({
              embeds: fixedEmbed(0xffa500, '⏳ **Waiting room enabled!** New users will be muted until you unmute them.'),
              flags: MessageFlags.Ephemeral,
            });
          }
        }

        // ── DELETE ───────────────────────────────────────────────────────
        case 'tv_delete': {
          try {
            await db.deleteTempVoice(voiceChannel.id);
            client.tempVoiceChannels.delete(voiceChannel.id);

            await voiceChannel.delete('Deleted by owner');

            await sendLog(guild, new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('🗑️ Temp Voice Deleted by Owner')
              .addFields(
                { name: '👤 Owner',   value: `${member} (${member.user.tag})`, inline: false },
                { name: '🔊 Channel', value: voiceChannel.name,                inline: false },
              )
              .setTimestamp()
            );
          } catch (err) {
            return interaction.reply({
              embeds: fixedEmbed(0xed4245, `❌ Failed to delete channel: ${err.message}`),
              flags: MessageFlags.Ephemeral,
            });
          }
          // Channel is deleted, interaction may fail — ignore
          return interaction.reply({
            embeds: fixedEmbed(0x57f287, '🗑️ Your voice channel has been deleted.'),
            flags: MessageFlags.Ephemeral,
          }).catch(() => {});
        }
      }
    }

    // ── User Select Menu Interactions ───────────────────────────────────────
    if (interaction.isUserSelectMenu()) {
      const { customId, member, guild } = interaction;
      if (!customId.startsWith('tv_select_')) return;

      await interaction.deferUpdate(); // Acknowledge and keep the menu message or clean it up
      
      const voiceChannel = member.voice?.channel;
      if (!voiceChannel || String(client.tempVoiceChannels.get(voiceChannel.id)) !== String(member.id)) {
        return interaction.followUp({
          embeds: fixedEmbed(0xed4245, '❌ Action failed: You must be the owner and inside the channel.'),
          flags: MessageFlags.Ephemeral,
        });
      }

      const action = customId.replace('tv_select_', '');
      const targetUserId = interaction.values[0];
      const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

      if (!targetMember) {
        return interaction.followUp({
          embeds: fixedEmbed(0xed4245, '❌ User not found.'),
          flags: MessageFlags.Ephemeral,
        });
      }

      if (action === 'trust') {
        const hasTrust = voiceChannel.permissionOverwrites.cache.get(targetUserId)?.allow.has(PermissionFlagsBits.Connect);
        
        if (hasTrust) {
          try {
            await voiceChannel.permissionOverwrites.delete(targetUserId).catch(() => {});
            return interaction.editReply({
              content: null,
              components: [],
              embeds: fixedEmbed(0x57f287, `✅ **${targetMember.displayName}** has been **untrusted**.`),
            });
          } catch (err) {
            return interaction.followUp({ embeds: fixedEmbed(0xed4245, `❌ Failed to untrust user: ${err.message}`), flags: MessageFlags.Ephemeral });
          }
        } else {
          try {
            await voiceChannel.permissionOverwrites.edit(targetUserId, {
              Connect: true,
              Speak: true,
              Stream: true,
            });
            return interaction.editReply({
              content: null,
              components: [],
              embeds: fixedEmbed(0x57f287, `✅ **${targetMember.displayName}** is now **trusted** and can always join your channel.`),
            });
          } catch (err) {
            return interaction.followUp({ embeds: fixedEmbed(0xed4245, `❌ Failed to trust user: ${err.message}`), flags: MessageFlags.Ephemeral });
          }
        }
      }

      if (action === 'invite') {
        try {
          await voiceChannel.permissionOverwrites.edit(targetUserId, { Connect: true });
          try {
            await targetMember.send({
              embeds: [new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle('📩 Voice Channel Invitation')
                .setDescription(`**${member.displayName}** has invited you to join their voice channel **${voiceChannel.name}** in **${guild.name}**!`)
                .setTimestamp()
              ],
            });
          } catch (_) {}
          
          return interaction.editReply({
            content: null,
            components: [],
            embeds: fixedEmbed(0x57f287, `✅ **${targetMember.displayName}** has been **invited** to your channel!`),
          });
        } catch (err) {
          return interaction.followUp({ embeds: fixedEmbed(0xed4245, `❌ Failed to invite user: ${err.message}`), flags: MessageFlags.Ephemeral });
        }
      }

      if (action === 'kick') {
        try {
          const targetInVC = voiceChannel.members.get(targetUserId);
          if (!targetInVC) {
            return interaction.editReply({
              content: null,
              components: [],
              embeds: fixedEmbed(0xed4245, '❌ That user is not in your voice channel.'),
            });
          }
          if (targetUserId === member.id) {
            return interaction.editReply({
              content: null,
              components: [],
              embeds: fixedEmbed(0xed4245, '❌ You cannot kick yourself!'),
            });
          }
          await targetInVC.voice.disconnect();

          await sendLog(guild, new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle('🦶 Voice Kick')
            .addFields(
              { name: '👑 Channel Owner', value: `${member} (${member.user.tag})`,             inline: false },
              { name: '👤 Kicked User',   value: `${targetMember} (${targetMember.user.tag})`, inline: false },
              { name: '🎙️ Channel',       value: voiceChannel.name,                            inline: false },
            )
            .setTimestamp()
          );

          return interaction.editReply({
            content: null,
            components: [],
            embeds: fixedEmbed(0x57f287, `✅ **${targetMember.displayName}** has been kicked from the channel.`),
          });
        } catch (err) {
          return interaction.followUp({ embeds: fixedEmbed(0xed4245, `❌ Failed to kick user: ${err.message}`), flags: MessageFlags.Ephemeral });
        }
      }

      if (action === 'block') {
        const isBlocked = voiceChannel.permissionOverwrites.cache.get(targetUserId)?.deny.has(PermissionFlagsBits.Connect);
        
        if (isBlocked) {
          try {
            await voiceChannel.permissionOverwrites.delete(targetUserId).catch(() => {});
            return interaction.editReply({
              content: null,
              components: [],
              embeds: fixedEmbed(0x57f287, `✅ **${targetMember.displayName}** has been **unblocked**.`),
            });
          } catch (err) {
            return interaction.followUp({ embeds: fixedEmbed(0xed4245, `❌ Failed to unblock user: ${err.message}`), flags: MessageFlags.Ephemeral });
          }
        } else {
          try {
            await voiceChannel.permissionOverwrites.edit(targetUserId, { Connect: false });
            if (targetMember.voice?.channelId === voiceChannel.id) {
              await targetMember.voice.disconnect().catch(() => {});
            }
            return interaction.editReply({
              content: null,
              components: [],
              embeds: fixedEmbed(0x57f287, `✅ **${targetMember.displayName}** has been **blocked** from your channel.`),
            });
          } catch (err) {
            return interaction.followUp({ embeds: fixedEmbed(0xed4245, `❌ Failed to block user: ${err.message}`), flags: MessageFlags.Ephemeral });
          }
        }
      }

      if (action === 'transfer') {
        try {
          const targetInVC = voiceChannel.members.get(targetUserId);
          if (!targetInVC) {
            return interaction.editReply({
              content: null,
              components: [],
              embeds: fixedEmbed(0xed4245, '❌ That user must be in your voice channel to transfer ownership.'),
            });
          }
          if (targetUserId === member.id) {
            return interaction.editReply({
              content: null,
              components: [],
              embeds: fixedEmbed(0xed4245, '❌ You already own this channel!'),
            });
          }

          // Remove old owner perms, set new owner perms
          await voiceChannel.permissionOverwrites.delete(member.id).catch(() => {});
          await voiceChannel.permissionOverwrites.edit(targetUserId, {
            ManageChannels: true,
            MoveMembers: true,
            MuteMembers: true,
            Connect: true,
            Speak: true,
            Stream: true,
          });

          await db.updateTempVoiceOwner(voiceChannel.id, targetUserId);
          client.tempVoiceChannels.set(voiceChannel.id, targetUserId);

          await sendLog(guild, new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle('🔄 Voice Ownership Transferred')
            .addFields(
              { name: '⬅️ Old Owner', value: `${member} (${member.user.tag})`,             inline: false },
              { name: '➡️ New Owner', value: `${targetMember} (${targetMember.user.tag})`, inline: false },
              { name: '🔊 Channel',   value: voiceChannel.name,                            inline: false },
            )
            .setTimestamp()
          );

          return interaction.editReply({
            content: null,
            components: [],
            embeds: fixedEmbed(0x57f287, `✅ Ownership transferred to **${targetMember.displayName}**!`),
          });
        } catch (err) {
          return interaction.followUp({ embeds: fixedEmbed(0xed4245, `❌ Failed to transfer ownership: ${err.message}`), flags: MessageFlags.Ephemeral });
        }
      }
    }

    // ── Modal Submissions ───────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const { customId, member, guild } = interaction;
      
      if (customId === 'ticket_modal_create') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const reason = interaction.fields.getTextInputValue('ticket_reason');
        const cfg = await db.getGuildConfig(guild.id);
        
        const currentCount = cfg.ticketCount || 0;
        const newCount = currentCount + 1;
        await db.setGuildConfig(guild.id, { ticketCount: newCount });
        
        const ticketName = `ticket-${newCount.toString().padStart(4, '0')}`;
        
        try {
          const permissionOverwrites = [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: member.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
              deny: [PermissionFlagsBits.SendMessages],
            }
          ];
          
          if (cfg.ticketAdminRoleId) {
             permissionOverwrites.push({
               id: cfg.ticketAdminRoleId,
               allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
             });
          }
          
          const category = guild.channels.cache.get(cfg.ticketCategoryId);
          const parent = category && category.type === ChannelType.GuildCategory ? category.id : null;
          
          const newTicketCh = await guild.channels.create({
            name: ticketName,
            type: ChannelType.GuildText,
            parent: parent,
            topic: `Ticket Owner: ${member.id}`,
            permissionOverwrites,
          });
          
          const welcomeEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🎫 ${ticketName}`)
            .setDescription(`**Ticket by** ${member}\n\n**Reason:** ${reason}\n\n*Please wait until a staff member accepts your ticket to start chatting.*`)
            .setFooter({ text: 'Staff can accept or reject this ticket below.' });
            
          const actionRow = new ActionRowBuilder().addComponents(
             new ButtonBuilder().setCustomId('ticket_accept').setEmoji('✅').setLabel('Accept').setStyle(ButtonStyle.Success),
             new ButtonBuilder().setCustomId('ticket_reject').setEmoji('❌').setLabel('Reject').setStyle(ButtonStyle.Danger),
             new ButtonBuilder().setCustomId('ticket_close_btn').setEmoji('🔒').setLabel('Close').setStyle(ButtonStyle.Secondary)
          );
          
          await newTicketCh.send({ content: `${cfg.ticketAdminRoleId ? `<@&${cfg.ticketAdminRoleId}>` : 'Admin'}`, embeds: [welcomeEmbed], components: [actionRow] });
          
          return interaction.editReply({ embeds: fixedEmbed(0x57f287, `✅ Ticket created! Please go to ${newTicketCh}`) });
        } catch (err) {
           return interaction.editReply({ embeds: fixedEmbed(0xed4245, `❌ Failed to create ticket: ${err.message}`) });
        }
      }

      const modals = ['tv_modal_rename', 'tv_modal_limit'];
      if (!modals.includes(customId)) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const voiceChannel = member.voice?.channel;

      if (!voiceChannel || String(client.tempVoiceChannels.get(voiceChannel.id)) !== String(member.id)) {
        return interaction.editReply({
          embeds: fixedEmbed(0xed4245, '❌ Action failed: You must be the owner and inside the channel.'),
        });
      }

      // ── RENAME MODAL ───────────────────────────────────────────────────
      if (customId === 'tv_modal_rename') {
        const name = interaction.fields.getTextInputValue('input_rename').trim();
        await voiceChannel.setName(name);
        return interaction.editReply({
          embeds: fixedEmbed(0x57f287, `✅ Channel renamed to **${name}**!`),
        });
      }

      // ── LIMIT MODAL ────────────────────────────────────────────────────
      if (customId === 'tv_modal_limit') {
        const limit = parseInt(interaction.fields.getTextInputValue('input_limit'));
        if (isNaN(limit) || limit < 0 || limit > 99) {
          return interaction.editReply({
            embeds: fixedEmbed(0xed4245, '❌ Please enter a valid number between **0 and 99**.'),
          });
        }
        await voiceChannel.setUserLimit(limit);
        return interaction.editReply({
          embeds: fixedEmbed(0x57f287, `✅ User limit set to **${limit === 0 ? 'Unlimited' : limit}**.`),
        });
      }
    }
  },
  handleTicketClose,
};
