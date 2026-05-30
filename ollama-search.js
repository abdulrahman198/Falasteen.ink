// ollama-search.js — Local search across martyrs, landmarks, reels
window.FLOllamaSearch = {
  ask: async function(query) {
    if (!query || !query.trim()) return [];
    var q = query.trim().toLowerCase();
    var results = [];

    // Search martyrs in localStorage
    try {
      var martyrs = JSON.parse(localStorage.getItem('fl_martyrs') || '[]');
      martyrs.forEach(function(m) {
        if ((m.name||'').toLowerCase().includes(q) || (m.city||'').toLowerCase().includes(q)) {
          results.push({ type: 'martyr', icon: '🕊', title: m.name, sub: m.city || '', link: 'Martyrs.html' });
        }
      });
    } catch(e) {}

    // Search landmarks in localStorage
    try {
      var landmarks = JSON.parse(localStorage.getItem('fl_landmarks') || '[]');
      landmarks.forEach(function(l) {
        if ((l.name||'').toLowerCase().includes(q) || (l.city||'').toLowerCase().includes(q)) {
          results.push({ type: 'landmark', icon: '🏛', title: l.name, sub: l.city || '', link: 'Landmarks.html' });
        }
      });
    } catch(e) {}

    // Search reels in localStorage
    try {
      var reels = JSON.parse(localStorage.getItem('fl_reels') || '[]');
      reels.forEach(function(r) {
        if ((r.title||'').toLowerCase().includes(q) || (r.desc||'').toLowerCase().includes(q)) {
          results.push({ type: 'reel', icon: '▶', title: r.title, sub: r.category || '', link: 'Feed.html' });
        }
      });
    } catch(e) {}

    // Also search Supabase martyrs if available
    if (window.FL && FL.SUPABASE_URL && FL.SUPABASE_KEY) {
      try {
        var qEncoded = encodeURIComponent(q);
        var url = FL.SUPABASE_URL + '/rest/v1/martyrs?select=name,city&or=(name.ilike.*' + qEncoded + '*,city.ilike.*' + qEncoded + '*)&limit=5';
        var res = await fetch(url, {
          headers: {
            apikey: FL.SUPABASE_KEY,
            Authorization: 'Bearer ' + FL.SUPABASE_KEY
          }
        });
        if (!res.ok) throw new Error('Supabase search failed: ' + res.status);
        var data = await res.json();
        if (Array.isArray(data)) {
          data.forEach(function(m) {
            if (!results.find(function(r){ return r.type === 'martyr' && r.title === m.name; })) {
              results.push({ type: 'martyr', icon: '🕊', title: m.name, sub: m.city || '', link: 'Martyrs.html' });
            }
          });
        }
      } catch (e) {
        console.warn('FLOllamaSearch supabase query error', e);
      }
    }

    return results.slice(0, 10);
  }
};
