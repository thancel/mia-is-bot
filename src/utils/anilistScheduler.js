const { EmbedBuilder } = require('discord.js');
const db = require('../db');

// Keep track of the last time we checked, initialized to 30 mins ago
let lastCheckUnix = Math.floor(Date.now() / 1000) - 30 * 60;

const SCHEDULE_QUERY = `
query ($greater: Int, $lesser: Int) {
  Page(page: 1, perPage: 50) {
    airingSchedules(airingAt_greater: $greater, airingAt_lesser: $lesser) {
      airingAt
      episode
      mediaId
      media {
        siteUrl
        title { romaji english }
        coverImage { extraLarge color }
      }
    }
  }
}`;

const USER_LIST_QUERY = `
query ($username: String) {
  MediaListCollection(userName: $username, type: ANIME, status_in: [CURRENT, PLANNING]) {
    lists {
      entries {
        mediaId
      }
    }
  }
}`;

async function fetchAiredEpisodes(greater, lesser) {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: SCHEDULE_QUERY, variables: { greater, lesser } })
  }).catch(() => null);

  if (!res || !res.ok) return [];
  const json = await res.json();
  return json?.data?.Page?.airingSchedules || [];
}

async function fetchUserWatchingIds(username) {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: USER_LIST_QUERY, variables: { username } })
  }).catch(() => null);

  if (!res || !res.ok) return new Set();
  const json = await res.json();
  
  const ids = new Set();
  const lists = json?.data?.MediaListCollection?.lists || [];
  for (const list of lists) {
    for (const entry of list.entries) {
      ids.add(entry.mediaId);
    }
  }
  return ids;
}

async function runCheck(client) {
  const nowUnix = Math.floor(Date.now() / 1000);
  const greater = lastCheckUnix;
  const lesser  = nowUnix + 60; 

  const airedEpisodes = await fetchAiredEpisodes(greater, lesser);
  lastCheckUnix = nowUnix;

  if (!airedEpisodes.length) return;

  const allConfigs = await db.getAllGuildConfigs();
  const configsByUser = {};

  for (const [guildId, cfg] of Object.entries(allConfigs)) {
    if (!cfg.animeNotifChannelId || !cfg.animeNotifUsername) continue;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;
    const channel = guild.channels.cache.get(cfg.animeNotifChannelId);
    if (!channel) continue;

    const user = cfg.animeNotifUsername.toLowerCase();
    if (!configsByUser[user]) Object.defineProperty(configsByUser, user, { value: [], enumerable: true, writable: true });
    configsByUser[user].push({ guildId, channel, roleId: cfg.animeNotifRoleId });
  }

  const usernames = Object.keys(configsByUser);
  if (!usernames.length) return;

  for (const username of usernames) {
    const userWatchingIds = await fetchUserWatchingIds(username);
    if (userWatchingIds.size === 0) continue;

    const episodesForThisUser = airedEpisodes.filter(e => userWatchingIds.has(e.mediaId));
    if (episodesForThisUser.length === 0) continue;

    const pendingMessages = configsByUser[username];

    for (const ep of episodesForThisUser) {
      const media = ep.media;
      const titleDisplay = media.title.english || media.title.romaji || "Unknown Anime";
      
      const airingDate = new Date(ep.airingAt * 1000);
      const timeStr = airingDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
      const dateStr = airingDate.toLocaleDateString('en-US', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric' });
      
      const embed = new EmbedBuilder()
        .setColor(media.coverImage?.color ? parseInt(media.coverImage.color.replace('#', ''), 16) : 0x5865F2)
        .setTitle(titleDisplay)
        .setURL(media.siteUrl)
        .setDescription(`**Episode ${ep.episode}** has just aired!`)
        .setThumbnail(media.coverImage?.extraLarge || null)
        .setFooter({ text: `AniList ID: ${ep.mediaId} • Aired at ${timeStr} • ${dateStr}` });

      for (const target of pendingMessages) {
        const pingText = target.roleId ? `<@&${target.roleId}>` : '';
        target.channel.send({ content: pingText || null, embeds: [embed] }).catch(() => {});
      }
    }
  }
}

function startScheduler(client) {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  
  let minsToNext = 20 - (minutes % 20);
  if (minsToNext === 0) minsToNext = 20;
  
  const delayMs = (minsToNext * 60 - seconds) * 1000;
  
  console.log(`[AniList Scheduler] Next episode check in ${Math.round(delayMs / 60000)} minutes.`);

  setTimeout(() => {
    runCheck(client);
    setInterval(() => runCheck(client), 20 * 60 * 1000);
  }, delayMs);
}

module.exports = { startScheduler, runCheck };
