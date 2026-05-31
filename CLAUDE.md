# 🇵🇸 CLAUDE.md — falasteen.ink

## Project Overview
**falasteen.ink** — Palestinian digital archive platform  
TikTok-style documentary interface with reels, martyrs archive, and protest map.

- **Deploy:** Netlify (drag & drop unzipped folder)
- **Backend:** Supabase (`https://audvtdbylhmumvdrhijk.supabase.co`)
- **Domain:** falasteen.ink (Namecheap)

---

## 🗂️ Core File Architecture

| File | Role |
|------|------|
| `index.html` | Home / Landing page |
| `feed.html` | Reels / TikTok-style feed |
| `archive.html` | Martyrs archive (60,000+ records) |
| `app.js` | Main app logic |
| `common.js` | Shared utilities & Supabase client |
| `app-config.js` | Global config & constants |
| `styles.css` | Global styles |

---

## 🎨 Design System

```css
/* Palestinian Colors */
--red:   #CE1126;
--green: #007A3D;
--gold:  #F8D800;
--black: #000000;
--white: #FFFFFF;
--dark-bg: #0a0a0a;
--card-bg: #111111;
```

**Fonts:** Cairo, Tajawal, Amiri (Arabic)  
**Direction:** RTL (Arabic-first)  
**Aesthetic:** Cinematic dark theme

---

## 🗄️ Supabase Tables

| Table | Description |
|-------|-------------|
| `martyrs` | 60,000+ martyrs records |
| `reels` | User-generated & curated reels |
| `documentaries` | Documentary films |
| `songs` | Palestinian songs archive |
| `events` | Protest/event map data |
| `fl_guardian_profile` | User profiles (localStorage key) |

### ⚠️ RLS Rules
- Public SELECT allowed on `martyrs`, `reels`, `documentaries`
- INSERT on `reels` requires auth
- Always test RLS after any policy change

---

## 👤 Auth & Session

- User profile stored in `localStorage` under key: `fl_guardian_profile`
- Supabase Auth (email/password + anonymous)
- Check session with: `supabase.auth.getSession()`

---

## 🚀 Deployment Workflow

```bash
# 1. Make changes locally
# 2. Zip the project folder (NOT the folder itself, the contents)
# 3. Go to Netlify → Sites → falasteen.ink → Deploys
# 4. Drag & drop the ZIP file
# 5. Wait ~30 seconds → Live ✅
```

---

## ⚡ Task Rules for Claude Code

### ✅ DO
- One file per task
- Specify exact file: `"fix feed.js line ~120"`
- Specify exact behavior: `"martyrs should load 20 per page"`
- Test RLS in Supabase SQL editor before deploying

### ❌ DON'T
- `"fix all bugs"` → causes timeout
- `"rewrite the whole platform"` → too large
- Edit `common.js` without checking all files that import it

---

## 🔧 Common Commands

```javascript
// Supabase client (in common.js)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fetch martyrs (paginated)
const { data, error } = await supabase
  .from('martyrs')
  .select('*')
  .range(0, 19);

// Upload reel
const { data, error } = await supabase.storage
  .from('reels')
  .upload(`${userId}/${filename}`, file);
```

---

## 📱 Feed Page Rules (feed.html)
- Fullscreen vertical scroll (TikTok-style)
- Each reel = 100vh height
- Auto-play video when in viewport (IntersectionObserver)
- Swipe up/down navigation
- Show: title, location, date, martyrs count overlay

---

## 🕯️ Special Features
- **Digital Candles:** Users can light candle for a martyr → stored in Supabase
- **Background Audio:** Ambient Palestinian music on homepage
- **XP/Badge System:** Users earn XP for contributions
- **Protest Map:** Live map of events (Leaflet.js)

---

## 🐛 Known Issues Log
- [ ] RLS on `martyrs` table blocked 60K records → fixed in v7
- [ ] Feed scroll jank on mobile → use CSS `scroll-snap`
- [ ] Profile page needs real session data (not mock)

---

## 📞 Stack Versions
- Supabase JS: v2 (CDN)
- Leaflet: 1.9.x
- No build tool — vanilla HTML/CSS/JS
- No npm/webpack — direct CDN imports

---

*Last updated: May 2026 — v7*
