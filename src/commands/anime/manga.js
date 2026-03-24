const { SlashCommandBuilder } = require('discord.js');
const { runSearch } = require('../../utils/anilist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manga')
    .setDescription('📚 Cari informasi manga via AniList')
    .addStringOption(opt =>
      opt
        .setName('judul')
        .setDescription('Judul manga yang ingin dicari')
        .setRequired(true)
    ),

  async execute(interaction) {
    await runSearch(interaction, 'MANGA');
  },
};
