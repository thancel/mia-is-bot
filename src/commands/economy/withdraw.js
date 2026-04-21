const { SlashCommandBuilder } = require('discord.js');
const db = require('../../db');
const { fixedEmbed } = require('../../utils/embedUtils');
const { applyInterest } = require('./deposit');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('📤 Withdraw money from your bank')
    .addStringOption(opt => opt.setName('amount').setDescription('Amount to withdraw (or "all")').setRequired(true)),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const amountInput = interaction.options.getString('amount').toLowerCase();
    
    let data = await db.getEconomy(guildId, userId);

    // Check for ATM Tier requirement
    if (!data.atmTier) {
      return interaction.reply({ 
        embeds: fixedEmbed(0xED4245, '❌ **You cannot withdraw:** You need to own an **💳 ATM Card** to use bank services!'), 
        ephemeral: true 
      });
    }

    data = await applyInterest(guildId, userId, data);

    let amount = 0;
    if (amountInput === 'all') {
      amount = data.bank;
    } else {
      amount = parseInt(amountInput);
      if (isNaN(amount) || amount <= 0) {
        return interaction.reply({ embeds: fixedEmbed(0xED4245, '❌ Please enter a valid amount or "all".'), ephemeral: true });
      }
    }

    if (amount > data.bank) {
      return interaction.reply({ embeds: fixedEmbed(0xED4245, `❌ You don't have enough in the bank. Your current bank balance is **$${data.bank.toLocaleString()}**.`), ephemeral: true });
    }

    if (amount === 0) {
      return interaction.reply({ embeds: fixedEmbed(0xED4245, '❌ Your bank account is empty!'), ephemeral: true });
    }

    await db.updateEconomy(guildId, userId, {
      balance: data.balance + amount,
      bank: data.bank - amount
    });

    return interaction.reply({ 
      embeds: fixedEmbed(0x57F287, `✅ Successfully withdrew **$${amount.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}** from your bank.`)
    });
  },
};
