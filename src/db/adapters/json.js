/**
 * JSON adapter — persists data to data/db.json
 * Zero external dependencies. Data survives bot restarts.
 * Used automatically when SUPABASE_URL & SUPABASE_KEY are not set in .env.
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const DB_PATH  = path.join(DATA_DIR, 'db.json');

// ── Helpers ────────────────────────────────────────────────────────────────
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) return { guildConfigs: {}, warnings: {}, tempVoices: {} };
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); }
  catch { return { guildConfigs: {}, warnings: {}, tempVoices: {} }; }
}

function save(data) {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

let _db = null;
function db() {
  if (!_db) _db = load();
  return _db;
}

function flush() {
  save(db());
}

// ── Connect ────────────────────────────────────────────────────────────────
async function connect() {
  _db = load();
  // ensure all top-level keys exist
  _db.guildConfigs ??= {};
  _db.warnings     ??= {};
  _db.tempVoices   ??= {};
  flush();
  console.log(`✅ JSON DB loaded — ${DB_PATH}`);
}

// ── Guild Config ───────────────────────────────────────────────────────────
const CONFIG_DEFAULTS = {
  welcomeChannelId:    null,
  goodbyeChannelId:    null,
  welcomeText:         null,
  goodbyeText:         null,
  welcomeTextColor:    null,
  goodbyeTextColor:    null,
  welcomeEmbedColor:   null,
  goodbyeEmbedColor:   null,
  voicePanelChannelId: null,
  logChannelId:        null,
  autoRoleId:          null,
  ticketPanelChannelId: null,
  ticketCategoryId:    null,
  ticketLogChannelId:  null,
  ticketAdminRoleId:   null,
  ticketCount:         0,
  reactionRolePanels:  {},
  giveaways:           {},
  triviaScores:        {},
  economy:             {},
};

async function getGuildConfig(guildId) {
  return { ...CONFIG_DEFAULTS, ...(db().guildConfigs[guildId] || {}) };
}

async function setGuildConfig(guildId, updates) {
  const current = await getGuildConfig(guildId);
  const merged  = { ...current, ...updates };
  db().guildConfigs[guildId] = merged;
  flush();
  return merged;
}

async function resetGuildConfig(guildId) {
  delete db().guildConfigs[guildId];
  flush();
}

// ── Warnings ───────────────────────────────────────────────────────────────
function _warnKey(guildId, userId) { return `${guildId}:${userId}`; }

// Determine next ID
function _nextWarnId() {
  let max = 0;
  for (const list of Object.values(db().warnings)) {
    for (const w of list) { if (w.id > max) max = w.id; }
  }
  return max + 1;
}

async function addWarning(guildId, userId, { reason, modId, modTag }) {
  const key  = _warnKey(guildId, userId);
  db().warnings[key] ??= [];
  db().warnings[key].push({ id: _nextWarnId(), reason, modId, mod: modTag, timestamp: Date.now() });
  flush();
}

async function getWarnings(guildId, userId) {
  return [...(db().warnings[_warnKey(guildId, userId)] || [])];
}

async function removeWarning(guildId, userId, index) {
  const key  = _warnKey(guildId, userId);
  const list = db().warnings[key] || [];
  if (index < 0 || index >= list.length) return false;
  list.splice(index, 1);
  if (list.length === 0) delete db().warnings[key];
  flush();
  return true;
}

async function clearWarnings(guildId, userId) {
  const key   = _warnKey(guildId, userId);
  const count = (db().warnings[key] || []).length;
  delete db().warnings[key];
  flush();
  return count;
}

// ── Temp Voice ─────────────────────────────────────────────────────────────
async function setTempVoice(channelId, ownerId, joinOrder = []) {
  db().tempVoices[channelId] = {
    channelId,
    ownerId:   String(ownerId),
    joinOrder: joinOrder.map(String),
  };
  flush();
}

async function getTempVoice(channelId) {
  return db().tempVoices[channelId] || null;
}

async function deleteTempVoice(channelId) {
  delete db().tempVoices[channelId];
  flush();
}

async function getAllTempVoices() {
  return Object.values(db().tempVoices);
}

async function updateTempVoiceOwner(channelId, newOwnerId) {
  if (db().tempVoices[channelId]) {
    db().tempVoices[channelId].ownerId = String(newOwnerId);
    flush();
  }
}

async function updateTempVoiceJoinOrder(channelId, joinOrder) {
  if (db().tempVoices[channelId]) {
    db().tempVoices[channelId].joinOrder = joinOrder.map(String);
    flush();
  }
}

function getAllGuildConfigs() {
  return db().guildConfigs || {};
}

async function addUserTriviaScore(guildId, userId, points) {
  const cfg = await getGuildConfig(guildId);
  cfg.triviaScores ??= {};
  cfg.triviaScores[userId] = (cfg.triviaScores[userId] || 0) + points;
  await setGuildConfig(guildId, { triviaScores: cfg.triviaScores });
}

async function getTriviaLeaderboard(guildId) {
  const cfg = await getGuildConfig(guildId);
  const scores = cfg.triviaScores || {};
  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([userId, score]) => ({ userId, score }));
}

async function getEconomy(guildId, userId) {
  const cfg = await getGuildConfig(guildId);
  cfg.economy ??= {};
  const defaults = { 
    balance: 0, 
    bank: 0, 
    lastDaily: 0, 
    streak: 0, 
    lastReward: 0, 
    lastInterest: Date.now(), 
    inventory: [], 
    luckyBoostUntil: 0,
    fish: 0,
    fishInventory: [],
    equippedRod: null,
    rodDurability: {},
    lastFishTask: 0,
    coffeeFishingUntil: 0,
    atmTier: null,
    equippedBait: null,
    baitUses: {}
  };
  return { ...defaults, ...(cfg.economy[userId] || {}) };
}

async function updateEconomy(guildId, userId, data) {
  const cfg = await getGuildConfig(guildId);
  cfg.economy ??= {};
  cfg.economy[userId] = { ... (cfg.economy[userId] || {}), ...data };
  await setGuildConfig(guildId, { economy: cfg.economy });
}

module.exports = {
  connect,
  getGuildConfig,
  setGuildConfig,
  resetGuildConfig,
  getAllGuildConfigs,
  addWarning,
  getWarnings,
  removeWarning,
  clearWarnings,
  setTempVoice,
  getTempVoice,
  deleteTempVoice,
  getAllTempVoices,
  updateTempVoiceOwner,
  updateTempVoiceJoinOrder,
  addUserTriviaScore,
  getTriviaLeaderboard,
  getEconomy,
  updateEconomy,
};
