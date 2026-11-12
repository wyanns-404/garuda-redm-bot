/**
 * Logger sederhana biar konsisten di seluruh bot.
 * Nanti gampang diganti ke Winston/Pino tanpa ubah kode lain,
 * karena semua modul lain cuma import dari sini.
 */
const timestamp = () => new Date().toISOString();

module.exports = {
  info: (...args) => console.log(`[INFO ${timestamp()}]`, ...args),
  warn: (...args) => console.warn(`[WARN ${timestamp()}]`, ...args),
  error: (...args) => console.error(`[ERROR ${timestamp()}]`, ...args),
  debug: (...args) => {
    if (process.env.DEBUG === 'true') console.debug(`[DEBUG ${timestamp()}]`, ...args);
  },
};
