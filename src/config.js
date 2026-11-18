require('dotenv').config();

module.exports = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID || null,
  },
  features: {
    aiFaqBot: {
      channelId: process.env.AI_FAQ_CHANNEL_ID || null,
      cooldownSeconds: Number(process.env.AI_FAQ_COOLDOWN_SECONDS || 10),
    },
    donation: {
      channelId: process.env.DONATION_CHANNEL_ID || null,
      logChannelId: process.env.DONATION_LOG_CHANNEL_ID || null,
    },
    imageUpload: {
      channelId: process.env.IMAGE_CHANNEL_ID || null,
      logChannelId: process.env.IMAGE_LOG_CHANNEL_ID || null,
      roleId: process.env.IMAGE_UPLOAD_ROLE_ID || null,
      workerUrl: process.env.IMAGE_WORKER_URL || null,
      uploadSecret: process.env.IMAGE_UPLOAD_SECRET || null,
      filePrefix: process.env.IMAGE_FILE_PREFIX || 'IMG',
    },
  },
  garudaApi: {
    // Saklar ON/OFF: hanya ON kalau persis "true". Saat OFF bot tidak memanggil API sama sekali.
    enabled: process.env.GARUDA_API_ENABLED === 'true',
    url: process.env.GARUDA_API_URL || null,
    secret: process.env.GARUDA_API_SECRET || null,
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'anthropic', // 'anthropic' | 'gemini'
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },
};
