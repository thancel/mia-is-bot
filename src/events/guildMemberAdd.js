const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getConfig } = require('../utils/guildConfig');
const { generateWelcomeImage } = require('../utils/welcomeImage');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const cfg = getConfig(member.guild.id);
    if (!cfg.welcomeChannelId) return;
    const channel = member.guild.channels.cache.get(cfg.welcomeChannelId);
    if (!channel) return;

    try {
      const buffer = await generateWelcomeImage({
        avatarURL:   member.user.displayAvatarURL({ extension: 'png', size: 256 }),
        username:    member.displayName,
        guildId:     member.guild.id,
        welcomeText: cfg.welcomeText  || 'Welcome to {server}! · Member {count}',
        textColor:   cfg.welcomeColor || '#ffffff',
        guildName:   member.guild.name,
        memberCount: member.guild.memberCount,
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });

      const embed = new EmbedBuilder()
        .setColor(cfg.welcomeColor || '#57f287')
        .setDescription(
          `👋 Hey ${member}! Welcome to **${member.guild.name}**!\n` +
          `You are member **#${member.guild.memberCount}**!`
        )
        .setImage('attachment://welcome.png')
        .addFields(
          { name: '📛 Username',    value: member.user.tag,                                                            inline: true },
          { name: '🆔 ID',          value: member.user.id,                                                             inline: true },
          { name: '📅 Account Age', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,                 inline: true },
        )
        .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      channel.send({ content: `${member}`, embeds: [embed], files: [attachment] });
    } catch (err) {
      console.error('❌ Welcome image error:', err);
      channel.send({
        content: `${member}`,
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('👋 Welcome!')
            .setDescription(
              `Hey ${member}! Welcome to **${member.guild.name}**!\n` +
              `You are member **#${member.guild.memberCount}**!`
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp(),
        ],
      });
    }
  },
};
