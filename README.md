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

## 📁 Project Structure

```
discord-bot/
├── index.js                      # Entry point
├── deploy-commands.js            # Slash command deployment script
├── .env                          # Tokens & config (never commit!)
├── .env.example                  # Template
├── data/
│   ├── db.json                   # JSON database (created automatically)
│   ├── welcome_bg/<guildId>.png  # Per-guild welcome backgrounds
│   └── goodbye_bg/<guildId>.png  # Per-guild goodbye backgrounds
└── src/
    ├── commands/
    │   ├── anime/
    │   │   ├── anime.js          # /anime
    │   │   └── manga.js          # /manga
    │   ├── moderation/
    │   │   ├── mod.js            # /ban /kick /mute /unmute /purge /unban
    │   │   ├── warn.js           # /warn add/list/remove/clear
    │   │   ├── Welcome.js        # /welcome setup/background/text/color/preview/reset
    │   │   └── Goodbye.js        # /goodbye setup/background/text/color/preview/reset
    │   ├── voice/
    │   │   └── tempvoice.js      # /voice setup/kick/panel
    │   └── info/
    │       ├── help.js           # /help
    │       ├── info.js           # /serverinfo /userinfo
    │       └── say.js            # /say
    ├── db/
    │   ├── index.js              # Auto-selects adapter (Supabase / JSON)
    │   └── adapters/
    │       ├── supabase.js       # Supabase adapter
    │       └── json.js           # JSON file adapter (fallback)
    ├── events/
    │   ├── ready.js              # Bot online + refresh voice panels
    │   ├── interactionCreate.js  # Slash commands, buttons, modals
    │   ├── guildMemberAdd.js     # Welcome message
    │   ├── guildMemberRemove.js  # Goodbye message
    │   └── voiceStateUpdate.js   # Temp voice auto-create/delete/ownership
    ├── handlers/
    │   ├── commandHandler.js     # Load all commands
    │   └── eventHandler.js       # Load all events
    └── utils/
        ├── embedUtils.js         # randomColor(), quickEmbed(), fixedEmbed()
        ├── guildConfig.js        # Thin async wrapper around db
        ├── anilist.js            # AniList GraphQL helper
        └── welcomeImage.js       # Welcome/goodbye image generator
```

---

## 📖 Commands

### 🎙️ Temp Voice
| Command | Description |
|---------|-------------|
| `/voice setup <category>` | [Admin] Create trigger channel + control panel |
| `/voice panel` | [Admin] Refresh and resend the control panel |

**Panel Buttons** *(in `#🎙️・interface`)*
| Button | Action |
|--------|--------|
| `✏️` **Rename** | Rename the channel (opens a form) |
| `🔒` **Limit** | Set user limit (opens a form) |
| `🛡️` **Privacy** | Lock/Unlock (toggle) |
| `⏳` **Waiting R.** | Toggle Waiting Room |
| `👤` **Trust/Untrust** | Manage user access (toggle) |
| `🚫` **Block/Unblock** | Block user from joining (toggle) |
| `📩` **Invite** | Invite a user via DM with bypass |
| `🦶` **Kick** | Kick a user from channel |
| `👑` **Claim** | Claim ownership of empty-owned channel |
| `🔄` **Transfer** | Transfer ownership to someone else |
| `🗑️` **Delete** | Delete your temporary channel |

> ℹ️ **On bot restart**, the panel is automatically refreshed — old messages are deleted and a fresh panel is sent.

### 🎌 Anime & Manga
| Command | Description |
|---------|-------------|
| `/anime <title>` | Search anime via AniList. Shows selection if multiple results. |
| `/manga <title>` | Search manga via AniList. Shows selection if multiple results. |
| `/notify anime setup <channel> [username] [role]`| Track AniList user's watching/planning list and notify when episodes air. |
| `/notify anime remove` | Disable anime notifications for this server. |

