const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

/**
 * Titik masuk tunggal untuk semua kebutuhan AI di bot ini.
 * Provider aktif ditentukan lewat AI_PROVIDER di .env ('anthropic' atau 'gemini').
 *
 * Fitur lain CUKUP:
 *   const ai = require('../../lib/ai');
 *   const jawaban = await ai.askWithContext(systemPrompt, pertanyaan);
 * Tidak perlu tahu/ubah apa pun kalau provider diganti — cukup ubah .env.
 *
 * Mau nambah provider lain (OpenAI, dll)? Tambah 1 fungsi askXxx(systemPrompt, userMessage)
 * yang return string jawaban, lalu tambahkan case baru di askWithContext().
 */

async function askClaude(systemPrompt, userMessage) {
  if (!config.ai.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY belum di-set di .env');
  }

  const { data } = await axios.post(
    'https://api.anthropic.com/v1/messages',
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

async function askGemini(systemPrompt, userMessage) {
  if (!config.ai.geminiApiKey) {
    throw new Error('GEMINI_API_KEY belum di-set di .env');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.ai.geminiModel}:generateContent?key=${config.ai.geminiApiKey}`;

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

/**
 * @param {string} systemPrompt - instruksi + konteks knowledge base
 * @param {string} userMessage - pertanyaan user
 * @returns {Promise<string|null>} jawaban dari model
 */
function askWithContext(systemPrompt, userMessage) {
  switch (config.ai.provider) {
    case 'gemini':
      return askGemini(systemPrompt, userMessage);
    case 'anthropic':
    default:
      return askClaude(systemPrompt, userMessage);
  }
}

module.exports = { askWithContext };
