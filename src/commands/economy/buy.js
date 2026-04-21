const { SlashCommandBuilder } = require('discord.js');
const db = require('../../db');
const { fixedEmbed } = require('../../utils/embedUtils');
const { SHOP_ITEMS } = require('../../utils/economyItems');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('🛍️ Purchase items in bulk or by ID')
    .addStringOption(opt => opt.setName('item')
      .setDescription('The item to purchase')
      .setRequired(true)
      .setAutocomplete(true)
    )
    .addStringOption(opt => opt.setName('amount')
      .setDescription('Quantity to buy (number or "all")')
      .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();
    const itemId = interaction.options.getString('item');
    const amountInput = interaction.options.getString('amount') || '1';
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return interaction.editReply({ embeds: fixedEmbed(0xED4245, '❌ Invalid item.'), ephemeral: true });

    const data = await db.getEconomy(guildId, userId);
    let quantity = 0;

    if (amountInput.toLowerCase() === 'all') {
      quantity = Math.floor(data.balance / item.price);
    } else {
      quantity = parseInt(amountInput);
    }

    if (isNaN(quantity) || quantity <= 0) {
      return interaction.editReply({ embeds: fixedEmbed(0xED4245, '❌ Please provide a valid quantity.'), ephemeral: true });
    }

    // Limit non-stackable items
    const inventory = data.inventory || [];
    if (!item.stackable) {
      if (itemId.startsWith('rod_')) {
        const fishingData = require('../../data/fishing.json');
        const rodStats = fishingData.rods.find(r => r.id === itemId);
        const currentDur = (data.rodDurability || {})[itemId] || 0;
        const maxStackDur = rodStats.durability * 3;
        
        if (currentDur >= maxStackDur) {
          return interaction.editReply({ embeds: fixedEmbed(0xED4245, `❌ Your **${item.name}** durability is already at maximum (3x)!`), ephemeral: true });
        }
        
        if (quantity > 3) {
           return interaction.editReply({ embeds: fixedEmbed(0xED4245, `❌ You can only stack up to **3x** durability.`), ephemeral: true });
        }
      } else {
        if (quantity > 1) {
          return interaction.editReply({ embeds: fixedEmbed(0xED4245, `❌ You can only own one **${item.name}**.`), ephemeral: true });
        }
        if (inventory.includes(itemId)) {
          return interaction.editReply({ embeds: fixedEmbed(0xED4245, `❌ You already own a **${item.name}**.`), ephemeral: true });
        }
      }
    }

    const totalCost = item.price * quantity;
    if (data.balance < totalCost) {
      return interaction.editReply({ embeds: fixedEmbed(0xED4245, `❌ You don't have enough money! Total cost for ${quantity}x is **$${totalCost.toLocaleString()}**.`), ephemeral: true });
    }

    // Process Purchase
    let updates = { balance: data.balance - totalCost };
    const newInventory = [...inventory];

    for (let i = 0; i < quantity; i++) newInventory.push(itemId);
    updates.inventory = newInventory;

    // If it's a rod, set durability
    if (itemId.startsWith('rod_')) {
      const fishingData = require('../../data/fishing.json');
      const rodStats = fishingData.rods.find(r => r.id === itemId);
      if (rodStats) {
        const rodDurability = data.rodDurability || {};
        const maxStackDur = rodStats.durability * 3;
        rodDurability[itemId] = Math.min(maxStackDur, (rodDurability[itemId] || 0) + (rodStats.durability * quantity));
        updates.rodDurability = rodDurability;
      }
    }

    await db.updateEconomy(guildId, userId, updates);

    return interaction.editReply({ 
      embeds: fixedEmbed(0x57F287, `✅ You successfully bought **${quantity}x ${item.name}** for **$${totalCost.toLocaleString()}**!\nUse \`/inventory\` to see your items and manage your equipment.`)
    });
  },

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const data = await db.getEconomy(guildId, userId);
    const hasATM = (data.inventory || []).includes('atm_card');

    let filtered = SHOP_ITEMS;
    // Hide ATM if already owned
    if (hasATM) {
      filtered = filtered.filter(i => i.id !== 'atm_card');
    }

    // Filter by typing
    filtered = filtered.filter(i => 
      i.name.toLowerCase().includes(focusedValue) || 
      i.id.toLowerCase().includes(focusedValue)
    );

    await interaction.respond(
      filtered.slice(0, 25).map(i => ({ name: `${i.name} ($${i.price})`, value: i.id }))
    );
  },
};
