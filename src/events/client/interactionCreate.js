const logger = require('../../core/logger');
const { errorEmbed } = require('../../utils/embeds');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      logger.warn(`Command tidak ditemukan: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(`Error di command ${interaction.commandName}:`, err);
      const payload = { embeds: [errorEmbed('Terjadi kesalahan saat menjalankan command ini.')] };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => {});
      } else {
        await interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
      }
    }
  },
};
