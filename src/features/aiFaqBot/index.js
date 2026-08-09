const config = require('../../config');
const logger = require('../../core/logger');
const ai = require('../../services/ai');
const { loadKnowledgeBase } = require('./knowledgeBase');
const { isOnCooldown, markUsed } = require('./cooldown');
const { logUnanswered } = require('./unansweredLog');

/**
 * FITUR: AI FAQ Bot untuk server roleplay Garuda RedM.
 *
 * Cara kerja singkat:
 * 1. Dengar semua pesan, tapi HANYA proses kalau dikirim di AI_FAQ_CHANNEL_ID.
 * 2. Ambil seluruh isi data/knowledge/*.md sebagai konteks.
 * 3. Kirim ke Claude dengan system prompt yang membatasi topik ketat.
 * 4. Balas di channel yang sama (reply ke pesan user).
 *
 * Kata kunci penanda "tidak tahu" (TIDAK_TAHU) dipakai supaya kode bisa
 * mendeteksi kapan AI gagal jawab dari konteks, lalu dicatat ke log.
 */

const UNKNOWN_MARKER = 'TIDAK_TAHU';

function buildSystemPrompt(knowledgeBase) {
  return `Kamu adalah asisten FAQ untuk server roleplay RedM bernama "Garuda RedM".

ATURAN KETAT:
- Kamu HANYA boleh menjawab pertanyaan seputar server Garuda RedM berdasarkan INFORMASI di bawah ini.
- Kalau pertanyaan di luar topik server (basa-basi umum, topik lain, dll) ATAU jawabannya tidak ada di informasi berikut, balas PERSIS dengan kata: ${UNKNOWN_MARKER}
- Jangan mengarang informasi yang tidak ada di konteks.
- Jawab singkat, jelas, ramah, dan gunakan Bahasa Indonesia santai khas komunitas roleplay.

=== INFORMASI SERVER GARUDA REDM ===
${knowledgeBase || '(belum ada data, isi folder data/knowledge/)'}
=== AKHIR INFORMASI ===`;
}

async function handleMessage(message) {
  const { channelId, cooldownSeconds } = config.features.aiFaqBot;
  if (!channelId) return; // fitur nonaktif kalau channel belum di-set
  if (message.channelId !== channelId) return;
  if (message.author.bot) return;
  if (!message.content?.trim()) return;

  if (isOnCooldown(message.author.id, cooldownSeconds)) {
    await message.react('⏳').catch(() => {});
    return;
  }

  try {
    await message.channel.sendTyping();

    const knowledgeBase = loadKnowledgeBase();
    const systemPrompt = buildSystemPrompt(knowledgeBase);
    const answer = await ai.askWithContext(systemPrompt, message.content);

    markUsed(message.author.id);

    if (!answer || answer.includes(UNKNOWN_MARKER)) {
      logUnanswered(message.author.tag, message.content);
      await message.reply(
        'Maaf, aku belum punya info soal itu 🙏 Coba tanya admin/mod ya, atau pastikan pertanyaannya seputar server Garuda RedM.'
      );
      return;
    }

    await message.reply(answer);
  } catch (err) {
    logger.error('Gagal memproses pertanyaan AI FAQ:', err);
    await message.reply('Waduh, ada gangguan pas mau jawab pertanyaan kamu. Coba lagi sebentar lagi ya.').catch(() => {});
  }
}

function init(client) {
  const { channelId } = config.features.aiFaqBot;

  if (!channelId) {
    logger.info('Fitur AI FAQ bot: AI_FAQ_CHANNEL_ID belum di-set, fitur ini nonaktif.');
    return;
  }

  const apiKey = config.ai.provider === 'gemini' ? config.ai.geminiApiKey : config.ai.anthropicApiKey;
  if (!apiKey) {
    logger.warn(`Fitur AI FAQ bot: API key untuk provider "${config.ai.provider}" belum di-set, fitur ini nonaktif.`);
    return;
  }

  client.on('messageCreate', handleMessage);
  logger.info(`Fitur AI FAQ bot aktif di channel ${channelId}.`);
}

module.exports = { init };
