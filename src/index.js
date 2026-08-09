const Bot = require('./core/Bot');
const logger = require('./core/logger');

const bot = new Bot();

bot.start().catch((err) => {
  logger.error('Gagal menjalankan bot:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err);
});
