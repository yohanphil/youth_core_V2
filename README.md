# Youth Central — Leadership Hub

A classy, mobile-friendly, multi-page admin system for **TGC Dehiwala Youth Core Team**.  
Built with vanilla HTML/CSS/JS + Firebase (Firestore + Auth). No build step needed.

---

## 📁 File Structure

```
youth-central/
  login.html          ← Sign in / sign up
  home.html           ← Dashboard + KPIs
  people.html         ← Full member database
  newcomer.html       ← Quick newcomer capture
  attendance.html     ← Mark & track attendance
  followups.html      ← Care & follow-up tracker
  teams.html          ← Teams, cell leaders, cell groups
  events.html         ← Special youth events
  event-detail.html   ← Event report (open via events page)
  sundays.html        ← Auto-generate Sunday services
  tasks.html          ← Kanban task board
  reports.html        ← Youth analytics & charts
  access.html         ← Admin user role management
  profile.html        ← Personal profile & DP
  assets/
    css/app.css       ← Design system (dark command-center)
    js/firebase.js    ← Firebase init + exports
    js/core.js        ← Auth guard, nav shell, store, helpers
    img/logo-mark.svg ← Youth Central brand mark
```

---

## 🚀 Deploy to GitHub Pages

1. **Create a GitHub repo** (public or private with Pages enabled).
2. **Upload this entire `youth-central/` folder** as the root of your repo (or a subfolder — just keep paths relative).
3. Go to **Settings → Pages** → set source to `main` branch, root `/` (or the subfolder).
4. Your site will be live at `https://<username>.github.io/<repo>/login.html`.

### Quick deploy via GitHub Codespace
```bash
# In your Codespace terminal:
cd youth-central
# All files are static — open with Live Server or deploy to Pages
```

---

## 🔑 Admin Setup

- First person to sign up with the Admin Code gets **Admin** role (max 3 Admins).
- **Admin Code:** `YC-ADMIN-2026`
- Admins can change any user's role in the **Access** page.

**Roles:** Admin · Core Moderator · Team Head · Team Lead · Member · Viewer

---

## 🔥 Firebase

The app is wired to the existing `youth-tasks` Firebase project.  
All your existing data, logins and team records are intact.

### Fix Public Read Rules (for FOMO live page)

If the public FOMO tournament page stops showing data, apply these Firestore rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /events/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /tournamentTeams/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /tournamentMatches/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /tournamentSettings/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 📱 Mobile

Fully responsive — sidebar collapses to a hamburger drawer on phones.  
All tap targets are 44px+.

---

## ✏️ Customise

- **Colors:** Edit CSS variables at the top of `assets/css/app.css`
- **Logo:** Replace `assets/img/logo-mark.svg`
- **Firebase project:** Update the config object in `assets/js/firebase.js`
- **Google Sheet sync URL:** Update `GOOGLE_SHEET_SYNC_URL` in `assets/js/core.js`

---

*Youth Central · TGC Dehiwala Youth Core Team*
