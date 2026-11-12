const db = require('../../services/database');

/**
 * Cari karakter di tabel `players` berdasarkan citizenid.
 * Dipakai semua jenis donasi untuk validasi pemilik + menampilkan nama karakter.
 *
 * @returns {Promise<{ citizenid: string, name: string } | null>}
 */
async function findCharacter(citizenid) {
  const rows = await db.query('SELECT citizenid, charinfo FROM players WHERE citizenid = ? LIMIT 1', [citizenid]);
  if (rows.length === 0) return null;

  return { citizenid: rows[0].citizenid, name: parseCharacterName(rows[0].charinfo) };
}

// charinfo bisa berupa string JSON (kolom longtext) atau object (kolom JSON)
function parseCharacterName(charinfo) {
  try {
    const info = typeof charinfo === 'string' ? JSON.parse(charinfo) : charinfo;
    const name = [info?.firstname, info?.lastname].filter(Boolean).join(' ');
    return name || 'Tanpa nama';
  } catch {
    return 'Tanpa nama';
  }
}

module.exports = { findCharacter };
