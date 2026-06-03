// FALASTEEN.INK — common.js v2
// Single source of truth for FL namespace

window.FL = window.FL || {};

// Temporary audit/debug layer. Set localStorage.fl_debug = "off" to silence.
FL.DEBUG = true;
try { FL.DEBUG = localStorage.getItem('fl_debug') !== 'off'; } catch(e) {}

FL.log = function() {
  if (!FL.DEBUG || !window.console) return;
  console.log.apply(console, ['[FALASTEEN.AUDIT]'].concat([].slice.call(arguments)));
};

FL.warn = function() {
  if (!FL.DEBUG || !window.console) return;
  console.warn.apply(console, ['[FALASTEEN.AUDIT]'].concat([].slice.call(arguments)));
};

FL.error = function() {
  if (!window.console) return;
  console.error.apply(console, ['[FALASTEEN.AUDIT]'].concat([].slice.call(arguments)));
};

if (window.fetch && !window.fetch._flAuditWrapped) {
  FL._nativeFetch = window.fetch.bind(window);
  var flAuditFetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var method = (init && init.method) || (input && input.method) || 'GET';
    if (FL.DEBUG && (url.indexOf('supabase.co') > -1 || url.indexOf('localhost:11434') > -1 || url.indexOf('/rest/v1/') > -1)) {
      FL.log('fetch:', method, url);
    }
    return FL._nativeFetch(input, init).catch(function(err) {
      FL.warn('fetch failed:', method, url, err && err.message ? err.message : err);
      throw err;
    });
  };
  flAuditFetch._flAuditWrapped = true;
  window.fetch = flAuditFetch;
}

// SECURITY FIX: Load config from environment variables
FL.SUPABASE_URL = window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url ? window.SUPABASE_CONFIG.url : '';
FL.SUPABASE_KEY = window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.key ? window.SUPABASE_CONFIG.key : '';

// Validate that credentials are configured
if (!FL.SUPABASE_URL || !FL.SUPABASE_KEY) {
  FL.error('[SECURITY] Supabase credentials not properly configured. Please set environment variables.');
}

// ── Supabase Auth ──
FL.getSupabaseClient = function() {
  if (FL._supabaseClient) return FL._supabaseClient;
  if (!window.supabase || !window.supabase.createClient) return null;
  if (!FL.SUPABASE_URL || !FL.SUPABASE_KEY) {
    FL.error('Cannot create Supabase client: credentials missing');
    return null;
  }
  FL._supabaseClient = window.supabase.createClient(FL.SUPABASE_URL, FL.SUPABASE_KEY);
  return FL._supabaseClient;
};

FL._session = null;
FL._user = null;

FL.getSession = async function() {
  if (FL._session) return FL._session;
  var sb = FL.getSupabaseClient();
  if (!sb || !sb.auth) return null;
  var res = await sb.auth.getSession();
  if (res.error || !res.data || !res.data.session) return null;
  FL._session = res.data.session;
  return FL._session;
};

FL.setSession = function(session) {
  FL._session = session || null;
};

FL.getUser = async function() {
  if (FL._user) return FL._user;
  var sb = FL.getSupabaseClient();
  if (!sb || !sb.auth) return null;
  var res = await sb.auth.getUser();
  if (res.error || !res.data || !res.data.user) return null;
  FL._user = res.data.user;
  return FL._user;
};

FL.setUser = function(user) {
  FL._user = user || null;
};

FL.signIn = async function(email, password) {
  var sb = FL.getSupabaseClient();
  if (!sb || !sb.auth) throw new Error('Supabase client unavailable');
  var res = await sb.auth.signInWithPassword({ email: email, password: password });
  if (res.error) throw res.error;
  FL.setSession(res.data.session);
  FL.setUser(res.data.user);
  return res;
};

FL.signUp = async function(email, password) {
  var sb = FL.getSupabaseClient();
  if (!sb || !sb.auth) throw new Error('Supabase client unavailable');
  var res = await sb.auth.signUp({ email: email, password: password });
  if (res.error) throw res.error;
  FL.setSession(res.data.session);
  FL.setUser(res.data.user);
  return res;
};

FL.signOut = async function() {
  var sb = FL.getSupabaseClient();
  if (!sb || !sb.auth) return;
  await sb.auth.signOut();
  FL.setSession(null);
  FL.setUser(null);
};

FL.getRole = function(user) {
  if (!user) return 'anon';
  var appMeta = user.app_metadata || {};
  var userMeta = user.user_metadata || {};
  return appMeta.role || userMeta.role || 'user';
};

FL.isAdminUser = function(user) {
  return !!(user && user.app_metadata && user.app_metadata.role === 'admin');
};

FL.clearSession = async function() {
  var sb = FL.getSupabaseClient();
  if (sb && sb.auth) await sb.auth.signOut();
  FL.setSession(null);
  FL.setUser(null);
};

// Start hydrating the session/user as early as possible to shrink the window
// where FL.isLoggedIn() returns a stale false. Retried on load in case the
// Supabase client wasn't ready yet at parse time.
FL.getSession().catch(function(){});
FL.getUser().catch(function(){});

