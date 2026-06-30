import { auth, db, onAuthStateChanged, signOut, doc, getDoc, setDoc, collection, onSnapshot, query, orderBy, serverTimestamp } from './firebase.js';

// ── CONSTANTS ─────────────────────────────────
export const ADMIN_CODE = "YC-ADMIN-2026";
export const ROLES = ["Admin","Core Moderator","Team Head","Team Lead","Member","Viewer"];
export const GOOGLE_SHEET_SYNC_URL = "https://script.google.com/macros/s/AKfycby3jUrgFnV97vU_Z_EUv1MmvNRbFjWuckByvsdOPPMpjRYOQZ7iBAyMW3fLrce29rc/exec";

// ── UTILS ──────────────────────────────────────
export const $ = id => document.getElementById(id);
export const clean = v => String(v ?? "").replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&#39;','"':'&quot;'}[c]));
export const todayISO = () => new Date().toISOString().slice(0,10);
export const roleKey = s => String(s||"").toLowerCase().replace(/[\s\-]/g,"");

export function initials(value) {
  const text = String(value || "YC").trim();
  const parts = text.split(/\s+/).filter(Boolean);
  if (!parts.length) return "YC";
  if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function safeImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("data:image/") || url.startsWith("https://")) return url;
  return "";
}

export function avatarHTML(profile, fallbackName) {
  const img = safeImageUrl(profile?.photoData) || safeImageUrl(profile?.photoURL);
  if (img) return `<img src="${img}" alt="Photo">`;
  return initials(fallbackName || profile?.name || "YC");
}

export function notify(message) {
  let wrap = $("toast");
  if (!wrap) { wrap = document.createElement("div"); wrap.id = "toast"; document.body.appendChild(wrap); }
  const el = document.createElement("div");
  el.className = "toast-msg";
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(20px)"; }, 2600);
  setTimeout(() => el.remove(), 3100);
}

// ── STORE ──────────────────────────────────────
export const store = {
  youthMembers: [], cellLeaders: [], cellGroups: [], attendance: [],
  followUps: [], tasks: [], userProfiles: [], notifications: [],
  events: [], tournamentTeams: [], tournamentMatches: [], tournamentSettings: []
};

let currentUser = null;
let currentProfile = null;
const renderCallbacks = [];
let listenersStarted = false;

export function getCurrentUser() { return currentUser; }
export function getCurrentProfile() { return currentProfile; }
export function canManage() { return ["Admin","Core Moderator"].includes(currentProfile?.role); }
export function canAdmin() { return currentProfile?.role === "Admin"; }

export function onData(cb) { renderCallbacks.push(cb); }
function fireRender() { renderCallbacks.forEach(cb => { try { cb(store); } catch(e) { console.error(e); } }); }

