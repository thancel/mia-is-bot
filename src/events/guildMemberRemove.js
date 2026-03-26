const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../db');
const { generateGoodbyeImage } = require('../utils/welcomeImage');
const { randomColor } = require('../utils/embedUtils');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const cfg = await db.getGuildConfig(member.guild.id);
    if (!cfg.goodbyeChannelId) return;
    const channel = member.guild.channels.cache.get(cfg.goodbyeChannelId);
    if (!channel) return;

    const embedColor = cfg.goodbyeEmbedColor || randomColor();

    try {
      const buffer = await generateGoodbyeImage({
        avatarURL:   member.user.displayAvatarURL({ extension: 'png', size: 256 }),
        username:    member.displayName,
        guildId:     member.guild.id,
        goodbyeText: cfg.goodbyeImgText || 'See you next time, {user}!',
        textColor:   cfg.goodbyeTextColor || '#ffffff',
        guildName:   member.guild.name,
        memberCount: member.guild.memberCount,
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'goodbye.png' });

      const desc = cfg.goodbyeEmbedText
        ? cfg.goodbyeEmbedText
            .replace(/{user}/g,   member.displayName)
            .replace(/{server}/g, member.guild.name)
            .replace(/{count}/g,  `#${member.guild.memberCount}`)
        : `**${member.user.tag}** has left the server.\n**${member.guild.memberCount}** members remaining.`;

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(desc)
        .setImage('attachment://goodbye.png')
        .addFields(
          { name: '📛 Username', value: member.user.tag, inline: true },
          { name: '🆔 ID',       value: member.user.id,  inline: true },
          { name: '📅 Joined',   value: member.joinedAt
            ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
            : 'Unknown', inline: true },
        )
        .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      channel.send({ embeds: [embed], files: [attachment] });
    } catch (err) {
      console.error('❌ Goodbye image error:', err);
      channel.send({
        embeds: [new EmbedBuilder()
          .setColor(embedColor)
          .setTitle('👋 Goodbye!')
          .setDescription(
            `**${member.user.tag}** has left the server.\n` +
            `**${member.guild.memberCount}** members remaining.`
          )
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .addFields(
            { name: '📛 Username', value: member.user.tag, inline: true },
            { name: '🆔 ID',       value: member.user.id,  inline: true },
            { name: '📅 Joined',   value: member.joinedAt
              ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
              : 'Unknown', inline: true },
          )
          .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL({ dynamic: true }) })
          .setTimestamp()],
      });
    }
  },
};
