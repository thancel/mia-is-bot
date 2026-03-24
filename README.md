# 🤖 Discord Bot Serbaguna

Bot Discord berbasis **Discord.js v14** dengan fitur:
- 🛡️ **Moderasi** — Ban, Kick, Mute, Warn, Purge, Unban
- 🎙️ **Temp Voice** — Auto-create & auto-delete voice channel pribadi
- 🎌 **Anime/Manga** — Cari info via AniList GraphQL dengan pilihan interaktif
- 👋 **Welcome & Goodbye** — Embed otomatis saat member masuk/keluar
- ℹ️ **Info** — Server info, User info, Help

---

## 📋 Persyaratan

- [Node.js](https://nodejs.org) v18+ (disarankan v20 LTS)
- Bot Token dari [Discord Developer Portal](https://discord.com/developers/applications)
- Intents yang diaktifkan: **SERVER MEMBERS INTENT** & **MESSAGE CONTENT INTENT**

---

## 🚀 Instalasi

### 1. Clone / Download project ini

```bash
git clone <repo-url>
cd discord-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup file `.env`

Salin `.env.example` menjadi `.env` lalu isi:

```env
TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here          # Opsional, untuk dev (command langsung aktif)

WELCOME_CHANNEL_ID=channel_id_here   # Channel untuk pesan selamat datang
GOODBYE_CHANNEL_ID=channel_id_here   # Channel untuk pesan perpisahan
LOG_CHANNEL_ID=channel_id_here       # Channel untuk log moderasi
```

### 4. Deploy Slash Commands

```bash
npm run deploy
```

> Jika `GUILD_ID` diisi → command aktif **instan** (untuk development).
> Jika tidak → command aktif **global** dalam ~1 jam.

### 5. Jalankan Bot

```bash
npm start

# Atau mode development (auto-restart on file change)
npm run dev
```

---

## 📁 Struktur Folder

```
discord-bot/
├── index.js                    # Entry point
├── deploy-commands.js          # Script deploy slash commands
├── .env                        # Token & konfigurasi (jangan di-commit!)
├── .env.example                # Template .env
└── src/
    ├── commands/
    │   ├── anime/
    │   │   └── anime.js        # /anime — Cari anime & manga
    │   ├── moderation/
    │   │   └── mod.js          # /ban /kick /mute /unmute /warn /purge /unban
    │   ├── voice/
    │   │   └── tempvoice.js    # /tempvoice
    │   └── info/
    │       ├── help.js         # /help
    │       └── info.js         # /serverinfo /userinfo
    ├── events/
    │   ├── ready.js            # Bot online
    │   ├── interactionCreate.js # Handle slash commands & select menus
    │   ├── guildMemberAdd.js   # Welcome message
    │   ├── guildMemberRemove.js # Goodbye message
    │   └── voiceStateUpdate.js # Temp voice auto-create/delete
    └── handlers/
        ├── commandHandler.js   # Load semua commands
        └── eventHandler.js     # Load semua events
```

---

## 📖 Daftar Command

### 🎌 Anime & Manga
| Command | Deskripsi |
|---------|-----------|
| `/anime judul:<query> [tipe:Anime\|Manga]` | Cari anime/manga. Jika ada banyak hasil, muncul select menu pilihan |

### 🎙️ Temp Voice
| Command | Deskripsi |
|---------|-----------|
| `/tempvoice setup kategori:<channel>` | [Admin] Buat trigger channel "➕ Buat Voice" |
| `/tempvoice rename nama:<nama>` | Ganti nama channel kamu |
| `/tempvoice limit jumlah:<0-99>` | Set batas user (0 = unlimited) |
| `/tempvoice kick user:<@user>` | Kick user dari channel kamu |
| `/tempvoice lock` | Kunci/buka voice channel kamu |
| `/tempvoice transfer user:<@user>` | Transfer ownership ke user lain |
| `/tempvoice info` | Lihat info channel saat ini |

### 🛡️ Moderasi
| Command | Deskripsi |
|---------|-----------|
| `/ban user:<@user> [alasan] [hapus_pesan]` | Ban user |
| `/unban userid:<id> [alasan]` | Unban user berdasarkan ID |
| `/kick user:<@user> [alasan]` | Kick user |
| `/mute user:<@user> durasi:<menit> [alasan]` | Timeout user |
| `/unmute user:<@user> [alasan]` | Hapus timeout user |
| `/warn add user:<@user> alasan:<text>` | Tambah peringatan |
| `/warn list user:<@user>` | Lihat daftar peringatan |
| `/warn clear user:<@user>` | Hapus semua peringatan |
| `/purge jumlah:<1-100> [user:<@user>]` | Hapus pesan bulk |

### ℹ️ Info
| Command | Deskripsi |
|---------|-----------|
| `/help` | Tampilkan semua command |
| `/serverinfo` | Info lengkap server |
| `/userinfo [user:<@user>]` | Info lengkap user |

---

## ⚙️ Setup Temp Voice

1. Jalankan `/tempvoice setup kategori:<pilih kategori>`
2. Bot otomatis membuat channel **"➕ Buat Voice"** di kategori tersebut
3. Saat user join channel tersebut, bot otomatis:
   - Membuat voice channel baru dengan nama user
   - Memberi owner permission ke user tersebut
   - Memindahkan user ke channel baru
4. Saat channel kosong (semua keluar), channel otomatis dihapus

---

## 🔐 Permissions yang Dibutuhkan Bot

Di Discord Developer Portal → Bot → Privileged Gateway Intents:
- ✅ **SERVER MEMBERS INTENT**
- ✅ **MESSAGE CONTENT INTENT**

Permissions bot di server:
- Manage Channels, Manage Roles
- Kick Members, Ban Members
- Moderate Members (untuk timeout)
- Manage Messages
- Move Members
- Send Messages, Embed Links
- Read Message History

---

## 📝 Catatan

- **Warn system** menggunakan in-memory storage. Untuk production, gunakan database (MongoDB, SQLite, dll.)
- **Temp voice** data juga in-memory; restart bot akan reset tracking (channel yang sudah ada tidak akan auto-delete sampai kosong)
- AniList API **gratis dan tanpa API key** — rate limit generous untuk penggunaan normal
