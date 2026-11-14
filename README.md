# RedM Discord Bot

Bot Discord untuk mengelola server RedM & server Discord. Struktur file dibuat
modular supaya gampang nambah fitur baru tanpa bongkar kode yang sudah ada.

## Struktur Folder

```
redm-discord-bot/
├── src/
│   ├── index.js              # Entry point: load semua modul, teruskan interaksi ke modulnya, login
│   ├── config.js             # SEMUA konfigurasi (baca dari .env) ada di sini
│   ├── deploy.js             # Script untuk mendaftarkan slash command ke Discord
│   ├── lib/                  # Alat bantu yang dipakai bersama oleh semua modul
│   │   ├── logger.js         # Logger konsisten (info/warn/error/debug)
│   │   ├── embeds.js         # Builder embed yang dipakai berulang
│   │   ├── db.js             # Koneksi MySQL (database server RedM)
│   │   ├── redm.js           # Request ke API server RedM
│   │   ├── ai.js             # Panggil AI (Claude / Gemini)
│   │   └── modules.js        # Loader otomatis untuk src/modules/
│   └── modules/              # SETIAP FITUR = 1 FOLDER
│       ├── _contoh/          # Contoh modul untuk dicontek (tidak dimuat bot)
│       ├── general/          # /ping
│       ├── server-status/    # /status, /players, embed status auto-update
│       ├── ai-faq/           # Bot FAQ berbasis AI
│       ├── donation/         # Panel donasi staff (index.js, shared.js, horse.js)
│       └── image-upload/     # Panel upload gambar ke Cloudflare R2 (link permanen)
├── cloudflare/               # Kode Cloudflare Worker (di-paste ke dashboard Cloudflare, bukan dijalankan bot)
├── data/                     # Data lokal (knowledge base, daftar kuda, log)
├── .env.example              # Contoh isi .env — copy jadi .env lalu isi
└── package.json
```

## Kenapa strukturnya begini?

- **`config.js`** → satu sumber kebenaran untuk semua env var. Modul lain
  tinggal `require('../../config')`, tidak ada `process.env.X` yang tersebar.
- **`lib/`** → kode yang dipakai lebih dari 1 fitur (logger, database, API RedM, AI).
  Kalau nanti ganti cara ambil data RedM (misal dari txAdmin API), cukup ubah `lib/redm.js` saja.
- **`modules/`** → semua kode milik 1 fitur (command, tombol, event, interval) ada di
  1 folder. Folder baru otomatis ke-load, jadi nambah/hapus fitur tidak
  mempengaruhi fitur lain.

## Cara Menjalankan

1. Install dependency:
   ```bash
   npm install
   ```