window.addEventListener('load', function() {
  FL.log('Page loaded:', location.pathname || location.href);
  FL.getSession().catch(function(){});
  FL.getUser().catch(function(){});
});

document.addEventListener('DOMContentLoaded', function() {
  FL.log('DOM ready:', document.title || location.href);
  var ids = {};
  Array.prototype.forEach.call(document.querySelectorAll('[id]'), function(el) {
    ids[el.id] = (ids[el.id] || 0) + 1;
  });
  Object.keys(ids).forEach(function(id) {
    if (ids[id] > 1) FL.warn('Duplicate id detected:', id, ids[id]);
  });
});

document.addEventListener('click', function(e) {
  var target = e.target.closest && e.target.closest('button,a,[role="button"],.chip,.fchip,.tab,.tab-btn,.mission-card,.card');
  if (!target) return;
  FL.log('UI click:', target.tagName, target.id || target.getAttribute('href') || target.getAttribute('data-mission-id') || target.className || target.textContent.trim().slice(0, 40));
}, true);

document.addEventListener('click', function(e) {
  var overlay = e.target.closest && e.target.closest('.overlay,.modal-overlay,.v-overlay,.af-overlay');
  if (overlay && overlay.classList && (overlay.classList.contains('on') || overlay.classList.contains('active'))) {
    FL.log('Overlay interaction:', overlay.id || overlay.className);
  }
}, true);

window.addEventListener('error', function(e) {
  FL.error('JS error:', e.message, e.filename ? e.filename + ':' + e.lineno : '');
});

window.addEventListener('unhandledrejection', function(e) {
  FL.error('Unhandled promise rejection:', e.reason && (e.reason.message || e.reason));
});

// ── Escape HTML ──
FL.esc = function(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// ── Safe URL ──
FL.safeUrl = function(url) {
  if (!url) return '#';
  if (/^(https?:\/\/|mailto:|tel:)/.test(url)) return url;
  return '#';
};

// ── Toast ──
FL.toast = function(msg, type) {
  var t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.background = type === 'err' ? '#E8221F' : type === 'warn' ? '#ffb347' : '#00b954';
  t.style.color = '#fff';
  t.classList.add('show');
  clearTimeout(FL._toastTimer);
  FL._toastTimer = setTimeout(function() { t.classList.remove('show'); }, 3500);
};

FL.authHeaders = async function(extra) {
  var session = await FL.getSession();
  var token = session && session.access_token ? session.access_token : FL.SUPABASE_KEY;
  return Object.assign({
    'apikey':        FL.SUPABASE_KEY,
    'Authorization': 'Bearer ' + token,
    'Content-Type':  'application/json'
  }, extra || {});
};

FL.get = async function(table, query) {
  return FL.rest(table, { query: query || 'select=*' });
};

FL.post = async function(table, data, opts) {
  opts = opts || {};
  return FL.rest(table, Object.assign({ method: 'POST', body: data, query: opts.query || 'select=*', prefer: opts.prefer || '' }, opts));
};

FL.put = async function(table, data, opts) {
  opts = opts || {};
  return FL.rest(table, Object.assign({ method: 'PATCH', body: data, query: opts.query || 'select=*', prefer: opts.prefer || '' }, opts));
};

FL.delete = async function(table, opts) {
  opts = opts || {};
  return FL.rest(table, Object.assign({ method: 'DELETE', query: opts.query || 'select=*', prefer: opts.prefer || '' }, opts));
};

// Synchronous best-effort check against the cached session/user. May return
// false before hydration completes — callers that need certainty should
// `await FL.isLoggedInAsync()` (or `await FL.getSession()`) instead.
FL.isLoggedIn = function() {
  return !!((FL._session && FL._session.user) || FL._user);
};

FL.isLoggedInAsync = async function() {
  var session = await FL.getSession();
  return !!(session && session.user);
};

FL.requireAuth = async function() {
  var session = await FL.getSession();
  if (!session) {
    window.location.href = 'Auth.html';
    return false;
  }
  return true;
};

// ── Supabase REST ──
FL.rest = async function(table, opts) {
  opts = opts || {};
  var method  = opts.method || 'GET';
  var query   = opts.query  || 'select=*';
  var url     = FL.SUPABASE_URL + '/rest/v1/' + table + '?' + query;
  var headers = await FL.authHeaders({'Prefer': opts.prefer || ''});
  FL.log('Supabase REST:', method, table, query);
  try {
    var res = await fetch(url, {
      method:  method,
      headers: headers,
      body:    opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (!res.ok) throw new Error('FL.rest ' + table + ' HTTP ' + res.status);
    if (method === 'DELETE' || res.status === 204) return true;
    return res.json();
  } catch(e) {
    FL.warn('FL.rest failed:', table, e.message);
    throw e;
  }
};

// ── Admin check ──
FL.requireAdmin = async function() {
  var user = await FL.getUser();
  if (FL.isAdminUser(user)) return user;
  document.body.innerHTML = '<div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#0e0e0e;color:#E8221F;font-family:Arial,sans-serif;font-size:1.2rem;text-align:center;">⛔ Admin Role Required</div>';
  throw new Error('Admin role required');
};
