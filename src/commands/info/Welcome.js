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
const { generateWelcomeImage, getWelcomeBgPath } = require('../../utils/welcomeImage');

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
    .setColor(cfg.welcomeEmbedColor || 0x57f287)
    .setTitle('⚙️ Welcome Settings')
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: '👋 Welcome Channel', value: display(cfg.welcomeChannelId),                          inline: true  },
      { name: '🎨 Text Color',      value: cfg.welcomeTextColor  || '`#ffffff` (default)',          inline: true  },
      { name: '🖼️ Embed Color',     value: cfg.welcomeEmbedColor || '`#57f287` (default)',          inline: true  },
      { name: '💬 Embed Text',      value: cfg.welcomeEmbedText  || '`Default`',                    inline: false },
      { name: '🖼️ Image Text',      value: cfg.welcomeImgText    || '`Default`',                    inline: false },
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('⚙️ Configure welcome greeting settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('✅ Set the welcome channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Welcome channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('🗑️ Clear the welcome channel configuration')
    )
    .addSubcommand(sub => sub
      .setName('background')
      .setDescription('🖼️ Set welcome background image (PNG/JPG/WEBP, max 8MB — any size, auto-resized)')
      .addAttachmentOption(opt => opt.setName('image').setDescription('Background image file').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('text')
      .setDescription('✏️ Set welcome message. Variables: {user}, {server}, {count}')
      .addStringOption(opt => opt.setName('target').setDescription('Where to show the text').setRequired(true)
        .addChoices(
          { name: '💬 text — shown in embed description', value: 'text'    },
          { name: '🖼️ imgtext — drawn on the image',      value: 'imgtext' },
        )
      )
      .addStringOption(opt => opt.setName('message').setDescription('e.g. Welcome to {server}! You are member #{count}').setRequired(true).setMaxLength(100))
    )
    .addSubcommand(sub => sub
      .setName('color')
      .setDescription('🎨 Set a color for the welcome greeting')
      .addStringOption(opt => opt.setName('type').setDescription('Which color to set').setRequired(true)
        .addChoices(
          { name: '🎨 Text color (drawn on image)', value: 'text'  },
          { name: '🖼️ Embed color',                 value: 'embed' },
        )
      )
      .addStringOption(opt => opt.setName('hex').setDescription('Hex color code, e.g. #57f287').setRequired(true).setMinLength(4).setMaxLength(7))
    )
    .addSubcommand(sub => sub.setName('preview').setDescription('👁️ Preview the welcome image'))
    .addSubcommand(sub => sub.setName('reset').setDescription('♻️ Reset all welcome settings to default')),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const cfg     = await db.setGuildConfig(guildId, { welcomeChannelId: channel.id });
      await sendLog(interaction.guild, new EmbedBuilder().setColor(0x57f287).setTitle('⚙️ Welcome Setup').addFields({ name: '👋 Channel', value: `${channel}`, inline: true }, { name: '🛡️ Admin', value: `${interaction.user}`, inline: true }).setTimestamp());
      return interaction.reply({
        embeds: [viewEmbed(interaction.guild, cfg).setDescription(`✅ Welcome channel set to ${channel}.`)],
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      const cfg = await db.setGuildConfig(guildId, { welcomeChannelId: null });
      await sendLog(interaction.guild, new EmbedBuilder().setColor(0xed4245).setTitle('⚙️ Welcome Disabled').addFields({ name: '🛡️ Admin', value: `${interaction.user}`, inline: true }).setTimestamp());
      return interaction.reply({
        embeds: [viewEmbed(interaction.guild, cfg).setDescription('🗑️ Welcome channel has been cleared.').setColor(0xed4245)],
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
        fs.writeFileSync(getWelcomeBgPath(guildId), buffer);
        await sendLog(interaction.guild, new EmbedBuilder().setColor(0x57f287).setTitle('🖼️ Welcome Background Updated').addFields({ name: '🛡️ Admin', value: `${interaction.user}`, inline: true }, { name: '📁 File', value: attachment.name, inline: true }).setTimestamp());
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(
            '✅ **Welcome** background updated!\n' +
            'Images of any size are accepted — they will be auto-resized to fit.\n' +
            'Use `/welcome preview` to see the result.'
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
        await db.setGuildConfig(guildId, { welcomeEmbedText: message });
        await sendLog(interaction.guild, new EmbedBuilder().setColor(0x57f287).setTitle('✏️ Welcome Embed Text Updated').addFields({ name: '🛡️ Admin', value: `${interaction.user}`, inline: true }, { name: '💬 Text', value: message, inline: false }).setTimestamp());
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(
            `✅ **Welcome embed text** updated:\n> ${message}\n\nVariables: \`{user}\`, \`{server}\`, \`{count}\``
          )],
        });
      } else {
        await db.setGuildConfig(guildId, { welcomeImgText: message });
        await sendLog(interaction.guild, new EmbedBuilder().setColor(0x57f287).setTitle('✏️ Welcome Image Text Updated').addFields({ name: '🛡️ Admin', value: `${interaction.user}`, inline: true }, { name: '🖼️ Text', value: message, inline: false }).setTimestamp());
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(
            `✅ **Welcome image text** updated:\n> ${message}\n\nVariables: \`{user}\`, \`{server}\`, \`{count}\``
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
        await db.setGuildConfig(guildId, { welcomeTextColor: normalized });
        await sendLog(interaction.guild, new EmbedBuilder().setColor(normalized).setTitle('🎨 Welcome Text Color Updated').addFields({ name: '🛡️ Admin', value: `${interaction.user}`, inline: true }, { name: '🎨 Color', value: normalized, inline: true }).setTimestamp());
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(normalized).setDescription(
            `✅ **Welcome text color** set to **${normalized}**.\nUse \`/welcome preview\` to see the result.`
          )],
        });
      } else {
        await db.setGuildConfig(guildId, { welcomeEmbedColor: normalized });
        await sendLog(interaction.guild, new EmbedBuilder().setColor(normalized).setTitle('🎨 Welcome Embed Color Updated').addFields({ name: '🛡️ Admin', value: `${interaction.user}`, inline: true }, { name: '🎨 Color', value: normalized, inline: true }).setTimestamp());
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(normalized).setDescription(
            `✅ **Welcome embed color** set to **${normalized}**.\nUse \`/welcome preview\` to see the result.`
          )],
        });
      }
    }

    if (sub === 'preview') {
      const cfg = await db.getGuildConfig(guildId);
      try {
        const buffer = await generateWelcomeImage({
          avatarURL:   interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
          username:    interaction.member.displayName,
          guildId,
          welcomeText: cfg.welcomeImgText || 'Welcome to {server}! Member {count}',
          textColor:   cfg.welcomeTextColor || '#ffffff',
          guildName:   interaction.guild.name,
          memberCount: interaction.guild.memberCount,
        });
        const filename   = 'welcome_preview.png';
        const attachment = new AttachmentBuilder(buffer, { name: filename });
        const embedColor = cfg.welcomeEmbedColor || '#57f287';

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle('👁️ Welcome Preview')
          .setDescription(
            cfg.welcomeEmbedText
              ? cfg.welcomeEmbedText
                  .replace(/{user}/g,   interaction.member.displayName)
                  .replace(/{server}/g, interaction.guild.name)
                  .replace(/{count}/g,  `#${interaction.guild.memberCount}`)
              : null
          )
          .setImage(`attachment://${filename}`)
          .addFields(
            { name: '🎨 Text Color',  value: cfg.welcomeTextColor  || '`#ffffff` (default)', inline: true  },
            { name: '🖼️ Embed Color', value: embedColor,                                     inline: true  },
            { name: '💬 Embed Text',  value: cfg.welcomeEmbedText  || '`Not set`',            inline: false },
            { name: '🖼️ Image Text',  value: cfg.welcomeImgText    || '`Welcome to {server}! Member {count}` (default)', inline: false },
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
      const bgPath = getWelcomeBgPath(guildId);
      if (fs.existsSync(bgPath)) fs.unlinkSync(bgPath);
      await db.setGuildConfig(guildId, {
        welcomeEmbedText: null, welcomeImgText: null,
        welcomeTextColor: null, welcomeEmbedColor: null,
      });
      await sendLog(interaction.guild, new EmbedBuilder().setColor(0xed4245).setTitle('♻️ Welcome Reset').addFields({ name: '🛡️ Admin', value: `${interaction.user}`, inline: true }).setTimestamp());
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x57f287).setDescription('✅ **Welcome** settings have been reset to default.')],
      });
    }
  },
};
