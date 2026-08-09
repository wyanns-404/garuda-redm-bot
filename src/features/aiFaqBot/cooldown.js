/**
 * Rate limiter sederhana in-memory: 1 user cuma boleh nanya
 * tiap N detik (config.features.aiFaqBot.cooldownSeconds).
 *
 * Cukup pakai Map di memori karena scope-nya kecil (per user, per proses).
 * Kalau nanti bot di-scale ke banyak instance, ini perlu pindah ke Redis.
 */
const lastUsedAt = new Map();

function isOnCooldown(userId, cooldownSeconds) {
  const last = lastUsedAt.get(userId);
  if (!last) return false;
  return Date.now() - last < cooldownSeconds * 1000;
}

function markUsed(userId) {
  lastUsedAt.set(userId, Date.now());
}

module.exports = { isOnCooldown, markUsed };
