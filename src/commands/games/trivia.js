const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const db = require('../../db');
const { isGameActive, setGameActive, setGameInactive } = require('../../utils/gameState');

/**
 * Basic HTML Entity Decoder for Open Trivia DB strings.
 */
function decodeEntities(text) {
  if (!text) return '';
  const entities = {
    '&quot;': '"', '&#039;': "'", '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&ldquo;': '"', '&rdquo;': '"', '&lsquo;': "'", '&rsquo;': "'",
    '&hellip;': '...', '&shy;': '', '&deg;': '°'
  };
  return text.replace(/&[#\w]+;/g, match => entities[match] || match);
}

/**
 * Shuffle an array.
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('🏁 Play Trivia (Race Mode — Whoever answers first wins!)')
    .addStringOption(opt => opt
      .setName('category')
      .setDescription('Trivia category to play')
      .setRequired(false)
      .addChoices(
        { name: '🎌 Anime & Manga', value: '31' },
        { name: '🎮 Video Games', value: '15' },
        { name: '🐾 Animals', value: '27' },
        { name: '🌍 Geography', value: '22' },
        { name: '💻 Computers & Tech', value: '18' },
        { name: '🔱 Mythology', value: '20' },
        { name: '🎶 Music', value: '12' },
        { name: '🏛️ History', value: '23' }
      )
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const channelId = interaction.channel.id;

    if (isGameActive(channelId)) {
      return interaction.reply({ 
        content: '❌ A game is already in progress in this channel! Please finish it before starting a new one.',
        ephemeral: true 
      });
    }

    await interaction.deferReply();
    setGameActive(channelId);

    const categoryParam = interaction.options.getString('category');
    let sessionToken = null;
    let lastWinnerId = null;
    let currentStreak = 0;

    const getSessionToken = async () => {
      try {
        const res = await fetch('https://opentdb.com/api_token.php?command=request');
        const data = await res.json();
        if (data.response_code === 0) return data.token;
      } catch (e) {}
      return null;
    };

    const playRound = async (intx) => {
      try {
        if (!sessionToken) sessionToken = await getSessionToken();
        let apiUrl = `https://opentdb.com/api.php?amount=1&type=multiple${sessionToken ? `&token=${sessionToken}` : ''}`;
        if (categoryParam) apiUrl += `&category=${categoryParam}`;

        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data.response_code === 4) { // Token Exhausted
          await fetch(`https://opentdb.com/api_token.php?command=reset&token=${sessionToken}`);
          return playRound(intx);
        }
        if (data.response_code !== 0) throw new Error('API response code non-zero');

        const result = data.results[0];
        const question = decodeEntities(result.question);
        const correct = decodeEntities(result.correct_answer);
        const incorrect = result.incorrect_answers.map(decodeEntities);
        const all = shuffle([correct, ...incorrect]);
        const correctIdx = all.indexOf(correct);

        const rows = [new ActionRowBuilder(), new ActionRowBuilder()];
        all.forEach((ans, i) => {
          const btn = new ButtonBuilder()
            .setCustomId(`trivia_${i}`)
            .setLabel(`${['A','B','C','D'][i]}. ${ans.length > 75 ? ans.slice(0, 72) + '...' : ans}`)
            .setStyle(ButtonStyle.Secondary);
          rows[i < 2 ? 0 : 1].addComponents(btn);
        });

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`🏁 Trivia: ${result.category || 'Random'}`)
          .setDescription(`**${question}**\n\n🎯 *Race mode! First to click win.*${lastWinnerId ? `\n🔥 **Streak:** <@${lastWinnerId}> (${currentStreak}x)` : ''}`)
          .setFooter({ text: `Difficulty: ${result.difficulty}` });

        const message = await intx.editReply({ embeds: [embed], components: rows });
        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });
        let answered = false;

        collector.on('collect', async i => {
          if (i.customId === 'trivia_next') {
            await i.deferUpdate();
            collector.stop('next');
            return playRound(i);
          }
          if (i.customId === 'trivia_end') {
            await i.update({ components: [] });
            collector.stop('end');
            await i.followUp({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('🛑 Game ended. Thanks for playing!')] });
            return;
          }
          if (answered) return;
          answered = true;

          const isWin = parseInt(i.customId.replace('trivia_','')) === correctIdx;
          if (isWin) {
            if (lastWinnerId === i.user.id) currentStreak++; else { lastWinnerId = i.user.id; currentStreak = 1; }
            const pts = 10 + (currentStreak - 1) * 5;
            await db.addUserTriviaScore(guildId, i.user.id, pts);
            const winEmbed = new EmbedBuilder().setColor(0x57F287).setTitle('✅ Correct!')
              .setDescription(`${i.user} got it! **${correct}**\n💰 **+${pts} Points** added!${currentStreak > 1 ? `\n🔥 **Streak:** **${currentStreak}x**` : ''}`);
            await i.update({ embeds: [winEmbed], components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trivia_next').setLabel('⏭️ Next').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('trivia_end').setLabel('🛑 End Game').setStyle(ButtonStyle.Danger)
              )
            ] });
          } else {
            lastWinnerId = null; currentStreak = 0;
            const loseEmbed = new EmbedBuilder().setColor(0xED4245).setTitle('❌ Wrong!')
              .setDescription(`${i.user} failed. Answer: **${correct}**\n🔥 *Streak broken!*`);
            await i.update({ embeds: [loseEmbed], components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trivia_next').setLabel('⏭️ Next').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('trivia_end').setLabel('🛑 End Game').setStyle(ButtonStyle.Danger)
              )
            ] });
          }
        });

        collector.on('end', async (_, reason) => {
          if (reason !== 'next') {
            setGameInactive(channelId);
          }
          if (reason === 'time' && !answered) {
            lastWinnerId = null; currentStreak = 0;
            const timeoutEmbed = new EmbedBuilder().setColor(0x99AAB5).setTitle('⌛ Time\'s Up!').setDescription(`Answer: **${correct}**\n🔥 *Streak reset!*`);
            await intx.editReply({ embeds: [timeoutEmbed], components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trivia_next').setLabel('⏭️ Next').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('trivia_end').setLabel('🛑 End Game').setStyle(ButtonStyle.Danger)
              )
            ] }).catch(()=>{});
          }
        });
      } catch (err) {
        console.error('[Trivia] Error:', err);
        setGameInactive(channelId);
        return intx.editReply({ content: '❌ A technical error occurred. Game session ended.' }).catch(()=>{});
      }
    };

    await playRound(interaction);
  },
};
