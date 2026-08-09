const { EmbedBuilder } = require('discord.js');

/**
 * Kumpulan builder embed yang dipakai berulang kali.
 * Biar tampilan bot konsisten, semua embed "bertema" dibuat lewat sini
 * daripada bikin `new EmbedBuilder()` polos di banyak file.
 */
function baseEmbed() {
  return new EmbedBuilder().setColor(0xb5651d).setTimestamp(); // warna coklat khas RedM/western
}

function serverStatusEmbed({ serverName, online, clients, maxClients, players }) {
  const embed = baseEmbed()
    .setTitle(`🤠 ${serverName}`)
    .setDescription(online ? 'Server sedang **ONLINE**' : 'Server sedang **OFFLINE**')
    .addFields({ name: 'Pemain', value: `${clients ?? 0} / ${maxClients ?? 0}`, inline: true });

  if (online && players?.length) {
    const preview = players
      .slice(0, 15)
      .map((p) => `• ${p.name}`)
      .join('\n');
    embed.addFields({
      name: `Daftar Pemain (${players.length})`,
      value: preview || 'Tidak ada pemain',
    });
  }

  return embed;
}

function errorEmbed(message) {
  return baseEmbed().setColor(0xe74c3c).setTitle('❌ Terjadi Kesalahan').setDescription(message);
}

module.exports = { baseEmbed, serverStatusEmbed, errorEmbed };
