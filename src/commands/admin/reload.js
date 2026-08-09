const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loadCommands } = require('../../core/commandHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reload')
    .setDescription('[Admin] Muat ulang semua command tanpa restart bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Hapus cache require supaya file command yang diedit ke-load ulang
    Object.keys(require.cache).forEach((key) => {
      if (key.includes(`${require('path').sep}commands${require('path').sep}`)) {
        delete require.cache[key];
      }
    });

    const commands = loadCommands(interaction.client);
    await interaction.editReply(`✅ Berhasil reload ${commands.size} command.`);
  },
};
