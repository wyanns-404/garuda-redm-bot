const crypto = require('crypto');
const axios = require('axios');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  FileUploadBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
} = require('discord.js');
const config = require('../../config');
const logger = require('../../lib/logger');
const { baseEmbed, errorEmbed } = require('../../lib/embeds');

/**
 * FITUR: Upload gambar ke Cloudflare R2 supaya dapat link permanen (misal untuk pinboard in-game).
 *
 * Link lampiran Discord kedaluwarsa kalau dipakai di luar Discord, jadi bot mengambil gambarnya
 * lalu menyimpannya lewat Cloudflare Worker (kodenya ada di README, bagian Upload Gambar) ke bucket R2.
 *
 * Alur: panel di IMAGE_CHANNEL_ID -> tombol "Upload Gambar" -> form dengan kolom upload
 *       -> bot cek role, tipe & ukuran -> simpan ke R2 -> balas link -> catat ke IMAGE_LOG_CHANNEL_ID
 */

const PREFIX = 'image';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
let enabled = false;

/**
 * Tentukan jenis gambar dari isi file (bukan dari nama/ekstensi, karena itu bisa dipalsukan).
 * @returns {'png' | 'jpg' | 'webp' | null}
 */
function detectImageType(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function hasUploadRole(interaction) {
  const { roleId } = config.features.imageUpload;
  const roles = interaction.member?.roles;
  if (!roles) return false;
  // member dari cache = GuildMember (roles.cache), kalau tidak = data mentah API (array id)
  return Array.isArray(roles) ? roles.includes(roleId) : roles.cache.has(roleId);
}

function buildForm() {
  const fileInput = new FileUploadBuilder().setCustomId('file').setRequired(true).setMaxValues(1);
  const label = new LabelBuilder().setLabel('Gambar (PNG/JPG/WEBP, maks 5 MB)').setFileUploadComponent(fileInput);

  return new ModalBuilder().setCustomId(`${PREFIX}:submit`).setTitle('Upload Gambar').addLabelComponents(label);
}

/**
 * Simpan gambar ke R2 lewat Worker, lalu kembalikan link publiknya.
 * Bentuk link: https://domain.com/images/<IMAGE_FILE_PREFIX>-<12 karakter acak>.<ext>
 */
async function uploadToCloudflare(buffer, type) {
  const { workerUrl, uploadSecret, filePrefix } = config.features.imageUpload;
  const fileName = `${filePrefix}-${crypto.randomBytes(9).toString('base64url')}.${type}`;
  const url = `${workerUrl.replace(/\/+$/, '')}/images/${fileName}`;

  await axios.put(url, buffer, {
    headers: { Authorization: `Bearer ${uploadSecret}`, 'Content-Type': 'application/octet-stream' },
    timeout: 30000,
  });
  return url;
}

async function sendUploadLog(client, embed) {
  const { logChannelId } = config.features.imageUpload;
  if (!logChannelId) return;

  try {
    const channel = await client.channels.fetch(logChannelId);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.error(`Gagal kirim log upload gambar ke channel ${logChannelId}:`, err);
  }
}

async function handleSubmit(interaction) {
  const file = interaction.fields.getUploadedFiles('file', true).first();
  if (!file) {
    return interaction.reply({ embeds: [errorEmbed('Tidak ada file yang diupload.')], flags: MessageFlags.Ephemeral });
  }
  if (file.size > MAX_BYTES) {
    return interaction.reply({
      embeds: [errorEmbed(`Ukuran file terlalu besar (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimal 5 MB.`)],
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Ambil gambar dari Discord selagi link-nya masih berlaku
  const { data } = await axios.get(file.url, { responseType: 'arraybuffer', maxContentLength: MAX_BYTES, timeout: 30000 });
  const buffer = Buffer.from(data);

  const type = detectImageType(buffer);
  if (!type) {
    return interaction.editReply({ embeds: [errorEmbed('File harus berupa gambar PNG, JPG, atau WEBP.')] });
  }

  const link = await uploadToCloudflare(buffer, type);
  const sizeKb = Math.round(buffer.length / 1024);
  logger.info(`Gambar diupload oleh ${interaction.user.tag}: ${link} (${sizeKb} KB)`);

  await interaction.editReply({
    embeds: [
      baseEmbed()
        .setTitle('✅ Gambar berhasil diupload')
        .setDescription(`Link permanen (salin untuk pinboard):\n\`\`\`\n${link}\n\`\`\``)
        .setImage(link),
    ],
  });

  await sendUploadLog(
    interaction.client,
    baseEmbed()
      .setTitle('🖼️ Upload Gambar')
      .addFields(
        { name: 'Diupload oleh', value: `${interaction.user} (${interaction.user.tag})` },
        { name: 'Link', value: link },
        { name: 'File asli', value: `${file.name} (${sizeKb} KB)` }
      )
      .setImage(link)
  );
}

async function handle(interaction) {
  if (!enabled || !hasUploadRole(interaction)) {
    return interaction.reply({
      embeds: [errorEmbed('Kamu tidak punya akses untuk upload gambar.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  // image:open (tombol panel) atau image:submit (form dikirim)
  const action = interaction.customId.split(':')[1];
  if (action === 'open' && interaction.isButton()) return interaction.showModal(buildForm());
  if (action === 'submit' && interaction.isModalSubmit()) return handleSubmit(interaction);
}

function buildPanel() {
  const embed = baseEmbed()
    .setTitle('🖼️ Upload Gambar Garuda RedM')
    .setDescription(
      [
        'Upload gambar untuk mendapatkan **link permanen**, misalnya untuk pinboard in-game.',
        '',
        'Tekan **Upload Gambar**, pilih file (PNG/JPG/WEBP, maks 5 MB), lalu kirim.',
        'Link hanya terlihat oleh kamu, dan setiap upload tercatat di channel log.',
      ].join('\n')
    );

  const button = new ButtonBuilder()
    .setCustomId(`${PREFIX}:open`)
    .setLabel('Upload Gambar')
    .setEmoji('📤')
    .setStyle(ButtonStyle.Primary);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] };
}

/**
 * Pasang panel di IMAGE_CHANNEL_ID. Kalau panel lama dari bot ini sudah ada,
 * pesan itu yang diedit supaya tidak dobel tiap bot restart (sama seperti panel donasi).
 */
async function ensurePanel(client) {
  const { channelId } = config.features.imageUpload;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    logger.warn(`IMAGE_CHANNEL_ID (${channelId}) tidak ditemukan/tidak bisa diakses.`);
    return;
  }

  try {
    const recent = await channel.messages.fetch({ limit: 50 });
    const existing = recent.find(
      (m) =>
        m.author.id === client.user.id &&
        m.components.some((row) => row.components?.some((c) => c.customId === `${PREFIX}:open`))
    );

    if (existing) {
      await existing.edit(buildPanel());
    } else {
      await channel.send(buildPanel());
    }
  } catch (err) {
    logger.error('Gagal memasang panel upload gambar:', err);
  }
}

function init(client) {
  const { channelId, roleId, workerUrl, uploadSecret, filePrefix } = config.features.imageUpload;

  if (!channelId) {
    logger.info('Fitur upload gambar: IMAGE_CHANNEL_ID belum di-set, fitur ini nonaktif.');
    return;
  }
  if (!roleId) {
    logger.warn('Fitur upload gambar: IMAGE_UPLOAD_ROLE_ID belum di-set, fitur ini nonaktif (demi keamanan).');
    return;
  }
  if (!workerUrl || !uploadSecret) {
    logger.warn('Fitur upload gambar: IMAGE_WORKER_URL / IMAGE_UPLOAD_SECRET belum di-set, fitur ini nonaktif.');
    return;
  }
  // Harus sama dengan aturan nama file di Kode Worker (README, bagian Upload Gambar)
  if (!/^[A-Za-z0-9_]{1,20}$/.test(filePrefix)) {
    logger.warn('Fitur upload gambar: IMAGE_FILE_PREFIX hanya boleh huruf, angka, _ (maks 20), fitur ini nonaktif.');
    return;
  }

  enabled = true;
  client.once('clientReady', () => {
    ensurePanel(client);
    logger.info(`Fitur upload gambar aktif di channel ${channelId}.`);
  });
}

/** @type {import('../../lib/modules').BotModule} */
const modul = { components: { prefix: PREFIX, handle }, init };
module.exports = modul;
