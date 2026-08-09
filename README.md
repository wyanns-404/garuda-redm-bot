# RedM Discord Bot

Bot Discord untuk mengelola server RedM & server Discord. Struktur file dibuat
modular supaya gampang nambah fitur baru tanpa bongkar kode yang sudah ada.

## Struktur Folder

```
redm-discord-bot/
├── src/
│   ├── index.js                 # Entry point — jalankan file ini untuk start bot
│   ├── deployCommands.js        # Script untuk mendaftarkan slash command ke Discord
│   ├── config/
│   │   └── index.js             # SEMUA konfigurasi (baca dari .env) ada di sini
│   ├── core/                    # "Mesin" bot — jarang perlu disentuh
│   │   ├── Bot.js               # Class utama: init client, load command/event/fitur
│   │   ├── commandHandler.js    # Auto-load semua file di src/commands/**
│   │   ├── eventHandler.js      # Auto-load semua file di src/events/**
│   │   └── logger.js            # Logger konsisten (info/warn/error/debug)
│   ├── commands/                # Slash command, dikelompokkan per kategori
│   │   ├── general/             # ping, help, dll
│   │   ├── redm/                # status, players, dll
│   │   └── admin/                # reload, dll (command khusus admin)
│   ├── events/                  # Event listener Discord.js
│   │   └── client/               # ready, interactionCreate, dll
│   ├── features/                # Fitur "besar" yang berdiri sendiri (self-contained)
│   │   └── serverStatusEmbed/   # Contoh: auto-update embed status server
│   ├── services/                # Komunikasi ke sistem luar (RedM API, database, dll)
│   │   └── redm/
│   │       └── RedMApi.js       # Semua request ke server RedM lewat sini
│   └── utils/
│       └── embeds.js            # Builder embed yang dipakai berulang
├── data/                        # Tempat nyimpen data lokal (JSON/db file), di-gitignore
├── .env.example                 # Contoh isi .env — copy jadi .env lalu isi
└── package.json
```

## Kenapa strukturnya begini?

- **`config/`** → satu sumber kebenaran untuk semua env var. Command/fitur lain
  tinggal `require('../../config')`, tidak ada `process.env.X` yang tersebar.
- **`core/`** → logic teknis bot (loader, logger). Ini bagian yang jarang berubah.
- **`commands/`** → tinggal bikin file baru berisi `{ data, execute }`, otomatis
  ke-load. Tidak perlu daftarin manual di file lain.
- **`events/`** → sama seperti commands, tinggal bikin file baru berisi
  `{ name, once?, execute }`.
- **`features/`** → untuk fitur yang lebih kompleks dari 1 command saja (misal:
  butuh interval, state, atau beberapa command sekaligus). Setiap fitur
  berdiri sendiri di foldernya, gampang di-nonaktifkan/di-hapus tanpa
  mempengaruhi fitur lain.
- **`services/`** → semua komunikasi ke "dunia luar" (RedM server, database,
  API pihak ketiga) dipusatkan di sini. Kalau nanti ganti cara ambil data
  RedM (misal dari txAdmin API), cukup ubah `RedMApi.js` saja.

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

`RedMApi.js` mengambil data dari `info.json`, `players.json`, `dynamic.json`
milik FXServer. Pastikan endpoint ini bisa diakses (tidak semua server
mengaktifkannya secara default tergantung konfigurasi `sv_endpointprivacy`
dan setup reverse proxy/firewall). Kalau server pakai txAdmin dan endpoint
publik ini diblokir, alternatifnya adalah pakai txAdmin API — nanti tinggal
ganti isi `RedMApi.js`, command lain tidak perlu diubah.

## Menambah Command Baru

Buat file baru di `src/commands/<kategori>/nama-command.js`:

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nama-command')
    .setDescription('Deskripsi command'),

  async execute(interaction) {
    await interaction.reply('Halo!');
  },
};
```

Lalu jalankan `npm run deploy-commands` lagi.

## Menambah Fitur Baru (yang lebih kompleks dari 1 command)

1. Buat folder baru di `src/features/nama-fitur/`
2. Buat `index.js` dengan minimal fungsi `init(client)`
3. Daftarkan di `src/core/Bot.js` bagian `registerFeatures()`:
   ```js
   const namaFitur = require('../features/nama-fitur');
   namaFitur.init(this.client);
   ```

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
Semua pemanggilan AI melewati `services/ai/index.js`, yang otomatis pilih
`ClaudeService.js` atau `GeminiService.js` berdasarkan `AI_PROVIDER` di `.env`.
Fitur `aiFaqBot` tidak tahu dan tidak peduli provider mana yang dipakai —
tinggal ganti `AI_PROVIDER` + API key di `.env`, restart bot, selesai.
Mau nambah provider lain (OpenAI, dll)? Bikin file baru dengan method
`askWithContext(systemPrompt, userMessage)` yang bentuknya sama seperti
`ClaudeService.js`/`GeminiService.js`, lalu tambahkan 1 baris `case` di `services/ai/index.js`.

**Menambah/mengubah info yang bisa dijawab bot:**
Cukup edit atau tambah file `.md` baru di `data/knowledge/`. Format bebas,
tapi disarankan pakai heading `##` per topik biar rapi. Tidak perlu sentuh kode sama sekali.

**Kalau nanti knowledge base sudah sangat besar** (ratusan topik), pendekatan
"kirim semua ke system prompt" ini mulai boros token — saat itu baru perlu upgrade
`knowledgeBase.js` ke retrieval berbasis embedding/vector search, tapi untuk FAQ
server RP skala normal, pendekatan sekarang sudah cukup dan jauh lebih gampang dirawat.

## Ide Fitur Selanjutnya (contoh roadmap)

- `/restart` — restart server RedM lewat txAdmin API (perlu autentikasi admin)
- Whitelist/ban sync antara Discord role dan server RedM
- Log kejadian in-game (kill, item drop, dll) ke channel Discord tertentu
- Ticket system untuk laporan bug/player report
- Integrasi database (MySQL/SQLite) untuk fitur ekonomi/statistik pemain
