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
  generateGoodbyeImage,
  getWelcomeBgPath,
  getGoodbyeBgPath,
} = require('../../utils/welcomeImage');

// ============================================================
// /greet — All Welcome, Goodbye & server greeting settings
//
// Subcommands:
// • setup    — Setup a greeting channel (welcome/goodbye/log)
// • remove   — Remove/clear a greeting channel
// • background — Set background image (PNG/JPG/WEBP, max 8MB)
// • color    — Set text color (hex)
// • text     — Set greeting message (use {user}, {server}, {count})
// • preview  — Preview greeting image
// • reset    — Reset settings (welcome/goodbye/all)
// • view     — View all current settings
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
    .setColor(0x5865f2)
    .setTitle('⚙️ Greet Settings')
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: '👋 Welcome Channel', value: display(cfg.welcomeChannelId), inline: true  },
      { name: '👋 Goodbye Channel', value: display(cfg.goodbyeChannelId), inline: true  },
      { name: '📋 Log Channel',     value: display(cfg.logChannelId),     inline: true  },
      { name: '🟢 Welcome Text',    value: cfg.welcomeText || '`Default`', inline: false },
      { name: '🔴 Goodbye Text',    value: cfg.goodbyeText || '`Default`', inline: false },
    )
    .setFooter({ text: cfg.updatedAt
      ? `Last updated: ${new Date(cfg.updatedAt).toLocaleString('en-US')}`
      : 'Never configured',
    });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greet')
    .setDescription('⚙️ Configure Welcome, Goodbye & server greeting settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // ── /greet setup ──
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('✅ Setup a greeting channel')
      .addStringOption(opt => opt
        .setName('type')
        .setDescription('Which channel type?')
        .setRequired(true)
        .addChoices(
          { name: '👋 Welcome', value: 'welcome' },
          { name: '👋 Goodbye', value: 'goodbye' },
          { name: '📋 Log',     value: 'log'     },
        )
      )
      .addChannelOption(opt => opt
        .setName('channel')
        .setDescription('Select the target channel')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
      )
    )

    // ── /greet remove ──
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('🗑️ Remove/clear a greeting channel configuration')
      .addStringOption(opt => opt
        .setName('type')
        .setDescription('Which channel type to remove?')
        .setRequired(true)
        .addChoices(
          { name: '👋 Welcome', value: 'welcome' },
          { name: '👋 Goodbye', value: 'goodbye' },
          { name: '📋 Log',     value: 'log'     },
        )
      )
    )

    // ── /greet background ──
    .addSubcommand(sub => sub
      .setName('background')
      .setDescription('🖼️ Set greeting background image (PNG/JPG/WEBP, recommended 1000×400 px, max 8MB)')
      .addAttachmentOption(opt => opt
        .setName('image')
        .setDescription('Upload image file (recommended: 1000×400 px)')
        .setRequired(true)
      )
      .addStringOption(opt => opt
        .setName('type')
        .setDescription('Apply to welcome or goodbye? (default: welcome)')
        .setRequired(false)
        .addChoices(
          { name: '🟢 Welcome', value: 'welcome' },
          { name: '🔴 Goodbye', value: 'goodbye' },
        )
      )
    )

    // ── /greet color ──
    .addSubcommand(sub => sub
      .setName('color')
      .setDescription('🎨 Set text color on the greeting image')
      .addStringOption(opt => opt
        .setName('hex')
        .setDescription('Hex color code, e.g. #ffffff or #ff0000')
        .setRequired(true)
        .setMinLength(4)
        .setMaxLength(7)
      )
      .addStringOption(opt => opt
        .setName('type')
        .setDescription('Apply to welcome or goodbye? (default: welcome)')
        .setRequired(false)
        .addChoices(
          { name: '🟢 Welcome', value: 'welcome' },
          { name: '🔴 Goodbye', value: 'goodbye' },
        )
      )
    )

    // ── /greet text ──
    .addSubcommand(sub => sub
      .setName('text')
      .setDescription('✏️ Set greeting message text. Use {user}, {server}, {count}')
      .addStringOption(opt => opt
        .setName('message')
        .setDescription('e.g. Welcome to {server}! You are member {count}')
        .setRequired(true)
        .setMaxLength(100)
      )
      .addStringOption(opt => opt
        .setName('type')
        .setDescription('Apply to welcome or goodbye? (default: welcome)')
        .setRequired(false)
        .addChoices(
          { name: '🟢 Welcome', value: 'welcome' },
          { name: '🔴 Goodbye', value: 'goodbye' },
        )
      )
    )

    // ── /greet preview ──
    .addSubcommand(sub => sub
      .setName('preview')
      .setDescription('👁️ Preview the greeting image with current settings')
      .addStringOption(opt => opt
        .setName('type')
        .setDescription('Preview welcome or goodbye? (default: welcome)')
        .setRequired(false)
        .addChoices(
          { name: '🟢 Welcome', value: 'welcome' },
          { name: '🔴 Goodbye', value: 'goodbye' },
        )
      )
    )

    // ── /greet reset ──
    .addSubcommand(sub => sub
      .setName('reset')
      .setDescription('♻️ Reset greeting image settings to default')
      .addStringOption(opt => opt
        .setName('type')
        .setDescription('Which settings to reset?')
        .setRequired(true)
        .addChoices(
          { name: '🟢 Welcome only', value: 'welcome' },
          { name: '🔴 Goodbye only', value: 'goodbye' },
          { name: '🔁 Reset both',   value: 'all'     },
        )
      )
    )

    // ── /greet view ──
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('👁️ View all current greet settings')
    ),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── /greet setup ──
    if (sub === 'setup') {
      const type     = interaction.options.getString('type');
      const channel  = interaction.options.getChannel('channel');

      const keyMap   = { welcome: 'welcomeChannelId', goodbye: 'goodbyeChannelId', log: 'logChannelId' };
      const labelMap = { welcome: 'Welcome', goodbye: 'Goodbye', log: 'Log' };
      const colorMap = { welcome: 0x57f287, goodbye: 0xed4245, log: 0x5865f2 };

      const cfg = setConfig(guildId, { [keyMap[type]]: channel.id });
      return interaction.reply({
        embeds: [
          viewEmbed(interaction.guild, cfg)
            .setDescription(`✅ **${labelMap[type]} Channel** set to ${channel}!`)
            .setColor(colorMap[type]),
        ],
        ephemeral: true,
      });
    }

    // ── /greet remove ──
    if (sub === 'remove') {
      const type = interaction.options.getString('type');
      const keyMap = { welcome: 'welcomeChannelId', goodbye: 'goodbyeChannelId', log: 'logChannelId' };
      const labels = { welcome: 'Welcome Channel',  goodbye: 'Goodbye Channel',  log: 'Log Channel'  };

      const cfg = setConfig(guildId, { [keyMap[type]]: null });
      return interaction.reply({
        embeds: [
          viewEmbed(interaction.guild, cfg)
            .setDescription(`🗑️ **${labels[type]}** has been cleared.`)
            .setColor(0xed4245),
        ],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const type      = interaction.options.getString('type') ?? 'welcome';
    const isWelcome = type === 'welcome';

    // ── /greet background ──
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
        const bgPath = isWelcome ? getWelcomeBgPath(guildId) : getGoodbyeBgPath(guildId);
        fs.writeFileSync(bgPath, buffer);
        return interaction.editReply({
          content:
            `✅ **${isWelcome ? 'Welcome' : 'Goodbye'}** background updated!\n` +
            `Use \`/greet preview type:${type}\` to see the result.\n\n` +
            `📐 **Recommended background size:** 1000 × 400 px`,
        });
      } catch (err) {
        return interaction.editReply({ content: `❌ Failed to download image: ${err.message}` });
      }
    }

    // ── /greet color ──
    if (sub === 'color') {
      const hex = interaction.options.getString('hex').trim();
      if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
        return interaction.editReply({ content: '❌ Invalid color format! Use hex like `#ffffff` or `#fff`.' });
      }
      const normalized = hex.length === 4
        ? '#' + [...hex.slice(1)].map(c => c + c).join('')
        : hex;

      setConfig(guildId, isWelcome ? { welcomeColor: normalized } : { goodbyeColor: normalized });
      return interaction.editReply({
        content:
          `✅ **${isWelcome ? 'Welcome' : 'Goodbye'}** text color set to **${normalized}**!\n` +
          `Use \`/greet preview type:${type}\` to see the result.`,
      });
    }

    // ── /greet text ──
    if (sub === 'text') {
      const message = interaction.options.getString('message');
      setConfig(guildId, isWelcome ? { welcomeText: message } : { goodbyeText: message });
      return interaction.editReply({
        content:
          `✅ **${isWelcome ? 'Welcome' : 'Goodbye'}** message set to:\n> ${message}\n\n` +
          `Available variables: \`{user}\`, \`{server}\`, \`{count}\``,
      });
    }

    // ── /greet preview ──
    if (sub === 'preview') {
      const cfg = getConfig(guildId);
      try {
        let buffer, filename;

        if (isWelcome) {
          buffer = await generateWelcomeImage({
            avatarURL:   interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
            username:    interaction.member.displayName,
            guildId,
            welcomeText: cfg.welcomeText || 'Welcome to {server}! · Member {count}',
            textColor:   cfg.welcomeColor || '#ffffff',
            guildName:   interaction.guild.name,
            memberCount: interaction.guild.memberCount,
          });
          filename = 'welcome_preview.png';
        } else {
          buffer = await generateGoodbyeImage({
            avatarURL:   interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
            username:    interaction.member.displayName,
            guildId,
            goodbyeText: cfg.goodbyeText || 'See you next time, {user}!',
            textColor:   cfg.goodbyeColor || '#ffffff',
            guildName:   interaction.guild.name,
            memberCount: interaction.guild.memberCount,
          });
          filename = 'goodbye_preview.png';
        }

        const attachment = new AttachmentBuilder(buffer, { name: filename });
        const colorVal = isWelcome ? cfg.welcomeColor : cfg.goodbyeColor;
        const textVal = isWelcome ? cfg.welcomeText : cfg.goodbyeText;
        const defaultTxt = isWelcome
          ? 'Welcome to {server}! · Member {count}'
          : 'See you next time, {user}!';

        const embed = new EmbedBuilder()
          .setColor(colorVal || (isWelcome ? '#57f287' : '#ed4245'))
          .setTitle(`👁️ Preview — ${isWelcome ? 'Welcome' : 'Goodbye'} Image`)
          .setImage(`attachment://${filename}`)
          .addFields(
            { name: '🎨 Text Color', value: colorVal || '`#ffffff` (default)', inline: true },
            { name: '✏️ Message',    value: textVal || `\`${defaultTxt}\` (default)`, inline: false },
          )
          .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) });

        return interaction.editReply({ embeds: [embed], files: [attachment] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Failed to generate preview: ${err.message}` });
      }
    }

    // ── /greet reset ──
    if (sub === 'reset') {
      const resetType = interaction.options.getString('type');

      if (resetType === 'welcome' || resetType === 'all') {
        const bgPath = getWelcomeBgPath(guildId);
        if (fs.existsSync(bgPath)) fs.unlinkSync(bgPath);
        setConfig(guildId, { welcomeColor: null, welcomeText: null });
      }
      if (resetType === 'goodbye' || resetType === 'all') {
        const bgPath = getGoodbyeBgPath(guildId);
        if (fs.existsSync(bgPath)) fs.unlinkSync(bgPath);
        setConfig(guildId, { goodbyeColor: null, goodbyeText: null });
      }

      const label = resetType === 'all'
        ? 'Welcome & Goodbye'
        : (resetType === 'welcome' ? 'Welcome' : 'Goodbye');
      return interaction.editReply({
        content: `✅ **${label}** image settings have been reset to default.`,
      });
    }

    // ── /greet view ──
    if (sub === 'view') {
      const cfg = getConfig(guildId);
      return interaction.editReply({ embeds: [viewEmbed(interaction.guild, cfg)] });
    }
  },
};
