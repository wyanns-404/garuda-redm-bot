const { ActivityType } = require('discord.js');
const logger = require('../../core/logger');
const config = require('../../config');

module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    logger.info(`Bot login sebagai ${client.user.tag}`);
    client.user.setActivity(config.redm.name, { type: ActivityType.Watching });
  },
};
