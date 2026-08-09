const axios = require('axios');
const config = require('../../config');
const logger = require('../../core/logger');

/**
 * Service tipis untuk manggil Claude API (Anthropic).
 * Kalau nanti mau pindah provider (OpenAI, dll), CUKUP UBAH FILE INI —
 * fitur lain (aiFaqBot) manggil lewat method askWithContext() saja,
 * tidak peduli provider di baliknya apa.
 */
class ClaudeService {
  constructor() {
    this.apiUrl = 'https://api.anthropic.com/v1/messages';
  }

  /**
   * @param {string} systemPrompt - instruksi + konteks knowledge base
   * @param {string} userMessage - pertanyaan user
   * @returns {Promise<string>} jawaban dari model
   */
  async askWithContext(systemPrompt, userMessage) {
    if (!config.ai.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY belum di-set di .env');
    }

    const { data } = await axios.post(
      this.apiUrl,
      {
        model: config.ai.model,
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      },
      {
        headers: {
          'x-api-key': config.ai.anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const textBlock = data.content?.find((c) => c.type === 'text');
    if (!textBlock) {
      logger.warn('Respons Claude tidak mengandung teks:', JSON.stringify(data));
      return null;
    }
    return textBlock.text.trim();
  }
}

module.exports = new ClaudeService();
