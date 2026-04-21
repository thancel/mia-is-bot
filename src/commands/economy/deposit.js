const { SlashCommandBuilder } = require('discord.js');
const db = require('../../db');
const { fixedEmbed } = require('../../utils/embedUtils');

const ATM_LIMITS = {
  'atm_basic': 100000,
  'atm_gold': 500000,
  'atm_platinum': 10000000,
  'atm_black': 100000000
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('📥 Deposit money into your bank')
    .addStringOption(opt => opt.setName('amount').setDescription('Amount to deposit (or "all")').setRequired(true)),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const amountInput = interaction.options.getString('amount').toLowerCase();
    
    let data = await db.getEconomy(guildId, userId);
    
    // Check for ATM Tier requirement
    const atmTier = data.atmTier;
    
    if (!atmTier) {
      return interaction.reply({ 
        embeds: fixedEmbed(0xED4245, '❌ **You cannot deposit:** You need to purchase a **💳 Basic ATM Card** from the `/shop` to use bank services!'), 
        ephemeral: true 
      });
    }

    // Determine max limit based on tier
    const maxBankLimit = ATM_LIMITS[atmTier] || 0;

    data = await applyInterest(guildId, userId, data);

    let amount = 0;
    if (amountInput === 'all') {
      amount = data.balance;
    } else {
      amount = parseInt(amountInput);
      if (isNaN(amount) || amount <= 0) {
        return interaction.reply({ embeds: fixedEmbed(0xED4245, '❌ Please enter a valid amount or "all".'), ephemeral: true });
      }
    }

    if (amount > data.balance) {
      return interaction.reply({ embeds: fixedEmbed(0xED4245, `❌ You don't have enough cash. Your current wallet balance is **$${data.balance.toLocaleString()}**.`), ephemeral: true });
    }

    if (amount === 0) {
      return interaction.reply({ embeds: fixedEmbed(0xED4245, '❌ You have nothing to deposit!'), ephemeral: true });
    }

    // Capacity Check
    if (data.bank + amount > maxBankLimit) {
      const remaining = maxBankLimit - data.bank;
      if (remaining <= 0) {
        return interaction.reply({ embeds: fixedEmbed(0xED4245, `❌ **Bank Full:** Your current ATM Card limit is **$${maxBankLimit.toLocaleString()}**. Upgrade your ATM at the \`/shop\`!`), ephemeral: true });
      }
      return interaction.reply({ embeds: fixedEmbed(0xED4245, `❌ **Limit Exceeded:** You can only deposit up to **$${remaining.toLocaleString()}** more with your current ATM card.`), ephemeral: true });
    }

    await db.updateEconomy(guildId, userId, {
      balance: data.balance - amount,
      bank: data.bank + amount
    });

    return interaction.reply({ 
      embeds: fixedEmbed(0x57F287, `✅ Successfully deposited **$${amount.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}** into your bank.\nYour bank grows by **4% every hour**! (Limit: $${maxBankLimit.toLocaleString()})`)
    });
  },
};

/**
 * Apply 4% hourly compound interest
 */
async function applyInterest(guildId, userId, data) {
  const bank = data.bank || 0;
  if (bank <= 0) return data;
  
  const now = Date.now();
  const lastInterest = data.lastInterest || now;
  const diffMs = now - lastInterest;
  const hours = Math.floor(diffMs / (60 * 60 * 1000));

  if (hours >= 1) {
    const rate = 0.04; // 4% per hour
    const newBank = bank * Math.pow(1 + rate, hours);
    
    // Determine max limit for safety (though interest might push it slightly over, we cap it or let it grow?)
    // Usually interest allows going over limit, but let's see. 
    // I'll let interest go over but block manual deposits.

    const updates = {
      bank: newBank,
      lastInterest: lastInterest + (hours * 60 * 60 * 1000)
    };
    await db.updateEconomy(guildId, userId, updates);
    return { ...data, ...updates };
  }
  return data;
}

module.exports.applyInterest = applyInterest;
