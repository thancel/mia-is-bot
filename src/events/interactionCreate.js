const {
  EmbedBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require('discord.js');
const { randomColor, fixedEmbed } = require('../utils/embedUtils');
const db = require('../db');

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
        const cfg = await db.getGuildConfig(guild.id);
        const giveaways = cfg.giveaways || {};
        const gw = giveaways[giveawayId];

        if (!gw || gw.ended) {
          return interaction.reply({
            embeds: fixedEmbed(0xed4245, '❌ This giveaway has ended.'),
            flags: MessageFlags.Ephemeral,
          });
        }

        const userId = member.id;
        const idx = gw.entries.indexOf(userId);

        if (idx === -1) {
          // Enter
          gw.entries.push(userId);
          await db.setGuildConfig(guild.id, { giveaways });

          // Update button count
          try {
            const { buildGiveawayButton, buildGiveawayEmbed } = require('../commands/moderation/giveaway');
            const row = buildGiveawayButton(gw);
            const embed = buildGiveawayEmbed(gw);
            await interaction.update({ embeds: [embed], components: [row] });
          } catch {
            await interaction.deferUpdate();
          }

          return;
        } else {
          // Leave
          gw.entries.splice(idx, 1);
          await db.setGuildConfig(guild.id, { giveaways });

          try {
            const { buildGiveawayButton, buildGiveawayEmbed } = require('../commands/moderation/giveaway');
            const row = buildGiveawayButton(gw);
            const embed = buildGiveawayEmbed(gw);
            await interaction.update({ embeds: [embed], components: [row] });
          } catch {
            await interaction.deferUpdate();
          }

          return;
        }
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

      // ── Temp Voice Buttons ─────────────────────────────────────────────
      const tvButtons = ['tv_lock', 'tv_unlock', 'tv_rename', 'tv_limit', 'tv_bitrate', 'tv_info'];
      if (!tvButtons.includes(customId)) return;

      const voiceChannel = member.voice?.channel;

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

      switch (customId) {
        case 'tv_info': {
          const isLocked     = voiceChannel.permissionOverwrites.cache.get(guild.id)?.deny.has(PermissionFlagsBits.Connect);
          const currentBitrate = voiceChannel.bitrate / 1000;

          const infoEmbed = new EmbedBuilder()
            .setColor(randomColor())
            .setTitle('ℹ️ Voice Channel Info')
            .addFields(
              { name: '🎙️ Name',     value: `\`${voiceChannel.name}\``,                          inline: true },
              { name: '👑 Owner',    value: `<@${storedOwnerId}>`,                               inline: true },
              { name: '👥 Members',  value: `\`${voiceChannel.members.size}/${voiceChannel.userLimit || '∞'}\``, inline: true },
              { name: '🔒 Status',   value: isLocked ? '`Locked`' : '`Unlocked`',               inline: true },
              { name: '📡 Bitrate',  value: `\`${currentBitrate} kbps\``,                       inline: true },
              { name: '⏳ Type',     value: '`Temporary`',                                       inline: true },
            )
            .setTimestamp();

          return interaction.reply({ embeds: [infoEmbed], flags: MessageFlags.Ephemeral });
        }

        case 'tv_lock': {
          const isLocked = voiceChannel.permissionOverwrites.cache.get(guild.id)?.deny.has(PermissionFlagsBits.Connect);
          if (isLocked) {
            return interaction.reply({
              embeds: fixedEmbed(0xed4245, '⚠️ **Already Locked:** This channel is already private.'),
              flags: MessageFlags.Ephemeral,
            });
          }
          await voiceChannel.permissionOverwrites.edit(guild.id, { [PermissionFlagsBits.Connect]: false });
          return interaction.reply({
            embeds: fixedEmbed(0xed4245, '🔒 **Channel locked!** No new users can join.'),
            flags: MessageFlags.Ephemeral,
          });
        }

        case 'tv_unlock': {
          const isUnlocked = !voiceChannel.permissionOverwrites.cache.get(guild.id)?.deny.has(PermissionFlagsBits.Connect);
          if (isUnlocked) {
            return interaction.reply({
              embeds: fixedEmbed(0xed4245, '⚠️ **Already Unlocked:** This channel is already public.'),
              flags: MessageFlags.Ephemeral,
            });
          }
          await voiceChannel.permissionOverwrites.edit(guild.id, { [PermissionFlagsBits.Connect]: null });
          return interaction.reply({
            embeds: fixedEmbed(0x57f287, '🔓 **Channel unlocked!** Everyone can join now.'),
            flags: MessageFlags.Ephemeral,
          });
        }

        case 'tv_rename': {
          const modal = new ModalBuilder().setCustomId('tv_modal_rename').setTitle('✏️ Rename Channel');
          const input = new TextInputBuilder()
            .setCustomId('input_rename').setLabel('New Channel Name').setStyle(TextInputStyle.Short)
            .setPlaceholder(voiceChannel.name).setMinLength(1).setMaxLength(50).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }

        case 'tv_limit': {
          const modal = new ModalBuilder().setCustomId('tv_modal_limit').setTitle('👥 Set User Limit');
          const input = new TextInputBuilder()
            .setCustomId('input_limit').setLabel('Limit (0 = unlimited, max 99)')
            .setStyle(TextInputStyle.Short).setPlaceholder('0')
            .setValue(`${voiceChannel.userLimit}`).setMinLength(1).setMaxLength(2).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }

        case 'tv_bitrate': {
          const maxBitrate = [96, 128, 256, 384][guild.premiumTier] || 96;
          const modal = new ModalBuilder().setCustomId('tv_modal_bitrate').setTitle('📡 Set Channel Bitrate');
          const input = new TextInputBuilder()
            .setCustomId('input_bitrate')
            .setLabel(`Bitrate kbps (8–${maxBitrate})`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`Max for this server: ${maxBitrate}kbps`)
            .setValue(`${voiceChannel.bitrate / 1000}`)
            .setMinLength(1).setMaxLength(3).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }
      }
    }

    // ── Modal Submissions ───────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const { customId, member, guild } = interaction;
      const modals = ['tv_modal_rename', 'tv_modal_limit', 'tv_modal_bitrate'];
      if (!modals.includes(customId)) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const voiceChannel = member.voice?.channel;

      if (!voiceChannel || String(client.tempVoiceChannels.get(voiceChannel.id)) !== String(member.id)) {
        return interaction.editReply({
          embeds: fixedEmbed(0xed4245, '❌ Action failed: You must be the owner and inside the channel.'),
        });
      }

      if (customId === 'tv_modal_rename') {
        const name = interaction.fields.getTextInputValue('input_rename').trim();
        await voiceChannel.setName(name);
        return interaction.editReply({
          embeds: fixedEmbed(0x57f287, `✅ Channel renamed to **${name}**!`),
        });
      }

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

      if (customId === 'tv_modal_bitrate') {
        const bitrate    = parseInt(interaction.fields.getTextInputValue('input_bitrate'));
        const maxBitrate = [96, 128, 256, 384][guild.premiumTier] || 96;

        if (isNaN(bitrate) || bitrate < 8 || bitrate > maxBitrate) {
          return interaction.editReply({
            embeds: fixedEmbed(0xed4245, `❌ Invalid bitrate. This server supports **8–${maxBitrate} kbps** based on its boost level.`),
          });
        }
        try {
          await voiceChannel.setBitrate(bitrate * 1000);
          return interaction.editReply({
            embeds: fixedEmbed(0x57f287, `✅ Bitrate updated to **${bitrate} kbps**.`),
          });
        } catch (err) {
          return interaction.editReply({
            embeds: fixedEmbed(0xed4245, `❌ Failed to update bitrate: ${err.message}`),
          });
        }
      }
    }
  },
};