2. Copy `.env.example` jadi `.env`, lalu isi:
   - `DISCORD_TOKEN` & `DISCORD_CLIENT_ID` dari [Discord Developer Portal](https://discord.com/developers/applications)
   - `DISCORD_GUILD_ID` (opsional, isi saat development biar slash command update instan)
   - `REDM_SERVER_HOST` & `REDM_SERVER_PORT` sesuai server RedM kamu
   - `STATUS_CHANNEL_ID` kalau mau fitur auto-update status aktif
3. Deploy slash command:
   ```bash
   npm run deploy-commands
   ```
4. Jalankan bot:
   ```bash
   npm start
   ```
   atau untuk development (auto-restart saat file berubah):
   ```bash
   npm run dev
   ```

## Catatan Penting soal Endpoint RedM

`lib/redm.js` mengambil status online & jumlah pemain dari API dopminer
(`REDM_STATUS_API_URL`), dan daftar nama pemain dari `players.json` milik FXServer.
Pastikan `players.json` bisa diakses (tidak semua server
mengaktifkannya secara default tergantung konfigurasi `sv_endpointprivacy`
dan setup reverse proxy/firewall). Kalau server pakai txAdmin dan endpoint
publik ini diblokir, alternatifnya adalah pakai txAdmin API — nanti tinggal
ganti isi `lib/redm.js`, modul lain tidak perlu diubah.

## Menambah Fitur Baru

**Cara paling gampang:** copy folder `src/modules/_contoh/`, ganti namanya tanpa
awalan `_` (misal `src/modules/sapa/`), lalu ubah isinya. File contoh itu berisi
slash command, tombol, dan event dengan penjelasan baris per baris.
Folder yang diawali `_` tidak dimuat bot, jadi `_contoh` tidak mengubah perilaku bot.

Modul di `src/modules/` otomatis ke-load, tidak perlu daftarin di file lain.
Semua bagian di bawah opsional, export yang dibutuhkan saja:

```js
const { SlashCommandBuilder } = require('discord.js');

const halo = {
  data: new SlashCommandBuilder().setName('halo').setDescription('Sapa bot'),
  async execute(interaction) {
    await interaction.reply('Halo!');
  },
};

/** @type {import('../../lib/modules').BotModule} */
const modul = {
  commands: [halo],                         // slash command milik fitur ini
  components: { prefix: 'halo', handle },   // tombol/select/modal dengan customId "halo:..."
  init(client) {},                          // pasang event, interval, dll
};
module.exports = modul;
```

Komentar `@type` di atas membuat VS Code memberi saran nama bagian
(`commands`, `components`, `init`) dan penjelasannya saat kursor diarahkan.

Kalau fitur punya slash command, jalankan `npm run deploy-commands` lagi.

## Fitur: AI FAQ Bot (Garuda RedM)

Fitur ini bikin bot otomatis menjawab pertanyaan seputar server roleplay
**hanya di 1 channel tertentu**, pakai Claude API (Anthropic) + knowledge base
lokal (bukan slash command — user tinggal ngetik pertanyaan biasa).

**Cara aktifkan:**
1. Pilih provider di `.env`: `AI_PROVIDER=anthropic` (Claude) atau `AI_PROVIDER=gemini`
2. Isi API key sesuai provider yang dipilih (`ANTHROPIC_API_KEY` atau `GEMINI_API_KEY`)
3. Isi `AI_FAQ_CHANNEL_ID` dengan ID channel Discord yang mau dipakai
4. Edit file-file di `data/knowledge/*.md` — isi dengan info asli server kamu
   (cara mancing, job, aturan, dll). Tidak perlu restart bot tiap edit,
   file di-load ulang otomatis tiap ada pertanyaan baru.
5. Restart bot sekali biar fitur ini aktif (`npm start`)

**Cara kerja:**
- Bot cuma merespons pesan di channel `AI_FAQ_CHANNEL_ID`, channel lain diabaikan total.
- Seluruh isi `data/knowledge/*.md` dikirim sebagai konteks ke Claude tiap ada pertanyaan.
- System prompt membatasi Claude supaya HANYA jawab dari konteks tsb — kalau
  di luar topik/tidak ada di knowledge base, bot menolak dengan sopan
  (bukan mengarang jawaban) dan pertanyaannya dicatat ke `data/unanswered-questions.log`
  supaya kamu tahu topik apa yang perlu ditambahkan.
- Ada cooldown per user (`AI_FAQ_COOLDOWN_SECONDS`) supaya tidak spam ke API — kalau
  kena cooldown, bot cukup react ⏳ di pesannya.

**Ganti provider AI kapan pun:**
Semua pemanggilan AI melewati `lib/ai.js`, yang otomatis pilih Claude atau
Gemini berdasarkan `AI_PROVIDER` di `.env`.
Modul `ai-faq` tidak tahu dan tidak peduli provider mana yang dipakai —
tinggal ganti `AI_PROVIDER` + API key di `.env`, restart bot, selesai.
Mau nambah provider lain (OpenAI, dll)? Tambah 1 fungsi di `lib/ai.js`
yang bentuknya sama seperti `askClaude`/`askGemini`, lalu tambahkan 1 baris `case` di `askWithContext()`.

**Menambah/mengubah info yang bisa dijawab bot:**
Cukup edit atau tambah file `.md` baru di `data/knowledge/`. Format bebas,
tapi disarankan pakai heading `##` per topik biar rapi. Tidak perlu sentuh kode sama sekali.

**Kalau nanti knowledge base sudah sangat besar** (ratusan topik), pendekatan
"kirim semua ke system prompt" ini mulai boros token — saat itu baru perlu upgrade
`loadKnowledgeBase()` di `modules/ai-faq/index.js` ke retrieval berbasis embedding/vector search, tapi untuk FAQ
server RP skala normal, pendekatan sekarang sudah cukup dan jauh lebih gampang dirawat.

## Fitur: Upload Gambar (Cloudflare R2)

Link lampiran Discord kedaluwarsa kalau dipakai di luar Discord (misal pinboard in-game).
Fitur ini menyimpan gambar ke Cloudflare R2 dan memberi **link permanen**.

Alur: panel di `IMAGE_CHANNEL_ID` → tombol **Upload Gambar** → form upload →
bot cek role, tipe (PNG/JPG/WEBP dicek dari isi file) & ukuran (maks 5 MB) →
simpan lewat Worker ke R2 → link dikirim ke pengupload (ephemeral) → dicatat ke `IMAGE_LOG_CHANNEL_ID`.

**Setup Cloudflare (sekali saja, semua gratis):**
1. Dashboard Cloudflare → **R2** → *Create bucket*, misal `garuda-images`.
2. **Workers & Pages** → *Create* → *Hello World* worker, beri nama misal `garuda-img` → *Deploy*.
3. Buka worker tersebut → *Edit code* → hapus isinya, paste isi `cloudflare/image-worker.js` → *Deploy*.
4. Worker → *Settings* → **Bindings** → *Add* → **R2 bucket**: variable name `BUCKET`, pilih bucket dari langkah 1.
5. Worker → *Settings* → **Variables and Secrets** → *Add* → type **Secret**, name `UPLOAD_SECRET`,
   isi dengan kata sandi acak yang panjang (minimal 32 karakter).
6. Worker → *Settings* → **Domains & Routes** → *Add* → **Custom domain** → isi `domainmu.com`
   (domain harus sudah ada di akun Cloudflare yang sama). DNS & SSL dibuat otomatis.
   Setelah itu matikan route `workers.dev` di halaman yang sama, supaya hanya ada 1 link resmi.
   Link gambar jadi `https://domainmu.com/images/WYANNS-a8f3k2Xq9LmB.png`.
   > Kalau nanti `domainmu.com` mau dipakai untuk website: hapus custom domain ini dan ganti dengan
   > **Route** `domainmu.com/images/*` ke Worker yang sama. Link gambar lama tetap jalan.
7. Isi `.env` bot:
   - `IMAGE_WORKER_URL` = `https://domainmu.com` (tanpa `/images`)
   - `IMAGE_FILE_PREFIX` = awalan nama file, misal `WYANNS` (huruf, angka, `_`, maks 20)
   - `IMAGE_UPLOAD_SECRET` = kata sandi yang sama dengan langkah 5
   - `IMAGE_CHANNEL_ID`, `IMAGE_LOG_CHANNEL_ID`, `IMAGE_UPLOAD_ROLE_ID`
8. Restart bot. Panel otomatis muncul di `IMAGE_CHANNEL_ID`.

**Catatan:**
- Bucket R2 **tidak perlu** dijadikan publik; gambar dibaca lewat Worker.
- Gambar disimpan di cache Cloudflare (hanya berlaku di custom domain), jadi gambar yang sama
  cukup dibaca dari R2 sekali. Kuota gratis: R2 10 GB, Worker 100.000 request/hari.
- Menghapus gambar yang melanggar:
  1. R2 → bucket → cari nama file dari link (lihat channel log) → *Delete*.
  2. Domain → **Caching** → *Configuration* → **Purge Cache** → *Custom Purge* → masukkan link gambarnya.
     Tanpa langkah ini, gambar masih bisa tampil dari cache.

## Ide Fitur Selanjutnya (contoh roadmap)

- `/restart` — restart server RedM lewat txAdmin API (perlu autentikasi admin)
- Whitelist/ban sync antara Discord role dan server RedM
- Log kejadian in-game (kill, item drop, dll) ke channel Discord tertentu
- Ticket system untuk laporan bug/player report
- Integrasi database (MySQL/SQLite) untuk fitur ekonomi/statistik pemain
