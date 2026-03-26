const { SlashCommandBuilder } = require('discord.js');
const { runSearch } = require('../../utils/anilist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anime')
    .setDescription('🎌 Search for anime information')
    .addStringOption(opt =>
      opt
        .setName('title')
        .setDescription('The title of the anime you want to search for')
        .setRequired(true)
    ),

  async execute(interaction) {
    await runSearch(interaction, 'ANIME');
  },
};