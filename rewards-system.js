// rewards-system.js — XP, Points, Guardian Levels, Badges, Missions, and Token Rewards.
// Token rewards are stored off-chain for now. TODO: Blockchain reward integration later.
(function() {
  'use strict';

  var REWARDS_KEY = 'fl_rewards_profiles';
  var EVENTS_KEY = 'fl_reward_events';
  var SOUND_KEY = 'fl_rewards_sound';

  var XP_RULES = {
    view: { xp: 1, points: 1, token: 0 },
    upload: { xp: 15, points: 10, token: 1 },
    comment: { xp: 5, points: 3, token: 0.1 },
    translate: { xp: 20, points: 14, token: 1.5 },
    share: { xp: 3, points: 2, token: 0 },
    document: { xp: 25, points: 18, token: 2 },
    daily_login: { xp: 2, points: 1, token: 0 },
    mission: { xp: 0, points: 0, token: 0 }
  };

  var LEVELS = [
    { level: 1, xp: 0, name: 'Guardian Seed' },
    { level: 2, xp: 100, name: 'Memory Keeper' },
    { level: 3, xp: 300, name: 'Archive Guardian' },
    { level: 4, xp: 700, name: 'Witness Sentinel' },
    { level: 5, xp: 1500, name: 'Eternal Guardian' }
  ];

  var BADGES = [
    { id: 'Archivist', icon: '📚', name: 'Archivist', desc: 'حفظ ورفع مواد أرشيفية' },
    { id: 'Witness', icon: '🎙', name: 'Witness', desc: 'شارك شهادة أو تعليقًا مهمًا' },
    { id: 'Guardian', icon: '🛡', name: 'Guardian', desc: 'وصل إلى مستوى Guardian' },
    { id: 'Storyteller', icon: '✒', name: 'Storyteller', desc: 'رفع قصصًا مؤثرة' },
    { id: 'Volunteer', icon: '🤝', name: 'Volunteer', desc: 'أكمل مهام تطوعية' },
    { id: 'Translator', icon: '🌐', name: 'Translator', desc: 'ترجم محتوى للغات أخرى' }
  ];

  var MISSIONS = [
    { id: 'upload_5_stories', title: 'ارفع 5 قصص', titleEn: 'Upload 5 Stories', type: 'upload', target: 5, xp: 75, points: 50, token: 5, badge: 'Storyteller' },
    { id: 'translate_3_posts', title: 'ترجم 3 منشورات', titleEn: 'Translate 3 Posts', type: 'translate', target: 3, xp: 60, points: 42, token: 4, badge: 'Translator' },
    { id: 'watch_10_videos', title: 'شاهد 10 فيديوهات', titleEn: 'Watch 10 Videos', type: 'view', target: 10, xp: 25, points: 20, token: 1, badge: 'Witness' },
    { id: 'document_3_items', title: 'وثّق 3 عناصر', titleEn: 'Document 3 Items', type: 'document', target: 3, xp: 90, points: 65, token: 6, badge: 'Archivist' }
  ];

  var ACHIEVEMENTS = [
    { id: 'first_step', title: 'First Step', test: function(p) { return p.xp >= 1; }, badge: 'Volunteer' },
    { id: 'level_3', title: 'Archive Guardian', test: function(p) { return p.level >= 3; }, badge: 'Guardian' },
    { id: 'seven_day_streak', title: '7 Day Flame', test: function(p) { return p.streak >= 7; }, badge: 'Witness' }
  ];

  function log() {
    if (window.console) console.log.apply(console, ['[FLRewards]'].concat([].slice.call(arguments)));
  }

  function warn() {
    if (window.console) console.warn.apply(console, ['[FLRewards]'].concat([].slice.call(arguments)));
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

  function todayKey(date) {
    var d = date ? new Date(date) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function daysBetween(a, b) {
    var start = new Date(a + 'T00:00:00');
    var end = new Date(b + 'T00:00:00');
    return Math.round((end - start) / 86400000);
  }

  async function getCurrentUserId() {
    try {
      if (window.FL && typeof window.FL.getUser === 'function') {
        var user = await window.FL.getUser();
        if (user && user.id) return user.id;
      }
    } catch (e) {}
    var localId = localStorage.getItem('fl_rewards_guest_id');
    if (!localId) {
      localId = 'guest_' + Date.now() + '_' + Math.random().toString(16).slice(2);
      localStorage.setItem('fl_rewards_guest_id', localId);
    }
    return localId;
  }

  function getLevel(xp) {
    xp = Number(xp || 0);
    var current = LEVELS[0];
    LEVELS.forEach(function(level) {
      if (xp >= level.xp) current = level;
    });
    return current.level;
  }

  function getLevelMeta(levelNumber) {
    return LEVELS.find(function(l) { return l.level === levelNumber; }) || LEVELS[0];
  }

  function getProgressToNextLevel(xp) {
    xp = Number(xp || 0);
    var currentLevel = getLevel(xp);
    var current = getLevelMeta(currentLevel);
    var next = LEVELS.find(function(l) { return l.level === currentLevel + 1; });
    if (!next) {
      return { current: current.xp, next: current.xp, progress: 100, remaining: 0, maxed: true };
    }
    var progress = Math.max(0, Math.min(100, ((xp - current.xp) / (next.xp - current.xp)) * 100));
    return { current: current.xp, next: next.xp, progress: progress, remaining: Math.max(0, next.xp - xp), maxed: false };
  }

  function defaultProfile(userId) {
    return {
      id: 'local_' + userId,
      user_id: userId,
      xp: 0,
      level: 1,
      points: 0,
      token_balance: 0,
      badges: [],
      streak: 0,
      last_login: '',
      missions: {},
      achievements: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  function localProfiles() {
    return readJSON(REWARDS_KEY, {});
  }

  function saveLocalProfile(profile) {
    var all = localProfiles();
    profile.level = getLevel(profile.xp);
    profile.updated_at = new Date().toISOString();
    all[profile.user_id] = profile;
    writeJSON(REWARDS_KEY, all);
    return profile;
  }

  async function fetchRemoteProfile(userId) {
    if (!window.FL || !window.FL.rest || String(userId).indexOf('guest_') === 0) return null;
    try {
      var rows = await window.FL.rest('user_rewards', { query: 'select=*&user_id=eq.' + encodeURIComponent(userId) + '&limit=1' });
      if (Array.isArray(rows) && rows[0]) {
        rows[0].badges = Array.isArray(rows[0].badges) ? rows[0].badges : [];
        rows[0].missions = rows[0].missions || {};
        rows[0].achievements = rows[0].achievements || [];
        return rows[0];
      }
    } catch (e) {
      warn('Supabase user_rewards unavailable, using local fallback.', e.message || e);
    }
    return null;
  }

  async function syncRemoteProfile(profile) {
    if (!window.FL || !window.FL.rest || String(profile.user_id).indexOf('guest_') === 0) return false;
    var payload = {
      user_id: profile.user_id,
      xp: profile.xp,
      level: getLevel(profile.xp),
      points: profile.points,
      token_balance: profile.token_balance,
      badges: profile.badges,
      streak: profile.streak,
      last_login: profile.last_login || null,
      missions: profile.missions || {},
      achievements: profile.achievements || [],
      updated_at: new Date().toISOString()
    };
    try {
      var existing = await window.FL.rest('user_rewards', { query: 'select=id&user_id=eq.' + encodeURIComponent(profile.user_id) + '&limit=1' });
      if (Array.isArray(existing) && existing[0]) {
        await window.FL.rest('user_rewards', {
          method: 'PATCH',
          query: 'user_id=eq.' + encodeURIComponent(profile.user_id),
          body: payload,
          prefer: 'return=minimal'
        });
      } else {
        await window.FL.rest('user_rewards', {
          method: 'POST',
          body: payload,
          prefer: 'return=minimal'
        });
      }
      return true;
    } catch (e) {
      warn('Could not sync profile to Supabase.', e.message || e);
      return false;
    }
  }

  async function getProfile(userId) {
    userId = userId || await getCurrentUserId();
    var all = localProfiles();
    var localProfile = all[userId] || defaultProfile(userId);
    var remote = await fetchRemoteProfile(userId);
    if (remote) {
      var merged = Object.assign(defaultProfile(userId), localProfile, remote);
      merged.last_login = localProfile.last_login || merged.last_login || '';
      merged.missions = localProfile.missions || merged.missions || {};
      merged.achievements = localProfile.achievements || merged.achievements || [];
      saveLocalProfile(merged);
      return merged;
    }
    return localProfile.user_id ? localProfile : saveLocalProfile(defaultProfile(userId));
  }

  function saveEventLocal(event) {
    var events = readJSON(EVENTS_KEY, []);
    events.unshift(event);
    writeJSON(EVENTS_KEY, events.slice(0, 400));
  }

  async function saveEventRemote(event) {
    if (!window.FL || !window.FL.rest || String(event.user_id).indexOf('guest_') === 0) return;
    try {
      await window.FL.rest('reward_events', { method: 'POST', body: event, prefer: 'return=minimal' });
    } catch (e) {
      warn('Could not save reward event remotely.', e.message || e);
    }
  }

  function showRewardPopup(lines) {
    var box = document.createElement('div');
    box.className = 'fl-reward-popup';
    box.innerHTML = lines.map(function(line) { return '<div>' + esc(line) + '</div>'; }).join('');
    document.body.appendChild(box);
    requestAnimationFrame(function() { box.classList.add('show'); });
    playRewardSound();
    setTimeout(function() {
      box.classList.remove('show');
      setTimeout(function() { box.remove(); }, 350);
    }, 2600);
  }

  function playRewardSound() {
    if (localStorage.getItem(SOUND_KEY) !== 'on') return;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  }

  async function persist(profile) {
    saveLocalProfile(profile);
    await syncRemoteProfile(profile);
    renderProfileCard(profile);
    return profile;
  }

  async function addXP(userId, amount, reason) {
    var profile = await getProfile(userId);
    var beforeLevel = getLevel(profile.xp);
    profile.xp += Number(amount || 0);
    profile.level = getLevel(profile.xp);
    var lines = ['+' + Number(amount || 0) + ' XP'];
    if (profile.level > beforeLevel) {
      lines.push('Guardian Level ' + profile.level);
    }
    if (reason) lines.push(reason);
    showRewardPopup(lines);
    return persist(profile);
  }

  async function addPoints(userId, amount) {
    var profile = await getProfile(userId);
    profile.points += Number(amount || 0);
    showRewardPopup(['+' + Number(amount || 0) + ' Points']);
    return persist(profile);
  }

  async function addTokenReward(userId, amount) {
    var profile = await getProfile(userId);
    profile.token_balance = Number(profile.token_balance || 0) + Number(amount || 0);
    showRewardPopup(['+' + Number(amount || 0) + ' FAL Token Reward']);
    return persist(profile);
  }

  async function unlockBadge(userId, badge) {
    var profile = await getProfile(userId);
    if (profile.badges.indexOf(badge) === -1) {
      profile.badges.push(badge);
      showRewardPopup(['🏅 New Badge Unlocked', badge]);
      await persist(profile);
    }
    return profile;
  }

  async function awardCustomMission(userId, reward) {
    userId = userId || await getCurrentUserId();
    reward = reward || {};
    var profile = await getProfile(userId);
    var beforeLevel = profile.level;
    var xp = Number(reward.xp || 0);
    var points = Number(reward.points || 0);
    var token = Number(reward.token || 0);

    profile.xp += xp;
    profile.points += points;
    profile.token_balance = Number(profile.token_balance || 0) + token;
    profile.level = getLevel(profile.xp);

    if (reward.badge && profile.badges.indexOf(reward.badge) === -1) {
      profile.badges.push(reward.badge);
    }

    if (reward.trackType) {
      profile = updateMissionProgress(profile, reward.trackType, 1);
    }

    profile = applyAchievements(profile);
    profile = await persist(profile);

    var event = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(16).slice(2),
      user_id: userId,
      type: reward.id ? 'mission:' + reward.id : 'mission',
      amount: 1,
      xp: xp,
      points: points,
      token_reward: token,
      created_at: new Date().toISOString()
    };
    saveEventLocal(event);
    saveEventRemote(event);

    var lines = ['Mission Complete', '+' + xp + ' XP', '+' + points + ' Points'];
    if (token) lines.push('+' + token + ' FAL');
    if (reward.badge) lines.push('🏅 ' + reward.badge);
    if (profile.level > beforeLevel) lines.push('Guardian Level ' + profile.level);
    showRewardPopup(lines);
    log('Awarded custom mission reward:', reward.id || 'mission', event);
    return profile;
  }

  async function trackEvent(userId, type) {
    if (typeof userId === 'string' && !type) {
      type = userId;
      userId = null;
    }
    userId = userId || await getCurrentUserId();
    var rule = XP_RULES[type] || XP_RULES.view;
    var profile = await getProfile(userId);
    var beforeLevel = profile.level;
    profile.xp += rule.xp;
    profile.points += rule.points;
    profile.token_balance = Number(profile.token_balance || 0) + Number(rule.token || 0);
    profile.level = getLevel(profile.xp);
    // Only update mission progress if this is not a mission-specific type
    if (type !== 'mission') {
      profile = updateMissionProgress(profile, type, 1);
    }
    profile = applyAchievements(profile);
    profile = await persist(profile);
    var event = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(16).slice(2),
      user_id: userId,
      type: type,
      amount: 1,
      xp: rule.xp,
      points: rule.points,
      token_reward: rule.token || 0,
      created_at: new Date().toISOString()
    };
    saveEventLocal(event);
    saveEventRemote(event);
    var lines = ['+' + rule.xp + ' XP', '+' + rule.points + ' Points'];
    if (rule.token) lines.push('+' + rule.token + ' FAL');
    if (profile.level > beforeLevel) lines.push('Guardian Level ' + profile.level);
    showRewardPopup(lines);
    log('Tracked event:', type, event);
    return profile;
  }

  function updateMissionProgress(profile, type, amount) {
    profile.missions = profile.missions || {};
    MISSIONS.forEach(function(mission) {
      if (mission.type !== type) return;
      var m = profile.missions[mission.id] || { progress: 0, completed: false };
      if (m.completed) return;
      m.progress = Math.min(mission.target, Number(m.progress || 0) + amount);
      if (m.progress >= mission.target) {
        m.completed = true;
        profile.xp += mission.xp;
        profile.points += mission.points;
        profile.token_balance = Number(profile.token_balance || 0) + Number(mission.token || 0);
        if (mission.badge && profile.badges.indexOf(mission.badge) === -1) profile.badges.push(mission.badge);
        showRewardPopup(['Mission Complete', '+' + mission.xp + ' XP', mission.badge ? '🏅 ' + mission.badge : '']);
      }
      profile.missions[mission.id] = m;
    });
    profile.level = getLevel(profile.xp);
    return profile;
  }

  async function completeMission(userId, missionId) {
    userId = userId || await getCurrentUserId();
    var mission = MISSIONS.find(function(m) { return m.id === missionId; });
    if (!mission) return null;
    var profile = await getProfile(userId);
    profile.missions = profile.missions || {};
    var progress = profile.missions[mission.id] || { progress: 0, completed: false };
    if (!progress.completed) {
      progress.progress = mission.target;
      progress.completed = true;
      profile.xp += mission.xp;
      profile.points += mission.points;
      profile.token_balance = Number(profile.token_balance || 0) + Number(mission.token || 0);
      if (mission.badge && profile.badges.indexOf(mission.badge) === -1) profile.badges.push(mission.badge);
      profile.level = getLevel(profile.xp);
      profile.missions[mission.id] = progress;
      await persist(profile);
      saveEventLocal({ id: 'evt_' + Date.now(), user_id: userId, type: 'mission:' + mission.id, amount: 1, xp: mission.xp, points: mission.points, token_reward: mission.token || 0, created_at: new Date().toISOString() });
      showRewardPopup(['Mission Complete', '+' + mission.xp + ' XP', mission.badge ? '🏅 ' + mission.badge : '']);
    }
    return profile;
  }

  function applyAchievements(profile) {
    profile.achievements = profile.achievements || [];
    ACHIEVEMENTS.forEach(function(achievement) {
      if (profile.achievements.indexOf(achievement.id) > -1) return;
      if (achievement.test(profile)) {
        profile.achievements.push(achievement.id);
        if (achievement.badge && profile.badges.indexOf(achievement.badge) === -1) profile.badges.push(achievement.badge);
        showRewardPopup(['Achievement Unlocked', achievement.title]);
      }
    });
    return profile;
  }

  async function dailyLogin(userId) {
    userId = userId || await getCurrentUserId();
    var profile = await getProfile(userId);
    var today = todayKey();
    if (profile.last_login === today) return profile;
    var diff = profile.last_login ? daysBetween(profile.last_login, today) : 0;
    profile.streak = diff === 1 ? Number(profile.streak || 0) + 1 : 1;
    profile.last_login = today;
    var bonus = 2 + Math.min(10, Math.max(0, profile.streak - 1));
    profile.xp += bonus;
    profile.points += 1;
    profile.level = getLevel(profile.xp);
    profile = applyAchievements(profile);
    await persist(profile);
    showRewardPopup(['Daily Login', '+' + bonus + ' XP', 'Streak ' + profile.streak]);
    return profile;
  }

  function esc(value) {
    if (window.FL && typeof window.FL.esc === 'function') return window.FL.esc(value);
    return String(value || '').replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function renderProfileCard(profile) {
    var box = document.getElementById('flRewardsCard');
    if (!box) return;
    profile = profile || defaultProfile('guest');
    var levelMeta = getLevelMeta(profile.level);
    var progress = getProgressToNextLevel(profile.xp);
    var badgeHtml = (profile.badges || []).length
      ? profile.badges.map(function(b) { return '<span class="fl-reward-badge">' + esc(b) + '</span>'; }).join('')
      : '<span class="fl-reward-badge locked">No badges yet</span>';
    box.innerHTML =
      '<section class="fl-rewards-card" dir="rtl">' +
        '<div class="fl-rewards-head">' +
          '<div><div class="fl-rewards-kicker">REWARDS SYSTEM</div><h2>Guardian Level ' + profile.level + '</h2><p>' + esc(levelMeta.name) + '</p></div>' +
          '<a href="Rewards.html" class="fl-rewards-link">Rewards</a>' +
        '</div>' +
        '<div class="fl-xp-row"><span>' + Number(profile.xp || 0).toLocaleString() + ' XP</span><span>' + (progress.maxed ? 'MAX' : progress.remaining + ' XP للمرحلة التالية') + '</span></div>' +
        '<div class="fl-xp-track"><div class="fl-xp-fill" style="width:' + progress.progress.toFixed(1) + '%"></div></div>' +
        '<div class="fl-reward-stats">' +
          '<div><span>Points</span><strong>' + Number(profile.points || 0).toLocaleString() + '</strong></div>' +
          '<div><span>Token Balance</span><strong>' + Number(profile.token_balance || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' FAL</strong></div>' +
          '<div><span>Daily Streak</span><strong>' + Number(profile.streak || 0) + '</strong></div>' +
        '</div>' +
        '<div class="fl-badges-row">' + badgeHtml + '</div>' +
      '</section>';
  }

  async function initProfileCard() {
    var userId = await getCurrentUserId();
    var profile = await dailyLogin(userId);
    renderProfileCard(profile);
    return profile;
  }

  async function leaderboard(limit) {
    var rows = [];
    try {
      if (window.FL && window.FL.rest) {
        rows = await window.FL.rest('user_rewards', { query: 'select=*&order=points.desc&limit=' + (limit || 10) });
      }
    } catch (e) {
      warn('Remote leaderboard unavailable.', e.message || e);
    }
    if (!Array.isArray(rows) || !rows.length) {
      var all = localProfiles();
      rows = Object.keys(all).map(function(k) { return all[k]; }).sort(function(a, b) { return Number(b.points || 0) - Number(a.points || 0); }).slice(0, limit || 10);
    }
    return rows;
  }

  function setSound(enabled) {
    localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
  }

  window.FLRewards = {
    xpRules: XP_RULES,
    levels: LEVELS,
    badges: BADGES,
    missions: MISSIONS,
    achievements: ACHIEVEMENTS,
    addXP: addXP,
    addPoints: addPoints,
    addTokenReward: addTokenReward,
    getLevel: getLevel,
    getProgressToNextLevel: getProgressToNextLevel,
    unlockBadge: unlockBadge,
    awardCustomMission: awardCustomMission,
    trackEvent: trackEvent,
    completeMission: completeMission,
    dailyLogin: dailyLogin,
    getProfile: getProfile,
    leaderboard: leaderboard,
    renderProfileCard: renderProfileCard,
    initProfileCard: initProfileCard,
    setSound: setSound
    // TODO: Blockchain reward integration later.
  };

  document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('flRewardsCard')) initProfileCard();
  });

  log('Rewards system ready.');
})();
