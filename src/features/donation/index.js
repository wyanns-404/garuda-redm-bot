const { MessageFlags } = require('discord.js');
const config = require('../../config');
const logger = require('../../core/logger');
const db = require('../../services/database');
const { errorEmbed } = require('../../utils/embeds');
const donationTypes = require('./types');
const { ensurePanel } = require('./panel');

/**
 * FITUR: Panel donasi untuk staff Garuda RedM.
 *
 * - Panel (embed + tombol per jenis donasi) dipasang di DONATION_CHANNEL_ID.
 * - Hanya member dengan DONATION_STAFF_ROLE_ID yang boleh memakai panel.
 * - Setiap jenis donasi (kuda, pet, ...) punya handler sendiri di types/<jenis>/,
 *   karena tiap jenis insert ke tabel database yang berbeda.
 *
 * customId semua komponen fitur ini diawali "donation:" dan dirutekan
 * ke handleInteraction() lewat client.componentHandlers.
 */

function hasStaffRole(interaction) {
  const { staffRoleId } = config.features.donation;
  const roles = interaction.member?.roles;
  if (!roles) return false;
  // member dari cache = GuildMember (roles.cache), kalau tidak = data mentah API (array id)
  return Array.isArray(roles) ? roles.includes(staffRoleId) : roles.cache.has(staffRoleId);
}

async function handleInteraction(interaction) {
  if (!hasStaffRole(interaction)) {
    return interaction.reply({
      embeds: [errorEmbed('Kamu tidak punya akses untuk input donasi.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  // donation:panel:<jenis>  atau  donation:<jenis>:<aksi>[:<draftId>]
  const [, scope, ...rest] = interaction.customId.split(':');

  if (scope === 'panel') {
    const type = donationTypes.get(rest[0]);
    if (!type) {
      return interaction.reply({ embeds: [errorEmbed('Jenis donasi ini belum tersedia.')], flags: MessageFlags.Ephemeral });
    }
    return type.openForm(interaction);
  }

  const type = donationTypes.get(scope);
  if (!type) {
    logger.warn(`Jenis donasi tidak dikenal: ${interaction.customId}`);
    return;
  }
  const [action, draftId] = rest;
  return type.handle(interaction, action, draftId);
}

function init(client) {
  const { channelId, staffRoleId } = config.features.donation;

  if (!channelId) {
    logger.info('Fitur donasi: DONATION_CHANNEL_ID belum di-set, fitur ini nonaktif.');
    return;
  }
  if (!staffRoleId) {
    logger.warn('Fitur donasi: DONATION_STAFF_ROLE_ID belum di-set, fitur ini nonaktif (demi keamanan).');
    return;
  }
  if (!db.isConfigured()) {
    logger.warn('Fitur donasi: konfigurasi database (DB_*) belum lengkap, fitur ini nonaktif.');
    return;
  }

  // Validasi data tiap jenis donasi (misal horses.json) sejak awal, biar error ketahuan saat start
  for (const type of donationTypes.getAll()) {
    if (!type.comingSoon) type.validate?.();
  }

  client.componentHandlers.set('donation', handleInteraction);

  client.once('clientReady', () => {
    ensurePanel(client);
    logger.info(`Fitur donasi aktif di channel ${channelId}.`);
  });
}

module.exports = { init };
