const crypto = require('crypto');

/**
 * Penyimpanan sementara (in-memory) untuk data donasi yang sedang diisi staff,
 * dari modal sampai tombol Simpan ditekan.
 *
 * TTL dibuat sedikit di bawah 15 menit karena token interaction Discord
 * cuma berlaku 15 menit — lewat dari itu pesan konfirmasi tidak bisa diedit lagi.
 * Kalau bot restart, draft yang sedang diisi ikut hilang (staff cukup input ulang).
 */
const TTL_MS = 14 * 60 * 1000;
const drafts = new Map();

function create(data) {
  const id = crypto.randomBytes(4).toString('hex');
  drafts.set(id, { ...data, id, createdAt: Date.now() });
  return drafts.get(id);
}

function get(id) {
  const draft = drafts.get(id);
  if (!draft) return null;
  if (Date.now() - draft.createdAt > TTL_MS) {
    drafts.delete(id);
    return null;
  }
  return draft;
}

function remove(id) {
  drafts.delete(id);
}

// Bersihkan draft kedaluwarsa secara berkala supaya Map tidak terus membesar
setInterval(() => {
  for (const [id, draft] of drafts) {
    if (Date.now() - draft.createdAt > TTL_MS) drafts.delete(id);
  }
}, 5 * 60 * 1000).unref();

module.exports = { create, get, remove };
