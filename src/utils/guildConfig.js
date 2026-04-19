/**
 * guildConfig.js — thin async wrapper around the database layer.
 * Kept for backward compatibility with existing imports.
 */
const db = require('../db');

async function getConfig(guildId)          { return db.getGuildConfig(guildId); }
async function setConfig(guildId, updates) { return db.setGuildConfig(guildId, updates); }
async function resetConfig(guildId)        { return db.resetGuildConfig(guildId); }
async function getAllConfigs()             { return db.getAllGuildConfigs(); }

module.exports = { getConfig, setConfig, resetConfig, getAllConfigs };
