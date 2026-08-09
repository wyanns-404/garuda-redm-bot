const axios = require('axios');
const config = require('../../config');
const logger = require('../../core/logger');

/**
 * Service tipis untuk manggil Gemini API (Google AI).
 * Punya "bentuk" method yang SAMA PERSIS dengan ClaudeService (askWithContext),
 * jadi fitur pemanggil (aiFaqBot) tidak perlu tahu/peduli provider mana yang dipakai.
 */
class GeminiService {
  constructor() {
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  /**
   * @param {string} systemPrompt - instruksi + konteks knowledge base
   * @param {string} userMessage - pertanyaan user
   * @returns {Promise<string>} jawaban dari model
   */
  async askWithContext(systemPrompt, userMessage) {
    if (!config.ai.geminiApiKey) {
      throw new Error('GEMINI_API_KEY belum di-set di .env');
    }

    const url = `${this.baseUrl}/${config.ai.geminiModel}:generateContent?key=${config.ai.geminiApiKey}`;

    const { data } = await axios.post(
      url,
      {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 600 },
      },
      { headers: { 'content-type': 'application/json' }, timeout: 20000 }
    );

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      logger.warn('Respons Gemini tidak mengandung teks:', JSON.stringify(data));
      return null;
    }
    return text.trim();
  }
}

module.exports = new GeminiService();
