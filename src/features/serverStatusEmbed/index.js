const logger = require('../../core/logger');
const config = require('../../config');
const redmApi = require('../../services/redm/RedMApi');
const { serverStatusEmbed } = require('../../utils/embeds');

/**
 * FITUR: Auto-update embed status server di sebuah channel tertentu.
 *
 * Ini contoh POLA untuk fitur mandiri (self-contained feature):
 * - Semua logic fitur ini ada di folder ini saja (features/serverStatusEmbed/).
 * - Untuk bikin fitur baru: duplikat folder ini, ganti isinya,
 *   lalu daftarkan `.init(client)`-nya di src/core/Bot.js -> registerFeatures().
 */

let cachedMessageId = null;

async function updateStatusMessage(client) {
  const { channelId } = config.features.statusEmbed;
  if (!channelId) return; // fitur nonaktif kalau channel belum di-set

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    logger.warn(`STATUS_CHANNEL_ID (${channelId}) tidak ditemukan/tidak bisa diakses.`);
    return;
  }

  const status = await redmApi.getStatus();
  const embed = serverStatusEmbed({ serverName: config.redm.name, ...status });

  try {
    if (cachedMessageId) {
      const existing = await channel.messages.fetch(cachedMessageId).catch(() => null);
      if (existing) {
        await existing.edit({ embeds: [embed] });
        return;
      }
    }

    // Belum ada pesan sebelumnya (atau sudah terhapus) -> kirim baru & cache ID-nya
    const sent = await channel.send({ embeds: [embed] });
    cachedMessageId = sent.id;
  } catch (err) {
    logger.error('Gagal update embed status server:', err);
  }
}

function init(client) {
  const { intervalSeconds, channelId } = config.features.statusEmbed;

  if (!channelId) {
    logger.info('Fitur status embed: STATUS_CHANNEL_ID belum di-set, fitur ini nonaktif.');
    return;
  }

  client.once('clientReady', () => {
    updateStatusMessage(client); // update pertama kali begitu bot online
    setInterval(() => updateStatusMessage(client), intervalSeconds * 1000);
    logger.info(`Fitur status embed aktif, update tiap ${intervalSeconds} detik.`);
  });
}

module.exports = { init };
