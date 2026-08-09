const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Baca semua file event secara rekursif dari folder src/events.
 * Setiap file event HARUS export: { name, once?, execute }
 * name = nama event discord.js (contoh: 'ready', 'interactionCreate')
 *
 * Nambah event baru = bikin file baru di src/events/<kategori>/nama.js
 */
function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  let count = 0;

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.js')) continue;

      const event = require(fullPath);
      if (!event?.name || !event?.execute) {
        logger.warn(`Event di ${fullPath} tidak punya "name" atau "execute", dilewati.`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
      count++;
      logger.debug(`Event dimuat: ${event.name}`);
    }
  };

  walk(eventsPath);
  logger.info(`Total ${count} event dimuat.`);
}

module.exports = { loadEvents };