// ── AUTH GUARD ─────────────────────────────────
export function requireAuth(onReady) {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    currentUser = user;
    try {
      const ref = doc(db, "userProfiles", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        currentProfile = { id: user.uid, ...snap.data() };
      } else {
        currentProfile = {
          id: user.uid, uid: user.uid,
          name: user.email?.split("@")[0] || "User",
          email: user.email || "", role: "Member", team: "", status: "Active",
          photoData: "", photoURL: ""
        };
        await setDoc(ref, { ...currentProfile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
    } catch(e) {
      currentProfile = { id: user.uid, uid: user.uid, name: user.email?.split("@")[0] || "User", email: user.email || "", role: "Member" };
    }
    updateShellUser();
    if (onReady) onReady(currentUser, currentProfile);
    startListeners();
  });
}

export async function logout() {
  try { await signOut(auth); window.location.href = "login.html"; }
  catch(e) { notify(e.message || "Logout failed"); }
}

// ── LISTENERS ──────────────────────────────────
function listen(name, key, sorted = true) {
  const col = collection(db, name);
  const q = sorted ? query(col, orderBy("createdAt","desc")) : col;
  onSnapshot(q, snap => {
    store[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (key === "userProfiles" && currentUser) {
      const me = store.userProfiles.find(u => (u.uid || u.id) === currentUser.uid);
      if (me) { currentProfile = me; updateShellUser(); }
    }
    fireRender();
  }, err => { console.error(name, err); notify("Firestore issue — check rules."); });
}

function startListeners() {
  if (listenersStarted) return;
  listenersStarted = true;
  listen("youthMembers","youthMembers");
  listen("cellLeaders","cellLeaders");
  listen("cellGroups","cellGroups");
  listen("attendance","attendance");
  listen("followUps","followUps");
  listen("tasks","tasks");
  listen("userProfiles","userProfiles");
  listen("notifications","notifications");
  listen("events","events");
  listen("tournamentTeams","tournamentTeams");
  listen("tournamentMatches","tournamentMatches");
  listen("tournamentSettings","tournamentSettings", false);
}

// ── SHELL ──────────────────────────────────────
const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><path d="M16 5.2a3 3 0 0 1 0 5.6"/><path d="M17.5 14.6c2 .7 3.5 2.6 3.5 5.4"/></svg>',
  newcomer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="3.2"/><path d="M4 20c0-3.3 2.7-5.5 6-5.5"/><path d="M18 13.5v6M15 16.5h6"/></svg>',
  attendance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1"/><path d="m8.5 12 2 2 3.5-3.5"/></svg>',
  followups: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/></svg>',
  teams: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/></svg>',
  events: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="2.5"/><path d="M4 9.5h16M8 3v4M16 3v4"/></svg>',
  sundays: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 12 7M10 5h4"/><path d="M12 7 5 12v9h14v-9z"/><path d="M10 21v-4h4v4"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.2 2.2L16 9"/></svg>',
  reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><rect x="6" y="11" width="3" height="6" rx="1"/><rect x="11" y="7" width="3" height="10" rx="1"/><rect x="16" y="13" width="3" height="4" rx="1"/></svg>',
  access: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/><path d="m9.5 12 1.8 1.8L15 10"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c0-3.7 3-6.5 7-6.5s7 2.8 7 6.5"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M9 12h11M16 8l4 4-4 4"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
};

const NAV = [
  { group: "Overview", items: [{ id:"home", label:"Home", icon:ICON.home, href:"home.html" }] },
  { group: "People", items: [
    { id:"people", label:"People", icon:ICON.people, href:"people.html" },
    { id:"newcomer", label:"Newcomer", icon:ICON.newcomer, href:"newcomer.html" },
    { id:"attendance", label:"Attendance", icon:ICON.attendance, href:"attendance.html" },
    { id:"followups", label:"Follow-ups", icon:ICON.followups, href:"followups.html" },
    { id:"teams", label:"Teams", icon:ICON.teams, href:"teams.html" }
  ]},
  { group: "Events", items: [
    { id:"events", label:"Events", icon:ICON.events, href:"events.html" },
    { id:"sundays", label:"Sundays", icon:ICON.sundays, href:"sundays.html" }
  ]},
  { group: "Work", items: [
    { id:"tasks", label:"Tasks", icon:ICON.tasks, href:"tasks.html" }
  ]},
  { group: "Insights", items: [
    { id:"reports", label:"Analytics", icon:ICON.reports, href:"reports.html" }
  ]},
  { group: "Admin", items: [
    { id:"access", label:"Access", icon:ICON.access, href:"access.html" },
    { id:"profile", label:"My Profile", icon:ICON.profile, href:"profile.html" }
  ]}
];

export function animateCount(el, target, dur = 900) {
  if (!el) return;
  target = Number(target) || 0;
  const start = Number(el.dataset.val || 0);
  if (start === target) { el.textContent = target; return; }
  const t0 = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (p < 1) requestAnimationFrame(tick);
    else { el.textContent = target; el.dataset.val = target; }
  }
  el.dataset.val = target;
  requestAnimationFrame(tick);
}

