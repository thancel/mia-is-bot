const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db');
const { fixedEmbed } = require('../../utils/embedUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('🪙 Flip a coin and bet your money')
    .addStringOption(opt => opt.setName('side').setDescription('Choose Head or Tail').setRequired(true).addChoices(
      { name: 'Head', value: 'head' },
      { name: 'Tail', value: 'tail' }
    ))
    .addStringOption(opt => opt.setName('amount').setDescription('Amount to bet (or "all")').setRequired(true)),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const side = interaction.options.getString('side');
    const amountInput = interaction.options.getString('amount').toLowerCase();
    
    const data = await db.getEconomy(guildId, userId);
    
    let amount = 0;
    if (amountInput === 'all') {
      amount = Math.min(data.balance, 10000);
    } else {
      amount = parseFloat(amountInput);
    }

    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({ embeds: fixedEmbed(0xED4245, '❌ Please enter a valid amount to bet.'), ephemeral: true });
    }

    if (amount > 10000) {
      return interaction.reply({ embeds: fixedEmbed(0xED4245, '❌ **Bet Limit Exceeded:** The maximum bet for coinflip is **$10,000**.'), ephemeral: true });
    }

    if (amount > data.balance) {
      return interaction.reply({ embeds: fixedEmbed(0xED4245, `❌ You don't have enough money in your wallet! (**$${data.balance.toLocaleString(undefined, { minimumFractionDigits: 1 })}**)`), ephemeral: true });
    }

    // Win Chance Logic
    let winChance = 32.5;
    const now = Date.now();
    const isLucky = (data.luckyBoostUntil || 0) > now;
    if (isLucky) winChance += 12.5;

    const roll = Math.random() * 100;
    const win = roll < winChance;
    
    const resultSide = win ? side : (side === 'head' ? 'tail' : 'head');
    const newBalance = win ? (data.balance + amount) : (data.balance - amount);

    await db.updateEconomy(guildId, userId, { balance: newBalance });

    const embed = new EmbedBuilder()
      .setColor(win ? 0x57F287 : 0xED4245)
      .setTitle(win ? '🎉 You Won!' : '💀 You Lost!')
      .setThumbnail(win ? 'https://i.imgur.com/8Q9O0nS.png' : 'https://i.imgur.com/8Q9O0nS.png') // Use coin images if available
      .setDescription(`The coin landed on **${resultSide.toUpperCase()}**!`)
      .addFields(
        { name: 'Bet', value: `**$${amount.toLocaleString()}**`, inline: true },
        { name: 'Result', value: win ? `**+$${amount.toLocaleString()}**` : `**-$${amount.toLocaleString()}**`, inline: true },
        { name: 'New Balance', value: `**$${newBalance.toLocaleString()}**`, inline: false }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
