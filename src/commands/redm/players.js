const { SlashCommandBuilder } = require('discord.js');
const redmApi = require('../../services/redm/RedMApi');
const { errorEmbed, baseEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('players')
    .setDescription('Lihat daftar lengkap pemain yang sedang online di server RedM'),

  async execute(interaction) {
    await interaction.deferReply();

    const players = await redmApi.getPlayers().catch(() => null);

    if (!players) {
      return interaction.editReply({
        embeds: [errorEmbed('Tidak bisa mengambil data pemain. Pastikan server RedM sedang online.')],
      });
    }

    if (players.length === 0) {
      return interaction.editReply({
        embeds: [baseEmbed().setTitle('Daftar Pemain').setDescription('Tidak ada pemain online saat ini.')],
      });
    }

    const list = players.map((p, i) => `${i + 1}. **${p.name}** (ping: ${p.ping}ms)`).join('\n');
    const embed = baseEmbed().setTitle(`Daftar Pemain Online (${players.length})`).setDescription(list.slice(0, 4000));

    await interaction.editReply({ embeds: [embed] });
  },
};
