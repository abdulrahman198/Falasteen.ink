// discovery-engine.js — TikTok-style discovery recommendations for FALASTEEN.INK.
// يعتمد على الوسوم، المشاهدات، الإعجابات، الحفظ، المشاركة، التعليقات، ووقت المشاهدة.
(function() {
  'use strict';

  var INTERESTS_KEY = 'fl_user_interests';
  var METRICS_KEY = 'fl_discovery_metrics';
  var SESSION_KEY = 'fl_discovery_session';
  var MAX_TAGS = 16;

  var INTERACTION_WEIGHTS = {
    view: 1,
    like: 5,
    save: 7,
    share: 4,
    comment: 6,
    watch_time: 0.35
  };

  var CREATE_USER_INTERESTS_SQL = [
    'create table if not exists public.user_interests (',
    '  user_id uuid not null,',
    '  tag text not null,',
    '  score numeric not null default 0,',
    '  updated_at timestamptz not null default now(),',
    '  primary key (user_id, tag)',
    ');',
    '',
    'alter table public.user_interests enable row level security;',
    '',
    'create policy "Users can read own interests"',
    'on public.user_interests for select',
    'using (auth.uid() = user_id);',
    '',
    'create policy "Users can insert own interests"',
    'on public.user_interests for insert',
    'with check (auth.uid() = user_id);',
    '',
    'create policy "Users can update own interests"',
    'on public.user_interests for update',
    'using (auth.uid() = user_id)',
    'with check (auth.uid() = user_id);'
  ].join('\n');

  function log() {
    if (window.console) console.log.apply(console, ['[FLDiscoveryEngine]'].concat([].slice.call(arguments)));
  }

  function warn() {
    if (window.console) console.warn.apply(console, ['[FLDiscoveryEngine]'].concat([].slice.call(arguments)));
  }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function esc(value) {
    if (window.FL && typeof window.FL.esc === 'function') return window.FL.esc(value);
    return String(value || '').replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function normalizeTags(tags) {
    var list = [];
    if (Array.isArray(tags)) list = tags;
    else if (typeof tags === 'string') list = tags.split(/[,،#\n]+/);
    return list
      .map(function(tag) {
        return String(tag || '')
          .replace(/^[#@]+/, '')
          .replace(/[^\u0600-\u06FFa-zA-Z0-9 _-]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      })
      .filter(Boolean)
      .filter(function(tag, index, arr) {
        return tag.length <= 28 && arr.map(function(x) { return x.toLowerCase(); }).indexOf(tag.toLowerCase()) === index;
      })
      .slice(0, MAX_TAGS);
  }

  function inferTags(parts) {
    var text = parts.filter(Boolean).join(' ');
    var tags = [];
    var cityMatches = text.match(/غزة|رفح|خان يونس|جباليا|الشفاء|القدس|جنين|Gaza|Rafah|Jerusalem|Jenin/gi) || [];
    tags = tags.concat(cityMatches);
    [
      ['شهيد', /شهيد|شهداء|martyr/i],
      ['طفل', /طفل|أطفال|child/i],
      ['معلم', /معلم|مسجد|مستشفى|جامعة|مدرسة|landmark|hospital|mosque|school/i],
      ['شهادة', /شهادة|testimony|oral/i],
      ['فيديو', /فيديو|ريل|video|reel/i],
      ['تراث', /تراث|ثقافي|heritage|culture/i],
      ['قصف', /قصف|دمر|تدمير|bomb|destroy/i]
    ].forEach(function(pair) {
      if (pair[1].test(text)) tags.push(pair[0]);
    });
    return normalizeTags(tags);
  }

  function getSessionId() {
    var id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = 'guest_' + Date.now() + '_' + Math.random().toString(16).slice(2);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  async function getCurrentUserId() {
    try {
      if (window.FL && typeof window.FL.getUser === 'function') {
        var user = await window.FL.getUser();
        if (user && user.id) return user.id;
      }
    } catch (e) {}
    return getSessionId();
  }

  function getLocalInterests(userId) {
    var all = readJSON(INTERESTS_KEY, {});
    return all[userId || getSessionId()] || {};
  }

  function saveLocalInterests(userId, interests) {
    var all = readJSON(INTERESTS_KEY, {});
    all[userId || getSessionId()] = interests || {};
    writeJSON(INTERESTS_KEY, all);
  }

  function getMetrics() {
    return readJSON(METRICS_KEY, {});
  }

  function saveMetrics(metrics) {
    writeJSON(METRICS_KEY, metrics || {});
  }

  function bumpMetrics(contentId, type, amount) {
    if (!contentId) return;
    var metrics = getMetrics();
    metrics[contentId] = metrics[contentId] || { views: 0, likes: 0, saves: 0, shares: 0, comments: 0, watchTime: 0 };
    if (type === 'view') metrics[contentId].views += amount;
    if (type === 'like') metrics[contentId].likes += amount;
    if (type === 'save') metrics[contentId].saves += amount;
    if (type === 'share') metrics[contentId].shares += amount;
    if (type === 'comment') metrics[contentId].comments += amount;
    if (type === 'watch_time') metrics[contentId].watchTime += amount;
    saveMetrics(metrics);
  }

  async function fetchRemoteInterests(userId) {
    if (!window.FL || !window.FL.rest || !userId || String(userId).indexOf('guest_') === 0) return {};
    try {
      var rows = await window.FL.rest('user_interests', {
        query: 'select=tag,score&user_id=eq.' + encodeURIComponent(userId)
      });
      var map = {};
      if (Array.isArray(rows)) {
        rows.forEach(function(row) { map[row.tag] = Number(row.score) || 0; });
      }
      return map;
    } catch (e) {
      warn('Supabase user_interests unavailable. Using local fallback.', e.message || e);
      return {};
    }
  }

  async function syncInterestToSupabase(userId, tag, score) {
    if (!window.FL || !window.FL.rest || !userId || String(userId).indexOf('guest_') === 0) return;
    try {
      var existing = await window.FL.rest('user_interests', {
        query: 'select=score&user_id=eq.' + encodeURIComponent(userId) + '&tag=eq.' + encodeURIComponent(tag) + '&limit=1'
      });
      if (Array.isArray(existing) && existing.length) {
        await window.FL.rest('user_interests', {
          method: 'PATCH',
          query: 'user_id=eq.' + encodeURIComponent(userId) + '&tag=eq.' + encodeURIComponent(tag),
          body: { score: score, updated_at: new Date().toISOString() },
          prefer: 'return=minimal'
        });
      } else {
        await window.FL.rest('user_interests', {
          method: 'POST',
          body: { user_id: userId, tag: tag, score: score },
          prefer: 'return=minimal'
        });
      }
    } catch (e) {
      warn('Could not sync interest to Supabase. Run user_interests SQL if needed.', e.message || e);
    }
  }

  async function trackInteraction(type, tags, contentId, amount) {
    var weight = INTERACTION_WEIGHTS[type] || 1;
    var value = typeof amount === 'number' ? amount : 1;
    var delta = weight * value;
    var userId = await getCurrentUserId();
    var normalized = normalizeTags(tags);
    var interests = getLocalInterests(userId);

    normalized.forEach(function(tag) {
      interests[tag] = Number(interests[tag] || 0) + delta;
      syncInterestToSupabase(userId, tag, interests[tag]);
    });
    saveLocalInterests(userId, interests);
    bumpMetrics(contentId, type, value);
    log('Tracked interaction:', type, normalized, 'delta:', delta);
    return interests;
  }

  function defaultSamples() {
    return [
      {
        id: 'sample_reel_1',
        type: 'reel',
        title: 'توثيق حي من غزة',
        description: 'مشهد قصير من ذاكرة المكان وحياة الناس اليومية.',
        tags: ['غزة', 'فيديو', 'توثيق', 'حياة'],
        source: 'Feed.html',
        icon: '▶',
        video_url: '',
        views: 920,
        likes: 120,
        saves: 34
      },
      {
        id: 'sample_landmark_1',
        type: 'landmark',
        title: 'مستشفى الشفاء',
        description: 'أكبر مستشفى في قطاع غزة ورمز مهم في الذاكرة الفلسطينية.',
        tags: ['غزة', 'مستشفى', 'معلم', 'الشفاء'],
        source: 'Landmarks.html',
        icon: '🏥',
        views: 760,
        likes: 96,
        saves: 45
      },
      {
        id: 'sample_archive_1',
        type: 'archive',
        title: 'شهادة شفوية من الذاكرة',
        description: 'قصة محفوظة ضمن الأرشيف البصري والشهادات.',
        tags: ['شهادة', 'أرشيف', 'فلسطين', 'ذاكرة'],
        source: 'Archive.html',
        icon: '🎙',
        views: 640,
        likes: 88,
        saves: 52
      }
    ];
  }

  function normalizeContent(item, type) {
    var id = item.id || item.uuid || (type + '_' + Math.random().toString(16).slice(2));
    var title = item.title || item.name || item.sub || 'Untitled';
    var description = item.description || item.desc || item.story || item.sub || item.mission || '';
    var category = item.category || item.type || '';
    var city = item.city || '';
    var tags = normalizeTags(item.tags);
    if (!tags.length) tags = inferTags([title, description, category, city]);
    var source = type === 'reel' ? 'Feed.html' : type === 'martyr' ? 'Martyrs.html' : type === 'landmark' ? 'Landmarks.html' : 'Archive.html';
    return {
      id: String(id),
      type: type,
      title: title,
      description: description,
      category: category,
      city: city,
      tags: tags,
      source: source,
      icon: type === 'reel' ? '▶' : type === 'martyr' ? '🕊' : type === 'landmark' ? '🏛' : '📽',
      video_url: item.video_url || item.videoUrl || item.url || '',
      cover_url: item.cover_url || item.coverUrl || item.photo || item.photoAfter || item.photoBefore || '',
      views: Number(item.views || item.view_count || 0),
      likes: Number(item.likes || item.like_count || 0),
      saves: Number(item.saves || item.save_count || 0),
      created_at: item.created_at || item.addedAt || item.date || ''
    };
  }

  function collectLocalContent() {
    var items = [];
    readJSON('fl_reels', []).forEach(function(r) { items.push(normalizeContent(r, 'reel')); });
    readJSON('fl_martyrs', []).forEach(function(m) { items.push(normalizeContent(m, 'martyr')); });
    readJSON('fl_landmarks', []).forEach(function(l) { items.push(normalizeContent(l, 'landmark')); });
    readJSON('fl_archive_films', []).forEach(function(f) { items.push(normalizeContent(f, 'archive')); });
    defaultSamples().forEach(function(s) {
      if (!items.some(function(item) { return item.id === s.id; })) items.push(normalizeContent(s, s.type));
    });
    return items;
  }

  async function collectRemoteContent() {
    if (!window.FL || !window.FL.rest) return [];
    var items = [];
    try {
      var reels = await window.FL.rest('reels', { query: 'select=*&order=created_at.desc&limit=40' });
      if (Array.isArray(reels)) reels.forEach(function(r) { items.push(normalizeContent(r, 'reel')); });
    } catch (e) {
      warn('Remote reels unavailable.', e.message || e);
    }
    try {
      var martyrs = await window.FL.rest('martyrs', { query: 'select=*&order=created_at.desc&limit=30' });
      if (Array.isArray(martyrs)) martyrs.forEach(function(m) { items.push(normalizeContent(m, 'martyr')); });
    } catch (e) {
      warn('Remote martyrs unavailable.', e.message || e);
    }
    return items;
  }

  function scoreItem(item, interests) {
    var metrics = getMetrics()[item.id] || {};
    var tagScore = item.tags.reduce(function(sum, tag) {
      return sum + Number(interests[tag] || interests[tag.toLowerCase()] || 0);
    }, 0);
    var engagement =
      Number(item.views || 0) * 0.015 +
      Number(item.likes || 0) * 0.7 +
      Number(item.saves || 0) * 1.1 +
      Number(metrics.views || 0) * 1.2 +
      Number(metrics.likes || 0) * 5 +
      Number(metrics.saves || 0) * 7 +
      Number(metrics.shares || 0) * 4 +
      Number(metrics.comments || 0) * 6 +
      Number(metrics.watchTime || 0) * 0.25;
    var freshness = item.created_at ? Math.max(0, 12 - ((Date.now() - Date.parse(item.created_at)) / 86400000)) : 0;
    return tagScore * 3 + engagement + freshness;
  }

  async function getRecommendations(userId) {
    userId = userId || await getCurrentUserId();
    var localInterests = getLocalInterests(userId);
    var remoteInterests = await fetchRemoteInterests(userId);
    var interests = Object.assign({}, localInterests, remoteInterests);
    var local = collectLocalContent();
    var remote = await collectRemoteContent();
    var byId = {};
    local.concat(remote).forEach(function(item) { byId[item.type + ':' + item.id] = item; });
    return Object.keys(byId).map(function(key) {
      var item = byId[key];
      item.score = scoreItem(item, interests);
      return item;
    }).sort(function(a, b) {
      return b.score - a.score;
    });
  }

  function getTrendingTags(limit) {
    var counts = {};
    var interests = getLocalInterests(getSessionId());
    collectLocalContent().forEach(function(item) {
      item.tags.forEach(function(tag) {
        counts[tag] = (counts[tag] || 0) + 1 + Math.round(scoreItem(item, interests) / 20);
      });
    });
    return Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; }).slice(0, limit || 10).map(function(tag) {
      return { tag: tag, score: counts[tag] };
    });
  }

  function getRelatedContent(item, pool, limit) {
    if (!item) return [];
    var tagMap = {};
    item.tags.forEach(function(tag) { tagMap[tag.toLowerCase()] = true; });
    return (pool || collectLocalContent()).filter(function(candidate) {
      return candidate.id !== item.id && candidate.tags.some(function(tag) { return tagMap[tag.toLowerCase()]; });
    }).slice(0, limit || 3);
  }

  window.FLDiscoveryEngine = {
    createUserInterestsSQL: CREATE_USER_INTERESTS_SQL,
    weights: INTERACTION_WEIGHTS,
    normalizeTags: normalizeTags,
    trackInteraction: trackInteraction,
    trackWatchTime: function(tags, seconds, contentId) {
      return trackInteraction('watch_time', tags, contentId, seconds || 1);
    },
    getRecommendations: getRecommendations,
    getTrendingTags: getTrendingTags,
    getRelatedContent: getRelatedContent,
    collectLocalContent: collectLocalContent,
    esc: esc
    // TODO: Add semantic search over archived stories.
    // TODO: Add embeddings storage for multilingual retrieval.
    // TODO: Add AI recommendations using Ollama/OpenAI ranking.
  };

  log('Discovery engine ready. user_interests SQL is available at FLDiscoveryEngine.createUserInterestsSQL');
})();
