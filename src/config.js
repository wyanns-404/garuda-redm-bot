require('dotenv').config();

/**
 * Semua konfigurasi bot ada di satu tempat ini.
 * Kalau nanti nambah fitur baru dan butuh env var baru,
 * tinggal tambahkan di sini + di .env.example
 * (jangan taruh process.env.X tersebar di file lain).
 */
module.exports = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID || null, // null = deploy global (lebih lambat propagate)
  },
  redm: {
    host: process.env.REDM_SERVER_HOST || '127.0.0.1',
    port: process.env.REDM_SERVER_PORT || '30120',
    name: process.env.REDM_SERVER_NAME || 'RedM Server',
  },
  features: {
    statusEmbed: {
      channelId: process.env.STATUS_CHANNEL_ID || null,
      intervalSeconds: Number(process.env.STATUS_UPDATE_INTERVAL || 60),
    },
    aiFaqBot: {
      channelId: process.env.AI_FAQ_CHANNEL_ID || null,
      cooldownSeconds: Number(process.env.AI_FAQ_COOLDOWN_SECONDS || 10),
    },
    donation: {
      channelId: process.env.DONATION_CHANNEL_ID || null,
      logChannelId: process.env.DONATION_LOG_CHANNEL_ID || null,
      staffRoleId: process.env.DONATION_STAFF_ROLE_ID || null,
    },
  },
  database: {
    host: process.env.DB_HOST || null,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || null,
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || null,
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'anthropic', // 'anthropic' | 'gemini'
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },
};
