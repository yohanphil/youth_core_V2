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
const NAV = [
  { group: "Overview", items: [{ id:"home", label:"Home", icon:"🏠", href:"home.html" }] },
  { group: "People", items: [
    { id:"people", label:"People", icon:"👥", href:"people.html" },
    { id:"newcomer", label:"Newcomer", icon:"✨", href:"newcomer.html" },
    { id:"attendance", label:"Attendance", icon:"📋", href:"attendance.html" },
    { id:"followups", label:"Follow-ups", icon:"🔔", href:"followups.html" },
    { id:"teams", label:"Teams", icon:"🏷️", href:"teams.html" }
  ]},
  { group: "Events", items: [
    { id:"events", label:"Events", icon:"📅", href:"events.html" },
    { id:"sundays", label:"Sundays", icon:"⛪", href:"sundays.html" }
  ]},
  { group: "Work", items: [
    { id:"tasks", label:"Tasks", icon:"✅", href:"tasks.html" }
  ]},
  { group: "Insights", items: [
    { id:"reports", label:"Analytics", icon:"📊", href:"reports.html" }
  ]},
  { group: "Admin", items: [
    { id:"access", label:"Access", icon:"🔑", href:"access.html" },
    { id:"profile", label:"My Profile", icon:"👤", href:"profile.html" }
  ]}
];

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
                <span class="nav-icon">${item.icon}</span>
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
          <button class="btn-logout" onclick="window._ycLogout()" title="Logout">⏻</button>
        </div>
      </div>
    `;
  }

  // Topbar
  const topbar = $("topbar");
  if (topbar) {
    topbar.innerHTML = `
      <button class="topbar-hamburger" id="hamburger" aria-label="Menu">☰</button>
      <div class="topbar-title">${title}${subtitle ? `<span>${subtitle}</span>` : ""}</div>
      <div class="topbar-right">
        <div class="topbar-user-label" id="topbarUserLabel"></div>
        <div class="avatar" id="topAvatar">YC</div>
      </div>
    `;
    const ham = $("hamburger");
    if (ham) ham.onclick = toggleSidebar;
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
