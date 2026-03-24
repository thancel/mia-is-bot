const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getConfig } = require('../utils/guildConfig');
const { generateGoodbyeImage } = require('../utils/welcomeImage');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const cfg = getConfig(member.guild.id);
    if (!cfg.goodbyeChannelId) return;
    const channel = member.guild.channels.cache.get(cfg.goodbyeChannelId);
    if (!channel) return;

    try {
      const buffer = await generateGoodbyeImage({
        avatarURL:   member.user.displayAvatarURL({ extension: 'png', size: 256 }),
        username:    member.displayName,
        guildId:     member.guild.id,
        goodbyeText: cfg.goodbyeText  || 'See you next time, {user}!',
        textColor:   cfg.goodbyeColor || '#ffffff',
        guildName:   member.guild.name,
        memberCount: member.guild.memberCount,
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'goodbye.png' });

      const embed = new EmbedBuilder()
        .setColor(cfg.goodbyeColor || '#ed4245')
        .setDescription(
          `**${member.user.tag}** has left the server.\n\n` +
          `Hope to see you again~ 😢\n` +
          `**${member.guild.memberCount}** members remaining.`
        )
        .setImage('attachment://goodbye.png')
        .addFields(
          { name: '📛 Username',  value: member.user.tag,  inline: true },
          { name: '🆔 ID',        value: member.user.id,   inline: true },
          { name: '📅 Joined',    value: member.joinedAt
            ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
            : 'Unknown', inline: true },
        )
        .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      channel.send({ embeds: [embed], files: [attachment] });
    } catch (err) {
      console.error('❌ Goodbye image error:', err);
      // Fallback embed without image
      channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('👋 Goodbye!')
            .setDescription(
              `**${member.user.tag}** has left the server.\n\n` +
              `Hope to see you again~ 😢\n` +
              `**${member.guild.memberCount}** members remaining.`
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
              { name: '📛 Username', value: member.user.tag,  inline: true },
              { name: '🆔 ID',       value: member.user.id,   inline: true },
              { name: '📅 Joined',   value: member.joinedAt
                ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
                : 'Unknown', inline: true },
            )
            .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL({ dynamic: true }) })
            .setTimestamp(),
        ],
      });
    }
  },
};
