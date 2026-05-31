// HANDALA Rewards System — FALASTEEN.INK
// Tracks earned tokens in Supabase for manual distribution later.
// Action points: verification=50, upload=10, rose=5, prayer=5
(function() {
  var POINTS = {
    verification: 50,
    upload: 10,
    rose: 5,
    prayer: 5
  };

  var LABELS = {
    verification: 'توثيق الحساب',
    upload: 'رفع محتوى',
    rose: 'وضع وردة',
    prayer: 'دعاء'
  };

  async function getSB() {
    var url = window.SUPABASE_URL || 'https://audvtdbylhmumvdrhijk.supabase.co';
    var key = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1ZHZ0ZGJ5bGhtdW12ZHJoaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTA5NjAsImV4cCI6MjA5MTU4Njk2MH0.Clrp9j8uN08AZ28Uu53NiQDYqDo0SGgVo-HVGBEa4gU';
    return window.supabase && window.supabase.createClient
      ? window.supabase.createClient(url, key)
      : null;
  }

  window.FLHandala = {
    // Call after any rewarded action
    earn: async function(actionType) {
      try {
        var sb = await getSB();
        if (!sb) return;
        var sessionRes = await sb.auth.getSession();
        var session = sessionRes && sessionRes.data && sessionRes.data.session;
        if (!session) return;
        var uid = session.user.id;
        var meta = session.user.user_metadata || {};
        var wallet = meta.wallet_address || (typeof localStorage !== 'undefined' && localStorage.getItem('fl_wallet')) || null;
        var pts = POINTS[actionType];
        if (!pts) return;

        var result = await sb.from('rewards').insert({
          user_id: uid,
          action_type: actionType,
          points: pts,
          wallet_address: wallet
        });

        // Show toast for new rows; ignore unique-constraint errors on 'verification'
        if (!result.error) {
          window.FLHandala.showToast('+' + pts + ' HANDALA — ' + (LABELS[actionType] || actionType));
          // Update any balance displays on the page
          window.FLHandala.refreshBalance();
        }
      } catch(e) {
        if (window.console) console.warn('[FLHandala] earn error:', e);
      }
    },

    // Get total earned HANDALA points for current user
    getBalance: async function() {
      try {
        var sb = await getSB();
        if (!sb) return 0;
        var sessionRes = await sb.auth.getSession();
        var session = sessionRes && sessionRes.data && sessionRes.data.session;
        if (!session) return 0;
        var res = await sb.from('rewards').select('points').eq('user_id', session.user.id);
        if (!res.data) return 0;
        return res.data.reduce(function(sum, r) { return sum + (r.points || 0); }, 0);
      } catch(e) { return 0; }
    },

    // Update any element with id="handalaBalance" on the page
    refreshBalance: function() {
      window.FLHandala.getBalance().then(function(bal) {
        var el = document.getElementById('handalaBalance');
        if (el) el.textContent = bal + ' HANDALA 🪙';
      });
    },

    // Small RTL toast notification
    showToast: function(msg) {
      if (!document.getElementById('fl-handala-style')) {
        var s = document.createElement('style');
        s.id = 'fl-handala-style';
        s.textContent = '@keyframes flHUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
        document.head.appendChild(s);
      }
      var toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#1a6b3a,#2d9b57);color:#fff;padding:12px 24px;border-radius:50px;font-size:15px;font-weight:bold;z-index:99999;direction:rtl;box-shadow:0 4px 20px rgba(0,0,0,0.3);animation:flHUp 0.3s ease;white-space:nowrap;';
      toast.textContent = '🪙 ' + msg;
      document.body.appendChild(toast);
      setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3000);
    }
  };

  // Backwards-compat alias so existing FLRewards.earn() calls still work if needed
  if (!window.FLRewards) window.FLRewards = window.FLHandala;
})();
