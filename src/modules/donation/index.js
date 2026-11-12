const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const config = require('../../config');
const logger = require('../../lib/logger');
const db = require('../../lib/db');
const { baseEmbed, errorEmbed } = require('../../lib/embeds');

/**
 * FITUR: Panel donasi untuk staff Garuda RedM.
 *
 * - Panel (embed + tombol per jenis donasi) dipasang di DONATION_CHANNEL_ID.
 * - Hanya member dengan DONATION_STAFF_ROLE_ID yang boleh memakai panel.
 * - Setiap jenis donasi punya file sendiri (horse.js, nanti pet.js, wagon.js, ...),
 *   karena tiap jenis insert ke tabel database yang berbeda.
 *
 * customId semua komponen fitur ini diawali "donation:".
 */

/**
 * Daftar jenis donasi yang tampil sebagai tombol di panel.
 * Jenis yang sudah jadi: require file-nya (lihat horse.js untuk bentuknya).
 * Jenis yang belum jadi: cukup { key, label, emoji, comingSoon: true } -> tombol tampil tapi disabled.
 *
 * Nambah jenis baru (misal wagon): bikin wagon.js mengikuti pola horse.js,
 * lalu ganti entri comingSoon di bawah dengan require('./wagon').
 */
const TYPES = [
  require('./horse'),
  { key: 'pet', label: 'Pet', emoji: '🐕', comingSoon: true },
  { key: 'kantong', label: 'Kantong', emoji: '🎒', comingSoon: true },
  { key: 'wagon', label: 'Wagon', emoji: '🛻', comingSoon: true },
];

const PANEL_PREFIX = 'donation:panel:';
let enabled = false;

function findType(key) {
  const type = TYPES.find((t) => t.key === key);
  return type && !type.comingSoon ? type : null;
}

function hasStaffRole(interaction) {
  const { staffRoleId } = config.features.donation;
  const roles = interaction.member?.roles;
  if (!roles) return false;
  // member dari cache = GuildMember (roles.cache), kalau tidak = data mentah API (array id)
  return Array.isArray(roles) ? roles.includes(staffRoleId) : roles.cache.has(staffRoleId);
}

async function handle(interaction) {
  if (!enabled || !hasStaffRole(interaction)) {
    return interaction.reply({
      embeds: [errorEmbed('Kamu tidak punya akses untuk input donasi.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  // donation:panel:<jenis>  atau  donation:<jenis>:<aksi>[:<draftId>]
  const [, scope, ...rest] = interaction.customId.split(':');

  if (scope === 'panel') {
    const type = findType(rest[0]);
    if (!type) {
      return interaction.reply({ embeds: [errorEmbed('Jenis donasi ini belum tersedia.')], flags: MessageFlags.Ephemeral });
    }
    return type.openForm(interaction);
  }

  const type = findType(scope);
  if (!type) {
    logger.warn(`Jenis donasi tidak dikenal: ${interaction.customId}`);
    return;
  }
  const [action, draftId] = rest;
  return type.handle(interaction, action, draftId);
}

function buildPanel() {
  const embed = baseEmbed()
    .setTitle('🎁 Panel Donasi Garuda RedM')
    .setDescription(
      [
        'Panel khusus staff untuk memasukkan hadiah donasi pemain ke database server.',
        '',
        'Pilih jenis donasi di bawah, isi form, cek konfirmasi, lalu tekan **Simpan**.',
        'Semua input tercatat di channel log donasi.',
      ].join('\n')
    );

  const row = new ActionRowBuilder().addComponents(
    TYPES.map((type) =>
      new ButtonBuilder()
        .setCustomId(`${PANEL_PREFIX}${type.key}`)
        .setLabel(type.comingSoon ? `${type.label} (segera)` : type.label)
        .setEmoji(type.emoji)
        .setStyle(type.comingSoon ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(Boolean(type.comingSoon))
    )
  );

  return { embeds: [embed], components: [row] };
}

function isPanelMessage(message, botId) {
  return (
    message.author.id === botId &&
    message.components.some((row) => row.components?.some((c) => c.customId?.startsWith(PANEL_PREFIX)))
  );
}

/**
 * Pasang panel di DONATION_CHANNEL_ID.
 * Kalau panel lama (dari bot ini) sudah ada di channel, pesan itu yang diedit
 * supaya tidak dobel tiap bot restart, sekaligus ikut ter-update kalau ada jenis donasi baru.
 */
async function ensurePanel(client) {
  const { channelId } = config.features.donation;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    logger.warn(`DONATION_CHANNEL_ID (${channelId}) tidak ditemukan/tidak bisa diakses.`);
    return;
  }

  try {
    const recent = await channel.messages.fetch({ limit: 50 });
    const existing = recent.find((m) => isPanelMessage(m, client.user.id));

    if (existing) {
      await existing.edit(buildPanel());
    } else {
      await channel.send(buildPanel());
    }
  } catch (err) {
    logger.error('Gagal memasang panel donasi:', err);
  }
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
  for (const type of TYPES) {
    if (!type.comingSoon) type.validate?.();
  }

  enabled = true;
  client.once('clientReady', () => {
    ensurePanel(client);
    logger.info(`Fitur donasi aktif di channel ${channelId}.`);
  });
}

/** @type {import('../../lib/modules').BotModule} */
const modul = { components: { prefix: 'donation', handle }, init };
module.exports = modul;
