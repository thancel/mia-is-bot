const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../db');
const { generateWelcomeImage } = require('../utils/welcomeImage');
const { randomColor } = require('../utils/embedUtils');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const cfg = await db.getGuildConfig(member.guild.id);

    // ── Auto-Role ────────────────────────────────────────────────────────────
    if (cfg.autoRoleId) {
      try {
        const role = member.guild.roles.cache.get(cfg.autoRoleId);
        if (role && !role.managed && member.guild.members.me.roles.highest.position > role.position) {
          await member.roles.add(role, 'Auto-role on join');
          console.log(`🏷️  Auto-role: Assigned "${role.name}" to ${member.user.tag}`);
        }
      } catch (err) {
        console.error(`❌ Auto-role failed for ${member.user.tag}:`, err.message);
      }
    }

    // ── Welcome Message ──────────────────────────────────────────────────────
    if (!cfg.welcomeChannelId) return;
    const channel = member.guild.channels.cache.get(cfg.welcomeChannelId);
    if (!channel) return;

    const embedColor = cfg.welcomeEmbedColor || randomColor();

    try {
      const buffer = await generateWelcomeImage({
        avatarURL:   member.user.displayAvatarURL({ extension: 'png', size: 256 }),
        username:    member.displayName,
        guildId:     member.guild.id,
        welcomeText: cfg.welcomeImgText || 'Welcome to {server}! Member {count}',
        textColor:   cfg.welcomeTextColor || '#ffffff',
        guildName:   member.guild.name,
        memberCount: member.guild.memberCount,
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });

      const desc = cfg.welcomeEmbedText
        ? cfg.welcomeEmbedText
            .replace(/{user}/g,   member.displayName)
            .replace(/{server}/g, member.guild.name)
            .replace(/{count}/g,  `#${member.guild.memberCount}`)
        : `👋 Hey ${member}! Welcome to **${member.guild.name}**!\nYou are member **#${member.guild.memberCount}**.`;

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(desc)
        .setImage('attachment://welcome.png')
        .addFields(
          { name: '📛 Username',    value: member.user.tag,                                            inline: true },
          { name: '🆔 ID',          value: member.user.id,                                             inline: true },
          { name: '📅 Account Age', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        )
        .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      channel.send({ content: `${member}`, embeds: [embed], files: [attachment] });
    } catch (err) {
      console.error('❌ Welcome image error:', err);
      channel.send({
        content: `${member}`,
        embeds: [new EmbedBuilder()
          .setColor(embedColor)
          .setTitle('👋 Welcome!')
          .setDescription(`Hey ${member}! Welcome to **${member.guild.name}**!\nYou are member **#${member.guild.memberCount}**.`)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp()],
      });
    }
  },
};
