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
  generateWelcomeImage,
  getWelcomeBgPath,
} = require('../../utils/welcomeImage');

// ============================================================
// /welcome — Welcome greeting settings
//
// Subcommands:
// • setup      — Set welcome channel
// • remove     — Clear welcome channel
// • background — Set welcome background image (PNG/JPG/WEBP, max 8MB)
// • text       — Set welcome message, target: text (embed) / imgtext (on image)
// • color      — Set color (opt: embed / text)
// • preview    — Preview welcome image
// • reset      — Reset all welcome settings to default
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
    .setColor(cfg.welcomeEmbedColor || 0xffffff)
    .setTitle('⚙️ Welcome Settings')
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: '👋 Welcome Channel', value: display(cfg.welcomeChannelId),                inline: true  },
      { name: '🎨 Text Color',      value: cfg.welcomeTextColor  || '`#ffffff` (default)', inline: true  },
      { name: '🖼️ Embed Color',     value: cfg.welcomeEmbedColor || '`#ffffff` (default)', inline: true  },
      { name: '💬 Embed Text',      value: cfg.welcomeEmbedText  || '`Default`',           inline: false },
      { name: '🖼️ Image Text',      value: cfg.welcomeImgText    || '`Default`',           inline: false },
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
    .setName('welcome')
    .setDescription('⚙️ Configure welcome greeting settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // ── /welcome setup ──
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('✅ Set the welcome channel')
      .addChannelOption(opt => opt
        .setName('channel')
        .setDescription('Select the welcome channel')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
      )
    )

    // ── /welcome remove ──
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('🗑️ Clear the welcome channel configuration')
    )

    // ── /welcome background ──
    .addSubcommand(sub => sub
      .setName('background')
      .setDescription('🖼️ Set welcome background image (PNG/JPG/WEBP, recommended 1280×720 px, max 8MB)')
      .addAttachmentOption(opt => opt
        .setName('image')
        .setDescription('Upload image file (recommended: 1280×720 px, rasio 16:9)')
        .setRequired(true)
      )
    )

    // ── /welcome text ──
    .addSubcommand(sub => sub
      .setName('text')
      .setDescription('✏️ Set welcome message. Use {user}, {server}, {count}')
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
        .setDescription('e.g. Welcome to {server}! You are member #{count}')
        .setRequired(true)
        .setMaxLength(100)
      )
    )

    // ── /welcome color ──
    .addSubcommand(sub => sub
      .setName('color')
      .setDescription('🎨 Set color for the welcome greeting')
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
        .setDescription('Hex color code, e.g. #57f287 or #ffffff')
        .setRequired(true)
        .setMinLength(4)
        .setMaxLength(7)
      )
    )

    // ── /welcome preview ──
    .addSubcommand(sub => sub
      .setName('preview')
      .setDescription('👁️ Preview the welcome image with current settings')
    )

    // ── /welcome reset ──
    .addSubcommand(sub => sub
      .setName('reset')
      .setDescription('♻️ Reset all welcome settings to default')
    ),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── /welcome setup ──
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const cfg     = setConfig(guildId, { welcomeChannelId: channel.id });
      return interaction.reply({
        embeds: [
          viewEmbed(interaction.guild, cfg)
            .setDescription(`✅ **Welcome Channel** set to ${channel}!`),
        ],
        ephemeral: true,
      });
    }

    // ── /welcome remove ──
    if (sub === 'remove') {
      const cfg = setConfig(guildId, { welcomeChannelId: null });
      return interaction.reply({
        embeds: [
          viewEmbed(interaction.guild, cfg)
            .setDescription('🗑️ **Welcome Channel** has been cleared.')
            .setColor(0xed4245),
        ],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // ── /welcome background ──
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
        fs.writeFileSync(getWelcomeBgPath(guildId), buffer);
        return interaction.editReply({
          content:
            `✅ **Welcome** background updated!\n` +
            `Use \`/welcome preview\` to see the result.\n\n` +
            `📐 **Recommended background size:** 1280 × 720 px (16:9)`,
        });
      } catch (err) {
        return interaction.editReply({ content: `❌ Failed to download image: ${err.message}` });
      }
    }

    // ── /welcome text ──
    if (sub === 'text') {
      const target  = interaction.options.getString('target');
      const message = interaction.options.getString('message');

      if (target === 'text') {
        setConfig(guildId, { welcomeEmbedText: message });
        return interaction.editReply({
          content:
            `✅ **Welcome embed text** set to:\n> ${message}\n\n` +
            `Available variables: \`{user}\`, \`{server}\`, \`{count}\``,
        });
      } else {
        setConfig(guildId, { welcomeImgText: message });
        return interaction.editReply({
          content:
            `✅ **Welcome image text** (drawn on image) set to:\n> ${message}\n\n` +
            `Available variables: \`{user}\`, \`{server}\`, \`{count}\``,
        });
      }
    }

    // ── /welcome color ──
    if (sub === 'color') {
      const type       = interaction.options.getString('type');
      const hex        = interaction.options.getString('hex');
      const normalized = parseHex(hex);
      if (!normalized) {
        return interaction.editReply({ content: '❌ Invalid color format! Use hex like `#ffffff` or `#fff`.' });
      }

      if (type === 'text') {
        setConfig(guildId, { welcomeTextColor: normalized });
        return interaction.editReply({
          content:
            `✅ **Welcome text color** (on image) set to **${normalized}**!\n` +
            `Use \`/welcome preview\` to see the result.`,
        });
      } else {
        setConfig(guildId, { welcomeEmbedColor: normalized });
        return interaction.editReply({
          content:
            `✅ **Welcome embed color** set to **${normalized}**!\n` +
            `Use \`/welcome preview\` to see the result.`,
        });
      }
    }

    // ── /welcome preview ──
    if (sub === 'preview') {
      const cfg = getConfig(guildId);
      try {
        const buffer = await generateWelcomeImage({
          avatarURL:   interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
          username:    interaction.member.displayName,
          guildId,
          welcomeText: cfg.welcomeImgText || 'Welcome to {server}! · Member {count}',
          textColor:   cfg.welcomeTextColor || '#ffffff',
          guildName:   interaction.guild.name,
          memberCount: interaction.guild.memberCount,
        });

        const filename   = 'welcome_preview.png';
        const attachment = new AttachmentBuilder(buffer, { name: filename });
        const embedColor = cfg.welcomeEmbedColor || '#ffffff';

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle('👁️ Preview — Welcome Image')
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
            { name: '💬 Embed Text',  value: cfg.welcomeEmbedText  || '`Not set`',           inline: false },
            { name: '🖼️ Image Text',  value: cfg.welcomeImgText    || '`Welcome to {server}! · Member {count}` (default)', inline: false },
          )
          .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) });

        return interaction.editReply({ embeds: [embed], files: [attachment] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Failed to generate preview: ${err.message}` });
      }
    }

    // ── /welcome reset ──
    if (sub === 'reset') {
      const bgPath = getWelcomeBgPath(guildId);
      if (fs.existsSync(bgPath)) fs.unlinkSync(bgPath);

      setConfig(guildId, {
        welcomeEmbedText:  null,
        welcomeImgText:    null,
        welcomeTextColor:  null,
        welcomeEmbedColor: null,
      });

      return interaction.editReply({
        content: '✅ **Welcome** settings have been reset to default.',
      });
    }
  },
};