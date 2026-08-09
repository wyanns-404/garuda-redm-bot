const fs = require('fs');
const path = require('path');
const logger = require('../../core/logger');

const KNOWLEDGE_DIR = path.join(__dirname, '..', '..', '..', 'data', 'knowledge');

/**
 * Baca semua file .md di data/knowledge/ dan gabungkan jadi satu teks konteks.
 *
 * Pola isi tiap file BEBAS, tapi disarankan pakai heading yang jelas
 * (## Judul Topik) supaya AI gampang "nunjuk" ke bagian yang relevan.
 *
 * Untuk nambah/edit info server: TINGGAL EDIT FILE .md DI FOLDER INI,
 * tidak perlu ubah kode sama sekali. Perubahan langsung kepakai di request berikutnya
 * (di-load ulang tiap ada pertanyaan supaya tidak perlu restart bot tiap edit .md).
 */
function loadKnowledgeBase() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    logger.warn(`Folder knowledge base tidak ditemukan: ${KNOWLEDGE_DIR}`);
    return '';
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith('.md'));

  if (files.length === 0) {
    logger.warn('Folder data/knowledge/ kosong, belum ada file .md.');
    return '';
  }

  return files
    .map((file) => {
      const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf-8');
      return `# Sumber: ${file}\n${content}`;
    })
    .join('\n\n---\n\n');
}

module.exports = { loadKnowledgeBase };
