const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempvc')
    .setDescription('🎙️ Temp Voice Channel management')

    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('[Admin] Create the trigger channel')
      .addChannelOption(opt => opt
        .setName('category')
        .setDescription('Category to create the trigger channel in')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
      )
    )

    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('ℹ️ View info about your current voice channel')
    )

    .addSubcommand(sub => sub
      .setName('rename')
      .setDescription('✏️ Rename your temp voice channel')
      .addStringOption(opt => opt
        .setName('name')
        .setDescription('New channel name')
        .setMinLength(1)
        .setMaxLength(100)
        .setRequired(true)
      )
    )

    .addSubcommand(sub => sub
      .setName('limit')
      .setDescription('👥 Set the max user limit (0 = unlimited)')
      .addIntegerOption(opt => opt
        .setName('amount')
        .setDescription('Max users (0–99)')
        .setMinValue(0)
        .setMaxValue(99)
        .setRequired(true)
      )
    )

    .addSubcommand(sub => sub
      .setName('kick')
      .setDescription('🦵 Kick a user from your channel')
      .addUserOption(opt => opt
        .setName('user')
        .setDescription('User to kick')
        .setRequired(true)
      )
    )

    .addSubcommand(sub => sub
      .setName('lock')
      .setDescription('🔒 Lock your channel (prevent new users from joining)')
    )

    .addSubcommand(sub => sub
      .setName('unlock')
      .setDescription('🔓 Unlock your channel (allow everyone to join)')
    )

    .addSubcommand(sub => sub
      .setName('transfer')
      .setDescription('🔄 Transfer channel ownership to another user')
      .addUserOption(opt => opt
        .setName('user')
        .setDescription('New channel owner')
        .setRequired(true)
      )
    ),

  async execute(interaction, client) {
    const sub    = interaction.options.getSubcommand();
    const member = interaction.member;

    // ── setup ──
    if (sub === 'setup') {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Only administrators can run setup!', ephemeral: true });
      }
      const category = interaction.options.getChannel('category');
      try {
        const triggerCh = await interaction.guild.channels.create({
          name: '➕ Create Voice',
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: [
            { id: interaction.guild.id, allow: [PermissionFlagsBits.Connect] },
          ],
        });
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('✅ Setup Complete!')
            .setDescription(`Trigger channel ${triggerCh} created in **${category.name}**!\nMembers can join it to get their own room.`)],
          ephemeral: true,
        });
      } catch (err) {
        return interaction.reply({ content: `❌ Setup failed: ${err.message}`, ephemeral: true });
      }
    }

    // ── Semua aksi lain butuh voice channel ──
    const voiceChannel = member.voice?.channel ?? null;

    // ── info ──
    if (sub === 'info') {
      if (!voiceChannel) {
        return interaction.reply({ content: '❌ You are not in a voice channel!', ephemeral: true });
      }
      const ownerId = client.tempVoiceChannels.get(voiceChannel.id);
      const owner   = ownerId ? await interaction.guild.members.fetch(ownerId).catch(() => null) : null;
      const locked  = !voiceChannel.permissionsFor(interaction.guild.id)?.has(PermissionFlagsBits.Connect);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('ℹ️ Voice Channel Info')
          .addFields(
            { name: 'Name',    value: voiceChannel.name, inline: false },
            { name: 'Owner',   value: owner ? `${owner}` : 'Unknown', inline: false },
            { name: 'Members', value: `${voiceChannel.members.size}${voiceChannel.userLimit ? `/${voiceChannel.userLimit}` : ''}`, inline: false },
            { name: 'Status',  value: locked ? '🔒 Locked' : '🔓 Unlocked', inline: false },
            { name: 'Temp',    value: client.tempVoiceChannels.has(voiceChannel.id) ? 'Yes' : 'No', inline: false },
          )],
        ephemeral: true,
      });
    }

    if (!voiceChannel) {
      return interaction.reply({ content: '❌ You must be in a voice channel first!', ephemeral: true });
    }
    const isOwner = client.tempVoiceChannels.get(voiceChannel.id) === member.id;
    if (!isOwner) {
      return interaction.reply({ content: '❌ You are not the owner of this channel!', ephemeral: true });
    }

    // ── rename ──
    if (sub === 'rename') {
      const name = interaction.options.getString('name');
      await voiceChannel.setName(name);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`✅ Channel renamed to **${name}**!`)],
        ephemeral: true,
      });
    }

    // ── limit ──
    if (sub === 'limit') {
      const amount = interaction.options.getInteger('amount');
      await voiceChannel.setUserLimit(amount);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`✅ User limit set to **${amount === 0 ? 'Unlimited' : amount}**!`)],
        ephemeral: true,
      });
    }

    // ── kick ──
    if (sub === 'kick') {
      const target = interaction.options.getMember('user');
      if (!target) return interaction.reply({ content: '❌ User not found!', ephemeral: true });
      if (target.id === member.id) return interaction.reply({ content: '❌ You cannot kick yourself!', ephemeral: true });
      if (!target.voice?.channelId || target.voice.channelId !== voiceChannel.id) {
        return interaction.reply({ content: '❌ That user is not in your channel!', ephemeral: true });
      }
      await target.voice.disconnect('Kicked by channel owner');
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`✅ **${target.displayName}** has been kicked!`)],
        ephemeral: true,
      });
    }

    // ── lock ──
    if (sub === 'lock') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { [PermissionFlagsBits.Connect]: false });
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('🔒 Channel locked! No new users can join.')],
        ephemeral: true,
      });
    }

    // ── unlock ──
    if (sub === 'unlock') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { [PermissionFlagsBits.Connect]: true });
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x57f287).setDescription('🔓 Channel unlocked! Everyone can join now.')],
        ephemeral: true,
      });
    }

    // ── transfer ──
    if (sub === 'transfer') {
      const target = interaction.options.getMember('user');
      if (!target) return interaction.reply({ content: '❌ User not found!', ephemeral: true });
      if (target.id === member.id) return interaction.reply({ content: '❌ You are already the owner!', ephemeral: true });
      if (!target.voice?.channelId || target.voice.channelId !== voiceChannel.id) {
        return interaction.reply({ content: '❌ That user is not in your channel!', ephemeral: true });
      }
      await voiceChannel.permissionOverwrites.delete(member.id);
      await voiceChannel.permissionOverwrites.edit(target.id, {
        ManageChannels: true, MoveMembers: true, MuteMembers: true,
      });
      client.tempVoiceChannels.set(voiceChannel.id, target.id);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`✅ Ownership transferred to **${target.displayName}**!`)],
        ephemeral: true,
      });
    }
  },
};
