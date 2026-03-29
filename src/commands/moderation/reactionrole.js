const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
} = require('discord.js');
const db = require('../../db');
const { randomColor } = require('../../utils/embedUtils');

// ── Helpers ────────────────────────────────────────────────────────────────

const STYLE_MAP = {
  blurple: ButtonStyle.Primary,
  grey:    ButtonStyle.Secondary,
  green:   ButtonStyle.Success,
  red:     ButtonStyle.Danger,
};

/**
 * Generate a random panel ID like "ID-4829"
 * Ensures uniqueness against existing panels.
 */
function generatePanelId(existingPanels) {
  const existing = new Set(Object.keys(existingPanels));
  let id;
  do {
    const num = Math.floor(1000 + Math.random() * 9000); // 1000–9999
    id = `ID-${num}`;
  } while (existing.has(id));
  return id;
}

/**
 * Parse hex color string → integer. Returns null on invalid input.
 */
function parseHexColor(str) {
  if (!str) return null;
  const cleaned = str.replace('#', '');
  const parsed = parseInt(cleaned, 16);
  if (isNaN(parsed) || cleaned.length < 3 || cleaned.length > 6) return null;
  return parsed;
}

/**
 * Rebuild the ActionRow(s) of buttons for a reaction-role panel.
 * Discord allows max 5 buttons per row, and max 5 rows = 25 buttons.
 */
