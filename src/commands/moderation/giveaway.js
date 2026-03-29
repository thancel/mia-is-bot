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

/**
 * Generate a random giveaway ID like "ID-AXFR" (4 uppercase letters).
 */
function generateGiveawayId(existing) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const keys = new Set(Object.keys(existing));
  let id;
  do {
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * 26)];
    id = `ID-${code}`;
  } while (keys.has(id));
  return id;
}

/**
 * Parse a duration string like "1d12h30m" → milliseconds.
 * Supports: d (days), h (hours), m (minutes), s (seconds).
 */
function parseDuration(str) {
  const regex = /(\d+)\s*(d|h|m|s)/gi;
  let total = 0;
  let match;
  while ((match = regex.exec(str)) !== null) {
    const val = parseInt(match[1]);
    switch (match[2].toLowerCase()) {
      case 'd': total += val * 86400000; break;
      case 'h': total += val * 3600000;  break;
      case 'm': total += val * 60000;    break;
      case 's': total += val * 1000;     break;
    }
  }
  return total;
}

/**
 * Format milliseconds to a readable string like "1d 12h 30m".
 */
function formatDuration(ms) {
  const d = Math.floor(ms / 86400000); ms %= 86400000;
  const h = Math.floor(ms / 3600000);  ms %= 3600000;
  const m = Math.floor(ms / 60000);    ms %= 60000;
  const s = Math.floor(ms / 1000);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s && !d && !h) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

/**
 * Parse hex color string → integer.
 */
function parseHexColor(str) {
  if (!str) return null;
  const cleaned = str.replace('#', '');
  const parsed = parseInt(cleaned, 16);
  if (isNaN(parsed) || cleaned.length < 3 || cleaned.length > 6) return null;
  return parsed;
}

/**
 * Build the giveaway embed.
 */
function buildGiveawayEmbed(gw, ended = false) {
  let desc = '';

  if (gw.message) desc += `${gw.message}\n\n`;

  if (ended) {
    desc += gw.winners?.length
      ? `🏆 **Winner(s):** ${gw.winners.map(id => `<@${id}>`).join(', ')}`
      : '❌ No valid entries — no winner could be picked.';
  } else {
    desc += `🎯 React with the button below to enter!\n⏰ Ends: <t:${Math.floor(gw.endTime / 1000)}:R> (<t:${Math.floor(gw.endTime / 1000)}:F>)`;
  }

  const embed = new EmbedBuilder()
    .setColor(ended ? 0x99aab5 : 0x5865f2)
    .setTitle(ended ? `🎉 Giveaway Ended — ${gw.prize}` : `🎉 ${gw.prize}`)
    .setDescription(desc)
    .addFields(
      { name: '🏆 Winners',      value: `${gw.winnerCount}`,       inline: true },
      { name: '🎟️ Entries',      value: `${gw.entries.length}`,    inline: true },
      { name: '🎗️ Hosted by',    value: `<@${gw.hostId}>`,         inline: true },
    )
    .setFooter({ text: gw.giveawayId })
    .setTimestamp(ended ? new Date() : new Date(gw.endTime));
  return embed;
}

/**
 * Build the enter button row.
 */
