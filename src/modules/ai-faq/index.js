const fs = require('fs');
const path = require('path');
const config = require('../../config');
const logger = require('../../lib/logger');
const ai = require('../../lib/ai');

/**
 * FITUR: AI FAQ Bot untuk server roleplay Garuda RedM.
 *
 * Cara kerja singkat:
 * 1. Dengar semua pesan, tapi HANYA proses kalau dikirim di AI_FAQ_CHANNEL_ID.
 * 2. Ambil seluruh isi knowledge/*.md (di folder fitur ini) sebagai konteks.
 * 3. Kirim ke AI dengan system prompt yang membatasi topik ketat.
 * 4. Balas di channel yang sama (reply ke pesan user).
 *
 * Kata kunci penanda "tidak tahu" (TIDAK_TAHU) dipakai supaya kode bisa
 * mendeteksi kapan AI gagal jawab dari konteks, lalu dicatat ke log.
 */

const UNKNOWN_MARKER = 'TIDAK_TAHU';
// Semua data fitur ini ada di folder fitur ini sendiri (src/modules/ai-faq/)
const KNOWLEDGE_DIR = path.join(__dirname, 'knowledge');
const UNANSWERED_LOG_PATH = path.join(__dirname, 'unanswered-questions.log');

/**
 * Baca semua file .md di knowledge/ dan gabungkan jadi satu teks konteks.
 *
 * Untuk nambah/edit info server: TINGGAL EDIT FILE .md DI FOLDER ITU,
 * tidak perlu ubah kode sama sekali. Di-load ulang tiap ada pertanyaan
 * supaya tidak perlu restart bot tiap edit .md.
 */
function loadKnowledgeBase() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    logger.warn(`Folder knowledge base tidak ditemukan: ${KNOWLEDGE_DIR}`);
    return '';
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith('.md'));

  if (files.length === 0) {
    logger.warn('Folder knowledge/ AI FAQ kosong, belum ada file .md.');
    return '';
  }

  return files
    .map((file) => {
      const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf-8');
      return `# Sumber: ${file}\n${content}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Catat pertanyaan yang dijawab "TIDAK_TAHU" oleh AI (di luar knowledge base).
 * Buka file ini dari waktu ke waktu untuk tahu topik apa yang perlu
 * ditambahkan ke knowledge/.
 */
function logUnanswered(username, question) {
  const line = `[${new Date().toISOString()}] ${username}: ${question}\n`;
  fs.appendFile(UNANSWERED_LOG_PATH, line, () => {}); // fire-and-forget, tidak perlu blocking
}

/**
 * Rate limiter sederhana in-memory: 1 user cuma boleh nanya tiap N detik.
 * Kalau nanti bot di-scale ke banyak instance, ini perlu pindah ke Redis.
 */
const lastUsedAt = new Map();

function isOnCooldown(userId, cooldownSeconds) {
  const last = lastUsedAt.get(userId);
  if (!last) return false;
  return Date.now() - last < cooldownSeconds * 1000;
}

function buildSystemPrompt(knowledgeBase) {
  return `Kamu adalah asisten FAQ untuk server roleplay RedM bernama "Garuda RedM".

ATURAN KETAT:
- Kamu HANYA boleh menjawab pertanyaan seputar server Garuda RedM berdasarkan INFORMASI di bawah ini.
- Kalau pertanyaan di luar topik server (basa-basi umum, topik lain, dll) ATAU jawabannya tidak ada di informasi berikut, balas PERSIS dengan kata: ${UNKNOWN_MARKER}
- Jangan mengarang informasi yang tidak ada di konteks.
- Jawab singkat, jelas, ramah, dan gunakan Bahasa Indonesia santai khas komunitas roleplay.

=== INFORMASI SERVER GARUDA REDM ===
${knowledgeBase || '(belum ada data, isi folder knowledge/ di modul ai-faq)'}
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

    lastUsedAt.set(message.author.id, Date.now());

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

/** @type {import('../../lib/modules').BotModule} */
const modul = { init };
module.exports = modul;
