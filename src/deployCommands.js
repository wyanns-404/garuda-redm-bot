/**
 * Jalankan file ini SETIAP KALI kamu nambah/ubah slash command:
 *   npm run deploy-commands
 *
 * Kalau DISCORD_GUILD_ID diisi di .env -> command langsung update (buat development).
 * Kalau dikosongkan -> deploy global (bisa makan waktu ~1 jam buat propagate).
 */
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('./config');
const logger = require('./core/logger');

function collectCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.js')) continue;
      const command = require(fullPath);
      if (command?.data) commands.push(command.data.toJSON());
    }
  };

  walk(commandsPath);
  return commands;
}

(async () => {
  try {
    const commands = collectCommands();
    const rest = new REST().setToken(config.discord.token);

    logger.info(`Mendeploy ${commands.length} slash command...`);

    const route = config.discord.guildId
      ? Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId)
      : Routes.applicationCommands(config.discord.clientId);

    await rest.put(route, { body: commands });

    logger.info('Slash command berhasil dideploy!');
  } catch (err) {
    logger.error('Gagal deploy command:', err);
    process.exit(1);
  }
})();
