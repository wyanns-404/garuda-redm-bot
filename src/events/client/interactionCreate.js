const { MessageFlags } = require('discord.js');
const logger = require('../../core/logger');
const { errorEmbed } = require('../../utils/embeds');

/**
 * Cari handler untuk komponen (button / select menu / modal) berdasarkan
 * prefix customId. Contoh: customId "donation:horse:save:abc" -> prefix "donation".
 * Fitur mendaftarkan handler-nya sendiri lewat client.componentHandlers.set(prefix, fn).
 */
function resolveComponentHandler(interaction) {
  const prefix = interaction.customId.split(':')[0];
  return interaction.client.componentHandlers.get(prefix);
}

async function replyError(interaction) {
  const payload = { embeds: [errorEmbed('Terjadi kesalahan saat memproses permintaan ini.')] };

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload).catch(() => {});
  } else {
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        logger.warn(`Command tidak ditemukan: ${interaction.commandName}`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (err) {
        logger.error(`Error di command ${interaction.commandName}:`, err);
        await replyError(interaction);
      }
      return;
    }

    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      const handler = resolveComponentHandler(interaction);
      if (!handler) {
        logger.warn(`Handler komponen tidak ditemukan: ${interaction.customId}`);
        return;
      }

      try {
        await handler(interaction);
      } catch (err) {
        logger.error(`Error di komponen ${interaction.customId}:`, err);
        await replyError(interaction);
      }
    }
  },
};
