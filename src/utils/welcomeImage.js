const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs   = require('fs');

const WELCOME_BG_DIR = path.join(__dirname, '..', '..', 'data', 'welcome_bg');
const GOODBYE_BG_DIR = path.join(__dirname, '..', '..', 'data', 'goodbye_bg');

if (!fs.existsSync(WELCOME_BG_DIR)) fs.mkdirSync(WELCOME_BG_DIR, { recursive: true });
if (!fs.existsSync(GOODBYE_BG_DIR)) fs.mkdirSync(GOODBYE_BG_DIR, { recursive: true });

const WIDTH  = 1280;
const HEIGHT = 720;
const SCALE  = (1280 / 1000 + 720 / 400) / 2;

let FONT_TITLE     = 'sans-serif';
let FONT_BODY      = 'sans-serif';
let FONT_BODY_BOLD = 'sans-serif';

function tryRegister(filePath, alias) {
  if (fs.existsSync(filePath)) {
    try { GlobalFonts.registerFromPath(filePath, alias); return true; } catch (_) {}
  }
  return false;
}

function npmFont(pkg, file) {
  const candidates = [
    path.join(__dirname, '..', '..', 'node_modules', '@fontsource', pkg, 'files', file),
    path.join(__dirname, '..', '..', '..', 'node_modules', '@fontsource', pkg, 'files', file),
  ];
  for (const c of candidates) { if (fs.existsSync(c)) return c; }
  return null;
}

const bebasPath = npmFont('bebas-neue', 'bebas-neue-latin-400-normal.woff');
if (bebasPath && tryRegister(bebasPath, 'BebasNeue')) {
  FONT_TITLE = 'BebasNeue';
  console.log('[welcomeImage] Bebas Neue registered');
} else {
  console.warn('[welcomeImage] Bebas Neue not found. Run: npm install @fontsource/bebas-neue');
}

const montserratBoldPath = npmFont('montserrat', 'montserrat-latin-700-normal.woff');
if (montserratBoldPath && tryRegister(montserratBoldPath, 'MontserratBold')) {
  FONT_BODY_BOLD = 'MontserratBold';
}

const montserratPath = npmFont('montserrat', 'montserrat-latin-400-normal.woff');
if (montserratPath && tryRegister(montserratPath, 'Montserrat')) {
  FONT_BODY = 'Montserrat';
  console.log('[welcomeImage] Montserrat registered');
} else {
  console.warn('[welcomeImage] Montserrat not found. Run: npm install @fontsource/montserrat');
}

async function generateWelcomeImage(opts) { return _generateImage({ ...opts, type: 'welcome' }); }
async function generateGoodbyeImage(opts) { return _generateImage({ ...opts, type: 'goodbye' }); }

async function _generateImage(opts) {
  const {
    type = 'welcome', avatarURL, username, guildId,
    welcomeText, goodbyeText,
    textColor = '#ffffff', guildName = 'Server', memberCount = 0,
  } = opts;

  const isGoodbye   = type === 'goodbye';
  const messageText = isGoodbye
    ? (goodbyeText || 'See you next time, {user}!')
    : (welcomeText || 'Welcome to {server}! Member {count}');

  const resolvedText = messageText
    .replace(/{user}/g,   username)
    .replace(/{server}/g, guildName)
    .replace(/{count}/g,  `#${memberCount}`);

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext('2d');

  // Background — cover-resize automatically
  const bgDir  = isGoodbye ? GOODBYE_BG_DIR : WELCOME_BG_DIR;
  const bgPath = path.join(bgDir, `${guildId}.png`);

  if (fs.existsSync(bgPath)) {
    try {
      const bg    = await loadImage(bgPath);
      const scale = Math.max(WIDTH / bg.width, HEIGHT / bg.height);
      const drawW = bg.width  * scale;
      const drawH = bg.height * scale;
      ctx.drawImage(bg, (WIDTH - drawW) / 2, (HEIGHT - drawH) / 2, drawW, drawH);
    } catch { drawDefaultBg(ctx, isGoodbye); }
  } else { drawDefaultBg(ctx, isGoodbye); }

  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Avatar
  const avatarSize = Math.round(150 * SCALE);
  const avatarX    = WIDTH / 2;
  const avatarY    = Math.round(HEIGHT / 2 - 30 * SCALE);

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarSize / 2 + Math.round(6 * SCALE), 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

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

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor   = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur    = Math.round(10 * SCALE);
  ctx.shadowOffsetX = Math.round(2  * SCALE);
  ctx.shadowOffsetY = Math.round(2  * SCALE);

  // Label — Bebas Neue
  const labelFontSize = Math.round(34 * SCALE);
  const labelY = avatarY - avatarSize / 2 - Math.round(22 * SCALE);
  ctx.font      = `${labelFontSize}px ${FONT_TITLE}`;
  ctx.fillStyle = textColor;
  ctx.fillText(isGoodbye ? 'GOODBYE' : 'WELCOME', WIDTH / 2, labelY);

  // Username — Montserrat Bold
  const usernameFontSize = Math.round(44 * SCALE);
  const usernameY = avatarY + avatarSize / 2 + Math.round(58 * SCALE);
  ctx.font      = `bold ${usernameFontSize}px ${FONT_BODY_BOLD}`;
  ctx.fillStyle = textColor;
  ctx.fillText(username, WIDTH / 2, usernameY);

  // Sub-text — Montserrat Regular
  const msgFontSize = Math.round(24 * SCALE);
  const msgY = avatarY + avatarSize / 2 + Math.round(100 * SCALE);
  ctx.font      = `${msgFontSize}px ${FONT_BODY}`;
  ctx.fillStyle = hexToRgba(textColor, 0.90);
  ctx.fillText(resolvedText, WIDTH / 2, msgY);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  return canvas.toBuffer('image/png');
}

function drawDefaultBg(ctx, isGoodbye = false) {
  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  if (isGoodbye) {
    grad.addColorStop(0, '#1a0505'); grad.addColorStop(1, '#2d0f0f');
  } else {
    grad.addColorStop(0, '#05051a'); grad.addColorStop(1, '#0f0f2d');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function hexToRgba(hex, alpha) {
  const h    = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getWelcomeBgPath(guildId) { return path.join(WELCOME_BG_DIR, `${guildId}.png`); }
function getGoodbyeBgPath(guildId) { return path.join(GOODBYE_BG_DIR, `${guildId}.png`); }
function getBgPath(guildId) { return getWelcomeBgPath(guildId); }

module.exports = {
  generateWelcomeImage, generateGoodbyeImage,
  getWelcomeBgPath, getGoodbyeBgPath, getBgPath,
  WELCOME_BG_DIR, GOODBYE_BG_DIR, WIDTH, HEIGHT,
};
