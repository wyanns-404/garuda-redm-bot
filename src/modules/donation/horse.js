const path = require('path');
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
const db = require('../../lib/db');
const { baseEmbed, errorEmbed } = require('../../lib/embeds');
const { drafts, findCharacter, sendDonationLog } = require('./shared');

/**
 * JENIS DONASI: Kuda -> insert ke tabel `player_horses`.
 *
 * Alur:
 * 1. openForm      : modal (citizenid, nama kuda, height)
 * 2. handle 'form' : validasi + cek citizenid di `players`, lalu tampilkan embed konfirmasi
 * 3. handle 'group' / 'model' / 'gender' / 'tier' : update pilihan di embed konfirmasi
 * 4. handle 'save' : insert ke DB + kirim log;  'cancel' : batalkan draft
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
// Daftar kuda (data/donation/horses.json)
// Edit file JSON-nya untuk nambah/hapus kuda, lalu restart bot.
// ============================================================

const { groups } = require(path.join(__dirname, '..', '..', '..', 'data', 'donation', 'horses.json'));

// Batas dari Discord (opsi per dropdown) & dari kolom `horse` VARCHAR(50)
const MAX_OPTIONS = 25;
const MAX_MODEL_LENGTH = 50;

function validate() {
  if (groups.length > MAX_OPTIONS) {
    throw new Error(`horses.json: jumlah grup ${groups.length}, maksimal ${MAX_OPTIONS}`);
  }

  const seenModels = new Set();
  for (const group of groups) {
    if (group.horses.length > MAX_OPTIONS) {
      throw new Error(`horses.json: grup "${group.id}" punya ${group.horses.length} kuda, maksimal ${MAX_OPTIONS}`);
    }
    for (const horse of group.horses) {
      if (horse.model.length > MAX_MODEL_LENGTH) {
        throw new Error(`horses.json: model "${horse.model}" lebih dari ${MAX_MODEL_LENGTH} karakter`);
      }
      if (seenModels.has(horse.model)) {
        throw new Error(`horses.json: model "${horse.model}" duplikat`);
      }
      seenModels.add(horse.model);
    }
  }
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
// Database: insert ke `player_horses`
// ============================================================

const HORSE_ID_PREFIX = 'EXC';
const LOCK_NAME = 'garuda_bot_donation_horseid';
const LOCK_TIMEOUT_SECONDS = 10;

/**
 * Nilai kolom yang SELALU sama untuk setiap kuda donasi
 * (diambil dari template query manual sebelumnya).
 * Kalau ada nilai default yang mau diubah, cukup ubah di sini.
 */
const HORSE_DEFAULTS = {
  horsexp: 5100,
  credit: 100.0,
  components_after: null,
  components_before: null,
  textures: null,
  custom_textures: null,
  coreHP: 100,
  coreST: 100,
  health: 120,
  stamina: 120.0,
  active: 0,
  distance: 0,
  status: 0,
  notified: 0,
  tamed: 0,
  custprice: 0.0,
  custenabled: 1,
  job: 'blahorsetrainer',
  flame: 0,
  rgb: 0,
};

/**
 * Insert kuda donasi dengan horseid berurutan (EXC + angka terakhir + 1).
 *
 * Kolom horseid TIDAK unique di database, jadi pengambilan nomor terakhir + INSERT
 * dikunci pakai GET_LOCK di koneksi yang sama. Hasilnya: kalau 2 staff menekan
 * Simpan bersamaan, yang kedua menunggu sampai yang pertama selesai -> nomor tidak bentrok.
 *
 * Kalau koneksi putus SEBELUM INSERT dikirim (misal koneksi idle sudah diputus server),
 * dicoba ulang 1x dengan koneksi baru. Kalau putusnya saat/sesudah INSERT dikirim,
 * TIDAK di-retry karena tidak bisa dipastikan datanya sudah masuk atau belum (bisa dobel).
 *
 * @returns {Promise<{ id: number, horseid: string }>}
 */
async function insertDonationHorse(data) {
  const state = { insertSent: false };
  try {
    return await attemptInsert(data, state);
  } catch (err) {
    if (!err.fatal || state.insertSent) throw err;
    logger.warn(`Koneksi DB putus sebelum insert (${err.code}), mencoba ulang dengan koneksi baru...`);
    return attemptInsert(data, state);
  }
}

async function attemptInsert(data, state) {
  return db.withConnection(async (conn) => {
    const [[{ locked }]] = await conn.query('SELECT GET_LOCK(?, ?) AS locked', [LOCK_NAME, LOCK_TIMEOUT_SECONDS]);
    if (locked !== 1) {
      throw new Error('Gagal mendapatkan lock horseid (ada proses simpan lain yang belum selesai).');
    }

    try {
      // LIKE dulu supaya index `horseid` kepakai, REGEXP untuk buang horseid EXC yang bukan angka
      const [[{ lastNumber }]] = await conn.query(
        `SELECT MAX(CAST(SUBSTRING(horseid, ?) AS UNSIGNED)) AS lastNumber
         FROM player_horses
         WHERE horseid LIKE ? AND horseid REGEXP ?`,
        [HORSE_ID_PREFIX.length + 1, `${HORSE_ID_PREFIX}%`, `^${HORSE_ID_PREFIX}[0-9]+$`]
      );
      const horseid = `${HORSE_ID_PREFIX}${Number(lastNumber || 0) + 1}`;

      const row = { ...HORSE_DEFAULTS, ...data, horseid };
      const columns = Object.keys(row);
      state.insertSent = true;
      const [result] = await conn.execute(
        `INSERT INTO player_horses (${columns.map((c) => `\`${c}\``).join(', ')})
         VALUES (${columns.map(() => '?').join(', ')})`,
        columns.map((c) => row[c])
      );

      return { id: result.insertId, horseid };
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]).catch(() => {});
    }
  });
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
  if (height === null) {
    return interaction.reply({
      embeds: [errorEmbed(`Height tidak valid. Isi \`0\` atau angka \`${HEIGHT_MIN}\` - \`${HEIGHT_MAX}\` (maks 2 desimal).`)],
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const character = await findCharacter(citizenid);
  if (!character) {
    return interaction.editReply({ embeds: [errorEmbed(`Citizen ID \`${citizenid}\` tidak ditemukan di tabel players.`)] });
  }

  const draft = drafts.create({
    type: KEY,
    staffId: interaction.user.id,
    citizenid: character.citizenid,
    charName: character.name,
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

  // try HANYA membungkus insert: kalau error sesudahnya (misal editReply gagal),
  // jangan sampai staff diminta "Simpan lagi" padahal data sudah masuk -> kuda dobel
  let result;
  try {
    result = await insertDonationHorse({
      citizenid: draft.citizenid,
      name: draft.name,
      horse: draft.model,
      height: draft.height,
      gender: draft.gender,
      donasi: draft.tier,
    });
  } catch (err) {
    draft.saving = false;
    logger.error('Gagal insert donasi kuda:', err);

    const reason =
      err.code === 'ER_NO_REFERENCED_ROW_2'
        ? `Citizen ID \`${draft.citizenid}\` sudah tidak ada di tabel players.`
        : 'Terjadi kesalahan database. Data BELUM tersimpan, silakan coba Simpan lagi.';
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
  validate,
  openForm,
  handle,
};
