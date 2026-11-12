const config = require('../../config');
const logger = require('../../core/logger');

/**
 * Kirim embed log donasi ke DONATION_LOG_CHANNEL_ID.
 * Gagal kirim log TIDAK membatalkan donasi (data sudah masuk DB), cukup dicatat di console.
 */
async function sendDonationLog(client, embed) {
  const { logChannelId } = config.features.donation;
  if (!logChannelId) return;

  try {
    const channel = await client.channels.fetch(logChannelId);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.error(`Gagal kirim log donasi ke channel ${logChannelId}:`, err);
  }
}

module.exports = { sendDonationLog };
