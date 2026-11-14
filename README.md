# Garuda RedM Bot

Bot Discord untuk komunitas roleplay **RedM** (server Garuda: Ashland Frontier). Bot ini membantu
staff dan pemain lewat Discord: menjawab pertanyaan seputar server dengan AI, memasukkan hadiah
donasi langsung ke database server, dan menyediakan hosting gambar dengan link permanen.

Source code ini boleh kamu pakai sebagai dasar bot untuk server RedM-mu sendiri. Strukturnya modular:
setiap fitur ada di folder sendiri dan bisa dinyalakan/dimatikan lewat `.env`.

## Fitur

| Fitur | Keterangan |
|---|---|
| **`/ping`** | Cek bot hidup dan latency |
| **AI FAQ** | Menjawab pertanyaan pemain di 1 channel, hanya dari knowledge base lokal (`data/knowledge/*.md`). Mendukung Claude (Anthropic) atau Gemini |
| **Panel Donasi** | Panel khusus staff untuk memasukkan kuda donasi ke tabel `player_horses` di MySQL server RedM, lengkap dengan konfirmasi dan log. Jenis lain (pet, kantong, wagon) menyusul |
| **Upload Gambar** | Panel untuk role tertentu: upload gambar → disimpan di Cloudflare R2 → dapat link permanen (misal untuk pinboard in-game) |
| Status Server | `/status`, `/players`, embed status auto-update. **Saat ini nonaktif** (`src/modules/_server-status`) |

Setiap fitur otomatis **nonaktif** kalau env var wajibnya belum diisi, jadi kamu bisa mulai dari yang dibutuhkan saja.

## Kebutuhan

