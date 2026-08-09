const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('../config');
const logger = require('./logger');
const { loadCommands } = require('./commandHandler');
const { loadEvents } = require('./eventHandler');

/**
 * Class utama bot.
 * Semua "fitur" (features/) di-init lewat registerFeatures(),
 * jadi kalau mau nonaktifkan/aktifkan fitur cukup comment/uncomment 1 baris di sini.
 */
class Bot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.client.commands = new Collection();
  }

  async start() {
    if (!config.discord.token) {
      throw new Error('DISCORD_TOKEN belum di-set di file .env');
    }

    loadCommands(this.client);
    loadEvents(this.client);
    this.registerFeatures();

    await this.client.login(config.discord.token);
  }

  /**
   * Daftarkan fitur-fitur "aktif" di sini.
   * Setiap fitur di folder features/ punya init(client) sendiri.
   * Contoh nambah fitur baru:
   *   const myFeature = require('../features/myFeature');
   *   myFeature.init(this.client);
   */
  registerFeatures() {
    const serverStatusEmbed = require('../features/serverStatusEmbed');
    serverStatusEmbed.init(this.client);

    const aiFaqBot = require('../features/aiFaqBot');
    aiFaqBot.init(this.client);

    logger.info('Semua fitur berhasil diregistrasi.');
  }
}

module.exports = Bot;
