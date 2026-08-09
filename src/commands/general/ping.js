const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setDescription('Cek apakah bot masih hidup dan berapa latency-nya')
    .setName('ping'),

  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pong! 🏓', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(
      `Pong! 🏓\nLatency: \`${latency}ms\` | API: \`${Math.round(interaction.client.ws.ping)}ms\``
    );
  },
};
