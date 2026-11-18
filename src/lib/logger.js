const { styleText, format } = require('util');

/**
 * Logger berwarna biar konsisten di seluruh bot.
 * Semua modul cuma import dari sini, jadi tampilan log cukup diatur di file ini.
 *
 * Contoh output:
 *   2026-11-19 18:06:21 INFO  Bot login sebagai Garuda#1234
 *   2026-11-19 18:07:01 ERROR Gagal kirim log donasi:
 *                             Error: Missing Access
 *
 * Warna memakai util.styleText bawaan Node (tanpa package tambahan). Warna otomatis dimatikan kalau output
 * bukan terminal (misal ditulis ke file) atau ada env NO_COLOR. Paksa warna dengan env FORCE_COLOR=1.
 */

// Waktu WIB, format "YYYY-MM-DD HH:mm:ss" (locale sv-SE kebetulan memakai format ini)
const timeFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const LEVELS = {
  info: { label: 'INFO ', color: 'green', stream: process.stdout, write: console.log },
  warn: { label: 'WARN ', color: 'yellow', stream: process.stderr, write: console.warn },
  error: { label: 'ERROR', color: 'red', stream: process.stderr, write: console.error },
  debug: { label: 'DEBUG', color: 'gray', stream: process.stdout, write: console.debug },
};

function log(level, args) {
  const { label, color, stream, write } = LEVELS[level];
  const time = timeFormatter.format(new Date());
  const prefix = `${styleText('gray', time, { stream })} ${styleText(color, label, { stream })} `;

  // Error axios membawa header & URL request (berisi API key/secret), jadi yang dicetak cukup pesannya
  const safeArgs = args.map((a) => (a?.isAxiosError ? `${a.message}${a.response ? ` (HTTP ${a.response.status})` : ''}` : a));

  // Baris lanjutan (misal stack trace error) diberi indentasi supaya sejajar dengan pesan
  const indent = ' '.repeat(time.length + label.length + 2);
  write(prefix + format(...safeArgs).replace(/\n/g, `\n${indent}`));
}

module.exports = {
  info: (...args) => log('info', args),
  warn: (...args) => log('warn', args),
  error: (...args) => log('error', args),
  debug: (...args) => {
    if (process.env.DEBUG === 'true') log('debug', args);
  },
};
