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
const { getConfig, setConfig } = require('../../utils/guildConfig');
const {
  generateGoodbyeImage,
  getGoodbyeBgPath,
} = require('../../utils/welcomeImage');

// ============================================================
// /goodbye — Goodbye greeting settings
//
// Subcommands:
// • setup      — Set goodbye channel
// • remove     — Clear goodbye channel
// • background — Set goodbye background image (PNG/JPG/WEBP, max 8MB)
// • text       — Set goodbye message ({user}, {server}, {count})
// • color      — Set color (opt: embed / text)
// • preview    — Preview goodbye image
// • reset      — Reset all goodbye settings to default
// ============================================================

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

function display(id) {
  return id ? `<#${id}>` : '`Not set`';
}

function viewEmbed(guild, cfg) {
  return new EmbedBuilder()
    .setColor(cfg.goodbyeEmbedColor || 0xffffff)
    .setTitle('⚙️ Goodbye Settings')
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: '👋 Goodbye Channel', value: display(cfg.goodbyeChannelId),             inline: true  },
      { name: '🎨 Text Color',      value: cfg.goodbyeTextColor  || '`#ffffff` (default)', inline: true  },
      { name: '🖼️ Embed Color',     value: cfg.goodbyeEmbedColor || '`#ffffff` (default)', inline: true  },
      { name: '💬 Embed Text',      value: cfg.goodbyeEmbedText  || '`Default`',      inline: false },
      { name: '🖼️ Image Text',      value: cfg.goodbyeImgText    || '`Default`',      inline: false },
    )
    .setFooter({ text: cfg.updatedAt
      ? `Last updated: ${new Date(cfg.updatedAt).toLocaleString('en-US')}`
      : 'Never configured',
    });
}

