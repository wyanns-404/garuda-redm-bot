const { EmbedBuilder } = require('discord.js');

function baseEmbed() {
  return new EmbedBuilder()
    .setColor(0xb5651d)
    .setTimestamp()
    .setFooter({ text: '© Garuda Assistant | wyanns.dev', iconURL: 'https://cdn.discordapp.com/attachments/1544202538432204800/1552581761857224724/gif2.gif?ex=6afff5f1&is=6afea471&hm=0f4b437ca5fc79379f0370e1b11b69d13024d6402ac8452537cf662c5a6ba981&' });
}

function errorEmbed(message) {
  return baseEmbed().setColor(0xe74c3c).setTitle('❌ Terjadi Kesalahan').setDescription(message);
}

module.exports = { baseEmbed, errorEmbed };
