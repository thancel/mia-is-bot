/**
 * Supabase adapter — uses @supabase/supabase-js
 * Requires SUPABASE_URL and SUPABASE_KEY in .env
 *
 * Run this SQL in your Supabase SQL Editor to create the tables:
 *
 * CREATE TABLE IF NOT EXISTS guild_configs (
 *   guild_id   TEXT PRIMARY KEY,
 *   data       JSONB NOT NULL DEFAULT '{}'
 * );
 *
 * CREATE TABLE IF NOT EXISTS warnings (
 *   id         BIGSERIAL PRIMARY KEY,
 *   guild_id   TEXT NOT NULL,
 *   user_id    TEXT NOT NULL,
 *   reason     TEXT NOT NULL,
 *   mod_id     TEXT NOT NULL,
 *   mod_tag    TEXT NOT NULL,
 *   timestamp  BIGINT NOT NULL
 * );
 * CREATE INDEX IF NOT EXISTS idx_warnings ON warnings (guild_id, user_id);
 *
 * CREATE TABLE IF NOT EXISTS temp_voices (
 *   channel_id TEXT PRIMARY KEY,
 *   owner_id   TEXT NOT NULL,
 *   join_order JSONB NOT NULL DEFAULT '[]'
 * );
 */

const { createClient } = require('@supabase/supabase-js');

let supabase;

// ── Connect ────────────────────────────────────────────────────────────────
async function connect() {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
  // Simple ping to verify connection
  const { error } = await supabase.from('guild_configs').select('guild_id').limit(1);
  if (error) throw new Error(`Supabase connection error: ${error.message}`);
  console.log(`✅ Supabase connected — ${process.env.SUPABASE_URL}`);
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
  reactionRolePanels:  {},
  giveaways:           {},
};

async function getGuildConfig(guildId) {
  const { data, error } = await supabase
    .from('guild_configs')
    .select('data')
    .eq('guild_id', guildId)
    .single();
  if (error || !data) return { ...CONFIG_DEFAULTS };
  return { ...CONFIG_DEFAULTS, ...data.data };
}

async function setGuildConfig(guildId, updates) {
  const current = await getGuildConfig(guildId);
  const merged  = { ...current, ...updates };
  const { error } = await supabase
    .from('guild_configs')
    .upsert({ guild_id: guildId, data: merged }, { onConflict: 'guild_id' });
  if (error) throw new Error(`setGuildConfig error: ${error.message}`);
  return merged;
}

async function resetGuildConfig(guildId) {
  const { error } = await supabase
    .from('guild_configs')
    .delete()
    .eq('guild_id', guildId);
  if (error) throw new Error(`resetGuildConfig error: ${error.message}`);
}

async function getAllGuildConfigs() {
  const { data, error } = await supabase.from('guild_configs').select('guild_id, data');
  if (error) {
    console.error('Supabase fetch error (getAllConfigs):', error);
    return {};
  }
  const result = {};
  for (const row of data) {
    result[row.guild_id] = row.data;
  }
  return result;
}

// ── Warnings ───────────────────────────────────────────────────────────────
async function addWarning(guildId, userId, { reason, modId, modTag }) {
  const { error } = await supabase
    .from('warnings')
    .insert({ guild_id: guildId, user_id: userId, reason, mod_id: modId, mod_tag: modTag, timestamp: Date.now() });
  if (error) throw new Error(`addWarning error: ${error.message}`);
}

async function getWarnings(guildId, userId) {
  const { data, error } = await supabase
    .from('warnings')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .order('id', { ascending: true });
  if (error) throw new Error(`getWarnings error: ${error.message}`);
  return (data || []).map(r => ({
    id:        r.id,
    reason:    r.reason,
    modId:     r.mod_id,
    mod:       r.mod_tag,
    timestamp: r.timestamp,
  }));
}

async function removeWarning(guildId, userId, index) {
  const { data, error } = await supabase
    .from('warnings')
    .select('id')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .order('id', { ascending: true });
  if (error) throw new Error(`removeWarning error: ${error.message}`);
  if (!data || index < 0 || index >= data.length) return false;
  const { error: delErr } = await supabase
    .from('warnings')
    .delete()
    .eq('id', data[index].id);
  if (delErr) throw new Error(`removeWarning delete error: ${delErr.message}`);
  return true;
}

async function clearWarnings(guildId, userId) {
  const { data, error } = await supabase
    .from('warnings')
    .delete()
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw new Error(`clearWarnings error: ${error.message}`);
  return data ? data.length : 0;
}

// ── Temp Voice ─────────────────────────────────────────────────────────────
async function setTempVoice(channelId, ownerId, joinOrder = []) {
  const { error } = await supabase
    .from('temp_voices')
    .upsert(
      { channel_id: channelId, owner_id: String(ownerId), join_order: joinOrder.map(String) },
      { onConflict: 'channel_id' }
    );
  if (error) throw new Error(`setTempVoice error: ${error.message}`);
}

async function getTempVoice(channelId) {
  const { data, error } = await supabase
    .from('temp_voices')
    .select('*')
    .eq('channel_id', channelId)
    .single();
  if (error || !data) return null;
  return {
    channelId: data.channel_id,
    ownerId:   data.owner_id,
    joinOrder: data.join_order || [],
  };
}

async function deleteTempVoice(channelId) {
  const { error } = await supabase
    .from('temp_voices')
    .delete()
    .eq('channel_id', channelId);
  if (error) throw new Error(`deleteTempVoice error: ${error.message}`);
}

async function getAllTempVoices() {
  const { data, error } = await supabase
    .from('temp_voices')
    .select('*');
  if (error) throw new Error(`getAllTempVoices error: ${error.message}`);
  return (data || []).map(r => ({
    channelId: r.channel_id,
    ownerId:   r.owner_id,
    joinOrder: r.join_order || [],
  }));
}

async function updateTempVoiceOwner(channelId, newOwnerId) {
  const { error } = await supabase
    .from('temp_voices')
    .update({ owner_id: String(newOwnerId) })
    .eq('channel_id', channelId);
  if (error) throw new Error(`updateTempVoiceOwner error: ${error.message}`);
}

async function updateTempVoiceJoinOrder(channelId, joinOrder) {
  const { error } = await supabase
    .from('temp_voices')
    .update({ join_order: joinOrder.map(String) })
    .eq('channel_id', channelId);
  if (error) throw new Error(`updateTempVoiceJoinOrder error: ${error.message}`);
}

module.exports = {
  connect,
  // guild config
  getGuildConfig,
  setGuildConfig,
  resetGuildConfig,
  getAllGuildConfigs,
  // warnings
  addWarning,
  getWarnings,
  removeWarning,
  clearWarnings,
  // temp voice
  setTempVoice,
  getTempVoice,
  deleteTempVoice,
  getAllTempVoices,
  updateTempVoiceOwner,
  updateTempVoiceJoinOrder,
};
