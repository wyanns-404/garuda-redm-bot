const { EmbedBuilder } = require('discord.js');

/**
 * Kumpulan builder embed yang dipakai berulang kali.
 * Biar tampilan bot konsisten, semua embed "bertema" dibuat lewat sini
 * daripada bikin `new EmbedBuilder()` polos di banyak file.
 */
function baseEmbed() {
  return new EmbedBuilder().setColor(0xb5651d).setTimestamp(); // warna coklat khas RedM/western
}

function errorEmbed(message) {
  return baseEmbed().setColor(0xe74c3c).setTitle('❌ Terjadi Kesalahan').setDescription(message);
}

module.exports = { baseEmbed, errorEmbed };
