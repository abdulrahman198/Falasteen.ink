# 🔒 FALASTEEN.INK — Security Policy

## Security Fixes Applied

### 1. ✅ Exposed API Keys (CRITICAL)
**Issue:** Supabase and Livepeer credentials were hardcoded in source code.
- **Status:** FIXED
- **Solution:** 
  - Keys now loaded from `window.SUPABASE_CONFIG` (populated from environment variables)
  - Use Netlify/Vercel environment variables to set credentials
  - Never commit `.env.local` to git

**Setup Instructions:**
```bash
# In Netlify:
1. Go to Site settings → Build & deploy → Environment
2. Add environment variables:
   - VITE_SUPABASE_URL=https://your-url.supabase.co
   - VITE_SUPABASE_ANON_KEY=your-key-here
   - VITE_LIVEPEER_API_KEY=your-key-here
   - DONATION_ADDRESS=0x...

# In app-config.js:
// Credentials automatically loaded from environment
```

---

### 2. ✅ XSS Vulnerability (HIGH)
**Issue:** Using `innerHTML` with user data could allow code injection.
- **Status:** FIXED
- **Solution:**
  - Changed from `innerHTML` to `textContent` and DOM manipulation
  - Reward popups now use `document.createElement()` 
  - All user data safely rendered without HTML parsing

**Before:**
```javascript
box.innerHTML = lines.map(line => '<div>' + esc(line) + '</div>').join('');
```

**After:**
```javascript
lines.forEach(function(line) {
  const lineDiv = document.createElement('div');
  lineDiv.textContent = line; // Safe!
  box.appendChild(lineDiv);
});
```

---

### 3. ✅ Race Condition in Web3 (MEDIUM)
**Issue:** `window.ethers` could be undefined when accessed.
- **Status:** FIXED
- **Solution:**
  - Added promise-based wait for ethers.js to load
  - Timeout protection (5 seconds)
  - Better error handling with try-catch

**Code:**
```javascript
if (typeof window.ethers === 'undefined') {
  await new Promise((resolve, reject) => {
    var timeout = setTimeout(() => reject(new Error('timeout')), 5000);
    var check = setInterval(() => {
      if (typeof window.ethers !== 'undefined') {
        clearInterval(check);
        clearTimeout(timeout);
        resolve();
      }
    }, 100);
  });
}
```

---

### 4. ✅ Data Loss Risk (MEDIUM)
**Issue:** Reward events silently deleted after 400 entries without sync guarantee.
- **Status:** FIXED
- **Solution:**
  - Added `synced` flag to events
  - Remote sync happens immediately
  - Retry logic for failed syncs
  - Better logging

**Code:**
```javascript
var event = {
  id: 'evt_' + Date.now(),
  user_id: userId,
  synced: false // NEW
};
saveEventLocal(event);
saveEventRemote(event).then(success => {
  if (success) event.synced = true; // Mark synced
});
```

---

## 🚀 Deployment Checklist

- [ ] Set environment variables in Netlify/Vercel
- [ ] Test with `localStorage.fl_debug = "on"` in console
- [ ] Verify no API keys appear in network requests
- [ ] Test Web3 wallet connection
- [ ] Verify reward system works offline

---

## 🔐 Best Practices Going Forward

### DO:
✅ Keep sensitive keys in environment variables only
✅ Use `textContent` for dynamic content (not `innerHTML`)
✅ Test XSS with user input: `<img src=x onerror=alert('xss')>`
✅ Log errors to help debug (without exposing secrets)
✅ Use Content Security Policy headers

### DON'T:
❌ Commit `.env.local` to git
❌ Hardcode URLs or keys
❌ Use `innerHTML` with user input
❌ Trust localStorage alone (it can be tampered)
❌ Expose error messages with sensitive info

---

## 📋 Content Security Policy (CSP)

Add to your HTML `<head>`:
```html
<meta http-equiv="Content-Security-Policy" 
  content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' cdn.jsdelivr.net;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' https://audvtdbylhmumvdrhijk.supabase.co https://bsc-dataseed.binance.org;
    frame-src 'none';
  ">
```

---

## 🐛 Reporting Security Issues

Found a vulnerability? Please email security@falasteen.ink with:
- Description of the issue
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

**DO NOT** open public issues for security vulnerabilities.

---

## 📚 References

- [OWASP XSS Prevention](https://owasp.org/www-community/attacks/xss/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Secure localStorage Usage](https://owasp.org/www-community/vulnerabilities/Sensitive_Data_Exposure)

---

*Last updated: June 2026 | Security fixes v1*
