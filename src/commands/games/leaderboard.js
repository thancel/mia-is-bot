const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db');
const { randomColor } = require('../../utils/embedUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('🏆 Show the Trivia & Game leaderboard'),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    await interaction.deferReply();

    const leaderboard = await db.getTriviaLeaderboard(guildId);

    if (leaderboard.length === 0) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(randomColor())
          .setDescription('📭 No game scores found in this server. Play `/trivia` or `/unscramble` to get started!')]
      });
    }

    let boardStr = '';
    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
      boardStr += `${medal} <@${entry.userId}> — **${entry.score}** points\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFAA61A)
      .setTitle('🏆 Game Leaderboard')
      .setThumbnail(interaction.guild.iconURL())
      .setDescription(boardStr)
      .setFooter({ text: `${interaction.guild.name} • Top Players` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
