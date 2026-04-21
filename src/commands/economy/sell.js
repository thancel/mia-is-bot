const { SlashCommandBuilder } = require('discord.js');
const db = require('../../db');
const { fixedEmbed } = require('../../utils/embedUtils');
const { SHOP_ITEMS } = require('../../utils/economyItems');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sell')
    .setDescription('💰 Sell items from your inventory for 75% of their value')
    .addStringOption(opt => opt.setName('item')
      .setDescription('The item to sell')
      .setRequired(true)
      .setAutocomplete(true)
    )
    .addStringOption(opt => opt.setName('amount')
      .setDescription('Quantity to sell (number or "all")')
      .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();
    const itemId = interaction.options.getString('item');
    const amountInput = (interaction.options.getString('amount') || '1').toLowerCase();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return interaction.editReply({ embeds: fixedEmbed(0xED4245, '❌ Invalid item ID.'), ephemeral: true });

    if (itemId.startsWith('rod_')) {
      return interaction.editReply({ embeds: fixedEmbed(0xED4245, '❌ Fishing rods cannot be sold! They will break automatically when durability hits 0.'), ephemeral: true });
    }

    const data = await db.getEconomy(guildId, userId);
    let inventory = [...(data.inventory || [])];
    
    const countOwned = inventory.filter(id => id === itemId).length;

    if (countOwned === 0) {
      return interaction.editReply({ embeds: fixedEmbed(0xED4245, `❌ You don't have any **${item.name}** in your inventory!`), ephemeral: true });
    }

    let quantity = 0;
    if (amountInput === 'all') {
      quantity = countOwned;
    } else {
      quantity = parseInt(amountInput);
    }

    if (isNaN(quantity) || quantity <= 0) {
      return interaction.editReply({ embeds: fixedEmbed(0xED4245, '❌ Please provide a valid quantity.'), ephemeral: true });
    }

    if (quantity > countOwned) {
      return interaction.editReply({ embeds: fixedEmbed(0xED4245, `❌ You only have **${countOwned}x** of this item.`), ephemeral: true });
    }

    // Process Sale (75% value)
    const refundPerItem = item.price * 0.75;
    const totalRefund = Math.floor(refundPerItem * quantity); // Floor to be safe

    // Remove from inventory
    let removed = 0;
    inventory = inventory.filter(id => {
      if (id === itemId && removed < quantity) {
        removed++;
        return false;
      }
      return true;
    });

    const updates = {
      balance: data.balance + totalRefund,
      inventory: inventory
    };

    // If it's a rod, clean up rod data
    if (itemId.startsWith('rod_')) {
      // Unequip if it was the equipped one
      if (data.equippedRod === itemId) {
        updates.equippedRod = null;
      }
      
      // Remove durability entry
      const rodDurability = data.rodDurability || {};
      delete rodDurability[itemId];
      updates.rodDurability = rodDurability;
    }

    await db.updateEconomy(guildId, userId, updates);

    return interaction.editReply({ 
      embeds: fixedEmbed(0x57F287, `✅ You successfully sold **${quantity}x ${item.name}** for **$${totalRefund.toLocaleString()}** (75% value).`)
    });
  },

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const data = await db.getEconomy(guildId, userId);
    const inventory = data.inventory || [];
    
    // Only show items the user actually owns
    const uniqueOwnedIds = [...new Set(inventory)];
    
    let filtered = uniqueOwnedIds
      .map(id => SHOP_ITEMS.find(i => i.id === id))
      .filter(i => i && (i.name.toLowerCase().includes(focusedValue) || i.id.toLowerCase().includes(focusedValue)));

    await interaction.respond(
      filtered.slice(0, 25).map(i => ({ name: `${i.name} ($${(i.price * 0.75).toLocaleString()} each)`, value: i.id }))
    );
  },
};
