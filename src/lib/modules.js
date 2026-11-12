const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const MODULES_DIR = path.join(__dirname, '..', 'modules');

/**
 * Bentuk sebuah modul (isi export dari src/modules/<nama>/index.js).
 * Semua bagian opsional, export yang dibutuhkan saja.
 * Contoh lengkapnya ada di src/modules/_contoh/index.js
 *
 * Tulis `@type {import('../../lib/modules').BotModule}` di atas variabel yang di-export
 * (bukan langsung di atas `module.exports`) supaya VS Code kasih autocomplete & mengecek isinya.
 *
 * @typedef {Object} BotModule
 * @property {SlashCommand[]} [commands] Slash command milik fitur ini
 * @property {ComponentHandler} [components] Penanganan tombol / select menu / modal
 * @property {(client: import('discord.js').Client) => void} [init] Dipanggil 1x saat bot start (pasang event, interval, dll)
 */

/**
 * @typedef {Object} SlashCommand
 * @property {import('discord.js').SlashCommandBuilder | import('discord.js').SlashCommandOptionsOnlyBuilder} data Nama, deskripsi & opsi command
 * @property {(interaction: import('discord.js').ChatInputCommandInteraction) => Promise<unknown>} execute Dijalankan saat command dipakai
 */

/**
 * @typedef {Object} ComponentHandler
 * @property {string} prefix Awalan customId, misal "donation" untuk customId "donation:horse:save"
 * @property {(interaction: import('discord.js').ButtonInteraction | import('discord.js').StringSelectMenuInteraction | import('discord.js').ModalSubmitInteraction) => Promise<unknown>} handle
 *   Dijalankan saat tombol/select/modal dengan prefix tersebut dipakai
 */

/**
 * Muat semua fitur dari src/modules/. Setiap folder = 1 fitur, file utamanya index.js.
 * Folder yang namanya diawali "_" (misal _contoh) dilewati, jadi aman untuk contoh/draft.
 *
 * Nambah fitur baru = bikin folder baru di src/modules/, TIDAK PERLU daftarin di tempat lain.
 *
 * @returns {BotModule[]}
 */
function loadModules() {
  return fs
    .readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => {
      const mod = require(path.join(MODULES_DIR, entry.name));
      logger.debug(`Modul dimuat: ${entry.name}`);
      return mod;
    });
}

module.exports = { loadModules };
