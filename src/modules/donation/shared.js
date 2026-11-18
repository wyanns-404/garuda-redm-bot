const crypto = require('crypto');
const config = require('../../config');
const logger = require('../../lib/logger');

/**
 * Helper yang dipakai SEMUA jenis donasi (kuda, pet, wagon, ...).
 */

/**
 * Draft = data donasi yang sedang diisi staff, dari modal sampai tombol Simpan ditekan.
 * Disimpan in-memory; TTL sedikit di bawah 15 menit karena token interaction Discord
 * cuma berlaku 15 menit. Kalau bot restart, draft hilang (staff cukup input ulang).
 */
const DRAFT_TTL_MS = 14 * 60 * 1000;
const draftStore = new Map();

const drafts = {
  create(data) {
    const id = crypto.randomBytes(4).toString('hex');
    draftStore.set(id, { ...data, id, createdAt: Date.now() });
    return draftStore.get(id);
  },
  get(id) {
    const draft = draftStore.get(id);
    if (!draft) return null;
    if (Date.now() - draft.createdAt > DRAFT_TTL_MS) {
      draftStore.delete(id);
      return null;
    }
    return draft;
  },
  remove(id) {
    draftStore.delete(id);
  },
};

// Bersihkan draft kedaluwarsa secara berkala supaya Map tidak terus membesar
setInterval(() => {
  for (const [id, draft] of draftStore) {
    if (Date.now() - draft.createdAt > DRAFT_TTL_MS) draftStore.delete(id);
  }
}, 5 * 60 * 1000).unref();

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

module.exports = { drafts, sendDonationLog };
