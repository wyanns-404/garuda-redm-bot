const path = require('path');

/**
 * Daftar kuda dari data/donation/horses.json (dikelompokkan per ras).
 * Edit file JSON-nya untuk nambah/hapus kuda, tidak perlu ubah kode.
 * Dibaca sekali saat bot start, jadi setelah edit JSON perlu restart bot.
 */
const CATALOG_PATH = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'donation', 'horses.json');

// Batas dari Discord (opsi per dropdown) & dari kolom `horse` VARCHAR(50)
const MAX_OPTIONS = 25;
const MAX_MODEL_LENGTH = 50;

const { groups } = require(CATALOG_PATH);

function validateCatalog() {
  if (groups.length > MAX_OPTIONS) {
    throw new Error(`horses.json: jumlah grup ${groups.length}, maksimal ${MAX_OPTIONS}`);
  }

  const seenModels = new Set();
  for (const group of groups) {
    if (group.horses.length > MAX_OPTIONS) {
      throw new Error(`horses.json: grup "${group.id}" punya ${group.horses.length} kuda, maksimal ${MAX_OPTIONS}`);
    }
    for (const horse of group.horses) {
      if (horse.model.length > MAX_MODEL_LENGTH) {
        throw new Error(`horses.json: model "${horse.model}" lebih dari ${MAX_MODEL_LENGTH} karakter`);
      }
      if (seenModels.has(horse.model)) {
        throw new Error(`horses.json: model "${horse.model}" duplikat`);
      }
      seenModels.add(horse.model);
    }
  }
}

function getGroups() {
  return groups;
}

function findGroup(groupId) {
  return groups.find((g) => g.id === groupId) || null;
}

function findHorse(model) {
  for (const group of groups) {
    const horse = group.horses.find((h) => h.model === model);
    if (horse) return { ...horse, groupId: group.id };
  }
  return null;
}

module.exports = { validateCatalog, getGroups, findGroup, findHorse };
