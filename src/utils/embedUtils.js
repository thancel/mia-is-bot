/**
 * embedUtils.js — Shared embed helpers
 * - randomColor()  : generates a random vibrant Discord embed color
 * - quickEmbed()   : returns an embed array with a random color
 * - fixedEmbed()   : returns an embed array with a specific color
 */

const { EmbedBuilder } = require('discord.js');

/**
 * Returns a random vibrant hex color as a 24-bit integer.
 * Avoids very dark or very desaturated colors for readability.
 */
function randomColor() {
  // Pick from a curated palette of vibrant colors
  const palette = [
    0x5865F2, // Discord Blurple
    0x57F287, // Green
    0xFEE75C, // Yellow
    0xEB459E, // Pink
    0xED4245, // Red
    0xFF7F50, // Coral
    0x1ABC9C, // Turquoise
    0x3498DB, // Blue
    0x9B59B6, // Purple
    0xE67E22, // Orange
    0x2ECC71, // Emerald
    0xE91E63, // Hot Pink
    0x00BCD4, // Cyan
    0xFF5722, // Deep Orange
    0x8BC34A, // Light Green
    0x673AB7, // Deep Purple
    0x009688, // Teal
    0xF06292, // Light Pink
    0x42A5F5, // Light Blue
    0xFFCA28, // Amber
  ];
  return palette[Math.floor(Math.random() * palette.length)];
}

/**
 * Quick embed with RANDOM color.
 * @param {string} description
 * @returns {EmbedBuilder[]}
 */
function quickEmbed(description) {
  return [new EmbedBuilder().setColor(randomColor()).setDescription(description)];
}

/**
 * Quick embed with a FIXED color (for error states, success states, etc.)
 * @param {number|string} color
 * @param {string} description
 * @returns {EmbedBuilder[]}
 */
function fixedEmbed(color, description) {
  return [new EmbedBuilder().setColor(color).setDescription(description)];
}

module.exports = { randomColor, quickEmbed, fixedEmbed };
