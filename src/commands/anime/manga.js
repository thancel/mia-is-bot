const { SlashCommandBuilder } = require('discord.js');
const { runSearch } = require('../../utils/anilist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manga')
    .setDescription('📚 🎌 Search for manga information')
    .addStringOption(opt =>
      opt
        .setName('title')
        .setDescription('The title of the manga you want to search for')
        .setRequired(true)
    ),

  async execute(interaction) {
    await runSearch(interaction, 'MANGA');
  },
};