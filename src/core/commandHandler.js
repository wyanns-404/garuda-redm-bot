const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Baca semua file command secara rekursif dari folder src/commands.
 * Setiap file command HARUS export: { data, execute }
 * (data = SlashCommandBuilder, execute = async (interaction) => {})
 *
 * Supaya nambah command baru cukup: bikin file baru di folder yang sesuai,
 * TIDAK PERLU daftarin manual di tempat lain.
 */
function loadCommands(client) {
  client.commands = new Map();
  const commandsPath = path.join(__dirname, '..', 'commands');

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.js')) continue;

      const command = require(fullPath);
      if (!command?.data || !command?.execute) {
        logger.warn(`Command di ${fullPath} tidak punya "data" atau "execute", dilewati.`);
        continue;
      }
      client.commands.set(command.data.name, command);
      logger.debug(`Command dimuat: ${command.data.name}`);
    }
  };

  walk(commandsPath);
  logger.info(`Total ${client.commands.size} command dimuat.`);
  return client.commands;
}

module.exports = { loadCommands };
