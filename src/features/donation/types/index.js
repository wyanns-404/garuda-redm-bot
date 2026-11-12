/**
 * Daftar jenis donasi yang tampil sebagai tombol di panel.
 *
 * Jenis yang sudah jadi: object handler lengkap (lihat types/horse/index.js),
 * minimal punya { key, label, emoji, openForm(interaction), handle(interaction, action, draftId) }.
 * Jenis yang belum jadi: cukup { key, label, emoji, comingSoon: true } -> tombolnya tampil tapi disabled.
 *
 * Nambah jenis baru (misal wagon): bikin folder types/wagon/ mengikuti pola horse,
 * lalu ganti entri comingSoon di bawah dengan require('./wagon').
 */
const types = [
  require('./horse'),
  { key: 'pet', label: 'Pet', emoji: '🐕', comingSoon: true },
  { key: 'kantong', label: 'Kantong', emoji: '🎒', comingSoon: true },
  { key: 'wagon', label: 'Wagon', emoji: '🛻', comingSoon: true },
];

function getAll() {
  return types;
}

function get(key) {
  const type = types.find((t) => t.key === key);
  return type && !type.comingSoon ? type : null;
}

module.exports = { getAll, get };
