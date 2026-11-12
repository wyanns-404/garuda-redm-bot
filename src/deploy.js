/**
 * Jalankan file ini SETIAP KALI kamu nambah/ubah slash command:
 *   npm run deploy-commands
 *
 * Kalau DISCORD_GUILD_ID diisi di .env -> command langsung update (buat development).
 * Kalau dikosongkan -> deploy global (bisa makan waktu ~1 jam buat propagate).
 */
const { REST, Routes } = require('discord.js');
const config = require('./config');
const logger = require('./lib/logger');
const { loadModules } = require('./lib/modules');

(async () => {
  try {
    const commands = loadModules()
      .flatMap((mod) => mod.commands ?? [])
      .map((command) => command.data.toJSON());
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
