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
| **AI FAQ** | Menjawab pertanyaan pemain di 1 channel, hanya dari knowledge base lokal (`src/modules/ai-faq/knowledge/*.md`). Mendukung Claude (Anthropic) atau Gemini |
| **Garuda API** | Resource di server RedM yang menjadi satu-satunya jalan bot ke database: tanda tangan HMAC, izin bertingkat dari role Discord (`viewer`/`staff`/`admin`/`owner`), dan audit setiap perubahan. **Kode resource belum dipublikasikan di repo ini** |
| **Panel Donasi** | Panel khusus staff untuk memasukkan kuda donasi ke tabel `player_horses` lewat Garuda API, lengkap dengan konfirmasi dan log. Jenis lain (pet, kantong, wagon) menyusul |
| **Upload Gambar** | Panel untuk role tertentu: upload gambar → disimpan di Cloudflare R2 → dapat link permanen (misal untuk pinboard in-game) |

Setiap fitur otomatis **nonaktif** kalau env var wajibnya belum diisi, jadi kamu bisa mulai dari yang dibutuhkan saja.

## Kebutuhan

- Node.js 18 atau lebih baru
- Bot Discord dari [Discord Developer Portal](https://discord.com/developers/applications), dengan
  **Message Content Intent** aktif (dipakai fitur AI FAQ)
- Opsional, sesuai fitur:
  - API key Anthropic atau Gemini (AI FAQ)
  - Server RedM dengan `oxmysql` dan RSG Core v2, tabel `players` (`citizenid`, `charinfo` JSON) dan
    `player_horses`, serta akses untuk memasang resource sendiri (Garuda API + Panel Donasi)
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

Isi informasi server di `src/modules/ai-faq/knowledge/*.md` (lihat `example.md` di folder itu). File dibaca
ulang setiap ada pertanyaan, jadi tidak perlu restart setelah mengedit. Pertanyaan yang tidak bisa dijawab
dicatat ke `src/modules/ai-faq/unanswered-questions.log`.

### Garuda API (resource di server RedM)
Bot tidak mengakses MySQL langsung; semua lewat resource ini.

> **Catatan:** kode resource Garuda API **belum disertakan di repo ini**. Sisi bot (`src/lib/garuda-api.js`)
> sudah ada, tapi Panel Donasi baru bisa dipakai setelah resource-nya dipublikasikan. Langkah di bawah
> berlaku begitu resource tersedia.

1. Salin folder resource `garuda-api` ke `resources/` server RedM. Nama folder bebas (nama folder = nama resource
   = bagian alamat API).
2. Buat file cfg baru di server (misal `configs/garuda-api.cfg`) dan `exec` dari `server.cfg`:
   ```
   set garuda_api_enabled 1
   set garuda_api_secret_bot "<acak, minimal 32 karakter>"
   set garuda_api_roles '{"<role_id_discord>":"staff","<role_id_lain>":"admin"}'
   # opsional: hanya terima request dari IP server bot
   # set garuda_api_ips_bot "1.2.3.4"
   ```
   Wajib `set`, **jangan** `setr`/`sets` (bisa terlihat oleh player/publik).
   Level: `viewer` (lihat data), `staff` (+ donasi), `admin` (+ edit/hapus), `owner` (semua).
3. `ensure <nama-folder>` **setelah** `ensure oxmysql` dan `ensure rsg-core`.
4. Di `.env` bot:

| Variabel | Keterangan |
|---|---|
| `GARUDA_API_ENABLED` | `true` = ON. Selain itu OFF: bot tidak memanggil API dan fitur donasi nonaktif |
| `GARUDA_API_URL` | `http://<ip-server>:<port-http>/<nama-folder>` |
| `GARUDA_API_SECRET` | Sama dengan `garuda_api_secret_bot` di server |

**Saklar ON/OFF.** Ada di dua sisi, dan keduanya default OFF:
- **Server:** convar `garuda_api_enabled` (`1` = ON). Dibaca setiap request, jadi bisa diubah lewat console
  (`set garuda_api_enabled 1` / `0`) tanpa restart. Saat OFF, semua request ditolak tanpa log dan database
  tidak disentuh. Console hanya menampilkan 1 baris status saat resource start.
- **Bot:** `GARUDA_API_ENABLED`. Saat OFF, bot hanya menulis 1 baris log saat start (perlu restart bot setelah diubah).

Resource otomatis membuat tabel `garuda_api_audit` (riwayat setiap perubahan data). Katalog kuda dan nilai
default kolom kuda ada di dalam resource; sesuaikan dengan skema database servermu.

### Panel Donasi
| Variabel | Keterangan |
|---|---|
| `DONATION_CHANNEL_ID` | Channel panel |
| `DONATION_LOG_CHANNEL_ID` | Channel log donasi |

Butuh Garuda API (lihat catatan di atas). Yang boleh memakai panel: role Discord dengan level minimal
`staff` di `garuda_api_roles`.

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
3. Worker → *Edit code* → hapus isinya, paste **Kode Worker** di bawah → *Deploy*.
4. Worker → *Settings* → **Bindings** → *Add* → **R2 bucket**, variable name `BUCKET`, pilih bucket tadi.
5. Worker → *Settings* → **Variables and Secrets** → *Add* → **Secret** `UPLOAD_SECRET`
   (kata sandi acak, minimal 32 karakter).
6. Worker → *Settings* → **Domains & Routes** → *Add* → **Custom domain** → domainmu, lalu matikan route
   `workers.dev`. (Kalau domain juga dipakai untuk website, pakai **Route** `domainmu.com/images/*`.)
7. Isi env var di atas, restart bot.

<details>
<summary><b>Kode Worker</b> (klik untuk membuka, lalu salin semuanya)</summary>

GET menampilkan gambar dari R2 (dengan cache Cloudflare). PUT menyimpan gambar, hanya bisa dengan
`UPLOAD_SECRET`. Pola nama file harus sama dengan yang dibuat bot di `src/modules/image-upload/index.js`.

```js
// Nama file selalu dibuat oleh bot: <PREFIX>-<12 karakter acak>.<ext>, misal WYANNS-a8f3k2Xq9LmB.png
const PATH_PATTERN = /^\/images\/([A-Za-z0-9_]{1,20}-[A-Za-z0-9_-]{12}\.(png|jpg|webp))$/;
const CONTENT_TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

export default {
  async fetch(request, env, ctx) {
    const match = new URL(request.url).pathname.match(PATH_PATTERN);
    if (!match) {
      return new Response('Not found', { status: 404 });
    }
    const [, key, ext] = match;

    if (request.method === 'GET' || request.method === 'HEAD') {
      const cache = caches.default;
      const cacheKey = new Request(request.url);
      let response = await cache.match(cacheKey);

      if (!response) {
        const object = await env.BUCKET.get(key);
        if (!object) {
          return new Response('Not found', { status: 404 });
        }
        response = new Response(object.body, {
          headers: {
            'Content-Type': CONTENT_TYPES[ext],
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
            ETag: object.httpEtag,
          },
        });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      return request.method === 'HEAD' ? new Response(null, response) : response;
    }

    if (request.method === 'PUT') {
      if (!env.UPLOAD_SECRET || request.headers.get('Authorization') !== `Bearer ${env.UPLOAD_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
      }
      await env.BUCKET.put(key, request.body);
      return new Response('Created', { status: 201 });
    }

    return new Response('Method not allowed', { status: 405 });
  },
};
```

</details>

Menghapus gambar: hapus file di bucket R2, lalu **Purge Cache** link-nya di dashboard domain
(gambar di-cache hingga 1 tahun).

## Struktur Folder

```
├── src/
│   ├── index.js           # Entry point: muat modul, teruskan interaksi, login
│   ├── config.js          # Semua konfigurasi (dibaca dari .env)
│   ├── deploy.js          # Daftarkan slash command ke Discord
│   ├── lib/               # Alat bantu bersama: logger, embeds, ai, garuda-api (client API), loader modul
│   └── modules/           # SETIAP FITUR = 1 FOLDER (otomatis dimuat)
│       ├── general/       # /ping
│       ├── ai-faq/        # AI FAQ (+ knowledge/ berisi info server, log pertanyaan tak terjawab)
│       ├── donation/      # Panel donasi (index.js, shared.js, horse.js)
│       └── image-upload/  # Upload gambar
├── .env.example           # Contoh isi .env
└── start-bot.bat          # Jalankan bot di Windows
```

- **`config.js`**: satu-satunya tempat membaca `process.env`; modul lain cukup `require('../../config')`.
- **`lib/`**: kode yang dipakai lebih dari 1 fitur.
- **`modules/`**: semua milik 1 fitur (command, tombol, event, interval, **dan datanya**, misal
  `ai-faq/knowledge/`) ada di 1 folder. Folder yang namanya diawali `_` tidak dimuat.

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
