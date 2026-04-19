const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const db = require('../../db');
const fs = require('fs');
const path = require('path');
const { isGameActive, setGameActive, setGameInactive } = require('../../utils/gameState');

// Load local words for Unscramble
const wordsPath = path.join(__dirname, '..', '..', 'data', 'words.json');
let localWords = { games: [], general: [] };
try {
  if (fs.existsSync(wordsPath)) {
    localWords = JSON.parse(fs.readFileSync(wordsPath, 'utf-8'));
  }
} catch (e) {
  console.error('Error loading words.json:', e);
}

/**
 * Scramble a string.
 */
function scrambleString(str) {
  const original = str.replace(/\s+/g, '');
  let scrambled;
  do {
    scrambled = original.split('').sort(() => Math.random() - 0.5).join('').toUpperCase();
  } while (scrambled === original.toUpperCase() && original.length > 1);
  return scrambled.split('').join('-');
}

/**
 * Flexible Answer Matching (accepts reversed words for names).
 */
function isCorrectMatch(input, original) {
  const normalize = (s) => s.toLowerCase().trim().split(/\s+/).sort().join(' ');
  return normalize(input) === normalize(original);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unscramble')
    .setDescription('🧩 Word Unscramble (Type the correct answer in chat first to win!)')
    .addStringOption(opt => opt
      .setName('category')
      .setDescription('Unscramble category to play')
      .setRequired(false)
      .addChoices(
        { name: '👤 Anime Characters', value: 'anime_char' },
        { name: '🎌 Anime Titles', value: 'anime_title' },
        { name: '🎮 Video Games', value: 'games' }
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

    const catParam = interaction.options.getString('category');
    let lastWinnerId = null;
    let currentStreak = 0;

    const fetchWord = async (selectedCat) => {
      let category = selectedCat;
      if (!category) {
        const cats = ['anime_char', 'anime_title', 'games'];
        category = cats[Math.floor(Math.random() * cats.length)];
      }

      if (category === 'anime_char') {
        const page = Math.floor(Math.random() * 40) + 1; // Top 2000 (50 per page)
        const q = `query { Page(page: ${page}, perPage: 50) { characters(sort: FAVOURITES_DESC) { name { full } } } }`;
        try {
          const r = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) }).then(res => res.json());
          const list = r?.data?.Page?.characters || [];
          const pick = list[Math.floor(Math.random() * list.length)]?.name?.full;
          return { word: pick, label: '👤 Anime Character' };
        } catch (e) { return { word: null }; }
      }
      if (category === 'anime_title') {
        const page = Math.floor(Math.random() * 40) + 1; // Top 2000 (50 per page)
        const q = `query { Page(page: ${page}, perPage: 50) { media(sort: POPULARITY_DESC, type: ANIME) { title { english romaji } } } }`;
        try {
          const r = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) }).then(res => res.json());
          const list = r?.data?.Page?.media || [];
          const m = list[Math.floor(Math.random() * list.length)];
          const pick = m?.title?.english || m?.title?.romaji;
          return { word: pick, label: '🎌 Anime Title' };
        } catch (e) { return { word: null }; }
      }
      // Default games
      const pick = localWords.games[Math.floor(Math.random() * localWords.games.length)];
      return { word: pick, label: '🎮 Video Game' };
    };

    const playRound = async (intx) => {
      try {
        const data = await fetchWord(catParam);
        if (!data.word) throw new Error('Failed to fetch word');

        const original = data.word;
        const scrambled = scrambleString(original);

        const embed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle(`🧩 Unscramble: ${data.label}`)
          .setDescription(`Unscramble this word:\n# \`${scrambled}\`\n\n🎯 *Race mode! Type the answer in chat.*${lastWinnerId ? `\n🔥 **Streak:** <@${lastWinnerId}> (${currentStreak}x)` : ''}`)
          .setFooter({ text: 'You have 30 seconds to answer!' });

        await intx.editReply({ embeds: [embed], components: [] });
        
        const collector = intx.channel.createMessageCollector({
          filter: m => isCorrectMatch(m.content, original) && !m.author.bot,
          time: 30000,
          max: 1
        });

        let win = false;
        collector.on('collect', async m => {
          win = true;
          if (lastWinnerId === m.author.id) currentStreak++; else { lastWinnerId = m.author.id; currentStreak = 1; }
          const pts = 10 + (currentStreak - 1) * 5;
          await db.addUserTriviaScore(guildId, m.author.id, pts);
          
          const winEmbed = new EmbedBuilder().setColor(0x57F287).setTitle('✅ Correct!')
            .setDescription(`${m.author} unscrambled it! **${original}**\n💰 **+${pts} Points** added!${currentStreak > 1 ? `\n🔥 **Streak:** **${currentStreak}x**` : ''}`);
          
          const nextRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('game_next').setLabel('⏭️ Next Word').setStyle(ButtonStyle.Primary));
          await intx.followUp({ embeds: [winEmbed], components: [nextRow] });
        });

        collector.on('end', async (_, reason) => {
          if (!win && reason === 'time') {
            lastWinnerId = null; currentStreak = 0;
            const timeoutEmbed = new EmbedBuilder().setColor(0x99AAB5).setTitle('⌛ Time\'s Up!')
              .setDescription(`The word was: **${original}**\n🔥 *Streak reset!*`);
            const nextRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('game_next').setLabel('⏭️ Next Word').setStyle(ButtonStyle.Primary));
            await intx.followUp({ embeds: [timeoutEmbed], components: [nextRow] });
          }
        });

        const btnCollector = intx.channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
        btnCollector.on('collect', async i => {
          if (i.customId === 'game_next') {
            btnCollector.stop();
            await i.deferUpdate();
            return playRound(i);
          }
        });

        btnCollector.on('end', (_, reason) => {
          if (reason !== 'user' && reason !== 'game_next') {
             // If they don't click next in 60s, disable session
             setGameInactive(channelId);
          }
        });

      } catch (err) {
        console.error('[Unscramble] Error:', err);
        setGameInactive(channelId);
        return intx.editReply({ content: '❌ A technical error occurred. Game session ended.' }).catch(()=>{});
      }
    };

    await playRound(interaction);
  },
};
