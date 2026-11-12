const mysql = require('mysql2/promise');
const config = require('../config');

/**
 * Pool koneksi MySQL ke database server RedM.
 * Semua query ke database lewat sini, jadi kalau nanti ganti library/driver
 * cukup ubah file ini saja.
 *
 * Pool dibuat "lazy" (saat pertama dipakai) supaya bot tetap bisa jalan
 * walaupun DB_* belum di-set — fitur yang butuh DB cukup cek isConfigured().
 */
let pool = null;

function isConfigured() {
  const { host, user, name } = config.database;
  return Boolean(host && user && name);
}

function getPool() {
  if (!isConfigured()) {
    throw new Error('Konfigurasi database (DB_HOST/DB_USER/DB_NAME) belum di-set di .env');
  }

  if (!pool) {
    pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.name,
      connectionLimit: 5,
      charset: 'utf8mb4',
      // Server DB beda mesin: koneksi yang lama nganggur bisa diputus firewall/MySQL
      // tanpa pool tahu (-> ECONNRESET). Jadi koneksi idle ditutup sendiri setelah 30 detik
      // dan TCP keepalive dinyalakan supaya koneksi yang sedang dipakai tidak dianggap mati.
      maxIdle: 0,
      idleTimeout: 30000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }
  return pool;
}

/**
 * Query biasa (prepared statement). Return-nya baris hasil query saja.
 */
async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/**
 * Pinjam 1 koneksi khusus, misal untuk transaksi atau GET_LOCK yang harus
 * berjalan di koneksi yang sama. Koneksi otomatis dikembalikan ke pool.
 */
async function withConnection(fn) {
  const conn = await getPool().getConnection();
  try {
    const result = await fn(conn);
    conn.release();
    return result;
  } catch (err) {
    // Koneksi yang error fatal (putus, reset) dibuang, jangan dikembalikan ke pool
    if (err.fatal) conn.destroy();
    else conn.release();
    throw err;
  }
}

module.exports = { isConfigured, query, withConnection };
