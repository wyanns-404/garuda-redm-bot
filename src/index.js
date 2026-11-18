const { ActivityType, Client, GatewayIntentBits, MessageFlags } = require('discord.js');
const config = require('./config');
const logger = require('./lib/logger');
const { errorEmbed } = require('./lib/embeds');
const { loadModules } = require('./lib/modules');

/**
 * Entry point bot. Tugasnya cuma:
 * 1. Muat semua fitur dari src/modules/ (lihat lib/modules.js untuk bentuk modulnya)
 * 2. Teruskan setiap interaksi Discord ke fitur pemiliknya
 * 3. Login
 */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  // Pesan bot tidak boleh mem-ping siapa pun (@everyone, @here, role, user), misalnya kalau
  // AI FAQ dipancing menulis "@everyone". Pengecualian: ping ke orang yang dibalas (reply).
  allowedMentions: { parse: [], repliedUser: true },
});

const commands = new Map(); // nama slash command -> { data, execute }
const componentHandlers = new Map(); // prefix customId -> handle(interaction)

for (const mod of loadModules()) {
  for (const command of mod.commands ?? []) commands.set(command.data.name, command);
  if (mod.components) componentHandlers.set(mod.components.prefix, mod.components.handle);
  mod.init?.(client);
}
logger.info(`Total ${commands.size} command dimuat.`);

client.once('clientReady', () => {
  logger.info(`Bot login sebagai ${client.user.tag}`);
  client.user.setActivity('Garuda: Ashland Frontier', { type: ActivityType.Watching });
});

client.on('interactionCreate', async (interaction) => {
  let handler;
  if (interaction.isChatInputCommand()) {
    handler = commands.get(interaction.commandName)?.execute;
  } else if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
    // customId "donation:horse:save:abc" -> ditangani modul dengan prefix "donation"
    handler = componentHandlers.get(interaction.customId.split(':')[0]);
  } else {
    return;
  }

  const name = interaction.commandName ?? interaction.customId;
  if (!handler) {
    logger.warn(`Tidak ada handler untuk: ${name}`);
    return;
  }

  try {
    await handler(interaction);
  } catch (err) {
    logger.error(`Error saat memproses ${name}:`, err);
    const payload = { embeds: [errorEmbed('Terjadi kesalahan saat memproses permintaan ini.')] };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => {});
    } else {
      await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err);
});

if (!config.discord.token) {
  logger.error('DISCORD_TOKEN belum di-set di file .env');
  process.exit(1);
}

client.login(config.discord.token).catch((err) => {
  logger.error('Gagal menjalankan bot:', err);
  process.exit(1);
});