### 🛡️ Moderation
| Command | Description |
|---------|-------------|
| `/ban <user> <reason> [hours]` | Ban (optional: temporary) |
| `/unban <id> <reason>` | Unban by user ID |
| `/kick <user> <reason>` | Kick from server |
| `/mute <user> <minutes> <reason>` | Timeout a user |
| `/unmute <user> <reason>` | Remove timeout |
| `/warn add <user> <reason>` | Add a warning |
| `/warn list <user>` | List warnings |
| `/warn remove <user> <number>` | Remove a specific warning |
| `/warn clear <user>` | Clear all warnings |
| `/purge <amount> [user]` | Delete messages in bulk (max 100) |

### 👋 Welcome & Goodbye
| Command | Description |
|---------|-------------|
| `/welcome setup <channel>` | Set the welcome channel |
| `/welcome background <image>` | Upload a background (any size, auto-resized) |
| `/welcome text <target> <message>` | Set embed or image text |
| `/welcome color <type> <hex>` | Set text or embed color |
| `/welcome preview` | Preview the welcome image |
| `/welcome reset` | Reset all welcome settings |
| `/goodbye ...` | Same subcommands as `/welcome` |

> **Background images** can be any size — they are automatically scaled to cover the 1280×720 canvas.
> **Image fonts:** WELCOME/GOODBYE label uses **Bebas Neue**, username and sub-text use **Montserrat**.

### 🏷️ Auto-Role
| Command | Description |
|---------|-------------|
| `/autorole set <role>` | Set auto-role for new members |
| `/autorole remove` | Remove the auto-role |
| `/autorole status` | Show current auto-role configuration |

### 🎭 Reaction Role
| Command | Description |
|---------|-------------|
| `/reactionrole create <channel> <title>` | Create a new role panel |
| `/reactionrole add <panel_id> <role> <label>` | Add a role button (up to 25) |
| `/reactionrole remove <panel_id> <role>` | Remove a role button |
| `/reactionrole edit <panel_id> ...` | Edit a panel's title, description, or color |
| `/reactionrole delete <panel_id>` | Delete an entire panel |
| `/reactionrole list` | List all panels |

### 🎉 Giveaway
| Command | Description |
|---------|-------------|
| `/giveaway start <prize> <duration> [ping] [role]` | Start a new giveaway |
| `/giveaway end <giveaway_id>` | End a giveaway early |
| `/giveaway reroll <giveaway_id>` | Reroll the winner(s) of an ended giveaway |
| `/giveaway delete <giveaway_id>` | Cancel and delete a giveaway |
| `/giveaway list` | List all active and ended giveaways |

### 🎮 Games
| Command | Description |
|---------|-------------|
| `/trivia [category]` | Start a Trivia quiz (Race Mode). Categories: Anime, Games, Animals, Geography, Tech, Mythology, Music, History. |
| `/unscramble [cat]` | Start a Word Unscramble game (Chat Race). Categories: Anime Characters, Anime Titles, Video Games. *Supports reversed names for characters.* |
| `/leaderboard` | Show the top 10 players with the highest game scores. |

### ℹ️ Info
| Command | Description |
|---------|-------------|
| `/help` | Show listing of all available commands. |
| `/serverinfo` | Display current server information. |
| `/userinfo [user]` | Display user information. |
| `/say <message> [channel]` | Send a message as the bot. |

---

## ⚙️ Temp Voice Setup

1. Run `/voice setup category:<choose a category>`
2. The bot creates two channels:
   - 🔊 **➕ Create Voice** — Join to create a private room.
   - 💬 **🎙️・interface** — Text channel with the permanent control panel.
3. When a user joins **➕ Create Voice**, the bot:
   - Creates a new voice channel named after the user
   - Grants owner permissions
   - Moves the user into the new channel
4. When the channel is empty, it is automatically deleted.
5. If the **owner leaves** while others remain, ownership transfers to the **earliest member** who joined. (There are no DM notifications to avoid spam).

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
