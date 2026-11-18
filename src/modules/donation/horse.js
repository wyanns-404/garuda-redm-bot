const crypto = require('crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const logger = require('../../lib/logger');
const api = require('../../lib/garuda-api');
const { baseEmbed, errorEmbed } = require('../../lib/embeds');
const { drafts, sendDonationLog } = require('./shared');

/**
 * JENIS DONASI: Kuda -> tabel `player_horses`, lewat Garuda API (bukan MySQL langsung).
 *
 * Alur:
 * 1. openForm      : modal (citizenid, nama kuda, height)
 * 2. handle 'form' : validasi + cek citizenid lewat API, lalu tampilkan embed konfirmasi
 * 3. handle 'group' / 'model' / 'gender' / 'tier' : update pilihan di embed konfirmasi
 * 4. handle 'save' : POST /horses/donation + kirim log;  'cancel' : batalkan draft
 *
 * customId komponen: donation:horse:<action>[:<draftId>]
 */
const KEY = 'horse';

const GENDERS = [
  { value: 'male', label: 'Jantan (male)' },
  { value: 'female', label: 'Betina (female)' },
];

// Nilai kolom `donasi` = tier speed kuda (sudah divalidasi oleh script horses di game)
const TIERS = [
  { value: 0, label: '0 - Tanpa tier (default)' },
  { value: 1, label: '1 - Speed 10/10' },
  { value: 9, label: '9 - Speed 9/10' },
  { value: 8, label: '8 - Speed 8/10' },
];

const HEIGHT_DEFAULT = '0';
const HEIGHT_MIN = 0.7;
const HEIGHT_MAX = 1.17;

const customId = (action, draftId) => ['donation', KEY, action, draftId].filter(Boolean).join(':');

// ============================================================
// Daftar kuda: diambil dari API (GET /catalog/horses).
// File sumbernya ada di resource: redm-resources/garuda-api/data/horses.json
// ============================================================

let groups = [];

/** Muat katalog kuda dari API. Dipanggil saat bot start (dan diulang kalau gagal). */
async function load() {
  const catalog = await api.request('GET', '/catalog/horses');
  groups = catalog.groups;
  logger.info(`Katalog kuda dimuat dari API: ${groups.length} grup.`);
}

function findGroup(groupId) {
  return groups.find((g) => g.id === groupId) || null;
}

function findHorse(model) {
  for (const group of groups) {
    const horse = group.horses.find((h) => h.model === model);
    if (horse) return { ...horse, groupId: group.id };
  }
  return null;
}

// ============================================================
// Tampilan Discord: modal, embed konfirmasi, tombol
// ============================================================

/**
 * Height: kosong / 0 -> '0' (default), selain itu angka 0.7 - 1.17 (maks 2 desimal).
 * Disimpan sebagai string karena kolom `height` bertipe VARCHAR(8).
 * @returns {string|null} null kalau tidak valid
 */
function parseHeight(raw) {
  const value = (raw || '').trim().replace(',', '.');
  if (value === '') return HEIGHT_DEFAULT;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;

  const number = Number(value);
  if (number === 0) return HEIGHT_DEFAULT;
  if (number < HEIGHT_MIN || number > HEIGHT_MAX) return null;
  return String(number);
}

/** Pesan untuk staff dari error Garuda API. */
function apiErrorMessage(err) {
  if (err.status === 0) return 'Server API tidak bisa dihubungi.';
  if (err.code === 'DISABLED') return 'Garuda API sedang dimatikan di server RedM.';
  if (err.status === 403) return 'Kamu tidak punya akses untuk aksi ini.';
  if (err.status === 409) return 'Permintaan yang sama masih diproses, tunggu sebentar.';
  if (err.status === 400) return `Data ditolak API: ${err.message}`;
  return `Terjadi kesalahan di API (${err.code}).`;
}

function tierLabel(value) {
  return TIERS.find((t) => t.value === value)?.label ?? String(value);
}

function isComplete(draft) {
  return Boolean(draft.model && draft.gender);
}

function buildConfirmation(draft, notice) {
  const group = findGroup(draft.groupId);
  const horse = draft.model ? findHorse(draft.model) : null;

  const embed = baseEmbed()
    .setTitle('🐎 Konfirmasi Donasi Kuda')
    .setDescription(
      notice ||
        'Lengkapi pilihan di bawah, lalu tekan **Simpan**.\n`horseid` akan dibuat otomatis (EXC + nomor berikutnya) saat disimpan.'
    )
    .addFields(
      { name: 'Pemilik', value: `${draft.charName} (\`${draft.citizenid}\`)`, inline: true },
      { name: 'Nama Kuda', value: draft.name, inline: true },
      { name: 'Height', value: draft.height, inline: true },
      { name: 'Ras', value: group?.label ?? '-', inline: true },
      { name: 'Model', value: horse ? `${horse.label}\n\`${horse.model}\`` : '-', inline: true },
      { name: 'Gender', value: draft.gender ?? '-', inline: true },
      { name: 'Tier Donasi', value: tierLabel(draft.tier), inline: true }
    );

  const groupSelect = new StringSelectMenuBuilder()
    .setCustomId(customId('group', draft.id))
    .setPlaceholder('1. Pilih ras kuda')
    .addOptions(
      groups.map((g) => ({
        label: g.label,
        value: g.id,
        description: `${g.horses.length} varian`,
        default: g.id === draft.groupId,
      }))
    );

  // Dropdown Discord wajib punya minimal 1 opsi, jadi saat ras belum dipilih isinya placeholder + disabled
  const modelSelect = new StringSelectMenuBuilder().setCustomId(customId('model', draft.id));
  if (group) {
    modelSelect.setPlaceholder('2. Pilih varian / model kuda').addOptions(
      group.horses.map((h) => ({
        label: h.label,
        value: h.model,
        description: h.model,
        default: h.model === draft.model,
      }))
    );
  } else {
    modelSelect
      .setPlaceholder('2. Pilih ras dulu')
      .setDisabled(true)
      .addOptions({ label: '-', value: 'none' });
  }

  const genderSelect = new StringSelectMenuBuilder()
    .setCustomId(customId('gender', draft.id))
    .setPlaceholder('3. Pilih gender')
    .addOptions(GENDERS.map((g) => ({ ...g, default: g.value === draft.gender })));

  const tierSelect = new StringSelectMenuBuilder()
    .setCustomId(customId('tier', draft.id))
    .setPlaceholder('4. Pilih tier donasi')
    .addOptions(TIERS.map((t) => ({ label: t.label, value: String(t.value), default: t.value === draft.tier })));

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(customId('save', draft.id))
      .setLabel('Simpan')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!isComplete(draft)),
    new ButtonBuilder().setCustomId(customId('cancel', draft.id)).setLabel('Batal').setEmoji('❌').setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(groupSelect),
      new ActionRowBuilder().addComponents(modelSelect),
      new ActionRowBuilder().addComponents(genderSelect),
      new ActionRowBuilder().addComponents(tierSelect),
      buttons,
    ],
  };
}

