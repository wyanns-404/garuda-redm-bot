const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, '..', '..', '..', 'data', 'unanswered-questions.log');

/**
 * Catat pertanyaan yang dijawab "TIDAK_TAHU" oleh AI (di luar knowledge base).
 * Buka file ini dari waktu ke waktu untuk tahu topik apa yang perlu
 * ditambahkan ke data/knowledge/.
 */
function logUnanswered(username, question) {
  const line = `[${new Date().toISOString()}] ${username}: ${question}\n`;
  fs.appendFile(LOG_PATH, line, () => {}); // fire-and-forget, tidak perlu blocking
}

module.exports = { logUnanswered };
