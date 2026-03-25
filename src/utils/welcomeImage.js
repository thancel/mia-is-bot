const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs   = require('fs');

const WELCOME_BG_DIR = path.join(__dirname, '..', '..', 'data', 'welcome_bg');
const GOODBYE_BG_DIR = path.join(__dirname, '..', '..', 'data', 'goodbye_bg');

if (!fs.existsSync(WELCOME_BG_DIR)) fs.mkdirSync(WELCOME_BG_DIR, { recursive: true });
if (!fs.existsSync(GOODBYE_BG_DIR)) fs.mkdirSync(GOODBYE_BG_DIR, { recursive: true });

// ============================================================
// UKURAN BACKGROUND IMAGE
// - Width  : 1280 px
// - Height : 720 px
// - Rasio  : 16 : 9
// - Format : PNG / JPG / WEBP
// - Max    : 8 MB
// ============================================================
const WIDTH  = 1280;
const HEIGHT = 720;

// Scale factor dari ukuran lama (1000x400) ke baru (1280x720)
// scaleX = 1280/1000 = 1.28 | scaleY = 720/400 = 1.80
// Gunakan rata-rata keduanya agar elemen proporsional di kedua arah
const SCALE = (1280 / 1000 + 720 / 400) / 2; // ≈ 1.54

// ── Register font ──
let FONT_FAMILY = 'sans-serif';

const SYSTEM_FONT_PATHS = [
  // Linux (Debian/Ubuntu/Docker)
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
  '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
  // Alpine Linux
  '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf',
  // macOS
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/Library/Fonts/Arial.ttf',
  // Windows
  'C:\\Windows\\Fonts\\arial.ttf',
  'C:\\Windows\\Fonts\\segoeui.ttf',
];

for (const fp of SYSTEM_FONT_PATHS) {
  if (fs.existsSync(fp)) {
    try {
      GlobalFonts.registerFromPath(fp, 'BotFont');
      FONT_FAMILY = 'BotFont';
      console.log(`[welcomeImage] Font registered: ${fp}`);
      break;
    } catch (_) {}
  }
}

if (FONT_FAMILY === 'sans-serif') {
  console.warn('[welcomeImage] ⚠️  No system font found! Text may render as boxes.');
  console.warn('[welcomeImage] ⚠️  Install fonts: apt-get install -y fonts-dejavu-core');
}

