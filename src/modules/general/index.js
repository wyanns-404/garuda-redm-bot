const { SlashCommandBuilder, MessageFlags } = require('discord.js');

/**
 * FITUR: Command umum bot.
 */
/** @type {import('../../lib/modules').SlashCommand} */
const ping = {
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

const setBotStatus = {
  data: new SlashCommandBuilder()
    .setDescription('Set bot Status')
    .setName('setbotstatus')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Pilih tipe status')
        .setRequired(true)
        .addChoices(
          { name: 'Online', value: 'online' },
          { name: 'Idle', value: 'idle' },
          { name: 'Do Not Disturb', value: 'dnd' },
          { name: 'Invisible', value: 'invisible' }
        )
    ),

  async execute(interaction) {
    const allowedUserId = '715482575451193375';
    if (interaction.user.id !== allowedUserId) {
      return interaction.reply({ content: 'Kamu tidak memiliki izin untuk menggunakan perintah ini.', flags: MessageFlags.Ephemeral });
    }
    const statusType = interaction.options.getString('type') || 'online';
    await interaction.client.user.setStatus(statusType);
    await interaction.reply({ content: `Bot sekarang ${statusType}`, flags: MessageFlags.Ephemeral });
  },
};

/** @type {import('../../lib/modules').BotModule} */
const modul = { commands: [ping, setBotStatus] };
module.exports = modul;
