const db = require('../db');

/**
 * Clean up reaction-role panel data when the panel message is deleted
 * (manually, via /purge, or any other means).
 */
async function cleanupPanel(message) {
  if (!message.guild) return;

  const cfg = await db.getGuildConfig(message.guild.id);
  let changed = false;

  // ── Reaction Role Panels ──────────────────────────────────────────────
  const panels = cfg.reactionRolePanels || {};
  const panelEntry = Object.entries(panels).find(([, p]) => p.messageId === message.id);
  if (panelEntry) {
    const [panelId] = panelEntry;
    delete panels[panelId];
    changed = true;
    console.log(`🗑️  Auto-cleanup: Reaction-role panel "${panelId}" removed (message deleted)`);
  }

  // ── Giveaways ─────────────────────────────────────────────────────────
  const giveaways = cfg.giveaways || {};
  const gwEntry = Object.entries(giveaways).find(([, g]) => g.messageId === message.id);
  if (gwEntry) {
    const [gwId] = gwEntry;
    // Clear timer if active
    if (message.client?.giveawayTimers?.has(gwId)) {
      clearTimeout(message.client.giveawayTimers.get(gwId));
      message.client.giveawayTimers.delete(gwId);
    }
    delete giveaways[gwId];
    changed = true;
    console.log(`🗑️  Auto-cleanup: Giveaway "${gwId}" removed (message deleted)`);
  }

  if (changed) {
    await db.setGuildConfig(message.guild.id, { reactionRolePanels: panels, giveaways });
  }
}

module.exports = [
  {
    name: 'messageDelete',
    async execute(message) {
      await cleanupPanel(message);
    },
  },
  {
    name: 'messageDeleteBulk',
    async execute(messages) {
      for (const message of messages.values()) {
        await cleanupPanel(message);
      }
    },
  },
];