function buildButtonRows(roles) {
  const rows = [];
  for (let i = 0; i < roles.length; i += 5) {
    const row = new ActionRowBuilder();
    const chunk = roles.slice(i, i + 5);
    for (const r of chunk) {
      const btn = new ButtonBuilder()
        .setCustomId(`rr_${r.roleId}`)
        .setLabel(r.label)
        .setStyle(r.style || ButtonStyle.Secondary);
      if (r.emoji) btn.setEmoji(r.emoji);
      row.addComponents(btn);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Rebuild the embed for a panel.
 */
function buildPanelEmbed(panel) {
  return new EmbedBuilder()
    .setTitle(panel.title)
    .setDescription(panel.description || 'Click a button below to get or remove a role.')
    .setColor(panel.color || 0x5865f2)
    .setFooter({ text: `🏷️ Click to toggle a role • ${panel.panelId || ''}` })
    .setTimestamp();
}

/**
 * Edit/refresh the panel message in Discord.
 */
async function refreshPanel(guild, panel) {
  try {
    const channel = guild.channels.cache.get(panel.channelId);
    if (!channel) return false;
    const message = await channel.messages.fetch(panel.messageId).catch(() => null);
    if (!message) return false;

    const embed = buildPanelEmbed(panel);
    const rows = buildButtonRows(panel.roles);

    await message.edit({ embeds: [embed], components: rows });
    return true;
  } catch {
    return false;
  }
}

/**
 * Find a panel by its panelId (e.g. "ID-4829") from the panels object.
 * Returns [panelId, panelData] or [null, null].
 */
function findPanel(panels, panelId) {
  const key = panelId.toUpperCase();
  if (panels[key]) return [key, panels[key]];
  return [null, null];
}

// ── Command ────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('🏷️ Create button-based role panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

    // /reactionrole create
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('📝 Create a new reaction-role panel')
      .addChannelOption(opt => opt
        .setName('channel')
        .setDescription('Channel to send the panel in')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addStringOption(opt => opt
        .setName('title')
        .setDescription('Panel title')
        .setRequired(true)
        .setMaxLength(256))
      .addStringOption(opt => opt
        .setName('description')
        .setDescription('Panel description (supports {nl} for new line)')
        .setMaxLength(2048))
      .addStringOption(opt => opt
        .setName('color')
        .setDescription('Embed hex color (e.g. #5865F2)')
        .setMaxLength(7))
    )

    // /reactionrole add
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('➕ Add a role button to an existing panel')
      .addStringOption(opt => opt
        .setName('panel_id')
        .setDescription('Panel ID (e.g. ID-1234)')
        .setRequired(true)
        .setAutocomplete(true))
      .addRoleOption(opt => opt
        .setName('role')
        .setDescription('Role to assign/remove on click')
        .setRequired(true))
      .addStringOption(opt => opt
        .setName('label')
        .setDescription('Button label text')
        .setRequired(true)
        .setMaxLength(80))
      .addStringOption(opt => opt
        .setName('emoji')
        .setDescription('Button emoji (e.g. 🎮 or custom emoji)')
        .setMaxLength(50))
      .addStringOption(opt => opt
        .setName('style')
        .setDescription('Button color style')
        .addChoices(
          { name: '🔵 Blurple', value: 'blurple' },
          { name: '⚪ Grey',    value: 'grey' },
          { name: '🟢 Green',   value: 'green' },
          { name: '🔴 Red',     value: 'red' },
        ))
    )

    // /reactionrole remove
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('➖ Remove a role button from a panel')
      .addStringOption(opt => opt
        .setName('panel_id')
        .setDescription('Panel ID (e.g. ID-1234)')
        .setRequired(true)
        .setAutocomplete(true))
      .addRoleOption(opt => opt
        .setName('role')
        .setDescription('Role to remove from the panel')
        .setRequired(true))
    )

    // /reactionrole edit
    .addSubcommand(sub => sub
      .setName('edit')
      .setDescription('✏️ Edit a panel\'s title, description, or color')
      .addStringOption(opt => opt
        .setName('panel_id')
        .setDescription('Panel ID (e.g. ID-1234)')
        .setRequired(true)
        .setAutocomplete(true))
      .addStringOption(opt => opt
        .setName('title')
        .setDescription('New title')
        .setMaxLength(256))
      .addStringOption(opt => opt
        .setName('description')
        .setDescription('New description (supports {nl} for new line)')
        .setMaxLength(2048))
      .addStringOption(opt => opt
        .setName('color')
        .setDescription('New embed hex color (e.g. #FF5733)')
        .setMaxLength(7))
    )

    // /reactionrole delete
    .addSubcommand(sub => sub
      .setName('delete')
      .setDescription('🗑️ Delete an entire reaction-role panel')
      .addStringOption(opt => opt
        .setName('panel_id')
        .setDescription('Panel ID (e.g. ID-1234)')
        .setRequired(true)
        .setAutocomplete(true))
    )

    // /reactionrole list
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('📋 List all reaction-role panels in this server')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const cfg = await db.getGuildConfig(interaction.guild.id);
    const panels = cfg.reactionRolePanels || {};

    // ── create ───────────────────────────────────────────────────────────────
    if (sub === 'create') {
      const channel     = interaction.options.getChannel('channel');
      const title       = interaction.options.getString('title');
      const rawDesc     = interaction.options.getString('description') || 'Click a button below to get or remove a role.';
      const description = rawDesc.replace(/\{nl\}/gi, '\n');
      const colorStr    = interaction.options.getString('color');

      let color = 0x5865f2;
      if (colorStr) {
        const parsed = parseHexColor(colorStr);
        if (parsed === null) {
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ Invalid hex color. Use format like `#5865F2`.')],
            flags: MessageFlags.Ephemeral,
          });
        }
        color = parsed;
      }

      const panelId = generatePanelId(panels);
      const panelData = { panelId, channelId: channel.id, messageId: null, title, description, color, roles: [] };

      const embed = buildPanelEmbed(panelData);
      const sent = await channel.send({ embeds: [embed], components: [] });

      panelData.messageId = sent.id;
      panels[panelId] = panelData;
      await db.setGuildConfig(interaction.guild.id, { reactionRolePanels: panels });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('✅ Panel Created')
          .setDescription(
            `Reaction-role panel has been created in ${channel}!\n\n` +
            `**Panel ID:** \`${panelId}\`\n\n` +
            `**Next step:** Add roles using:\n` +
            `\`/reactionrole add panel_id:${panelId} role:@Role label:ButtonText\``
          )
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── add ──────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const panelIdInput = interaction.options.getString('panel_id');
      const role         = interaction.options.getRole('role');
      const label        = interaction.options.getString('label');
      const emoji        = interaction.options.getString('emoji') || null;
      const styleStr     = interaction.options.getString('style') || 'grey';
      const style        = STYLE_MAP[styleStr] || ButtonStyle.Secondary;

      const [panelId, panel] = findPanel(panels, panelIdInput);
      if (!panel) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(
            `❌ Panel \`${panelIdInput}\` not found. Use \`/reactionrole list\` to see all panels.`
          )],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Validations
      if (role.id === interaction.guild.id) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ You cannot add `@everyone` as a reaction role.')],
          flags: MessageFlags.Ephemeral,
        });
      }
      if (role.managed) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ That role is managed by an integration and cannot be used.')],
          flags: MessageFlags.Ephemeral,
        });
      }
      const botMember = interaction.guild.members.me;
      if (botMember.roles.highest.position <= role.position) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(
            `❌ I cannot assign **${role.name}** because it is at or above my highest role.`
          )],
          flags: MessageFlags.Ephemeral,
        });
      }
      if (panel.roles.length >= 25) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ This panel already has the maximum of 25 role buttons.')],
          flags: MessageFlags.Ephemeral,
        });
      }
      if (panel.roles.some(r => r.roleId === role.id)) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ ${role} is already on this panel.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Add the role
      panel.roles.push({ roleId: role.id, label, emoji, style });
      await db.setGuildConfig(interaction.guild.id, { reactionRolePanels: panels });

      const refreshed = await refreshPanel(interaction.guild, panel);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('➕ Role Button Added')
          .setDescription(`${emoji || '🏷️'} **${label}** → ${role}`)
          .addFields(
            { name: '📝 Panel',       value: `\`${panelId}\``,                 inline: true },
            { name: '🎯 Total Roles', value: `\`${panel.roles.length}\` / 25`, inline: true },
            { name: '🔄 Refreshed',   value: refreshed ? '`Yes`' : '`Failed — check if the message still exists`', inline: false },
          )
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── remove ───────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const panelIdInput = interaction.options.getString('panel_id');
      const role         = interaction.options.getRole('role');

      const [panelId, panel] = findPanel(panels, panelIdInput);
      if (!panel) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ Panel \`${panelIdInput}\` not found.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      const idx = panel.roles.findIndex(r => r.roleId === role.id);
      if (idx === -1) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ ${role} is not on this panel.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      panel.roles.splice(idx, 1);
      await db.setGuildConfig(interaction.guild.id, { reactionRolePanels: panels });

      const refreshed = await refreshPanel(interaction.guild, panel);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(randomColor())
          .setTitle('➖ Role Button Removed')
          .setDescription(`Removed ${role} from panel \`${panelId}\`.`)
          .addFields(
            { name: '🎯 Remaining',  value: `\`${panel.roles.length}\` role(s)`, inline: true },
            { name: '🔄 Refreshed',  value: refreshed ? '`Yes`' : '`Failed`',    inline: true },
          )
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── edit ─────────────────────────────────────────────────────────────────
    if (sub === 'edit') {
      const panelIdInput = interaction.options.getString('panel_id');
      const newTitle     = interaction.options.getString('title');
      const rawDesc      = interaction.options.getString('description');
      const newDesc      = rawDesc ? rawDesc.replace(/\{nl\}/gi, '\n') : null;
      const colorStr     = interaction.options.getString('color');

      const [panelId, panel] = findPanel(panels, panelIdInput);
      if (!panel) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ Panel \`${panelIdInput}\` not found.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!newTitle && !newDesc && !colorStr) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ Please provide at least one field to edit (`title`, `description`, or `color`).')],
          flags: MessageFlags.Ephemeral,
        });
      }

      const changes = [];

      if (newTitle) {
        panel.title = newTitle;
        changes.push(`📝 **Title** → ${newTitle}`);
      }
      if (newDesc) {
        panel.description = newDesc;
        changes.push(`📄 **Description** → updated`);
      }
      if (colorStr) {
        const parsed = parseHexColor(colorStr);
        if (parsed === null) {
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ Invalid hex color. Use format like `#FF5733`.')],
            flags: MessageFlags.Ephemeral,
          });
        }
        panel.color = parsed;
        changes.push(`🎨 **Color** → \`${colorStr}\``);
      }

      await db.setGuildConfig(interaction.guild.id, { reactionRolePanels: panels });

      const refreshed = await refreshPanel(interaction.guild, panel);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(panel.color || randomColor())
          .setTitle('✏️ Panel Updated')
          .setDescription(`Panel \`${panelId}\` has been updated:\n\n${changes.join('\n')}`)
          .addFields(
            { name: '🔄 Refreshed', value: refreshed ? '`Yes`' : '`Failed — check if the message still exists`', inline: false },
          )
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── delete ───────────────────────────────────────────────────────────────
    if (sub === 'delete') {
      const panelIdInput = interaction.options.getString('panel_id');

      const [panelId, panel] = findPanel(panels, panelIdInput);
      if (!panel) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ Panel \`${panelIdInput}\` not found.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Try to delete the message
      try {
        const channel = interaction.guild.channels.cache.get(panel.channelId);
        if (channel) {
          const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
          if (msg) await msg.delete();
        }
      } catch {}

      delete panels[panelId];
      await db.setGuildConfig(interaction.guild.id, { reactionRolePanels: panels });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('🗑️ Panel Deleted')
          .setDescription(`Panel \`${panelId}\` has been deleted.`)
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── list ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const entries = Object.entries(panels);

      if (entries.length === 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(randomColor())
            .setTitle('📋 Reaction-Role Panels')
            .setDescription('No panels configured yet.\n\nUse `/reactionrole create` to get started!')
            .setTimestamp()],
          flags: MessageFlags.Ephemeral,
        });
      }

      const desc = entries.map(([panelId, panel], i) => {
        const rolesList = panel.roles.length > 0
          ? panel.roles.map(r => `${r.emoji || '🏷️'} ${r.label} → <@&${r.roleId}>`).join('\n')
          : '*No roles added yet*';
        return `**${i + 1}. ${panel.title}** — \`${panelId}\`\n` +
               `📺 <#${panel.channelId}> • 🎨 \`#${(panel.color || 0x5865f2).toString(16).padStart(6, '0')}\`\n` +
               `${rolesList}`;
      }).join('\n\n');

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(randomColor())
          .setTitle('📋 Reaction-Role Panels')
          .setDescription(desc)
          .setFooter({ text: `${entries.length} panel(s)` })
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toUpperCase();
    const cfg = await db.getGuildConfig(interaction.guild.id);
    const panels = cfg.reactionRolePanels || {};

    const choices = Object.entries(panels).map(([id, panel]) => ({
      name: `${id} — ${panel.title}`,
      value: id,
    }));

    const filtered = choices
      .filter(c => c.name.toUpperCase().includes(focused) || c.value.includes(focused))
      .slice(0, 25);

    await interaction.respond(filtered);
  },
};
