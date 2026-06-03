// FALASTEEN.INK — app.js
// Unified JS: toggleLang, ESC, offline, SW update

// ── ESC closes modals ──
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.overlay.on, [id$="Modal"].on, [id$="Overlay"].on').forEach(function(el) {
    el.classList.remove('on');
    document.body.style.overflow = '';
    var v = el.querySelector('video'); if (v) v.pause();
    var f = el.querySelector('iframe'); if (f) { var s=f.src; f.src=''; f.src=s; }
  });
});


// ── Language toggle ──
var _lang = 'ar';
try { _lang = localStorage.getItem('fl_lang') || 'ar'; } catch(e){}

// Pages that need custom lang logic should listen for 'fl:lang' instead of
// defining their own toggleLang, which this function would overwrite.
window.toggleLang = function() {
  _lang = _lang === 'ar' ? 'en' : 'ar';
  try { localStorage.setItem('fl_lang', _lang); } catch(e){}
  applyLang(_lang);
  if (window.__onLangChange) window.__onLangChange(_lang);
  window.dispatchEvent(new CustomEvent('fl:lang', { detail: { lang: _lang } }));
};

function applyLang(lang) {
  document.documentElement.setAttribute('dir',  lang === 'ar' ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', lang);
  var btn = document.getElementById('langBtn');
  if (btn) btn.textContent = lang === 'ar' ? 'EN' : 'AR';

  // Translate all data-ar/data-en elements — always re-query to pick up dynamic content
  var _langNodes = Array.prototype.slice.call(document.querySelectorAll('[data-ar]'));
  _langNodes.forEach(function(el) {
    var val = lang === 'ar' ? el.dataset.ar : (el.dataset.en || el.dataset.ar);
    if (!val) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else if (el.tagName === 'BUTTON' || el.tagName === 'A') {
      el.textContent = val;
    } else if (el.hasAttribute('data-html')) {
      el.innerHTML = val;
    } else {
      el.textContent = val;
    }
  });
}

// Apply on load
window.addEventListener('DOMContentLoaded', function() {
  applyLang(_lang);
  document.body.classList.add('loaded');
  if (window.__onLangChange) window.__onLangChange(_lang);
});

window.getBlockchainStreamLink = async function() {
  // Placeholder implementation. Replace with real smart contract call logic.
  try {
    if (window.ethereum && window.ethereum.request) {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      // TODO: call contract method here using eth_call and ABI to fetch current stream link.
    }
  } catch (err) {
    console.warn('Blockchain wallet access failed:', err);
  }
  var stored = localStorage.getItem('fl_livepeer_stream_link');
  return stored || 'https://iframe.videodelivery.net/PLAYBACK_ID?autoplay=1';
};

window.verifyBlockchainStream = async function() {
  var link = await window.getBlockchainStreamLink();
  if (!link) throw new Error('لا يوجد رابط بث لامركزي مسجل على البلوكشين.');
  return link;
};

window.timestampStreamLink = function(link) {
  var record = { link: link, timestamp: new Date().toISOString() };
  try { localStorage.setItem('fl_live_stream_record', JSON.stringify(record)); } catch (e) {}
  return record;
};


// ── Offline indicator ──
function _updateOnline() {
  var bar = document.getElementById('offlineBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'offlineBar';
    bar.textContent = '⚠ أنت غير متصل — المحتوى المخزن فقط / Offline mode';
    document.body.appendChild(bar);
  }
  bar.style.display = navigator.onLine ? 'none' : 'block';
}
window.addEventListener('online', _updateOnline);
window.addEventListener('offline', _updateOnline);
window.addEventListener('load', _updateOnline);



// ── Local file cache guard ──
// During local file:// testing, stale service workers from older localhost runs
// can make the in-app browser show a plain "Offline" response. Clean them up.
if ('serviceWorker' in navigator && window.location.protocol === 'file:') {
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    regs.forEach(function(reg) { reg.unregister(); });
    if (window.caches && caches.keys) {
      caches.keys().then(function(keys) {
        keys.forEach(function(key) { caches.delete(key); });
      });
    }
    console.warn('[FALASTEEN.AUDIT] file:// mode detected; service workers/cache cleared for local testing.');
  }).catch(function(err) {
    console.warn('[FALASTEEN.AUDIT] Could not clear service worker cache in file mode.', err);
  });
}

// ── SW update notification ──
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  navigator.serviceWorker.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'SW_UPDATED') {
      var bar = document.createElement('div');
      bar.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:#E8221F;color:#fff;padding:10px 20px;z-index:9999;display:flex;gap:12px;align-items:center;font-size:.78rem;font-weight:700;white-space:nowrap;';
      bar.innerHTML = 'تحديث جديد! <button onclick="location.reload()" style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:5px 12px;cursor:pointer;">تحديث ←</button>';
      document.body.appendChild(bar);
      setTimeout(function(){ bar.remove(); }, 15000);
    }
  });
}


// ── Handala Badge (global) ──
(function() {
  function showHanzalaBadge() {
    if (document.getElementById('hanzala-badge-global')) return;
    var pts = 0;
    try { pts = parseInt(localStorage.getItem('fl_hanzala_points') || '0') || 0; } catch(e) {}
    var badge = document.createElement('div');
    badge.id = 'hanzala-badge-global';
    badge.style.cssText = 'position:fixed;bottom:70px;left:16px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid rgba(255,215,0,0.4);border-radius:20px;padding:6px 14px;font-size:0.85rem;color:#f4d03f;z-index:9999;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.4);';
    badge.innerHTML = '&#x1FA99; <span id="hanzala-pts-display">' + pts.toLocaleString('ar') + '</span>';
    badge.title = 'عملة حنظلة';
    badge.onclick = function() { window.location.href = '/rewards'; };
    document.body.appendChild(badge);
  }
  
  function updateHanzalaBadge() {
    var el = document.getElementById('hanzala-pts-display');
    if (!el) return;
    try {
      var pts = parseInt(localStorage.getItem('fl_hanzala_points') || '0') || 0;
      el.textContent = pts.toLocaleString('ar');
    } catch(e) {}
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showHanzalaBadge);
  } else {
    showHanzalaBadge();
  }
  
  // Expose globally
  window.updateHanzalaBadge = updateHanzalaBadge;
})();
