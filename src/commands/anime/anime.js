const { SlashCommandBuilder } = require('discord.js');
const { runSearch } = require('../../utils/anilist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anime')
    .setDescription('🎌 Cari informasi anime via AniList')
    .addStringOption(opt =>
      opt
        .setName('judul')
        .setDescription('Judul anime yang ingin dicari')
        .setRequired(true)
    ),

  async execute(interaction) {
    await runSearch(interaction, 'ANIME');
  },
};
