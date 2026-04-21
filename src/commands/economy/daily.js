const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db');
const { fixedEmbed } = require('../../utils/embedUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('📆 Claim your daily reward'),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const data = await db.getEconomy(guildId, userId);
    
    const now = Date.now();
    const WIB_OFFSET = 7 * 60 * 60 * 1000;
    const currentDay = Math.floor((now + WIB_OFFSET) / (24 * 60 * 60 * 1000));
    const lastDay = data.lastDailyDay || 0;

    // Check if already claimed today (WIB)
    if (currentDay === lastDay) {
      // Calculate time until next 00:00 WIB
      const nextDayMs = (currentDay + 1) * (24 * 60 * 60 * 1000) - WIB_OFFSET;
      const remaining = nextDayMs - now;
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

      return interaction.reply({ 
        embeds: fixedEmbed(0xED4245, `⏳ You have already claimed your daily reward today!\nNext reset at **00:00 WIB** (in **${hours}h ${minutes}m**).`), 
        ephemeral: true 
      });
    }

    let reward = 0;
    let newStreak = 1;
    let streakMessage = '';

    // Check if streak is maintained (claimed exactly on the next calendar day)
    if (currentDay === lastDay + 1) {
      newStreak = (data.streak || 0) + 1;
      const bonus = Math.floor(Math.random() * (2500 - 1000 + 1)) + 1000;
      reward = (data.lastReward || 0) + bonus;
      streakMessage = `🔥 **Streak x${newStreak}!** Your reward increased by **$${bonus.toLocaleString()}**.`;
    } else {
      // Reset or first time
      reward = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
      streakMessage = '✨ Start your daily streak to earn more each day!';
    }

    await db.updateEconomy(guildId, userId, {
      balance: data.balance + reward,
      lastDailyDay: currentDay, // Store day ID instead of timestamp
      lastDaily: now, // still keep timestamp for reference
      streak: newStreak,
      lastReward: reward
    });

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('📆 Daily Reward Claimed!')
      .setDescription(`You received **$${reward.toLocaleString()}**!\n\n${streakMessage}`)
      .addFields({ name: 'Total Wallet', value: `**$${(data.balance + reward).toLocaleString()}**` })
      .setFooter({ text: 'Come back tomorrow for an even bigger reward!' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
