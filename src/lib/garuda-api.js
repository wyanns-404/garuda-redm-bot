const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');

/**
 * Client untuk Garuda API (resource di server RedM, kode sumber di redm-resources/garuda-api/, belum dipublikasikan).
 * Semua akses data server (player, kuda, dll) lewat sini, bot TIDAK lagi ke MySQL langsung.
 *
 * Setiap request ditandatangani HMAC-SHA256 dengan GARUDA_API_SECRET (+ timestamp & nonce),
 * jadi tidak bisa dipalsukan atau diulang walaupun lewat HTTP biasa.
 */

const CLIENT = 'bot'; // di server: convar garuda_api_secret_bot

class GarudaApiError extends Error {
  /** @param {number} status 0 = API tidak bisa dihubungi */
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function isConfigured() {
  return Boolean(config.garudaApi.url && config.garudaApi.secret);
}

/**
 * Teks yang ditandatangani. HARUS sama persis dengan signingString di redm-resources/garuda-api/server/auth.js.
 */
function signingString({ method, path, timestamp, nonce, requestId, actor, body }) {
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  return [method, path, timestamp, nonce, requestId, actor, bodyHash].join('\n');
}

/**
 * Pelaku aksi (dikirim ke API untuk cek izin & audit) dari interaction Discord.
 */
function actorFrom(interaction) {
  const roles = interaction.member?.roles;
  // member dari cache = GuildMember (roles.cache), kalau tidak = data mentah API (array id)
  const roleIds = !roles ? [] : Array.isArray(roles) ? roles : [...roles.cache.keys()];
  return {
    discordId: interaction.user.id,
    name: interaction.user.tag.slice(0, 64),
    roles: roleIds.filter((id) => id !== interaction.guildId), // buang role @everyone
  };
}

/**
 * Kirim request ke Garuda API.
 * @param {'GET' | 'POST' | 'PATCH' | 'DELETE'} method
 * @param {string} path misal '/players/123'
 * @param {{ actor?: object | null, body?: object, requestId?: string | null }} [options]
 *   requestId wajib untuk aksi yang mengubah data (POST/PATCH/DELETE selain /me), supaya aman di-retry.
 * @returns {Promise<any>} isi `data` dari response API
 */
async function request(method, path, { actor = null, body, requestId = null } = {}) {
  const { url, secret } = config.garudaApi;
  // Method selain GET selalu mengirim body JSON (minimal {}), karena server baru memproses request setelah body diterima
  const rawBody = method === 'GET' ? '' : JSON.stringify(body ?? {});
  const actorHeader = actor ? Buffer.from(JSON.stringify(actor)).toString('base64') : '';

  const send = () => {
    const timestamp = String(Date.now());
    const nonce = crypto.randomBytes(16).toString('hex');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signingString({ method, path, timestamp, nonce, requestId: requestId || '', actor: actorHeader, body: rawBody }))
      .digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'X-Garuda-Client': CLIENT,
      'X-Garuda-Timestamp': timestamp,
      'X-Garuda-Nonce': nonce,
      'X-Garuda-Signature': signature,
    };
    if (requestId) headers['X-Garuda-Request-Id'] = requestId;
    if (actorHeader) headers['X-Garuda-Actor'] = actorHeader;

    return axios.request({
      method,
      url: url.replace(/\/+$/, '') + path,
      data: rawBody || undefined,
      headers,
      timeout: 15000,
      validateStatus: () => true,
    });
  };

  let res;
  try {
    res = await send();
  } catch {
    // Tidak ada response sama sekali (timeout/koneksi putus): aman dicoba 1x lagi,
    // karena GET tidak mengubah data dan aksi tulis memakai Request-Id yang sama (tidak akan dobel)
    try {
      res = await send();
    } catch (err) {
      throw new GarudaApiError(0, 'NETWORK', `API tidak bisa dihubungi (${err.code || err.message})`);
    }
  }

  if (res.data?.ok) return res.data.data;
  const error = res.data?.error || {};
  throw new GarudaApiError(res.status, error.code || `HTTP_${res.status}`, error.message || `HTTP ${res.status}`);
}

module.exports = { GarudaApiError, isConfigured, actorFrom, request };
