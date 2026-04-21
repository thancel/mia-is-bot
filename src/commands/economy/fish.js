const { SlashCommandBuilder } = require('discord.js');
const db = require('../../db');
const { fixedEmbed } = require('../../utils/embedUtils');
const FISHING_DATA = require('../../data/fishing.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fish')
    .setDescription('🎣 Go fishing using your rod and bait!'),

  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const data = await db.getEconomy(guildId, userId);
    
    if (!data.equippedRod) {
      return interaction.editReply({ 
        embeds: fixedEmbed(0xED4245, '❌ You don\'t have a fishing rod! Buy a **Standard Fishing Rod** at the `/shop`.') 
      });
    }

    const rodDurabilityMap = data.rodDurability || {};
    const currentDurability = rodDurabilityMap[data.equippedRod] || 0;

    if (currentDurability <= 0) {
      return interaction.editReply({ 
        embeds: fixedEmbed(0xED4245, `❌ Your **fishing rod** is broken! Buy a new one at the \`/shop\`.`) 
      });
    }

    const now = Date.now();
    const baseCooldown = 15 * 1000;
    const boostCooldown = 7.5 * 1000;
    const isCoffeeActive = (data.coffeeFishingUntil || 0) > now;
    const cooldown = isCoffeeActive ? boostCooldown : baseCooldown;

    if (now - (data.lastFishTask || 0) < cooldown) {
      const remaining = cooldown - (now - (data.lastFishTask || 0));
      return interaction.editReply({ 
        embeds: fixedEmbed(0xED4245, `⏳ Wait **${(remaining / 1000).toFixed(1)} seconds** before fishing again.`) 
      });
    }

    // --- BAIT LOGIC ---
    let activeBait = null;
    let rates = { ...FISHING_DATA.equipment.rod.base_drop_rates };
    
    const equippedBaitId = data.equippedBait;
    const baitUsesMap = data.baitUses || {};
    
    if (equippedBaitId && baitUsesMap[equippedBaitId] > 0) {
      activeBait = FISHING_DATA.equipment.baits.find(b => b.id === equippedBaitId);
      if (activeBait && activeBait.override_drop_rates) {
        rates = { ...activeBait.override_drop_rates };
      }
    }

    const roll = Math.random();
    let accumulated = 0;
    let chosenRarity = 'Junk';
    const order = ['Junk', 'Common', 'Rare', 'Epic', 'Legendary'];
    for (const rarity of order) {
      accumulated += (rates[rarity] || 0);
      if (roll <= accumulated) { chosenRarity = rarity; break; }
    }

    const fishesOfRarity = FISHING_DATA.fishes.filter(f => f.rarity === chosenRarity);
    const caughtFish = fishesOfRarity[Math.floor(Math.random() * fishesOfRarity.length)];

    // Update DB
    const updates = {
      fish: (data.fish || 0) + 1,
      fishInventory: [...(data.fishInventory || []), caughtFish.id],
      lastFishTask: now,
      rodDurability: { ...rodDurabilityMap, [data.equippedRod]: currentDurability - 1 }
    };

    // Use up bait
    if (activeBait && activeBait.id !== 'bait_none') {
      const remainingUses = baitUsesMap[activeBait.id] - 1;
      updates.baitUses = { ...baitUsesMap, [activeBait.id]: remainingUses };
      if (remainingUses <= 0) updates.equippedBait = null;
    }

    await db.updateEconomy(guildId, userId, updates);

    const rarityColors = { Junk: 0x95A5A6, Common: 0x2ECC71, Rare: 0x3498DB, Epic: 0x9B59B6, Legendary: 0xF1C40F };
    let msg = `🎣 You caught a **${caughtFish.rarity} ${caughtFish.name}**! 🐟\n\n`;
    msg += `💰 Worth: **$${caughtFish.price.toLocaleString()}**\n`;
    msg += `🛠️ Durability: **${currentDurability - 1}/${FISHING_DATA.equipment.rod.max_durability}**\n`;
    
    if (activeBait && activeBait.id !== 'bait_none') {
      msg += `🍱 Bait: **${activeBait.name}** (${baitUsesMap[activeBait.id] - 1} left)\n`;
    }
    
    if (currentDurability - 1 === 0) msg += '\n⚠️ **Your rod just broke! Buy a new one at `/shop`.**';

    return interaction.editReply({ embeds: fixedEmbed(rarityColors[caughtFish.rarity] || 0x57F287, msg) });
  },
};
