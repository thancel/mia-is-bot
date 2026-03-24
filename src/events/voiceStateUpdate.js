const { PermissionFlagsBits, ChannelType } = require('discord.js');

// Channel name trigger - buat voice channel baru saat join channel ini
const TEMP_VOICE_TRIGGER_NAME = '➕ Create Voice';

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const guild = newState.guild || oldState.guild;

    // ── User JOIN voice channel ──
    if (newState.channel) {
      const joinedChannel = newState.channel;

      // Cek apakah join trigger channel
      if (joinedChannel.name === TEMP_VOICE_TRIGGER_NAME) {
        try {
          const newChannel = await guild.channels.create({
            name: `🎙️ ${newState.member.displayName}'s Room`,
            type: ChannelType.GuildVoice,
            parent: joinedChannel.parentId,
            permissionOverwrites: [
              {
                id: newState.member.id,
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
            userLimit: 0, // 0 = unlimited
          });

          // Simpan ke map
          client.tempVoiceChannels.set(newChannel.id, newState.member.id);

          // Pindahkan user ke channel baru
          await newState.member.voice.setChannel(newChannel);
          console.log(`🎙️ Temp voice dibuat: ${newChannel.name} oleh ${newState.member.user.tag}`);
        } catch (err) {
          console.error('❌ Gagal buat temp voice:', err);
        }
      }
    }

    // ── User LEAVE voice channel ──
    if (oldState.channel) {
      const leftChannel = oldState.channel;

      // Cek apakah ini temp voice channel
      if (client.tempVoiceChannels.has(leftChannel.id)) {
        // Hapus jika kosong
        if (leftChannel.members.size === 0) {
          try {
            await leftChannel.delete('Temp voice kosong, auto-delete');
            client.tempVoiceChannels.delete(leftChannel.id);
            console.log(`🗑️ Temp voice dihapus: ${leftChannel.name}`);
          } catch (err) {
            console.error('❌ Gagal hapus temp voice:', err);
            client.tempVoiceChannels.delete(leftChannel.id);
          }
        }
      }
    }
  },
};