- Node.js 18 atau lebih baru
- Bot Discord dari [Discord Developer Portal](https://discord.com/developers/applications), dengan
  **Message Content Intent** aktif (dipakai fitur AI FAQ)
- Opsional, sesuai fitur:
  - API key Anthropic atau Gemini (AI FAQ)
  - MySQL server RedM dengan tabel `players` (`citizenid`, `charinfo` JSON) dan `player_horses` (Panel Donasi)
  - Akun Cloudflare + domain di Cloudflare (Upload Gambar)

## Instalasi

1. Install dependency:
   ```bash
   npm install
   ```
2. Copy `.env.example` jadi `.env`, lalu isi minimal:
   - `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID` (ID server Discord; slash command langsung muncul di server itu)
3. Isi env var fitur yang mau dipakai (lihat [Konfigurasi Fitur](#konfigurasi-fitur)).
4. Daftarkan slash command (ulangi setiap ada perubahan command):
   ```bash
   npm run deploy-commands
   ```
5. Jalankan bot:
   ```bash
   npm start
   ```
   - Untuk development (auto-restart saat file berubah): `npm run dev`
   - Di Windows bisa juga double-click `start-bot.bat`

### Hosting (Pterodactyl / panel Node.js)
Startup command yang disarankan:
```bash
cd /home/container && if [ -f package.json ]; then npm install --no-fund --no-audit --omit=dev; fi && exec node src/index.js
```
Upload `.env` ke folder bot di server (file ini tidak ikut di git).

## Konfigurasi Fitur

### AI FAQ
| Variabel | Keterangan |
|---|---|
| `AI_FAQ_CHANNEL_ID` | Channel tempat bot menjawab |
| `AI_PROVIDER` | `anthropic` atau `gemini` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Kalau pakai Claude |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Kalau pakai Gemini |
| `AI_FAQ_COOLDOWN_SECONDS` | Jeda per user (default 10) |

Isi informasi server di `data/knowledge/*.md` (lihat `data/knowledge/example.md`). File dibaca ulang
setiap ada pertanyaan, jadi tidak perlu restart setelah mengedit. Pertanyaan yang tidak bisa dijawab
dicatat ke `data/unanswered-questions.log`.

### Panel Donasi
| Variabel | Keterangan |
|---|---|
| `DONATION_CHANNEL_ID` | Channel panel |
| `DONATION_LOG_CHANNEL_ID` | Channel log donasi |
| `DONATION_STAFF_ROLE_ID` | Role yang boleh memakai panel |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL server RedM |

- Daftar kuda ada di `data/donation/horses.json`; nilai default kolom lain ada di
  `HORSE_DEFAULTS` (`src/modules/donation/horse.js`). Sesuaikan dengan skema database servermu.
- Gunakan user MySQL khusus dengan izin terbatas (`SELECT` di `players`, `SELECT, INSERT` di `player_horses`),
  dan batasi akses port MySQL hanya dari IP server bot.

### Upload Gambar (Cloudflare R2)
| Variabel | Keterangan |
|---|---|
| `IMAGE_CHANNEL_ID` | Channel panel |
| `IMAGE_LOG_CHANNEL_ID` | Channel log upload |
| `IMAGE_UPLOAD_ROLE_ID` | Role yang boleh upload |
| `IMAGE_WORKER_URL` | Domain yang terhubung ke Worker, tanpa `/images` (misal `https://domainmu.com`) |
| `IMAGE_UPLOAD_SECRET` | Sama dengan secret `UPLOAD_SECRET` di Worker |
| `IMAGE_FILE_PREFIX` | Awalan nama file (huruf, angka, `_`, maks 20) |

Link yang dihasilkan: `https://domainmu.com/images/<PREFIX>-<12 karakter acak>.png`.
Hanya PNG/JPG/WEBP (dicek dari isi file), maksimal 5 MB.

Setup Cloudflare (sekali, semuanya di dashboard):
1. **R2** → *Create bucket*.
2. **Workers & Pages** → *Create* → *Hello World* worker → *Deploy*.
3. Worker → *Edit code* → paste isi `cloudflare/image-worker.js` → *Deploy*.
4. Worker → *Settings* → **Bindings** → *Add* → **R2 bucket**, variable name `BUCKET`, pilih bucket tadi.
5. Worker → *Settings* → **Variables and Secrets** → *Add* → **Secret** `UPLOAD_SECRET`
   (kata sandi acak, minimal 32 karakter).
6. Worker → *Settings* → **Domains & Routes** → *Add* → **Custom domain** → domainmu, lalu matikan route
   `workers.dev`. (Kalau domain juga dipakai untuk website, pakai **Route** `domainmu.com/images/*`.)
7. Isi env var di atas, restart bot.

Menghapus gambar: hapus file di bucket R2, lalu **Purge Cache** link-nya di dashboard domain
(gambar di-cache hingga 1 tahun).

### Status Server (nonaktif)
Untuk mengaktifkan: rename `src/modules/_server-status` → `server-status`, buka comment blok `redm`
dan `features.statusEmbed` di `src/config.js`, isi `REDM_SERVER_HOST`, `REDM_SERVER_PORT`,
`REDM_SERVER_NAME`, `REDM_STATUS_API_URL`, `STATUS_CHANNEL_ID`, `STATUS_UPDATE_INTERVAL`, lalu
`npm run deploy-commands` dan restart.

## Struktur Folder

```
├── src/
│   ├── index.js           # Entry point: muat modul, teruskan interaksi, login
│   ├── config.js          # Semua konfigurasi (dibaca dari .env)
│   ├── deploy.js          # Daftarkan slash command ke Discord
│   ├── lib/               # Alat bantu bersama: logger, embeds, db (MySQL), redm, ai, loader modul
│   └── modules/           # SETIAP FITUR = 1 FOLDER (otomatis dimuat)
│       ├── general/       # /ping
│       ├── ai-faq/        # AI FAQ
│       ├── donation/      # Panel donasi (index.js, shared.js, horse.js)
│       ├── image-upload/  # Upload gambar
│       └── _server-status/# Status server (awalan "_" = tidak dimuat)
├── cloudflare/            # Kode Cloudflare Worker (di-paste ke dashboard, bukan dijalankan bot)
├── data/                  # Knowledge base AI, daftar kuda, log
├── .env.example           # Contoh isi .env
└── start-bot.bat          # Jalankan bot di Windows
```

- **`config.js`**: satu-satunya tempat membaca `process.env`; modul lain cukup `require('../../config')`.
- **`lib/`**: kode yang dipakai lebih dari 1 fitur.
- **`modules/`**: semua kode milik 1 fitur (command, tombol, event, interval) di 1 folder. Folder yang
  namanya diawali `_` tidak dimuat.

## Menambah Fitur Baru

Buat folder baru di `src/modules/<nama-fitur>/index.js`. Tidak perlu didaftarkan di file lain.
Semua bagian opsional, export yang dibutuhkan saja:

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

Komentar `@type` membuat VS Code memberi saran dan mengecek bentuk modul. Kalau fitur punya slash
command, jalankan `npm run deploy-commands` lagi. Cek gaya kode dengan `npx eslint src`.

## Kebijakan

- [Kebijakan Privasi](privacy-policy.md)
- [Syarat & Ketentuan](terms-of-service.md)
