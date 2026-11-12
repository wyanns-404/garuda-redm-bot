const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const logger = require('../../lib/logger');
const redmApi = require('../../lib/redm');
const { baseEmbed, errorEmbed, serverStatusEmbed } = require('../../lib/embeds');

/**
 * FITUR: Status server RedM.
 * - /status   : status server (online/offline & jumlah pemain)
 * - /players  : daftar lengkap pemain online
 * - Auto-update embed status di STATUS_CHANNEL_ID tiap STATUS_UPDATE_INTERVAL detik
 */

/** @type {import('../../lib/modules').SlashCommand} */
const status = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Lihat status server RedM saat ini (online/offline & jumlah pemain)'),

  async execute(interaction) {
    await interaction.deferReply();
    const result = await redmApi.getStatus();

    const embed = serverStatusEmbed({
      serverName: config.redm.name,
      ...result,
    });

    await interaction.editReply({ embeds: [embed] });
  },
};

/** @type {import('../../lib/modules').SlashCommand} */
const players = {
  data: new SlashCommandBuilder()
    .setName('players')
    .setDescription('Lihat daftar lengkap pemain yang sedang online di server RedM'),

  async execute(interaction) {
    await interaction.deferReply();

    const list = await redmApi.getPlayers().catch(() => null);

    if (!list) {
      return interaction.editReply({
        embeds: [errorEmbed('Tidak bisa mengambil data pemain. Pastikan server RedM sedang online.')],
      });
    }

    if (list.length === 0) {
      return interaction.editReply({
        embeds: [baseEmbed().setTitle('Daftar Pemain').setDescription('Tidak ada pemain online saat ini.')],
      });
    }

    const text = list.map((p, i) => `${i + 1}. **${p.name}** (ping: ${p.ping}ms)`).join('\n');
    const embed = baseEmbed().setTitle(`Daftar Pemain Online (${list.length})`).setDescription(text.slice(0, 4000));

    await interaction.editReply({ embeds: [embed] });
  },
};

let cachedMessageId = null;

async function updateStatusMessage(client) {
  const { channelId } = config.features.statusEmbed;
  if (!channelId) return; // fitur nonaktif kalau channel belum di-set

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    logger.warn(`STATUS_CHANNEL_ID (${channelId}) tidak ditemukan/tidak bisa diakses.`);
    return;
  }

  const result = await redmApi.getStatus();
  const embed = serverStatusEmbed({ serverName: config.redm.name, ...result });

  try {
    // Pertama kali setelah bot start: cari embed status lama dari bot ini di channel,
    // supaya pesan itu yang diedit (tidak dobel tiap bot restart), sama seperti panel donasi.
    if (!cachedMessageId) {
      const recent = await channel.messages.fetch({ limit: 50 });
      const old = recent.find((m) => m.author.id === client.user.id && m.embeds[0]?.title === embed.data.title);
      if (old) cachedMessageId = old.id;
    }

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

/** @type {import('../../lib/modules').BotModule} */
const modul = { commands: [status, players], init };
module.exports = modul;
