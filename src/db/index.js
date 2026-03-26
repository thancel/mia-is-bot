/**
 * Database abstraction layer
 *
 * - SUPABASE_URL & SUPABASE_KEY set in .env → Supabase (PostgreSQL cloud, persistent)
 * - Not set → JSON file (data/db.json, persistent, no external dependencies)
 */

require('dotenv').config();

const USE_SUPABASE = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

let adapter;

if (USE_SUPABASE) {
  adapter = require('./adapters/supabase');
  console.log('🗄️  Database: Supabase');
} else {
  adapter = require('./adapters/json');
  console.log('🗄️  Database: JSON file (data/db.json)');
}

module.exports = adapter;
