const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

/**
 * Service buat komunikasi ke server RedM/FXServer.
 * FXServer punya endpoint bawaan (aktifkan dengan `sv_endpointprivacy false`
 * atau pastikan +set svgui_disable false / `set sv_master1 ...` sesuai kebutuhan):
 *   http://HOST:PORT/info.json     -> info server (nama, resource, versi)
 *   http://HOST:PORT/players.json  -> daftar player online
 *
 * Status online & jumlah pemain diambil dari API dopminer (REDM_STATUS_API_URL).
 *
 * Kalau nanti mau pindah ke txAdmin API atau RCON custom,
 * CUKUP UBAH FILE INI SAJA — semua command/feature lain manggil lewat class ini.
 */
class RedMApi {
  constructor() {
    this.baseUrl = `http://${config.redm.host}:${config.redm.port}`;
  }

  async getInfo() {
    const { data } = await axios.get(`${this.baseUrl}/info.json`, { timeout: 5000 });
    return data; // { resources, version, vars, ... }
  }

  async getPlayers() {
    const { data } = await axios.get(`${this.baseUrl}/players.json`, { timeout: 5000 });
    return data; // [{ id, name, ping, identifiers }, ...]
  }

  /**
   * Ambil status dari API dopminer, dengan fallback kalau API tidak bisa dijangkau.
   * Daftar nama pemain tetap dari players.json; kalau gagal, daftar nama dikosongkan saja.
   *
   * Contoh respons API: { ok: true, servers: [{ name, online, players: 9, maxPlayers: 128 }] }
   */
  async getStatus() {
    try {
      const { data } = await axios.get(config.redm.statusApiUrl, { timeout: 5000 });
      const server = data.servers?.[0];
      if (!data.ok || !server) throw new Error('server tidak ada di respons API status');

      const players = server.online ? await this.getPlayers().catch(() => []) : [];
      return {
        online: server.online,
        clients: server.players,
        maxClients: server.maxPlayers,
        players,
      };
    } catch (err) {
      logger.warn('Server RedM tidak bisa dijangkau:', err.message);
      return { online: false, clients: 0, maxClients: 0, players: [] };
    }
  }
}

// Export sebagai singleton biar konfigurasi/koneksi tidak dibuat ulang tiap dipanggil.
module.exports = new RedMApi();