export function mountShell(activePage, title, subtitle) {
  // Ensure toast exists
  if (!$("toast")) {
    const t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t);
  }

  // Sidebar
  const sidebar = $("sidebar");
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="sidebar-brand">
        <img src="assets/img/logo-mark.svg" alt="Youth Central">
        <div class="sidebar-brand-text">
          <h1>Youth Central</h1>
          <p>Leadership Hub</p>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${NAV.map(g => `
          <div class="nav-group">
            <div class="nav-group-label">${g.group}</div>
            ${g.items.map(item => `
              <a href="${item.href}" class="nav-link${item.id === activePage ? " active" : ""}">
                ${item.icon}
                ${item.label}
              </a>
            `).join("")}
          </div>
        `).join("")}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="avatar" id="shellAvatar">YC</div>
          <div class="sidebar-user-info">
            <b id="shellName">Loading…</b>
            <span id="shellRole">Member</span>
          </div>
          <button class="btn-logout" onclick="window._ycLogout()" title="Logout">${ICON.logout}</button>
        </div>
      </div>
    `;
  }

  // Topbar
  const topbar = $("topbar");
  if (topbar) {
    topbar.innerHTML = `
      <button class="topbar-hamburger" id="hamburger" aria-label="Menu">${ICON.menu}</button>
      <div class="topbar-title">${title}${subtitle ? `<span>${subtitle}</span>` : ""}</div>
      <div class="topbar-right">
        <div class="topbar-clock" id="topbarClock"></div>
        <div class="topbar-user-label" id="topbarUserLabel"></div>
        <div class="avatar" id="topAvatar">YC</div>
      </div>
    `;
    const ham = $("hamburger");
    if (ham) ham.onclick = toggleSidebar;
    startClock();
  }

  // Overlay for mobile
  let overlay = $("sidebarOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "sidebarOverlay";
    overlay.className = "sidebar-overlay";
    overlay.onclick = closeSidebar;
    document.body.appendChild(overlay);
  }

  window._ycLogout = logout;
  updateShellUser();
}

function updateShellUser() {
  if (!currentProfile) return;
  const name = currentProfile.name || currentUser?.email || "User";
  const role = currentProfile.role || "Member";
  if ($("shellName")) $("shellName").textContent = name;
  if ($("shellRole")) $("shellRole").textContent = role;
  if ($("shellAvatar")) $("shellAvatar").innerHTML = avatarHTML(currentProfile, name);
  if ($("topAvatar")) $("topAvatar").innerHTML = avatarHTML(currentProfile, name);
  if ($("topbarUserLabel")) $("topbarUserLabel").textContent = `${name} · ${role}`;
}

export function toggleSidebar() {
  const s = $("sidebar"); const o = $("sidebarOverlay");
  if (s) s.classList.toggle("open");
  if (o) o.classList.toggle("active");
}
export function closeSidebar() {
  const s = $("sidebar"); const o = $("sidebarOverlay");
  if (s) s.classList.remove("open");
  if (o) o.classList.remove("active");
}

let clockTimer = null;
function startClock() {
  const update = () => {
    const el = $("topbarClock");
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString("en-US",{weekday:"short",day:"numeric",month:"short"}) + " · " +
      now.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
  };
  update();
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(update, 30000);
}

// ── EVENT / TEAM HELPERS ──────────────────────
export function isSundayEvent(e) {
  const raw = String(e?.eventType || "");
  const title = String(e?.title || "").toLowerCase();
  if (/fomo|frisbee|ultimate|tournament/i.test(title)) return false;
  if (raw === "Sunday Service" || title.includes("sunday service")) return true;
  return false;
}
export function isSpecialEvent(e) { return !isSundayEvent(e); }

export function validUrl(url) { return String(url||"").trim().startsWith("http"); }

export function safeImg(value) {
  const url = String(value || "").trim();
  if (url.startsWith("data:image/") || url.startsWith("https://")) return url;
  return "";
}

export function isMissing(m) {
  if (!m.lastAttendedDate) return true;
  const d = new Date(m.lastAttendedDate);
  return ((Date.now() - d.getTime()) / (1000*60*60*24)) > 14;
}

export async function syncToSheet(member, source="website") {
  if (!GOOGLE_SHEET_SYNC_URL || !member?.id) return;
  try {
    await fetch(GOOGLE_SHEET_SYNC_URL, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...member, _source: source, _updatedAt: new Date().toISOString() })
    });
  } catch(e) { console.warn("Sheet sync failed", e); }
}
