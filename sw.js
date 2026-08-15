// ============================================================
// Service Worker：网络优先 + 缓存兜底（离线可用）
// 版本号跟随资源版本，改动文件后记得同步递增
// ============================================================
const CACHE = 'vocab-helper-v39';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css?v=39',
  './js/data.js?v=39',
  './js/wanglu_data.js?v=39',
  './js/store.js?v=39',
  './js/cloud.js?v=39',
  './js/speech.js?v=39',
  './js/importer.js?v=39',
  './js/ui.js?v=39',
  './js/scene_data.js?v=39',
  './js/scene.js?v=39',
  './js/views.js?v=39',
  './js/app.js?v=39',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req).then(res => {
      try {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      } catch (err) {}
      return res;
    }).catch(() => {
      return caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));
    })
  );
});
