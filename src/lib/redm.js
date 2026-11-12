const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

/**
 * Service buat komunikasi ke server RedM/FXServer.
 * FXServer punya endpoint bawaan (aktifkan dengan `sv_endpointprivacy false`
 * atau pastikan +set svgui_disable false / `set sv_master1 ...` sesuai kebutuhan):
 *   http://HOST:PORT/info.json     -> info server (nama, resource, versi)
 *   http://HOST:PORT/players.json  -> daftar player online
 *   http://HOST:PORT/dynamic.json  -> hostname, clients, sv_maxclients
 *
 * Kalau nanti mau pindah ke txAdmin API atau RCON custom,
 * CUKUP UBAH FILE INI SAJA — semua command/feature lain manggil lewat class ini.
 */
class RedMApi {
  constructor() {
    this.baseUrl = `http://${config.redm.host}:${config.redm.port}`;
  }

  async getDynamic() {
    const { data } = await axios.get(`${this.baseUrl}/dynamic.json`, { timeout: 5000 });
    return data; // { hostname, clients, sv_maxclients, gametype, mapname }
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
   * Ambil status lengkap sekaligus, dengan fallback kalau server offline.
   */
  async getStatus() {
    try {
      const [dynamic, players] = await Promise.all([this.getDynamic(), this.getPlayers()]);
      return {
        online: true,
        hostname: dynamic.hostname,
        clients: dynamic.clients,
        maxClients: dynamic.sv_maxclients,
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
