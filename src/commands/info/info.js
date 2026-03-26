const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { randomColor } = require('../../utils/embedUtils');

// ── /serverinfo ───────────────────────────────────────────────────────────────
const serverinfo = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('🏠 Display server information'),

  async execute(interaction) {
    const guild = interaction.guild;
    await guild.members.fetch();

    const totalMembers = guild.memberCount;
    const bots         = guild.members.cache.filter(m => m.user.bot).size;
    const humans       = totalMembers - bots;
    const channels     = guild.channels.cache;
    const text         = channels.filter(c => c.type === 0).size;
    const voice        = channels.filter(c => c.type === 2).size;
    const categories   = channels.filter(c => c.type === 4).size;

    const boostTier = ['None', 'Level 1', 'Level 2', 'Level 3'][guild.premiumTier] ?? 'None';

    const embed = new EmbedBuilder()
      .setColor(randomColor())
      .setTitle(`🏠 ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '🆔 Server ID',       value: guild.id,                                                      inline: true },
        { name: '👑 Owner',            value: `<@${guild.ownerId}>`,                                         inline: true },
        { name: '📅 Created',          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,          inline: true },
        { name: '👥 Total Members',    value: `${totalMembers}`,                                             inline: true },
        { name: '🧑 Humans',           value: `${humans}`,                                                   inline: true },
        { name: '🤖 Bots',             value: `${bots}`,                                                     inline: true },
        { name: '📢 Text Channels',    value: `${text}`,                                                     inline: true },
        { name: '🎙️ Voice Channels',   value: `${voice}`,                                                   inline: true },
        { name: '📁 Categories',       value: `${categories}`,                                               inline: true },
        { name: '🎭 Roles',            value: `${guild.roles.cache.size}`,                                   inline: true },
        { name: '😀 Emojis',           value: `${guild.emojis.cache.size}`,                                  inline: true },
        { name: '✨ Boost Level',       value: boostTier,                                                    inline: true },
        { name: '🔒 Verification',     value: guild.verificationLevel.toString(),                            inline: true },
      )
      .setImage(guild.bannerURL({ size: 1024 }) || null)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};

// ── /userinfo ─────────────────────────────────────────────────────────────────
const userinfo = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('👤 Display user information')
    .addUserOption(o => o.setName('user').setDescription('User to inspect (default: yourself)')),

  async execute(interaction) {
    const target = interaction.options.getMember('user') || interaction.member;
    const user   = target.user;

    const roles = target.roles.cache
      .filter(r => r.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `${r}`)
      .slice(0, 10)
      .join(', ') || 'None';

    const badges  = [];
    const flags   = user.flags?.toArray() || [];
    if (flags.includes('Staff'))           badges.push('👨‍💼 Discord Staff');
    if (flags.includes('Partner'))         badges.push('🤝 Partner');
    if (flags.includes('BugHunterLevel1')) badges.push('🐛 Bug Hunter');
    if (flags.includes('ActiveDeveloper')) badges.push('👨‍💻 Active Developer');
    if (flags.includes('VerifiedBot'))     badges.push('✅ Verified Bot');
    if (user.bot)                          badges.push('🤖 Bot');

    const embed = new EmbedBuilder()
      .setColor(target.displayHexColor || randomColor())
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '🆔 User ID',        value: user.id,                                                               inline: true },
        { name: '🎨 Display Name',   value: target.displayName,                                                    inline: true },
        { name: '🤖 Bot?',           value: user.bot ? 'Yes' : 'No',                                              inline: true },
        { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,                 inline: true },
        { name: '📅 Joined Server',   value: target.joinedAt ? `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>` : 'N/A', inline: true },
        { name: '🎖️ Highest Role',   value: `${target.roles.highest}`,                                            inline: true },
        { name: `🏷️ Roles (${target.roles.cache.size - 1})`, value: roles,                                       inline: false },
        { name: '🏅 Badges',          value: badges.length ? badges.join(', ') : 'None',                         inline: false },
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    if (user.banner) embed.setImage(user.bannerURL({ size: 512 }));
    return interaction.reply({ embeds: [embed] });
  },
};

module.exports = { serverinfo, userinfo };
