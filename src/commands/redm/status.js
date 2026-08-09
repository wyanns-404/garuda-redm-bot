const { SlashCommandBuilder } = require('discord.js');
const redmApi = require('../../services/redm/RedMApi');
const config = require('../../config');
const { serverStatusEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Lihat status server RedM saat ini (online/offline & jumlah pemain)'),

  async execute(interaction) {
    await interaction.deferReply();
    const status = await redmApi.getStatus();

    const embed = serverStatusEmbed({
      serverName: config.redm.name,
      ...status,
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
