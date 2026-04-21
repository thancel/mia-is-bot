const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db');
const { SHOP_ITEMS } = require('../../utils/economyItems');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('👤 View your or another user\'s profile summary')
    .addUserOption(opt => opt.setName('user').setDescription('The user to view the profile of').setRequired(false)),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const target = interaction.options.getUser('user') || interaction.user;
    
    // Fetch data
    const econ = await db.getEconomy(guildId, target.id);
    const guildCfg = await db.getGuildConfig(guildId);
    const triviaScore = (guildCfg.triviaScores || {})[target.id] || 0;
    
    // Apply interest check if it's the target
    const { applyInterest } = require('../economy/deposit');
    const updatedEcon = await applyInterest(guildId, target.id, econ);

    const now = Date.now();
    
    // Calculate boosts
    const activeEffects = [];
    if ((updatedEcon.luckyBoostUntil || 0) > now) {
      const mins = Math.ceil((updatedEcon.luckyBoostUntil - now) / 60000);
      activeEffects.push(`🧪 **Luck Boost** (Gambling) - **${mins}m**`);
    }
    if ((updatedEcon.coffeeFishingUntil || 0) > now) {
      const mins = Math.ceil((updatedEcon.coffeeFishingUntil - now) / 60000);
      activeEffects.push(`☕ **Hot Coffee** (Fish Delay -50%) - **${mins}m**`);
    }
    const boostText = activeEffects.length > 0 ? activeEffects.join('\n') : 'None';

    // Filter Collections (Exclude consumables and rods)
    const excludeIds = ['lucky_potion', 'lucky_charm', 'coffee', 'cookie', 'atm_card'];
    const inventory = updatedEcon.inventory || [];
    const collections = inventory.filter(id => !excludeIds.includes(id) && !id.startsWith('rod_'));
    
    const collectionCounts = {};
    collections.forEach(id => {
      collectionCounts[id] = (collectionCounts[id] || 0) + 1;
    });

    let collectionText = 'No collectibles yet.';
    if (Object.keys(collectionCounts).length > 0) {
      collectionText = Object.entries(collectionCounts)
        .map(([id, count]) => {
          const item = SHOP_ITEMS.find(i => i.id === id);
          return `**${item ? item.name : id}** x${count}`;
        })
        .join(', ');
    }

    const equippedRodId = 'rod_standard';
    const hasRod = (updatedEcon.rodDurability || {})[equippedRodId] > 0;
    const rodName = hasRod ? 'Standard Fishing Rod' : 'None (Use `/shop`)';

    // Bait Display
    const equippedBaitId = updatedEcon.equippedBait;
    const baitItem = SHOP_ITEMS.find(i => i.id === equippedBaitId);
    const baitUses = (updatedEcon.baitUses || {})[equippedBaitId] || 0;
    const gearText = `**Rod:** ${rodName}\n**Bait:** ${baitItem ? `${baitItem.name} (${baitUses} left)` : 'No Bait'}`;

    // ATM Tier Display
    const atmTier = updatedEcon.atmTier;
    const atmItem = SHOP_ITEMS.find(i => i.id === atmTier);
    const ATM_LIMITS = { 'atm_basic': 100000, 'atm_gold': 500000, 'atm_platinum': 10000000, 'atm_black': 100000000 };
    const atmText = atmItem ? `${atmItem.name} (Limit: $${ATM_LIMITS[atmTier].toLocaleString()})` : 'No ATM (Use `/shop`)';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`👤 ${target.username}'s Profile`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .addFields(
        { 
          name: '💰 Economy', 
          value: [
            `💵 **Wallet:** $${updatedEcon.balance.toLocaleString()}`,
            `🏛️ **Bank:** $${updatedEcon.bank.toLocaleString()}`,
            `📊 **Total:** $${(updatedEcon.balance + updatedEcon.bank).toLocaleString()}`
          ].join('\n'), 
          inline: true 
        },
        { 
          name: '🎮 Games & Stats', 
          value: [
            `🏁 **Trivia Score:** ${triviaScore.toLocaleString()}`,
            `🔥 **Daily Streak:** ${updatedEcon.streak || 0} days`,
            `🐟 **Fish Caught:** ${updatedEcon.fish || 0}`
          ].join('\n'), 
          inline: true 
        }
      )
      .addFields(
        { name: '✨ Active Effects', value: boostText, inline: true },
        { name: '🎣 Fishing Gear', value: gearText, inline: true },
        { name: '💳 ATM Banking', value: atmText, inline: false },
        { name: '🏆 Collections', value: collectionText, inline: false }
      )
      .setFooter({ text: `Member since ${interaction.guild.members.cache.get(target.id)?.joinedAt?.toLocaleDateString() || 'Unknown'}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
