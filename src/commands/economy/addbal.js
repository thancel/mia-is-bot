const { SlashCommandBuilder } = require('discord.js');
const db = require('../../db');
const { fixedEmbed } = require('../../utils/embedUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addbal')
    .setDescription('💸 [Owner Only] Add money to a user\'s wallet')
    .addUserOption(opt => opt.setName('user').setDescription('The user to give money to').setRequired(true))
    .addNumberOption(opt => opt.setName('amount').setDescription('Amount to add').setRequired(true)),

  async execute(interaction) {
    const devId = process.env.DEV_ID;
    if (interaction.user.id !== devId) {
      return interaction.reply({ embeds: fixedEmbed(0xED4245, '❌ This command is restricted to the bot developer.'), ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getNumber('amount');
    const guildId = interaction.guild.id;

    if (amount <= 0) {
      return interaction.reply({ embeds: fixedEmbed(0xED4245, '❌ Amount must be positive.'), ephemeral: true });
    }

    const data = await db.getEconomy(guildId, target.id);
    await db.updateEconomy(guildId, target.id, { balance: data.balance + amount });

    return interaction.reply({ 
      embeds: fixedEmbed(0x57F287, `✅ Successfully added **$${amount.toLocaleString(undefined, { minimumFractionDigits: 1 })}** to **${target.username}**'s wallet.`)
    });
  },
};
