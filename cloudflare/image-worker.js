/**
 * Cloudflare Worker untuk image hosting Garuda RedM.
 * File ini TIDAK dijalankan oleh bot, tapi di-paste ke dashboard Cloudflare
 * (langkah setup lengkap ada di README, bagian "Fitur: Upload Gambar").
 *
 * - GET  /images/<nama file>  -> tampilkan gambar dari bucket R2 (publik, untuk pinboard dll)
 * - PUT  /images/<nama file>  -> simpan gambar ke R2, hanya untuk bot (header Authorization wajib benar)
 *
 * Binding yang dibutuhkan di pengaturan Worker:
 * - BUCKET        : R2 bucket binding
 * - UPLOAD_SECRET : secret, isinya sama dengan IMAGE_UPLOAD_SECRET di .env bot
 */

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
      // Cek cache Cloudflare dulu (hanya berfungsi di custom domain, di workers.dev selalu kosong).
      // Gambar tidak pernah berubah, jadi aman di-cache selamanya.
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
