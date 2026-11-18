const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const config = require('../../config');
const logger = require('../../lib/logger');
const api = require('../../lib/garuda-api');
const { baseEmbed, errorEmbed } = require('../../lib/embeds');

/**
 * FITUR: Panel donasi untuk staff Garuda RedM.
 *
 * - Panel (embed + tombol per jenis donasi) dipasang di DONATION_CHANNEL_ID.
 * - Data disimpan lewat Garuda API (resource di server RedM), bukan MySQL langsung.
 * - Izin ditentukan API dari role Discord pelaku: minimal level "staff" untuk donasi.
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
const STAFF_LEVELS = ['staff', 'admin', 'owner'];
const RELOAD_INTERVAL_MS = 60 * 1000;
let enabled = false;

function findType(key) {
  const type = TYPES.find((t) => t.key === key);
  return type && !type.comingSoon ? type : null;
}

const deny = (interaction, message) =>
  interaction.reply({ embeds: [errorEmbed(message)], flags: MessageFlags.Ephemeral });

async function handle(interaction) {
  if (!enabled) return deny(interaction, 'Fitur donasi sedang nonaktif.');

  // donation:panel:<jenis>  atau  donation:<jenis>:<aksi>[:<draftId>]
  const [, scope, ...rest] = interaction.customId.split(':');

  if (scope === 'panel') {
    const type = findType(rest[0]);
    if (!type) return deny(interaction, 'Jenis donasi ini belum tersedia.');

    // Cek level ke API sebelum membuka form. Langkah sesudahnya (form, simpan) juga dicek ulang oleh API.
    let level;
    try {
      ({ level } = await api.request('POST', '/me', { actor: api.actorFrom(interaction) }));
    } catch (err) {
      if (err.code === 'DISABLED') return deny(interaction, 'Garuda API sedang dimatikan di server RedM.');
      logger.error(`Gagal cek akses donasi ke API (${err.code}):`, err.message);
      return deny(interaction, 'Server API tidak bisa dihubungi. Coba lagi sebentar lagi.');
    }
    if (!STAFF_LEVELS.includes(level)) return deny(interaction, 'Kamu tidak punya akses untuk input donasi.');

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

/**
 * Muat data tiap jenis donasi dari API (misal katalog kuda).
 * Kalau API belum bisa dihubungi, dicoba ulang tiap 1 menit sampai berhasil.
 * Log hanya ditulis saat penyebab gagalnya berubah, supaya console bot tidak penuh tiap menit.
 */
async function loadType(type, lastError = null) {
  try {
    await type.load();
  } catch (err) {
    if (err.code !== lastError) {
      logger.warn(`Gagal memuat data donasi "${type.key}" dari API (${err.code}): ${err.message}. Dicoba ulang tiap 1 menit.`);
    }
    setTimeout(() => loadType(type, err.code), RELOAD_INTERVAL_MS);
  }
}

function init(client) {
  const { channelId } = config.features.donation;

  if (!channelId) {
    logger.info('Fitur donasi: DONATION_CHANNEL_ID belum di-set, fitur ini nonaktif.');
    return;
  }
  if (!config.garudaApi.enabled) {
    logger.info('Fitur donasi: Garuda API dimatikan (GARUDA_API_ENABLED bukan true), fitur ini nonaktif.');
    return;
  }
  if (!api.isConfigured()) {
    logger.warn('Fitur donasi: GARUDA_API_URL / GARUDA_API_SECRET belum di-set, fitur ini nonaktif.');
    return;
  }

  enabled = true;
  client.once('clientReady', () => {
    ensurePanel(client);
    for (const type of TYPES) {
      if (!type.comingSoon && type.load) loadType(type);
    }
    logger.info(`Fitur donasi aktif di channel ${channelId}.`);
  });
}

/** @type {import('../../lib/modules').BotModule} */
const modul = { components: { prefix: 'donation', handle }, init };
module.exports = modul;