function buildGiveawayButton(gw, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gw_enter_${gw.giveawayId}`)
      .setLabel(`🎉 Enter (${gw.entries.length})`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled)
  );
}

/**
 * Pick unique random winners from entries.
 */
function pickWinners(entries, count) {
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * End a giveaway: pick winners, edit embed, save to DB.
 */
async function endGiveaway(client, guildId, giveawayId) {
  const cfg = await db.getGuildConfig(guildId);
  const giveaways = cfg.giveaways || {};
  const gw = giveaways[giveawayId];
  if (!gw || gw.ended) return;

  // Pick winners
  const winners = pickWinners(gw.entries, gw.winnerCount);
  gw.winners = winners;
  gw.ended = true;
  await db.setGuildConfig(guildId, { giveaways });

  // Edit the message
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const channel = guild.channels.cache.get(gw.channelId);
    if (!channel) return;
    const message = await channel.messages.fetch(gw.messageId).catch(() => null);
    if (!message) return;

    const embed = buildGiveawayEmbed(gw, true);
    const row = buildGiveawayButton(gw, true);
    await message.edit({ embeds: [embed], components: [row] });

    // Announce winners
    if (winners.length > 0) {
      await channel.send({
        content: `🎉 Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${gw.prize}**!`,
        allowedMentions: { users: winners },
      });
    } else {
      await channel.send(`😢 Giveaway for **${gw.prize}** ended but there were no entries.`);
    }
  } catch (err) {
    console.error(`❌ Failed to end giveaway ${giveawayId}:`, err.message);
  }

  // Clear timer
  if (client.giveawayTimers?.has(giveawayId)) {
    clearTimeout(client.giveawayTimers.get(giveawayId));
    client.giveawayTimers.delete(giveawayId);
  }

  console.log(`🎉 Giveaway ${giveawayId} ended — ${winners.length} winner(s)`);
}

/**
 * Schedule a giveaway timer (or end immediately if overdue).
 */
function scheduleGiveaway(client, guildId, gw) {
  if (gw.ended) return;

  if (!client.giveawayTimers) client.giveawayTimers = new Map();

  const remaining = gw.endTime - Date.now();

  if (remaining <= 0) {
    // Overdue — end immediately
    endGiveaway(client, guildId, gw.giveawayId);
    return;
  }

  // Cap at 24h intervals to avoid setTimeout overflow for very long durations
  const MAX_TIMEOUT = 86400000; // 24h
  if (remaining > MAX_TIMEOUT) {
    const timer = setTimeout(() => scheduleGiveaway(client, guildId, gw), MAX_TIMEOUT);
    client.giveawayTimers.set(gw.giveawayId, timer);
  } else {
    const timer = setTimeout(() => endGiveaway(client, guildId, gw.giveawayId), remaining);
    client.giveawayTimers.set(gw.giveawayId, timer);
  }
}

// ── Command ────────────────────────────────────────────────────────────────

module.exports = {
  // Export helpers for use in ready.js and interactionCreate.js
  endGiveaway,
  scheduleGiveaway,
  pickWinners,
  buildGiveawayEmbed,
  buildGiveawayButton,

  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('🎉 Manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // /giveaway start
    .addSubcommand(sub => sub
      .setName('start')
      .setDescription('🎁 Start a new giveaway')
      .addStringOption(opt => opt
        .setName('prize')
        .setDescription('What are you giving away?')
        .setRequired(true)
        .setMaxLength(256))
      .addStringOption(opt => opt
        .setName('duration')
        .setDescription('Duration (e.g. 1h, 30m, 1d12h, 2d)')
        .setRequired(true))
      .addChannelOption(opt => opt
        .setName('channel')
        .setDescription('Channel to host the giveaway in')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addIntegerOption(opt => opt
        .setName('winners')
        .setDescription('Number of winners (default: 1)')
        .setMinValue(1)
        .setMaxValue(20))
      .addStringOption(opt => opt
        .setName('message')
        .setDescription('Custom message for the giveaway (supports {nl} for new line)')
        .setMaxLength(1024))
    )

    // /giveaway end
    .addSubcommand(sub => sub
      .setName('end')
      .setDescription('⏹️ End a giveaway early')
      .addStringOption(opt => opt
        .setName('giveaway_id')
        .setDescription('Giveaway ID (e.g. ID-ABCD)')
        .setRequired(true)
        .setAutocomplete(true))
    )

    // /giveaway reroll
    .addSubcommand(sub => sub
      .setName('reroll')
      .setDescription('🔄 Reroll winner(s) for an ended giveaway')
      .addStringOption(opt => opt
        .setName('giveaway_id')
        .setDescription('Giveaway ID (e.g. ID-ABCD)')
        .setRequired(true)
        .setAutocomplete(true))
    )

    // /giveaway delete
    .addSubcommand(sub => sub
      .setName('delete')
      .setDescription('🗑️ Cancel and delete a giveaway')
      .addStringOption(opt => opt
        .setName('giveaway_id')
        .setDescription('Giveaway ID (e.g. ID-ABCD)')
        .setRequired(true)
        .setAutocomplete(true))
    )

    // /giveaway list
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('📋 List all giveaways in this server')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const cfg = await db.getGuildConfig(interaction.guild.id);
    const giveaways = cfg.giveaways || {};

    // ── start ────────────────────────────────────────────────────────────────
    if (sub === 'start') {
      const prize       = interaction.options.getString('prize');
      const durationStr = interaction.options.getString('duration');
      const channel     = interaction.options.getChannel('channel');
      const winnerCount = interaction.options.getInteger('winners') || 1;
      const rawMessage  = interaction.options.getString('message') || null;
      const message     = rawMessage ? rawMessage.replace(/\{nl\}/gi, '\n') : null;

      const durationMs = parseDuration(durationStr);
      if (durationMs < 10000) { // min 10 seconds
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(
            '❌ Duration too short. Minimum is **10s**.\nFormat: `1h`, `30m`, `1d12h`, `2d`'
          )],
          flags: MessageFlags.Ephemeral,
        });
      }
      if (durationMs > 30 * 86400000) { // max 30 days
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ Duration too long. Maximum is **30 days**.')],
          flags: MessageFlags.Ephemeral,
        });
      }


      const giveawayId = generateGiveawayId(giveaways);
      const endTime = Date.now() + durationMs;

      const gw = {
        giveawayId,
        channelId: channel.id,
        messageId: null,
        prize,
        endTime,
        winnerCount,
        entries: [],
        ended: false,
        hostId: interaction.user.id,
        hostTag: interaction.user.tag,
        message,
        winners: [],
      };

      const embed = buildGiveawayEmbed(gw);
      const row = buildGiveawayButton(gw);

      const sent = await channel.send({ embeds: [embed], components: [row] });
      gw.messageId = sent.id;

      giveaways[giveawayId] = gw;
      await db.setGuildConfig(interaction.guild.id, { giveaways });

      // Schedule the timer
      scheduleGiveaway(client, interaction.guild.id, gw);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('✅ Giveaway Started')
          .setDescription(
            `Giveaway has been created in ${channel}!\n\n` +
            `**ID:** \`${giveawayId}\`\n` +
            `**Prize:** ${prize}\n` +
            `**Duration:** ${formatDuration(durationMs)}\n` +
            `**Winners:** ${winnerCount}\n` +
            `**Ends:** <t:${Math.floor(endTime / 1000)}:R>`
          )
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── end ──────────────────────────────────────────────────────────────────
    if (sub === 'end') {
      const id = interaction.options.getString('giveaway_id').toUpperCase();
      const gw = giveaways[id];

      if (!gw) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ Giveaway \`${id}\` not found.`)],
          flags: MessageFlags.Ephemeral,
        });
      }
      if (gw.ended) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ Giveaway \`${id}\` has already ended.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      await endGiveaway(client, interaction.guild.id, id);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57f287)
          .setDescription(`✅ Giveaway \`${id}\` has been ended early.`)
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── reroll ───────────────────────────────────────────────────────────────
    if (sub === 'reroll') {
      const id = interaction.options.getString('giveaway_id').toUpperCase();
      const gw = giveaways[id];

      if (!gw) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ Giveaway \`${id}\` not found.`)],
          flags: MessageFlags.Ephemeral,
        });
      }
      if (!gw.ended) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ Giveaway \`${id}\` hasn't ended yet. Use \`/giveaway end\` first.`)],
          flags: MessageFlags.Ephemeral,
        });
      }
      if (gw.entries.length === 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ No entries to reroll from.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      const newWinners = pickWinners(gw.entries, gw.winnerCount);
      gw.winners = newWinners;
      await db.setGuildConfig(interaction.guild.id, { giveaways });

      // Update embed
      try {
        const channel = interaction.guild.channels.cache.get(gw.channelId);
        if (channel) {
          const msg = await channel.messages.fetch(gw.messageId).catch(() => null);
          if (msg) {
            const embed = buildGiveawayEmbed(gw, true);
            const row = buildGiveawayButton(gw, true);
            await msg.edit({ embeds: [embed], components: [row] });
          }
          // Announce new winners
          await channel.send({
            content: `🔄 Giveaway rerolled! New winner(s): ${newWinners.map(id => `<@${id}>`).join(', ')} for **${gw.prize}**!`,
            allowedMentions: { users: newWinners },
          });
        }
      } catch {}

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57f287)
          .setDescription(`✅ Rerolled giveaway \`${id}\`.\n🏆 New winner(s): ${newWinners.map(id => `<@${id}>`).join(', ')}`)
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── delete ───────────────────────────────────────────────────────────────
    if (sub === 'delete') {
      const id = interaction.options.getString('giveaway_id').toUpperCase();
      const gw = giveaways[id];

      if (!gw) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ Giveaway \`${id}\` not found.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Clear timer
      if (client.giveawayTimers?.has(id)) {
        clearTimeout(client.giveawayTimers.get(id));
        client.giveawayTimers.delete(id);
      }

      // Delete message
      try {
        const channel = interaction.guild.channels.cache.get(gw.channelId);
        if (channel) {
          const msg = await channel.messages.fetch(gw.messageId).catch(() => null);
          if (msg) await msg.delete();
        }
      } catch {}

      delete giveaways[id];
      await db.setGuildConfig(interaction.guild.id, { giveaways });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('🗑️ Giveaway Deleted')
          .setDescription(`Giveaway \`${id}\` has been cancelled and deleted.`)
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── list ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const entries = Object.entries(giveaways);

      if (entries.length === 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(randomColor())
            .setTitle('📋 Giveaways')
            .setDescription('No giveaways yet.\n\nUse `/giveaway start` to create one!')
            .setTimestamp()],
          flags: MessageFlags.Ephemeral,
        });
      }

      const active = entries.filter(([, g]) => !g.ended);
      const ended  = entries.filter(([, g]) => g.ended);

      let desc = '';
      if (active.length > 0) {
        desc += '**🟢 Active**\n' + active.map(([id, g]) =>
          `\`${id}\` — **${g.prize}** • ${g.entries.length} entries • Ends <t:${Math.floor(g.endTime / 1000)}:R>`
        ).join('\n') + '\n\n';
      }
      if (ended.length > 0) {
        desc += '**⚫ Ended**\n' + ended.slice(-5).map(([id, g]) =>
          `\`${id}\` — **${g.prize}** • 🏆 ${g.winners?.map(w => `<@${w}>`).join(', ') || 'None'}`
        ).join('\n');
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(randomColor())
          .setTitle('📋 Giveaways')
          .setDescription(desc)
          .setFooter({ text: `${active.length} active • ${ended.length} ended` })
          .setTimestamp()],
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toUpperCase();
    const cfg = await db.getGuildConfig(interaction.guild.id);
    const giveaways = cfg.giveaways || {};

    const sub = interaction.options.getSubcommand();
    const choices = Object.entries(giveaways)
      .filter(([, g]) => {
        if (sub === 'end') return !g.ended;      // only active for "end"
        if (sub === 'reroll') return g.ended;     // only ended for "reroll"
        return true;                              // all for "delete"
      })
      .map(([id, g]) => ({
        name: `${id} — ${g.prize}${g.ended ? ' (ended)' : ''}`,
        value: id,
      }));

    const filtered = choices
      .filter(c => c.name.toUpperCase().includes(focused) || c.value.includes(focused))
      .slice(0, 25);

    await interaction.respond(filtered);
  },
};
