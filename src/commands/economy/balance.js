const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('🏦 Check your current balance')
    .addUserOption(opt => opt.setName('user').setDescription('The user to check balance for').setRequired(false)),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const target = interaction.options.getUser('user') || interaction.user;
    let data = await db.getEconomy(guildId, target.id);
    
    // Apply interest on-demand for checking balance
    const { applyInterest } = require('./deposit');
    data = await applyInterest(guildId, target.id, data);
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
      .setTitle('🏦 Financial Status')
      .addFields(
        { name: '💵 Wallet', value: `**$${data.balance.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}**`, inline: true },
        { name: '🏛️ Bank',   value: `**$${data.bank.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}**`, inline: true }
      )
      .addFields(
        { name: '📊 Total', value: `**$${(data.balance + data.bank).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}**` }
      )
      .setFooter({ text: 'Bank savings grow by 5% every hour!' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
