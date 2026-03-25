const fs   = require('fs');
const path = require('path');

const DATA_DIR    = path.join(__dirname, '..', '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'guild_configs.json');

if (!fs.existsSync(DATA_DIR))    fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, '{}', 'utf8');

/**
 * Config structure per guild:
 * {
 *   "GUILD_ID": {
 *     welcomeChannelId  : string | null,
 *     goodbyeChannelId  : string | null,
 *     welcomeText       : string | null,
 *     goodbyeText       : string | null,
 *     welcomeTextColor  : string | null,   // text color on welcome image
 *     goodbyeTextColor  : string | null,   // text color on goodbye image
 *     welcomeEmbedColor : string | null,   // embed color for welcome
 *     goodbyeEmbedColor : string | null,   // embed color for goodbye
 *     updatedAt         : ISO string
 *   }
 * }
 */

function readAll() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return {}; }
}

function writeAll(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getConfig(guildId) {
  const all = readAll();
  return all[guildId] || {
    welcomeChannelId:  null,
    goodbyeChannelId:  null,
    welcomeText:       null,
    goodbyeText:       null,
    welcomeTextColor:  null,
    goodbyeTextColor:  null,
    welcomeEmbedColor: null,
    goodbyeEmbedColor: null,
  };
}

function setConfig(guildId, updates) {
  const all = readAll();
  all[guildId] = {
    ...(all[guildId] || {}),
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeAll(all);
  return all[guildId];
}

function resetConfig(guildId) {
  const all = readAll();
  delete all[guildId];
  writeAll(all);
}

module.exports = { getConfig, setConfig, resetConfig };