async function openForm(interaction) {
  if (groups.length === 0) {
    return interaction.reply({
      embeds: [errorEmbed('Daftar kuda belum termuat dari API. Coba lagi sebentar lagi.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(customId('form'))
    .setTitle('Donasi Kuda')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('citizenid')
          .setLabel('Citizen ID pemilik')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(9)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Nama kuda')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(255)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('height')
          .setLabel(`Height (0 = default, atau ${HEIGHT_MIN} - ${HEIGHT_MAX})`)
          .setStyle(TextInputStyle.Short)
          .setValue(HEIGHT_DEFAULT)
          .setMaxLength(4)
          .setRequired(false)
      )
    );

  await interaction.showModal(modal);
}

async function handleFormSubmit(interaction) {
  const citizenid = interaction.fields.getTextInputValue('citizenid').trim();
  const name = interaction.fields.getTextInputValue('name').trim();
  const height = parseHeight(interaction.fields.getTextInputValue('height'));

  if (!citizenid || !name) {
    return interaction.reply({ embeds: [errorEmbed('Citizen ID dan nama kuda wajib diisi.')], flags: MessageFlags.Ephemeral });
  }
  if (!/^[A-Za-z0-9]+$/.test(citizenid)) {
    return interaction.reply({ embeds: [errorEmbed('Citizen ID hanya boleh huruf dan angka.')], flags: MessageFlags.Ephemeral });
  }
  if (height === null) {
    return interaction.reply({
      embeds: [errorEmbed(`Height tidak valid. Isi \`0\` atau angka \`${HEIGHT_MIN}\` - \`${HEIGHT_MAX}\` (maks 2 desimal).`)],
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let player;
  try {
    player = await api.request('GET', `/players/${citizenid}`, { actor: api.actorFrom(interaction) });
  } catch (err) {
    const message =
      err.code === 'PLAYER_NOT_FOUND' ? `Citizen ID \`${citizenid}\` tidak ditemukan di tabel players.` : apiErrorMessage(err);
    return interaction.editReply({ embeds: [errorEmbed(message)] });
  }

  const draft = drafts.create({
    type: KEY,
    staffId: interaction.user.id,
    // 1 Request-Id per draft: kalau Simpan ditekan ulang setelah gagal koneksi, API tidak membuat kuda dobel
    requestId: crypto.randomUUID(),
    citizenid: player.citizenid,
    charName: player.name,
    name,
    height,
    groupId: null,
    model: null,
    gender: null,
    tier: 0,
    saving: false,
  });

  await interaction.editReply(buildConfirmation(draft));
}

async function save(interaction, draft) {
  if (draft.saving) return interaction.deferUpdate();
  if (!isComplete(draft)) return interaction.update(buildConfirmation(draft, '⚠️ Pilih model dan gender dulu.'));

  draft.saving = true;
  await interaction.update({ ...buildConfirmation(draft, '⏳ Menyimpan ke database...'), components: [] });

  const horse = findHorse(draft.model);

  // try HANYA membungkus panggilan API: kalau error sesudahnya (misal editReply gagal), tidak perlu Simpan lagi
  let result;
  try {
    const data = await api.request('POST', '/horses/donation', {
      actor: api.actorFrom(interaction),
      requestId: draft.requestId,
      body: {
        citizenid: draft.citizenid,
        name: draft.name,
        horse: draft.model,
        height: draft.height,
        gender: draft.gender,
        donasi: draft.tier,
      },
    });
    result = data.after;
  } catch (err) {
    draft.saving = false;
    logger.error(`Gagal simpan donasi kuda (${err.code}):`, err.message);

    const reason =
      err.code === 'PLAYER_NOT_FOUND'
        ? `Citizen ID \`${draft.citizenid}\` sudah tidak ada di tabel players.`
        : `${apiErrorMessage(err)}\nTekan **Simpan** lagi untuk mencoba ulang (aman, tidak akan membuat kuda dobel).`;
    return interaction.editReply(buildConfirmation(draft, `❌ ${reason}`));
  }

  drafts.remove(draft.id);
  logger.info(`Donasi kuda ${result.horseid} untuk ${draft.citizenid} disimpan oleh ${interaction.user.tag}.`);

  const successEmbed = baseEmbed()
    .setColor(0x2ecc71)
    .setTitle('✅ Donasi Kuda Tersimpan')
    .addFields(
      { name: 'Horse ID', value: `\`${result.horseid}\``, inline: true },
      { name: 'Pemilik', value: `${draft.charName} (\`${draft.citizenid}\`)`, inline: true },
      { name: 'Nama Kuda', value: draft.name, inline: true },
      { name: 'Model', value: `${horse.label}\n\`${horse.model}\``, inline: true },
      { name: 'Gender', value: draft.gender, inline: true },
      { name: 'Height', value: draft.height, inline: true },
      { name: 'Tier Donasi', value: tierLabel(draft.tier), inline: true },
      { name: 'Diinput oleh', value: `<@${interaction.user.id}>`, inline: true }
    )
    .setFooter({ text: `player_horses.id: ${result.id}` });

  await interaction.editReply({ embeds: [successEmbed], components: [] }).catch(() => {});
  await sendDonationLog(interaction.client, successEmbed);
}

async function handle(interaction, action, draftId) {
  if (action === 'form') return handleFormSubmit(interaction);

  const draft = drafts.get(draftId);
  if (!draft || draft.staffId !== interaction.user.id) {
    return interaction.update({
      embeds: [errorEmbed('Sesi input ini sudah kedaluwarsa. Silakan mulai lagi dari panel donasi.')],
      components: [],
    });
  }

  // Nilai select tetap dicek ke daftar resmi, jangan percaya mentah-mentah data dari client
  const value = interaction.values?.[0];

  switch (action) {
    case 'group':
      if (findGroup(value)) {
        draft.groupId = value;
        draft.model = null; // model lama belum tentu ada di ras yang baru
      }
      return interaction.update(buildConfirmation(draft));
    case 'model':
      if (findHorse(value)?.groupId === draft.groupId) draft.model = value;
      return interaction.update(buildConfirmation(draft));
    case 'gender':
      if (GENDERS.some((g) => g.value === value)) draft.gender = value;
      return interaction.update(buildConfirmation(draft));
    case 'tier':
      if (TIERS.some((t) => t.value === Number(value))) draft.tier = Number(value);
      return interaction.update(buildConfirmation(draft));
    case 'save':
      return save(interaction, draft);
    case 'cancel':
      drafts.remove(draft.id);
      return interaction.update({ embeds: [baseEmbed().setDescription('Input donasi kuda dibatalkan.')], components: [] });
    default:
      logger.warn(`Aksi donasi kuda tidak dikenal: ${action}`);
  }
}

module.exports = {
  key: KEY,
  label: 'Kuda',
  emoji: '🐎',
  load,
  openForm,
  handle,
};
