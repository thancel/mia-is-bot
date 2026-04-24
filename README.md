# 🤖 Mia Discord Bot

A feature-rich Discord bot built with **Discord.js v14**.

**Features:**
- 🛡️ **Moderation** — Ban, Kick, Mute, Warn, Purge, Unban, Log Config
- 🎙️ **Temp Voice** — Auto-create & delete private voice rooms with an interactive control panel
- 🎌 **Anime / Manga** — Search info via AniList GraphQL with interactive selection menus
- 👋 **Welcome & Goodbye** — Custom image cards with embed notifications
- 🏷️ **Auto-Role** — Automatically assign roles to new members upon joining
- 🎭 **Reaction Role** — Custom button-based role panels with complete management
- 🎉 **Giveaway** — Manage giveaways with precise timers, instant rerolls, and rich embeds
- ℹ️ **Info** — Server info, User info, Help

---

## 📋 Requirements

- **[Node.js](https://nodejs.org) v20 or later** (minimum v20.0.0)
  > Required because `@supabase/supabase-js` needs Node ≥ 20.
  > Recommended: **v20 LTS** or **v22 LTS** for best stability.
- Bot Token from [Discord Developer Portal](https://discord.com/developers/applications)
- Intents enabled: **SERVER MEMBERS INTENT** & **MESSAGE CONTENT INTENT**

---

## 🗄️ Database

| Mode | When used | Notes |
|------|-----------|-------|
| **Supabase** | `SUPABASE_URL` + `SUPABASE_KEY` filled in `.env` | Cloud PostgreSQL. Recommended for production. |
| **JSON file** | `.env` left empty | Saves to `data/db.json`. Persistent across restarts. No setup needed. |

### Setup Supabase (optional)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → API**, copy **Project URL** and **anon public key**
3. Open **SQL Editor** in the dashboard and run:

```sql
CREATE TABLE IF NOT EXISTS guild_configs (
  guild_id TEXT PRIMARY KEY,
  data     JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS warnings (
  id        BIGSERIAL PRIMARY KEY,
  guild_id  TEXT   NOT NULL,
  user_id   TEXT   NOT NULL,
  reason    TEXT   NOT NULL,
  mod_id    TEXT   NOT NULL,
  mod_tag   TEXT   NOT NULL,
  timestamp BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_warnings ON warnings (guild_id, user_id);

CREATE TABLE IF NOT EXISTS temp_voices (
  channel_id TEXT PRIMARY KEY,
  owner_id   TEXT NOT NULL,
  join_order JSONB NOT NULL DEFAULT '[]'
);
```

4. Fill `SUPABASE_URL` and `SUPABASE_KEY` in `.env`

---

## 🚀 Installation

### 1. Clone / Download

```bash
git clone <repo-url>
cd discord-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure `.env`

Copy `.env.example` to `.env` and fill in:

```env
TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here      # Optional — for instant command deploy during development

# Optional — fill both for Supabase, leave empty to use JSON file
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your_anon_key_here
```

### 4. Deploy slash commands

```bash
npm run deploy
```

> `GUILD_ID` filled → commands register **instantly** (development).
> `GUILD_ID` empty  → commands register **globally** (~1 hour).

### 5. Start the bot

```bash
npm start

# Development mode (auto-restart on file change)
npm run dev
```

---


## 🔐 Required Bot Permissions

**Discord Developer Portal → Bot → Privileged Gateway Intents:**
- ✅ SERVER MEMBERS INTENT
- ✅ MESSAGE CONTENT INTENT

**Server permissions:**
- Manage Channels, Manage Roles
- Kick Members, Ban Members
- Moderate Members (for timeout)
- Manage Messages
- Move Members
- Send Messages, Embed Links
- Read Message History

---

## 📝 Notes

- **JSON mode** (`data/db.json`): Data is saved to disk on every write and persists across bot restarts. No external setup required.
- **Supabase mode**: Persistent cloud PostgreSQL. Recommended for production or multi-instance deployments.
- All embeds use **random colors** by default, except welcome/goodbye embeds which use the color configured via `/welcome color` or `/goodbye color`.
- **AniList API** is free and requires no API key.
