// ollama-auto-tagging.js — Local AI auto-tagging for FALASTEEN.INK content.
// لتشغيل Ollama:
// ollama serve
// ولتحميل موديل:
// ollama run llama3.1
(function() {
  'use strict';

  var ENDPOINT = 'http://localhost:11434/api/generate';
  var MAX_TAGS = 12;
  var MAX_TAG_LENGTH = 28;

  function log() {
    if (window.console) console.log.apply(console, ['[FLOllamaTagging]'].concat([].slice.call(arguments)));
  }

  function warn() {
    if (window.console) console.warn.apply(console, ['[FLOllamaTagging]'].concat([].slice.call(arguments)));
  }

  function resolveEl(selectorOrId) {
    if (!selectorOrId) return null;
    if (typeof selectorOrId !== 'string') return selectorOrId;
    return document.querySelector(selectorOrId.charAt(0) === '#' ? selectorOrId : '#' + selectorOrId);
  }

  function getValue(selectorOrId) {
    var el = resolveEl(selectorOrId);
    return el ? String(el.value || el.textContent || '').trim() : '';
  }

  function showToast(message) {
    if (window.FL && typeof window.FL.toast === 'function') return window.FL.toast(message, 'warn');
    if (typeof window.toast === 'function') return window.toast(message, 'warn');
    if (typeof window.showToast === 'function') return window.showToast(message);
    var t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(window.__flOllamaTagToastTimer);
    window.__flOllamaTagToastTimer = setTimeout(function() { t.classList.remove('show'); }, 3200);
  }

  function toText(data) {
    data = data || {};
    return [data.title, data.city, data.category, data.story, data.description, data.date].filter(Boolean).join('\n');
  }

  function buildPrompt(data) {
    return [
      'أنت نظام AI لاستخراج الوسوم لمشروع أرشيف فلسطيني.',
      'استخرج وسوم قصيرة فقط.',
      'الحد الأقصى 12.',
      'بدون شرح.',
      'بدون جمل.',
      'أعد النتيجة JSON array فقط.',
      'ادعم العربية والإنجليزية.',
      '',
      'مثال:',
      '["غزة","طفل","مستشفى","قصف"]',
      '',
      'النص:',
      toText(data)
    ].join('\n');
  }

  function parseOllamaTags(raw) {
    var text = String(raw || '').trim();
    var jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) text = jsonMatch[0];
    try {
      var parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      warn('Could not parse Ollama JSON response. Falling back to comma/newline split.', e);
      return text.split(/[\n,،#]+/).map(function(x) { return x.trim(); });
    }
  }

  function fallbackGenerate(data) {
    log('Using local fallback tag generator.');
    var text = toText(data).toLowerCase();
    var seeded = [data && data.city, data && data.category];
    var stopWords = {
      'هذا': 1, 'هذه': 1, 'ذلك': 1, 'الذي': 1, 'التي': 1, 'كان': 1, 'كانت': 1,
      'على': 1, 'في': 1, 'من': 1, 'عن': 1, 'إلى': 1, 'الى': 1, 'مع': 1,
      'the': 1, 'and': 1, 'for': 1, 'from': 1, 'with': 1, 'this': 1, 'that': 1,
      'was': 1, 'were': 1, 'are': 1, 'his': 1, 'her': 1, 'their': 1
    };
    var important = {
      'غزة': 1, 'gaza': 1, 'فلسطين': 1, 'palestine': 1, 'طفل': 1, 'child': 1,
      'شهيد': 1, 'martyr': 1, 'مستشفى': 1, 'hospital': 1, 'مدرسة': 1,
      'school': 1, 'جامعة': 1, 'قصف': 1, 'bombing': 1, 'تراث': 1, 'heritage': 1,
      'مسجد': 1, 'mosque': 1, 'شهادة': 1, 'testimony': 1, 'فيديو': 1, 'video': 1
    };
    var words = text
      .replace(/[^\u0600-\u06FFa-zA-Z0-9\s_-]/g, ' ')
      .split(/\s+/)
      .filter(function(word) {
        if (!word || word.length < 3 || word.length > MAX_TAG_LENGTH) return false;
        return important[word] || !stopWords[word];
      });
    return cleanTags(seeded.concat(words));
  }

  function cleanTags(tags) {
    var out = [];
    var seen = {};
    (Array.isArray(tags) ? tags : []).forEach(function(tag) {
      var cleaned = String(tag || '')
        .replace(/^[#@]+/, '')
        .replace(/[^\u0600-\u06FFa-zA-Z0-9 _-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleaned || cleaned.length > MAX_TAG_LENGTH) return;
      var key = cleaned.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(cleaned);
    });
    return out.slice(0, MAX_TAGS);
  }

  async function generate(data) {
    data = data || {};
    log('Generating tags for content:', data);
    try {
      if (!window.fetch) throw new Error('fetch is not available in this browser');
      var res = await window.fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: window.FLOllamaTagging.model,
          prompt: buildPrompt(data),
          stream: false,
          options: { temperature: 0.2 }
        })
      });
      if (!res.ok) throw new Error('Ollama HTTP ' + res.status);
      var payload = await res.json();
      var aiTags = cleanTags(parseOllamaTags(payload.response));
      if (!aiTags.length) throw new Error('Ollama returned no tags');
      log('Ollama tags generated:', aiTags);
      return aiTags;
    } catch (err) {
      warn('Ollama غير متصل أو localhost غير متاح من المتصفح. تأكد من تشغيل ollama serve والسماح بالوصول إلى localhost.', err);
      showToast('Ollama غير متصل — تم استخدام الوسوم المحلية');
      return fallbackGenerate(data);
    }
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function renderTags(containerId, tags) {
    var container = resolveEl(containerId);
    if (!container) return;
    var cleaned = cleanTags(tags);
    container.innerHTML = cleaned.map(function(tag) {
      return '<span class="fl-ai-tag-chip" dir="auto">' + escapeHtml(tag) + '</span>';
    }).join('');
    container.classList.toggle('is-empty', cleaned.length === 0);
  }

  function setLoading(button, loading) {
    if (!button) return;
    if (loading) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.classList.add('is-loading');
      button.textContent = '⏳ جاري توليد الوسوم...';
    } else {
      button.disabled = false;
      button.classList.remove('is-loading');
      button.textContent = button.dataset.originalText || '✨ توليد الوسوم';
    }
  }

  function attachToForm(config) {
    config = config || {};
    var button = resolveEl(config.button);
    if (!button || button.dataset.flOllamaAttached === '1') return false;
    button.dataset.flOllamaAttached = '1';
    log('Attached auto-tagging button:', button.id || button);
    button.addEventListener('click', async function(event) {
      event.preventDefault();
      var data = {
        title: getValue(config.title),
        city: getValue(config.city),
        category: getValue(config.category),
        story: getValue(config.story),
        description: getValue(config.description),
        date: getValue(config.date)
      };
      setLoading(button, true);
      try {
        var tags = await generate(data);
        renderTags(config.output, tags);
        var hidden = resolveEl(config.hiddenInput);
        if (hidden) hidden.value = JSON.stringify(tags);
        var visibleTagsInput = resolveEl(config.visibleInput);
        if (visibleTagsInput) visibleTagsInput.value = tags.join(', ');
      } finally {
        setLoading(button, false);
      }
    });
    return true;
  }

  function autoAttachKnownForms() {
    var config = null;
    if (document.getElementById('mName')) {
      config = { title: 'mName', city: 'mCity', category: 'mCategory', story: 'mStory', description: 'mSource', date: 'mDate' };
    } else if (document.getElementById('upTitle')) {
      config = { title: 'upTitle', category: 'upCat', description: 'upDesc', story: 'upMission', visibleInput: 'upTags' };
    } else if (document.getElementById('lName')) {
      config = { title: 'lName', city: 'lCity', category: 'lType', description: 'lDesc', date: 'lDestroyedDate' };
    } else if (document.getElementById('afTit')) {
      config = { title: 'afTit', category: 'afType', description: 'afDesc', date: 'afYear', story: 'afSrc' };
    } else if (document.getElementById('fTitle')) {
      config = { title: 'fTitle', category: 'fCat', description: 'fDesc', story: 'fMission', visibleInput: 'fTags' };
    }
    if (!config) return;
    config.button = 'generateTagsBtn';
    config.output = 'aiTagsOutput';
    config.hiddenInput = 'mTags';
    attachToForm(config);
  }

  window.FLOllamaTagging = {
    model: 'llama3.1',
    endpoint: ENDPOINT,
    generate: generate,
    fallbackGenerate: fallbackGenerate,
    cleanTags: cleanTags,
    renderTags: renderTags,
    attachToForm: attachToForm
    // TODO: Add OpenAI provider support for hosted AI tagging.
    // TODO: Add Remote Ollama server configuration for team deployments.
    // TODO: Store embeddings in a database for semantic search and multilingual AI.
    // TODO: Extend this module with image tagging and video tagging pipelines.
  };

  document.addEventListener('DOMContentLoaded', autoAttachKnownForms);
  log('Module ready. Model:', window.FLOllamaTagging.model, 'Endpoint:', ENDPOINT);
})();
