const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  AttachmentBuilder,
  ChannelType,
} = require('discord.js');
const fs    = require('fs');
const https = require('https');
const http  = require('http');
const db    = require('../../db');
const { generateGoodbyeImage, getGoodbyeBgPath } = require('../../utils/welcomeImage');

async function sendLog(guild, embed) {
  const cfg = await db.getGuildConfig(guild.id);
  if (!cfg.logChannelId) return;
  const ch = guild.channels.cache.get(cfg.logChannelId);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function display(id) { return id ? `<#${id}>` : '`Not set`'; }

function parseHex(hex) {
  const t = hex.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t)) return null;
  return t.length === 4 ? '#' + [...t.slice(1)].map(c => c + c).join('') : t;
}

function viewEmbed(guild, cfg) {
  return new EmbedBuilder()
    .setColor(cfg.goodbyeEmbedColor || 0xed4245)
    .setTitle('⚙️ Goodbye Settings')
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: '👋 Goodbye Channel', value: display(cfg.goodbyeChannelId),                         inline: true  },
      { name: '🎨 Text Color',      value: cfg.goodbyeTextColor  || '`#ffffff` (default)',         inline: true  },
      { name: '🖼️ Embed Color',     value: cfg.goodbyeEmbedColor || '`#ed4245` (default)',         inline: true  },
      { name: '💬 Embed Text',      value: cfg.goodbyeEmbedText  || '`Default`',                   inline: false },
      { name: '🖼️ Image Text',      value: cfg.goodbyeImgText    || '`Default`',                   inline: false },
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('goodbye')
    .setDescription('⚙️ Configure goodbye greeting settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('✅ Set the goodbye channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Goodbye channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    )
    .addSubcommand(sub => sub.setName('remove').setDescription('🗑️ Clear the goodbye channel configuration'))
    .addSubcommand(sub => sub
      .setName('background')
      .setDescription('🖼️ Set goodbye background image (PNG/JPG/WEBP, max 8MB — any size, auto-resized)')
      .addAttachmentOption(opt => opt.setName('image').setDescription('Background image file').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('text')
      .setDescription('✏️ Set goodbye message. Variables: {user}, {server}, {count}')
      .addStringOption(opt => opt.setName('target').setDescription('Where to show the text').setRequired(true)
        .addChoices(
          { name: '💬 text — shown in embed description', value: 'text'    },
          { name: '🖼️ imgtext — drawn on the image',      value: 'imgtext' },
        )
      )
      .addStringOption(opt => opt.setName('message').setDescription('e.g. See you next time, {user}!').setRequired(true).setMaxLength(100))
    )
    .addSubcommand(sub => sub
      .setName('color')
      .setDescription('🎨 Set a color for the goodbye greeting')
      .addStringOption(opt => opt.setName('type').setDescription('Which color to set').setRequired(true)
        .addChoices(
          { name: '🎨 Text color (drawn on image)', value: 'text'  },
          { name: '🖼️ Embed color',                 value: 'embed' },
        )
      )
      .addStringOption(opt => opt.setName('hex').setDescription('Hex color code, e.g. #ed4245').setRequired(true).setMinLength(4).setMaxLength(7))
    )
    .addSubcommand(sub => sub.setName('preview').setDescription('👁️ Preview the goodbye image'))
    .addSubcommand(sub => sub.setName('reset').setDescription('♻️ Reset all goodbye settings to default')),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const cfg     = await db.setGuildConfig(guildId, { goodbyeChannelId: channel.id });
      await sendLog(interaction.guild, new EmbedBuilder().setColor(0xed4245).setTitle('⚙️ Goodbye Setup').addFields({ name: '👋 Channel', value: `${channel}`, inline: true }, { name: '🛡️ Admin', value: `${interaction.user}`, inline: true }).setTimestamp());
      return interaction.reply({
        embeds: [viewEmbed(interaction.guild, cfg).setDescription(`✅ Goodbye channel set to ${channel}.`)],
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      const cfg = await db.setGuildConfig(guildId, { goodbyeChannelId: null });
      await sendLog(interaction.guild, new EmbedBuilder().setColor(0xed4245).setTitle('⚙️ Goodbye Disabled').addFields({ name: '🛡️ Admin', value: `${interaction.user}`, inline: true }).setTimestamp());
      return interaction.reply({
        embeds: [viewEmbed(interaction.guild, cfg).setDescription('🗑️ Goodbye channel has been cleared.').setColor(0xed4245)],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    if (sub === 'background') {
      const attachment = interaction.options.getAttachment('image');
      const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
      if (!validTypes.includes(attachment.contentType?.split(';')[0])) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ File must be an image (PNG/JPG/WEBP).')],
        });
      }
      if (attachment.size > 8 * 1024 * 1024) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ File size must not exceed 8 MB.')],
        });
      }
      try {
        const buffer = await downloadBuffer(attachment.url);
        fs.writeFileSync(getGoodbyeBgPath(guildId), buffer);
        await sendLog(interaction.guild, new EmbedBuilder().setColor(0xed4245).setTitle('🖼️ Goodbye Background Updated').addFields({ name: '🛡️ Admin', value: `${interaction.user}`, inline: true }, { name: '📁 File', value: attachment.name, inline: true }).setTimestamp());
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(
            '✅ **Goodbye** background updated!\n' +
            'Images of any size are accepted — they will be auto-resized to fit.\n' +
            'Use `/goodbye preview` to see the result.'
          )],
        });
      } catch (err) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ Failed to download image: ${err.message}`)],
        });
      }
    }

    if (sub === 'text') {
      const target  = interaction.options.getString('target');
      const message = interaction.options.getString('message');
      if (target === 'text') {
        await db.setGuildConfig(guildId, { goodbyeEmbedText: message });
        await sendLog(interaction.guild, new EmbedBuilder().setColor(0xed4245).setTitle('✏️ Goodbye Embed Text Updated').addFields({ name: '🛡️ Admin', value: `${interaction.user}`, inline: true }, { name: '💬 Text', value: message, inline: false }).setTimestamp());
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(
            `✅ **Goodbye embed text** updated:\n> ${message}\n\nVariables: \`{user}\`, \`{server}\`, \`{count}\``
          )],
        });
      } else {
        await db.setGuildConfig(guildId, { goodbyeImgText: message });
        await sendLog(interaction.guild, new EmbedBuilder().setColor(0xed4245).setTitle('✏️ Goodbye Image Text Updated').addFields({ name: '🛡️ Admin', value: `${interaction.user}`, inline: true }, { name: '🖼️ Text', value: message, inline: false }).setTimestamp());
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(
            `✅ **Goodbye image text** updated:\n> ${message}\n\nVariables: \`{user}\`, \`{server}\`, \`{count}\``
          )],
        });
      }
    }

    if (sub === 'color') {
      const type       = interaction.options.getString('type');
      const hex        = interaction.options.getString('hex');
      const normalized = parseHex(hex);
      if (!normalized) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ Invalid hex color. Use format like `#ffffff` or `#fff`.')],
        });
      }
      if (type === 'text') {
        await db.setGuildConfig(guildId, { goodbyeTextColor: normalized });
        await sendLog(interaction.guild, new EmbedBuilder().setColor(normalized).setTitle('🎨 Goodbye Text Color Updated').addFields({ name: '🛡️ Admin', value: `${interaction.user}`, inline: true }, { name: '🎨 Color', value: normalized, inline: true }).setTimestamp());
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(normalized).setDescription(
            `✅ **Goodbye text color** set to **${normalized}**.\nUse \`/goodbye preview\` to see the result.`
          )],
        });
      } else {
        await db.setGuildConfig(guildId, { goodbyeEmbedColor: normalized });
        await sendLog(interaction.guild, new EmbedBuilder().setColor(normalized).setTitle('🎨 Goodbye Embed Color Updated').addFields({ name: '🛡️ Admin', value: `${interaction.user}`, inline: true }, { name: '🎨 Color', value: normalized, inline: true }).setTimestamp());
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(normalized).setDescription(
            `✅ **Goodbye embed color** set to **${normalized}**.\nUse \`/goodbye preview\` to see the result.`
          )],
        });
      }
    }

    if (sub === 'preview') {
      const cfg = await db.getGuildConfig(guildId);
      try {
        const buffer = await generateGoodbyeImage({
          avatarURL:   interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
          username:    interaction.member.displayName,
          guildId,
          goodbyeText: cfg.goodbyeImgText || 'See you next time, {user}!',
          textColor:   cfg.goodbyeTextColor || '#ffffff',
          guildName:   interaction.guild.name,
          memberCount: interaction.guild.memberCount,
        });
        const filename   = 'goodbye_preview.png';
        const attachment = new AttachmentBuilder(buffer, { name: filename });
        const embedColor = cfg.goodbyeEmbedColor || '#ed4245';

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle('👁️ Goodbye Preview')
          .setDescription(
            cfg.goodbyeEmbedText
              ? cfg.goodbyeEmbedText
                  .replace(/{user}/g,   interaction.member.displayName)
                  .replace(/{server}/g, interaction.guild.name)
                  .replace(/{count}/g,  `#${interaction.guild.memberCount}`)
              : null
          )
          .setImage(`attachment://${filename}`)
          .addFields(
            { name: '🎨 Text Color',  value: cfg.goodbyeTextColor  || '`#ffffff` (default)', inline: true  },
            { name: '🖼️ Embed Color', value: embedColor,                                     inline: true  },
            { name: '💬 Embed Text',  value: cfg.goodbyeEmbedText  || '`Not set`',            inline: false },
            { name: '🖼️ Image Text',  value: cfg.goodbyeImgText    || '`See you next time, {user}!` (default)', inline: false },
          )
          .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) });

        return interaction.editReply({ embeds: [embed], files: [attachment] });
      } catch (err) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ Preview failed: ${err.message}`)],
        });
      }
    }

    if (sub === 'reset') {
      const bgPath = getGoodbyeBgPath(guildId);
      if (fs.existsSync(bgPath)) fs.unlinkSync(bgPath);
      await db.setGuildConfig(guildId, {
        goodbyeEmbedText: null, goodbyeImgText: null,
        goodbyeTextColor: null, goodbyeEmbedColor: null,
      });
      await sendLog(interaction.guild, new EmbedBuilder().setColor(0xed4245).setTitle('♻️ Goodbye Reset').addFields({ name: '🛡️ Admin', value: `${interaction.user}`, inline: true }).setTimestamp());
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x57f287).setDescription('✅ **Goodbye** settings have been reset to default.')],
      });
    }
  },
};
