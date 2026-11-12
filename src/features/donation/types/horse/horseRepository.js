const db = require('../../../../services/database');
const logger = require('../../../../core/logger');

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
 * Insert kuda donasi ke `player_horses` dengan horseid berurutan (EXC + angka terakhir + 1).
 *
 * Kolom horseid TIDAK unique di database, jadi pengambilan nomor terakhir + INSERT
 * dikunci pakai GET_LOCK di koneksi yang sama. Hasilnya: kalau 2 staff menekan
 * Simpan bersamaan, yang kedua menunggu sampai yang pertama selesai -> nomor tidak bentrok.
 *
 * Kalau koneksi putus SEBELUM INSERT dikirim (misal koneksi idle sudah diputus server),
 * dicoba ulang 1x dengan koneksi baru. Kalau putusnya saat/sesudah INSERT dikirim,
 * TIDAK di-retry karena tidak bisa dipastikan datanya sudah masuk atau belum (bisa dobel).
 *
 * @param {{ citizenid: string, name: string, horse: string, height: string, gender: string, donasi: number }} data
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

module.exports = { insertDonationHorse };
