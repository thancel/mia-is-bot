const { PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const db = require('../db');

const TEMP_VOICE_TRIGGER_NAME = '➕ Create Voice';

async function sendLog(guild, embed) {
  const cfg = await db.getGuildConfig(guild.id);
  if (!cfg.logChannelId) return;
  const ch = guild.channels.cache.get(cfg.logChannelId);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const guild  = newState.guild  || oldState.guild;
    const member = newState.member || oldState.member;

    // ── 1. USER JOINS TRIGGER → CLEANUP OLD + CREATE NEW ROOM ─────────────
    if (newState.channel && newState.channel.name === TEMP_VOICE_TRIGGER_NAME) {

      // Clean up any existing room owned by this user
      const allTempChannels  = [...client.tempVoiceChannels.entries()];
      const existingChannelId = allTempChannels.find(([, ownerId]) => ownerId === String(member.id))?.[0];

      if (existingChannelId) {
        const oldChannel = guild.channels.cache.get(existingChannelId);
        if (oldChannel) {
          try {
            await oldChannel.delete('User creating a new temporary channel');
            await db.deleteTempVoice(existingChannelId);
            client.tempVoiceChannels.delete(existingChannelId);
          } catch (err) {
            console.error('❌ Failed to cleanup old channel:', err);
          }
        }
      }

      // Create new room
      try {
        const newChannel = await guild.channels.create({
          name: `🎙️ ${member.displayName}'s Room`,
          type: ChannelType.GuildVoice,
          parent: newState.channel.parentId,
          permissionOverwrites: [
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
              ],
            },
            {
              id: guild.id,
              allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
            },
          ],
          userLimit: 0,
        });

        const ownerId   = String(member.id);
        const joinOrder = [ownerId];

        await db.setTempVoice(newChannel.id, ownerId, joinOrder);
        client.tempVoiceChannels.set(newChannel.id, ownerId);
        await member.voice.setChannel(newChannel);

        await sendLog(guild, new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('🎙️ Temp Voice Created')
          .addFields(
            { name: '👤 Owner',   value: `${member} (${member.user.tag})`, inline: false },
            { name: '🔊 Channel', value: newChannel.name,                  inline: false },
          )
          .setTimestamp()
        );
      } catch (err) {
        console.error('❌ Failed to create temp voice:', err);
      }
      return;
    }

    // ── 2. USER LEAVES → AUTO-DELETE OR OWNERSHIP TRANSFER ────────────────
    if (oldState.channel) {
      const leftChannel = oldState.channel;
      if (!client.tempVoiceChannels.has(leftChannel.id)) return;

      const record = await db.getTempVoice(leftChannel.id);
      if (!record) return;

      // Channel empty → delete
      if (leftChannel.members.size === 0) {
        try {
          await leftChannel.delete('Temp voice empty');
          await db.deleteTempVoice(leftChannel.id);
          client.tempVoiceChannels.delete(leftChannel.id);

          await sendLog(guild, new EmbedBuilder()
            .setColor(0x99aab5)
            .setTitle('🗑️ Temp Voice Deleted')
            .addFields(
              { name: '🔊 Channel', value: leftChannel.name, inline: false },
              { name: '📝 Reason',  value: 'Channel was empty',  inline: false },
            )
            .setTimestamp()
          );
        } catch (err) {
          console.error('❌ Failed to delete empty channel:', err);
        }
        return;
      }

      // Owner left → transfer ownership
      if (String(record.ownerId) === String(member.id)) {
        const updatedOrder      = record.joinOrder.filter(id => id !== String(member.id));
        const membersInChannel  = [...leftChannel.members.keys()].map(String);
        const nextOwnerId       = updatedOrder.find(id => membersInChannel.includes(id)) ?? membersInChannel[0];

        if (nextOwnerId) {
          try {
            await leftChannel.permissionOverwrites.delete(record.ownerId).catch(() => {});
            await leftChannel.permissionOverwrites.edit(nextOwnerId, {
              ManageChannels: true,
              MoveMembers:    true,
              MuteMembers:    true,
              Connect:        true,
              Speak:          true,
            });

            await db.updateTempVoiceOwner(leftChannel.id, nextOwnerId);
            client.tempVoiceChannels.set(leftChannel.id, String(nextOwnerId));

            // Notify new owner via DM
            const newOwnerMember = leftChannel.members.get(nextOwnerId);
            if (newOwnerMember) {
              newOwnerMember.user.send(
                `👑 You are now the owner of **${leftChannel.name}** in **${guild.name}**!`
              ).catch(() => {});
            }

            await sendLog(guild, new EmbedBuilder()
              .setColor(0xffa500)
              .setTitle('👑 Voice Ownership Transferred')
              .addFields(
                { name: '🔊 Channel',    value: leftChannel.name,                                               inline: false },
                { name: '⬅️ Old Owner', value: `${member} (${member.user.tag})`,                               inline: false },
                { name: '➡️ New Owner', value: newOwnerMember ? `${newOwnerMember} (${newOwnerMember.user.tag})` : `<@${nextOwnerId}>`, inline: false },
              )
              .setTimestamp()
            );
          } catch (err) {
            console.error('❌ Failed to transfer ownership:', err);
          }
        }
      }
    }
  },
};