/**
 * Generate welcome image
 * @param {Object} opts
 * @param {string} opts.avatarURL   - URL avatar user
 * @param {string} opts.username    - Display name user
 * @param {string} opts.guildId     - Guild ID (untuk load BG)
 * @param {string} opts.welcomeText - Teks bawah username, support {user} {server} {count}
 * @param {string} opts.textColor   - Hex warna teks, default #ffffff
 * @param {string} opts.guildName   - Nama server
 * @param {number} opts.memberCount
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateWelcomeImage(opts) {
  return _generateImage({ ...opts, type: 'welcome' });
}

/**
 * Generate goodbye image
 * @param {Object} opts
 * @param {string} opts.avatarURL    - URL avatar user
 * @param {string} opts.username     - Display name user
 * @param {string} opts.guildId      - Guild ID (untuk load BG)
 * @param {string} opts.goodbyeText  - Teks bawah username, support {user} {server} {count}
 * @param {string} opts.textColor    - Hex warna teks, default #ffffff
 * @param {string} opts.guildName    - Nama server
 * @param {number} opts.memberCount
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateGoodbyeImage(opts) {
  return _generateImage({ ...opts, type: 'goodbye' });
}

async function _generateImage(opts) {
  const {
    type        = 'welcome',
    avatarURL,
    username,
    guildId,
    welcomeText,
    goodbyeText,
    textColor   = '#ffffff',
    guildName   = 'Server',
    memberCount = 0,
  } = opts;

  const isGoodbye   = type === 'goodbye';
  const messageText = isGoodbye
    ? (goodbyeText || 'See you next time, {user}!')
    : (welcomeText || 'Welcome to {server}! · Member {count}');

  const resolvedText = messageText
    .replace(/{user}/g,   username)
    .replace(/{server}/g, guildName)
    .replace(/{count}/g,  `#${memberCount}`);

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext('2d');

  // ── Background ──
  const bgDir  = isGoodbye ? GOODBYE_BG_DIR : WELCOME_BG_DIR;
  const bgPath = path.join(bgDir, `${guildId}.png`);

  if (fs.existsSync(bgPath)) {
    try {
      const bg = await loadImage(bgPath);
      ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
    } catch {
      drawDefaultBg(ctx, isGoodbye);
    }
  } else {
    drawDefaultBg(ctx, isGoodbye);
  }

  // ── Overlay gelap ──
  ctx.fillStyle = 'rgba(0,0,0,0.50)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Posisi avatar (proporsional) ──
  // Lama: avatarSize=150, avatarX=500, avatarY=170 (HEIGHT/2 - 30)
  const avatarSize = Math.round(150 * SCALE); // ≈ 231
  const avatarX    = WIDTH / 2;               // 640
  const avatarY    = Math.round(HEIGHT / 2 - 30 * SCALE); // ≈ 314

  // Border lingkaran
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarSize / 2 + Math.round(6 * SCALE), 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // Gambar avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  try {
    const avatar = await loadImage(avatarURL + '?size=256');
    ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
  } catch {
    ctx.fillStyle = '#5865f2';
    ctx.fillRect(avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
  }
  ctx.restore();

  // ── Setup text style ──
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor   = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur    = Math.round(10 * SCALE);
  ctx.shadowOffsetX = Math.round(2  * SCALE);
  ctx.shadowOffsetY = Math.round(2  * SCALE);

  // Label atas (— WELCOME — / — GOODBYE —)
  // Lama: font 22px, posisi avatarY - avatarSize/2 - 18
  const labelFontSize = Math.round(22 * SCALE); // ≈ 34
  const labelY        = avatarY - avatarSize / 2 - Math.round(18 * SCALE); // ≈ offset -28
  ctx.font      = `bold ${labelFontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = textColor;   // ikut settingan welcomeTextColor / goodbyeTextColor
  const label   = isGoodbye ? '— GOODBYE —' : '— WELCOME —';
  ctx.fillText(label, WIDTH / 2, labelY);

  // Username
  // Lama: font 44px, posisi avatarY + avatarSize/2 + 55
  const usernameFontSize = Math.round(44 * SCALE); // ≈ 68
  const usernameY        = avatarY + avatarSize / 2 + Math.round(55 * SCALE); // ≈ +85
  ctx.font      = `bold ${usernameFontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = textColor;
  ctx.fillText(username, WIDTH / 2, usernameY);

  // Pesan welcome/goodbye
  // Lama: font 26px, posisi avatarY + avatarSize/2 + 98
  const msgFontSize = Math.round(26 * SCALE); // ≈ 40
  const msgY        = avatarY + avatarSize / 2 + Math.round(98 * SCALE); // ≈ +151
  ctx.font      = `${msgFontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = hexToRgba(textColor, 0.90);
  ctx.fillText(resolvedText, WIDTH / 2, msgY);

  // Reset shadow
  ctx.shadowColor   = 'transparent';
  ctx.shadowBlur    = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  return canvas.toBuffer('image/png');
}

function drawDefaultBg(ctx, isGoodbye = false) {
  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  if (isGoodbye) {
    grad.addColorStop(0, '#1a0505');
    grad.addColorStop(1, '#2d0f0f');
  } else {
    grad.addColorStop(0, '#05051a');
    grad.addColorStop(1, '#0f0f2d');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function hexToRgba(hex, alpha) {
  const h    = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getWelcomeBgPath(guildId) {
  return path.join(WELCOME_BG_DIR, `${guildId}.png`);
}

function getGoodbyeBgPath(guildId) {
  return path.join(GOODBYE_BG_DIR, `${guildId}.png`);
}

/** @deprecated gunakan getWelcomeBgPath */
function getBgPath(guildId) {
  return getWelcomeBgPath(guildId);
}

module.exports = {
  generateWelcomeImage,
  generateGoodbyeImage,
  getWelcomeBgPath,
  getGoodbyeBgPath,
  getBgPath,
  WELCOME_BG_DIR,
  GOODBYE_BG_DIR,
  WIDTH,
  HEIGHT,
};