const config = require('../../config');
const logger = require('../../core/logger');

/**
 * Titik masuk tunggal untuk semua kebutuhan AI di bot ini.
 * Provider aktif ditentukan lewat AI_PROVIDER di .env ('anthropic' atau 'gemini').
 *
 * Fitur lain (misal aiFaqBot) CUKUP:
 *   const ai = require('../../services/ai');
 *   const jawaban = await ai.askWithContext(systemPrompt, pertanyaan);
 * Tidak perlu tahu/ubah apa pun kalau provider diganti — cukup ubah .env.
 *
 * Mau nambah provider lain (OpenAI, dll)? Bikin file baru mengikuti
 * "bentuk" ClaudeService.js/GeminiService.js (harus punya method askWithContext),
 * lalu tambahkan case baru di bawah.
 */
function resolveProvider() {
  switch (config.ai.provider) {
    case 'gemini':
      logger.debug('AI provider aktif: Gemini');
      return require('./GeminiService');
    case 'anthropic':
    default:
      logger.debug('AI provider aktif: Claude (Anthropic)');
      return require('./ClaudeService');
  }
}

module.exports = resolveProvider();