function parseHex(hex) {
  const trimmed = hex.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return null;
  return trimmed.length === 4
    ? '#' + [...trimmed.slice(1)].map(c => c + c).join('')
    : trimmed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('goodbye')
    .setDescription('⚙️ Configure goodbye greeting settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // ── /goodbye setup ──
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('✅ Set the goodbye channel')
      .addChannelOption(opt => opt
        .setName('channel')
        .setDescription('Select the goodbye channel')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
      )
    )

    // ── /goodbye remove ──
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('🗑️ Clear the goodbye channel configuration')
    )

    // ── /goodbye background ──
    .addSubcommand(sub => sub
      .setName('background')
      .setDescription('🖼️ Set goodbye background image (PNG/JPG/WEBP, recommended 1280×720 px, max 8MB)')
      .addAttachmentOption(opt => opt
        .setName('image')
        .setDescription('Upload image file (recommended: 1280×720 px, rasio 16:9)')
        .setRequired(true)
      )
    )

    // ── /goodbye text ──
    .addSubcommand(sub => sub
      .setName('text')
      .setDescription('✏️ Set goodbye message. Use {user}, {server}, {count}')
      .addStringOption(opt => opt
        .setName('target')
        .setDescription('Where to show this text?')
        .setRequired(true)
        .addChoices(
          { name: '💬 text — shown in embed description', value: 'text'    },
          { name: '🖼️ imgtext — drawn on the image',      value: 'imgtext' },
        )
      )
      .addStringOption(opt => opt
        .setName('message')
        .setDescription('e.g. See you next time, {user}!')
        .setRequired(true)
        .setMaxLength(100)
      )
    )

    // ── /goodbye color ──
    .addSubcommand(sub => sub
      .setName('color')
      .setDescription('🎨 Set color for the goodbye greeting')
      .addStringOption(opt => opt
        .setName('type')
        .setDescription('Which color to set?')
        .setRequired(true)
        .addChoices(
          { name: '🎨 Text color (on image)', value: 'text'  },
          { name: '🖼️ Embed color',           value: 'embed' },
        )
      )
      .addStringOption(opt => opt
        .setName('hex')
        .setDescription('Hex color code, e.g. #ed4245 or #ffffff')
        .setRequired(true)
        .setMinLength(4)
        .setMaxLength(7)
      )
    )

    // ── /goodbye preview ──
    .addSubcommand(sub => sub
      .setName('preview')
      .setDescription('👁️ Preview the goodbye image with current settings')
    )

    // ── /goodbye reset ──
    .addSubcommand(sub => sub
      .setName('reset')
      .setDescription('♻️ Reset all goodbye settings to default')
    ),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── /goodbye setup ──
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const cfg     = setConfig(guildId, { goodbyeChannelId: channel.id });
      return interaction.reply({
        embeds: [
          viewEmbed(interaction.guild, cfg)
            .setDescription(`✅ **Goodbye Channel** set to ${channel}!`),
        ],
        ephemeral: true,
      });
    }

    // ── /goodbye remove ──
    if (sub === 'remove') {
      const cfg = setConfig(guildId, { goodbyeChannelId: null });
      return interaction.reply({
        embeds: [
          viewEmbed(interaction.guild, cfg)
            .setDescription('🗑️ **Goodbye Channel** has been cleared.')
            .setColor(0xed4245),
        ],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // ── /goodbye background ──
    if (sub === 'background') {
      const attachment = interaction.options.getAttachment('image');
      const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
      if (!validTypes.includes(attachment.contentType?.split(';')[0])) {
        return interaction.editReply({ content: '❌ File must be an image (PNG/JPG/WEBP)!' });
      }
      if (attachment.size > 8 * 1024 * 1024) {
        return interaction.editReply({ content: '❌ File size must not exceed 8MB!' });
      }
      try {
        const buffer = await downloadBuffer(attachment.url);
        fs.writeFileSync(getGoodbyeBgPath(guildId), buffer);
        return interaction.editReply({
          content:
            `✅ **Goodbye** background updated!\n` +
            `Use \`/goodbye preview\` to see the result.\n\n` +
            `📐 **Recommended background size:** 1280 × 720 px (16:9)`,
        });
      } catch (err) {
        return interaction.editReply({ content: `❌ Failed to download image: ${err.message}` });
      }
    }

    // ── /goodbye text ──
    if (sub === 'text') {
      const target  = interaction.options.getString('target');
      const message = interaction.options.getString('message');

      if (target === 'text') {
        setConfig(guildId, { goodbyeEmbedText: message });
        return interaction.editReply({
          content:
            `✅ **Goodbye embed text** set to:\n> ${message}\n\n` +
            `Available variables: \`{user}\`, \`{server}\`, \`{count}\``,
        });
      } else {
        setConfig(guildId, { goodbyeImgText: message });
        return interaction.editReply({
          content:
            `✅ **Goodbye image text** (drawn on image) set to:\n> ${message}\n\n` +
            `Available variables: \`{user}\`, \`{server}\`, \`{count}\``,
        });
      }
    }

    // ── /goodbye color ──
    if (sub === 'color') {
      const type       = interaction.options.getString('type');
      const hex        = interaction.options.getString('hex');
      const normalized = parseHex(hex);
      if (!normalized) {
        return interaction.editReply({ content: '❌ Invalid color format! Use hex like `#ffffff` or `#fff`.' });
      }

      if (type === 'text') {
        setConfig(guildId, { goodbyeTextColor: normalized });
        return interaction.editReply({
          content:
            `✅ **Goodbye text color** (on image) set to **${normalized}**!\n` +
            `Use \`/goodbye preview\` to see the result.`,
        });
      } else {
        setConfig(guildId, { goodbyeEmbedColor: normalized });
        return interaction.editReply({
          content:
            `✅ **Goodbye embed color** set to **${normalized}**!\n` +
            `Use \`/goodbye preview\` to see the result.`,
        });
      }
    }

    // ── /goodbye preview ──
    if (sub === 'preview') {
      const cfg = getConfig(guildId);
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
        const embedColor = cfg.goodbyeEmbedColor || '#ffffff';

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle('👁️ Preview — Goodbye Image')
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
            { name: '💬 Embed Text',  value: cfg.goodbyeEmbedText  || '`Not set`',           inline: false },
            { name: '🖼️ Image Text',  value: cfg.goodbyeImgText    || '`See you next time, {user}!` (default)', inline: false },
          )
          .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) });

        return interaction.editReply({ embeds: [embed], files: [attachment] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Failed to generate preview: ${err.message}` });
      }
    }

    // ── /goodbye reset ──
    if (sub === 'reset') {
      const bgPath = getGoodbyeBgPath(guildId);
      if (fs.existsSync(bgPath)) fs.unlinkSync(bgPath);

      setConfig(guildId, {
        goodbyeEmbedText:  null,
        goodbyeImgText:    null,
        goodbyeTextColor:  null,
        goodbyeEmbedColor: null,
      });

      return interaction.editReply({
        content: '✅ **Goodbye** settings have been reset to default.',
      });
    }
  },
};