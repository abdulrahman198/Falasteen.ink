// FALASTEEN.INK Service Worker v12
var CACHE = 'fl-v25';
var APP_SHELL = [
  '/', 'Index.html', 'Feed.html', 'Martyrs.html', 'Landmarks.html',
  'Map.html', 'Archive.html', 'live.html', 'Guardian_hub1.html',
  'Auth.html', 'Profile.html', 'Vault.html', 'Messages.html',
  'Missions.html', 'Discovery.html', 'Rewards.html', 'Leaderboard.html', 'Contact.html', 'Chat.html',
  'Policy.html', '404.html', 'Admin.html', 'Web3Setup.html',
  'styles.css', 'common.js', 'app-config.js', 'app.js',
  'ollama-search.js', 'ollama-auto-tagging.js', 'discovery-engine.js',
  'web3-token.js', 'rewards-system.js',
  'fl-nav.js', 'rewards.js',
  'manifest.json', 'icon-192.png', 'icon-512.png'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return Promise.allSettled(APP_SHELL.map(function(url) {
        return c.add(url).catch(function(){});
      }));
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;
  // Skip Supabase requests
  if (url.includes('supabase.co') || url.includes('youtube.com')) return;

  var wantsHtml = e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html');
  if (wantsHtml) {
    e.respondWith(
      fetch(e.request).then(function(res) {
        if (res.ok) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function() {
        return caches.match(e.request).then(function(cached) {
          if (cached) return cached;
          return caches.match('Index.html').then(function(home) {
            return home || new Response('<!doctype html><meta charset="utf-8"><title>FALASTEEN Offline</title><body style="background:#0e0e0e;color:#e5e2e1;font-family:Arial;padding:24px"><h1>Offline</h1><p>ÃÂÃÂÃÂÃÂ§ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ³ÃÂÃÂÃÂÃÂ®ÃÂÃÂÃÂÃÂ© ÃÂÃÂÃÂÃÂ§ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ®ÃÂÃÂÃÂÃÂ²ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ© ÃÂÃÂÃÂÃÂºÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ± ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂªÃÂÃÂÃÂÃÂ§ÃÂÃÂÃÂÃÂ­ÃÂÃÂÃÂÃÂ©. ÃÂÃÂÃÂÃÂ£ÃÂÃÂÃÂÃÂ¹ÃÂÃÂÃÂÃÂ¯ ÃÂÃÂÃÂÃÂ§ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂªÃÂÃÂÃÂÃÂ­ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ ÃÂÃÂÃÂÃÂ¹ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¯ ÃÂÃÂÃÂÃÂ§ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ§ÃÂÃÂÃÂÃÂªÃÂÃÂÃÂÃÂµÃÂÃÂÃÂÃÂ§ÃÂÃÂÃÂÃÂ ÃÂÃÂÃÂÃÂ£ÃÂÃÂÃÂÃÂ ÃÂÃÂÃÂÃÂ§ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ³ÃÂÃÂÃÂÃÂ­ cache ÃÂÃÂÃÂÃÂ§ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂªÃÂÃÂÃÂÃÂµÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ­.</p></body>', {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var fetchPromise = fetch(e.request).then(function(res) {
        if (res.ok) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function() { return cached || new Response('Offline', {status:503}); });
      return cached || fetchPromise;
    })
  );
});

// Offline detection message
self.addEventListener('message', function(e) {
  if (e.data === 'ping') e.source.postMessage('pong');
});

// Notify clients of new version
self.addEventListener('activate', function(e) {
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(function(clients) {
      clients.forEach(function(c) { c.postMessage({ type: 'SW_UPDATED' }); });
    })
  );
});
