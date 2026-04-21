const { SlashCommandBuilder } = require('discord.js');
const db = require('../../db');
const { fixedEmbed } = require('../../utils/embedUtils');
const FISHING_DATA = require('../../data/fishing.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sellfish')
    .setDescription('💰 Sell all your caught fish for profit'),

  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const data = await db.getEconomy(guildId, userId);
    const fishInv = data.fishInventory || [];

    if (fishInv.length === 0) {
      return interaction.editReply({ embeds: fixedEmbed(0xED4245, '❌ You don\'t have any fish to sell!') });
    }

    let totalProfit = 0;
    const itemsSold = fishInv.length;

    fishInv.forEach(id => {
      const fish = FISHING_DATA.fishes.find(f => f.id === parseInt(id));
      if (fish) totalProfit += fish.price;
    });

    await db.updateEconomy(guildId, userId, {
      balance: data.balance + totalProfit,
      fishInventory: [] // Empty the bucket
    });

    return interaction.editReply({ 
      embeds: fixedEmbed(0x57F287, `💰 You sold **${itemsSold} fish** for a total of **$${totalProfit.toLocaleString()}**!`)
    });
  },
};
