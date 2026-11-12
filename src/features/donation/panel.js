const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const logger = require('../../core/logger');
const { baseEmbed } = require('../../utils/embeds');
const donationTypes = require('./types');

const PANEL_PREFIX = 'donation:panel:';

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
    donationTypes.getAll().map((type) =>
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

module.exports = { ensurePanel, PANEL_PREFIX };
