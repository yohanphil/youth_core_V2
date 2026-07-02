import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, setDoc, getDoc, onSnapshot, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCdMfitam8d7UwVfP2I3jbuDIYvW-lAB-c",
  authDomain: "youth-tasks.firebaseapp.com",
  projectId: "youth-tasks",
  storageBucket: "youth-tasks.firebasestorage.app",
  messagingSenderId: "824413713361",
  appId: "1:824413713361:web:6c84c4ce1efab73b3c66f0",
  measurementId: "G-PKMFQ4Z1PZ"
};

const ADMIN_CODE = "YC-ADMIN-2026";
const TEAMS = ["Welcome Team","Worship Team","Media Team","Outreach Team","Cell Leaders","Production Team","Events Team","Prayer Team","Dance Team","General"];
const STATUSES = ["Active","Inactive","Needs Follow-up","Not Needed","Pending","Completed"];
const PAGE = document.body.dataset.page || "home";
const ROOT = document.body.dataset.root || "";
const PROTECTED = document.body.dataset.protected !== "false";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const state = {
  user:null,
  profile:null,
  profiles:[],
  members:[],
  events:[],
  attendance:[],
  leaders:[],
  groups:[],
  tasks:[],
  followups:[],
  tournamentTeams:[],
  tournamentMatches:[],
  unsubs:[],
  filters:{peopleType:"",peopleTeam:"",peopleSearch:"",eventType:"",taskSearch:""},
  authMode:"login",
  editing:{member:null,event:null,team:null,match:null}
};

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const ref = name => collection(db, name);
const one = (name, id) => doc(db, name, id);
const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
const val = id => $("#"+id)?.value?.trim() || "";
const setVal = (id, value="") => { const el = $("#"+id); if(el) el.value = value ?? ""; };
const fmtDate = value => {
  if(!value) return "-";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if(Number.isNaN(date.getTime())) return esc(value);
  return date.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
};
const shortDate = value => {
  if(!value) return "";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if(Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0,10);
};
const initials = name => (name || "YC").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "YC";
const sortByDate = arr => [...arr].sort((a,b)=> new Date(b.date || b.createdAt?.toDate?.() || b.createdAt || 0) - new Date(a.date || a.createdAt?.toDate?.() || a.createdAt || 0));
const isAdmin = () => ["Admin","Owner"].includes(state.profile?.role);

function toast(title, text=""){
  const wrap = $("#toastWrap") || (()=>{ const w=document.createElement("div"); w.id="toastWrap"; w.className="toast-wrap"; document.body.appendChild(w); return w; })();
  const item = document.createElement("div");
  item.className = "toast";
  item.innerHTML = `<b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ""}`;
  wrap.appendChild(item);
  setTimeout(()=> item.remove(), 4200);
}
function showModal(id){ const el=$("#"+id); if(el){ el.classList.remove("hidden"); document.body.style.overflow="hidden"; } }
function closeModal(id){ const el=$("#"+id); if(el){ el.classList.add("hidden"); document.body.style.overflow=""; } }
function closeAllModals(){ $$(".modal").forEach(m=>m.classList.add("hidden")); document.body.style.overflow=""; }

function setupMotion(){
  document.addEventListener("pointermove", e=>{
    document.body.style.setProperty("--mx", `${e.clientX}px`);
    document.body.style.setProperty("--my", `${e.clientY}px`);
  }, {passive:true});
  $$(".touch-card,.quick-card,.metric,.panel,.event-card").forEach(card=>{
    card.addEventListener("pointermove", e=>{
      const r=card.getBoundingClientRect();
      card.style.setProperty("--x", `${e.clientX-r.left}px`);
      card.style.setProperty("--y", `${e.clientY-r.top}px`);
    }, {passive:true});
  });
}

function setupShell(){
  $("#navToggle")?.addEventListener("click",()=>document.body.classList.toggle("nav-open"));
  $("#drawerBackdrop")?.addEventListener("click",()=>document.body.classList.remove("nav-open"));
  $$("[data-page-link]").forEach(a=>{
    const key = a.dataset.pageLink;
    if(key === PAGE) a.classList.add("active");
  });
  $("#pageCrumb") && ($("#pageCrumb").textContent = document.body.dataset.title || "Dashboard");
}

function setupActionDelegation(){
  document.addEventListener("click", async (e)=>{
    const btn = e.target.closest("[data-action]");
    if(!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id || "";
    const value = btn.dataset.value || "";
    try{
      switch(action){
        case "switchAuth": switchAuth(value); break;
        case "login": await login(); break;
        case "signup": await signup(); break;
        case "logout": await signOut(auth); break;
        case "closeModal": closeModal(value); break;
        case "openMember": openMemberModal(id || null); break;
        case "saveMember": await saveMember(); break;
        case "deleteMember": await deleteItem("youthMembers", id, "Person deleted"); break;
        case "quickNewcomer": await quickNewcomer(); break;
        case "openEvent": openEventModal(id || null); break;
        case "saveEvent": await saveEvent(); break;
        case "deleteEvent": await deleteItem("events", id, "Event deleted"); break;
        case "generateSundays": await generateSundayServices(Number(value || 8)); break;
        case "markAttendance": await markAttendance(); break;
        case "deleteAttendance": await deleteItem("attendance", id, "Attendance removed"); break;
        case "addLeader": await addCellLeader(); break;
        case "deleteLeader": await deleteItem("cellLeaders", id, "Leader deleted"); break;
        case "addGroup": await addCellGroup(); break;
        case "deleteGroup": await deleteItem("cellGroups", id, "Cell group deleted"); break;
        case "addTask": await addTask(); break;
        case "moveTask": await moveTask(id, value); break;
        case "deleteTask": await deleteItem("tasks", id, "Task deleted"); break;
        case "enableAlerts": await enableAlerts(); break;
        case "createFollow": await createFollowUp(); break;
        case "completeFollow": await updateDoc(one("followUps", id), {status:"Completed", completedAt:serverTimestamp()}); toast("Follow-up completed"); break;
        case "deleteFollow": await deleteItem("followUps", id, "Follow-up deleted"); break;
        case "saveProfile": await saveMyProfile(); break;
        case "removeDP": await saveProfileFields({photoURL:""}); break;
        case "updateRole": await updateUserRole(id); break;
        case "exportCSV": exportCSV(value); break;
        case "importJSON": importJsonData(); break;
        case "openGameIntro": playGameIntro(); break;
        case "addTournamentTeam": await addTournamentTeam(); break;
        case "deleteTournamentTeam": await deleteItem("tournamentTeams", id, "Team deleted"); break;
        case "addTournamentMatch": await addTournamentMatch(); break;
        case "quickScore": await quickScore(id, value); break;
        case "matchStatus": await setMatchStatus(id, value); break;
        case "deleteTournamentMatch": await deleteItem("tournamentMatches", id, "Match deleted"); break;
        case "seedFomo": await seedFomoTeams(); break;
        case "copyPublicLink": copyPublicLink(); break;
        default: console.warn("Unknown action", action);
      }
    }catch(err){ console.error(err); toast("Action failed", err.message || "Check Firebase rules or console."); }
  });
  document.addEventListener("change", e=>{
    const el=e.target;
    if(el.matches("#peopleTypeFilter")){ state.filters.peopleType=el.value; renderPeople(); }
    if(el.matches("#peopleTeamFilter")){ state.filters.peopleTeam=el.value; renderPeople(); }
    if(el.matches("#eventTypeFilter")){ state.filters.eventType=el.value; renderEvents(); }
    if(el.matches("#memberPhotoFile")){ previewProfileFile(el.files?.[0]); }
    if(el.matches("#eventSelect")){ updateAttendanceEventPreview(); }
  });
  document.addEventListener("input", e=>{
    const el=e.target;
    if(el.matches("#peopleSearch")){ state.filters.peopleSearch=el.value.toLowerCase(); renderPeople(); }
    if(el.matches("#taskSearch")){ state.filters.taskSearch=el.value.toLowerCase(); renderTasks(); }
  });
}

function switchAuth(mode){
  state.authMode = mode;
  $$(".auth-tab").forEach(t=>t.classList.toggle("active", t.dataset.value === mode));
  $$(".signup-only").forEach(x=>x.classList.toggle("hidden", mode !== "signup"));
  $("#authTitle") && ($("#authTitle").textContent = mode === "signup" ? "Create access" : "Welcome back");
  $("#authText") && ($("#authText").textContent = mode === "signup" ? "Start a Youth Central account for your team." : "Login to your Youth Central dashboard.");
  $("#authMainBtn") && ($("#authMainBtn").dataset.action = mode === "signup" ? "signup" : "login");
  $("#authMainBtn") && ($("#authMainBtn").textContent = mode === "signup" ? "Create Account" : "Login");
}
async function login(){
  const email = val("loginEmail"), password = val("loginPassword");
  if(!email || !password) return toast("Missing details", "Enter your email and password.");
  await signInWithEmailAndPassword(auth, email, password);
  toast("Logged in", "Welcome back to Youth Central.");
}
async function signup(){
  const name = val("loginName"), email = val("loginEmail"), password = val("loginPassword"), code = val("adminCode");
  if(!name || !email || !password) return toast("Missing details", "Add name, email and password.");
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(userCred.user, {displayName:name});
  const role = code === ADMIN_CODE ? "Admin" : "Member";
  await setDoc(one("userProfiles", userCred.user.uid), {
    uid:userCred.user.uid, name, email, role, team:"General", status:"Active", photoURL:"", createdAt:serverTimestamp()
  }, {merge:true});
  toast("Account created", `${role} access enabled.`);
}

async function bootstrapAuth(){
  if(!PROTECTED){
    setupDataListeners(true);
    return;
  }
  onAuthStateChanged(auth, async user=>{
    state.user = user;
    if(!user){
      $("#authScreen")?.classList.remove("hidden");
      $("#appScreen")?.classList.add("hidden");
      cleanupListeners();
      return;
    }
    $("#authScreen")?.classList.add("hidden");
    $("#appScreen")?.classList.remove("hidden");
    await ensureUserProfile(user);
    setupDataListeners(false);
    renderAll();
  });
}
async function ensureUserProfile(user){
  const snap = await getDoc(one("userProfiles", user.uid));
  if(!snap.exists()){
    await setDoc(one("userProfiles", user.uid), {uid:user.uid,email:user.email,name:user.displayName || user.email?.split("@")[0] || "YC Member",role:"Member",team:"General",status:"Active",photoURL:"",createdAt:serverTimestamp()}, {merge:true});
  }
  const fresh = await getDoc(one("userProfiles", user.uid));
  state.profile = {id:fresh.id, ...fresh.data()};
  updateUserUI();
}
function cleanupListeners(){ state.unsubs.forEach(u=>{try{u()}catch{}}); state.unsubs=[]; }
function listenCollection(name, key){
  const unsub = onSnapshot(ref(name), snap=>{
    state[key] = snap.docs.map(d=>({id:d.id, ...d.data()}));
    if(name === "userProfiles" && state.user){
      const mine = state[key].find(p=>p.id === state.user.uid || p.uid === state.user.uid);
      if(mine) state.profile = mine;
    }
    renderAll();
  }, err=>{ console.error(name, err); toast("Sync issue", `${name}: ${err.message}`); });
  state.unsubs.push(unsub);
}
function setupDataListeners(publicOnly=false){
  cleanupListeners();
  if(publicOnly){
    listenCollection("tournamentTeams", "tournamentTeams");
    listenCollection("tournamentMatches", "tournamentMatches");
    return;
  }
  listenCollection("userProfiles", "profiles");
  listenCollection("youthMembers", "members");
  listenCollection("events", "events");
  listenCollection("attendance", "attendance");
  listenCollection("cellLeaders", "leaders");
  listenCollection("cellGroups", "groups");
  listenCollection("tasks", "tasks");
  listenCollection("followUps", "followups");
  listenCollection("tournamentTeams", "tournamentTeams");
  listenCollection("tournamentMatches", "tournamentMatches");
}

function updateUserUI(){
  const name = state.profile?.name || state.user?.displayName || state.user?.email || "YC Member";
  const role = state.profile?.role || "Member";
  $$("[data-user-name]").forEach(el=>el.textContent = name);
  $$("[data-user-role]").forEach(el=>el.textContent = role);
  $$("[data-user-email]").forEach(el=>el.textContent = state.user?.email || "-");
  $$("[data-user-avatar]").forEach(el=>{
    if(state.profile?.photoURL) el.innerHTML = `<img src="${esc(state.profile.photoURL)}" alt="${esc(name)}">`;
    else el.textContent = initials(name);
  });
  $$(".admin-only").forEach(el=>el.classList.toggle("locked", !isAdmin()));
}
function renderAll(){
  updateUserUI();
  renderHome(); renderProfile(); renderPeople(); renderNewcomer(); renderEvents(); renderSundays(); renderAttendance(); renderTeams(); renderFollowups(); renderTasks(); renderReports(); renderAccess(); renderGamePlan(); renderPublicLive(); fillCommonSelects();
}

function fillCommonSelects(){
  $$("select[data-team-select]").forEach(sel=>{
    const current = sel.value;
    sel.innerHTML = `<option value="">Select Team</option>` + TEAMS.map(t=>`<option ${current===t?"selected":""}>${esc(t)}</option>`).join("");
  });
  const memberOptions = state.members.map(m=>`<option value="${esc(m.id)}">${esc(m.name || "Unnamed")}</option>`).join("");
  $$("select[data-member-select]").forEach(sel=>{ const cur=sel.value; sel.innerHTML=`<option value="">Select Person</option>${memberOptions}`; sel.value=cur; });
  const eventOptions = sortByDate(state.events).map(ev=>`<option value="${esc(ev.id)}">${esc(ev.title || "Event")} ${ev.date ? "• "+esc(fmtDate(ev.date)) : ""}</option>`).join("");
  $$("select[data-event-select]").forEach(sel=>{ const cur=sel.value; sel.innerHTML=`<option value="">Select Event</option>${eventOptions}`; sel.value=cur; });
  const teamOptions = state.tournamentTeams.map(t=>`<option value="${esc(t.id)}">${esc(t.name || "Team")}</option>`).join("");
  $$("select[data-tournament-team-select]").forEach(sel=>{ const cur=sel.value; sel.innerHTML=`<option value="">Select Team</option>${teamOptions}`; sel.value=cur; });
}

function renderHome(){
  if(PAGE !== "home") return;
  const total = state.members.length;
  const newcomers = state.members.filter(m=>String(m.type||"").toLowerCase().includes("newcomer")).length;
  const openTasks = state.tasks.filter(t=>t.status !== "done").length;
  const activeFollow = state.followups.filter(f=>f.status !== "Completed").length;
  const month = new Date().toISOString().slice(0,7);
  const attendedThisMonth = new Set(state.attendance.filter(a=>shortDate(a.date || a.createdAt).startsWith(month) && a.status !== "Absent").map(a=>a.memberId || a.memberName)).size;
  setMetric("metricPeople", total); setMetric("metricNewcomers", newcomers); setMetric("metricMonth", attendedThisMonth); setMetric("metricCare", activeFollow); setMetric("metricTasks", openTasks);
  renderMiniList("homeNotifications", state.tasks.filter(t=>t.status!=="done").slice(0,5).map(t=>`<div class="follow-card"><h4>${esc(t.title)}</h4><p>${esc(t.assignee || "Unassigned")} • ${esc(t.priority || "Normal")}</p></div>`), "No open notifications yet.");
  renderTeamChart("homeTeamChart");
  renderAttendanceTrend("homeAttendanceChart");
}
function setMetric(id, value){ const el=$("#"+id); if(el) el.textContent = value; }
function renderMiniList(id, rows, empty){ const el=$("#"+id); if(el) el.innerHTML = rows.length ? rows.join("") : `<div class="empty-state">${esc(empty)}</div>`; }

function renderProfile(){
  if(PAGE !== "profile") return;
  setVal("profileName", state.profile?.name || ""); setVal("profileTeam", state.profile?.team || ""); setVal("profilePhotoURL", state.profile?.photoURL || "");
  $("#profileRole") && ($("#profileRole").textContent = state.profile?.role || "Member");
  $("#profileEmail") && ($("#profileEmail").textContent = state.user?.email || "-");
}
async function previewProfileFile(file){
  if(!file) return;
  if(file.size > 900000) toast("Large image", "It will be compressed before saving.");
  const data = await compressImage(file, 420, .78);
  setVal("profilePhotoURL", data);
  $$("[data-user-avatar]").forEach(el=>el.innerHTML=`<img src="${data}" alt="Profile">`);
}
function compressImage(file, max=500, quality=.8){
  return new Promise((resolve,reject)=>{
    const img = new Image(); const reader = new FileReader();
    reader.onload = () => { img.onload = () => { const c=document.createElement("canvas"); let w=img.width,h=img.height; const scale=Math.min(1,max/Math.max(w,h)); w=Math.round(w*scale); h=Math.round(h*scale); c.width=w; c.height=h; c.getContext("2d").drawImage(img,0,0,w,h); resolve(c.toDataURL("image/jpeg",quality)); }; img.onerror=reject; img.src=reader.result; };
    reader.onerror=reject; reader.readAsDataURL(file);
  });
}
async function saveProfileFields(fields){
  if(!state.user) return;
  await setDoc(one("userProfiles", state.user.uid), {...fields, updatedAt:serverTimestamp()}, {merge:true});
  toast("Profile saved");
}
async function saveMyProfile(){
  await saveProfileFields({name:val("profileName"), team:val("profileTeam"), photoURL:val("profilePhotoURL")});
}

function filteredPeople(){
  return state.members.filter(m=>{
    const matchType = !state.filters.peopleType || (m.type || "") === state.filters.peopleType;
    const matchTeam = !state.filters.peopleTeam || (m.team || "") === state.filters.peopleTeam;
    const hay = `${m.name||""} ${m.phone||""} ${m.location||""} ${m.team||""} ${m.cellLeader||""}`.toLowerCase();
    const matchSearch = !state.filters.peopleSearch || hay.includes(state.filters.peopleSearch);
    return matchType && matchTeam && matchSearch;
  });
}
function renderPeople(){
  if(PAGE !== "people") return;
  const rows = filteredPeople().sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map(m=>`
    <tr>
      <td><b>${esc(m.name || "Unnamed")}</b><br><span class="muted">${esc(m.phone || "-")}</span></td>
      <td>${esc(m.gender || "-")}</td>
      <td>${esc(m.location || "-")}</td>
      <td><span class="tag blue">${esc(m.team || "General")}</span></td>
      <td>${esc(m.cellLeader || "-")}</td>
      <td><span class="tag ${m.type === "Newcomer" ? "pink" : "green"}">${esc(m.type || "Regular")}</span></td>
      <td>${esc(m.lastSeen || fmtDate(m.lastSeenAt) || "-")}</td>
      <td><div class="card-actions"><button class="btn small" data-action="openMember" data-id="${esc(m.id)}">Edit</button><button class="btn small red admin-only" data-action="deleteMember" data-id="${esc(m.id)}">Delete</button></div></td>
    </tr>`).join("");
  $("#peopleTableBody") && ($("#peopleTableBody").innerHTML = rows || `<tr><td colspan="8"><div class="empty-state">No people found. Add the first person.</div></td></tr>`);
  setMetric("peopleCount", filteredPeople().length);
}
function openMemberModal(id=null){
  state.editing.member = id;
  const m = id ? state.members.find(x=>x.id===id) : {};
  $("#memberModalTitle") && ($("#memberModalTitle").textContent = id ? "Edit Person" : "Add Person");
  setVal("memberName", m?.name || ""); setVal("memberPhone", m?.phone || ""); setVal("memberGender", m?.gender || ""); setVal("memberLocation", m?.location || ""); setVal("memberTeam", m?.team || "General"); setVal("memberLeader", m?.cellLeader || ""); setVal("memberType", m?.type || "Regular"); setVal("memberStatus", m?.status || "Active"); setVal("memberNotes", m?.notes || "");
  showModal("memberModal");
}
async function saveMember(){
  const data = {name:val("memberName"), phone:val("memberPhone"), gender:val("memberGender"), location:val("memberLocation"), team:val("memberTeam") || "General", cellLeader:val("memberLeader"), type:val("memberType") || "Regular", status:val("memberStatus") || "Active", notes:val("memberNotes"), updatedAt:serverTimestamp()};
  if(!data.name) return toast("Name required");
  if(state.editing.member) await updateDoc(one("youthMembers", state.editing.member), data); else await addDoc(ref("youthMembers"), {...data, createdAt:serverTimestamp()});
  closeModal("memberModal"); toast("Person saved");
}
async function quickNewcomer(){
  const name=val("newName"), phone=val("newPhone");
  if(!name) return toast("Name required", "Add at least the newcomer name.");
  const docRef = await addDoc(ref("youthMembers"), {name, phone, gender:val("newGender"), location:val("newLocation"), team:val("newTeam") || "General", cellLeader:val("newOwner"), type:"Newcomer", status:"Needs Follow-up", notes:val("newNotes"), createdAt:serverTimestamp(), updatedAt:serverTimestamp()});
  await addDoc(ref("followUps"), {memberId:docRef.id, memberName:name, owner:val("newOwner") || state.profile?.name || "Team", reason:"Newcomer follow-up", status:"Pending", createdAt:serverTimestamp()});
  ["newName","newPhone","newGender","newLocation","newTeam","newOwner","newNotes"].forEach(id=>setVal(id,""));
  toast("Newcomer saved", "Follow-up created automatically.");
}
function renderNewcomer(){
  if(PAGE !== "newcomers") return;
  renderMiniList("recentNewcomers", sortByDate(state.members.filter(m=>m.type==="Newcomer")).slice(0,6).map(m=>`<div class="follow-card"><h4>${esc(m.name)}</h4><p>${esc(m.phone||"No phone")} • ${esc(m.location||"No location")}</p><span class="tag pink">Needs care</span></div>`), "No newcomer records yet.");
}

function renderEvents(){
  if(PAGE !== "events") return;
  const events = sortByDate(state.events).filter(ev=>!state.filters.eventType || (ev.type||"") === state.filters.eventType);
  const cards = events.map(ev=>`
    <article class="event-card">
      <div class="event-thumb">${ev.flyer ? `<img src="${esc(ev.flyer)}" alt="${esc(ev.title)}">` : ""}</div>
      <h4>${esc(ev.title || "Untitled Event")}</h4>
      <p>${esc(fmtDate(ev.date))} ${ev.location ? "• "+esc(ev.location) : ""}<br>${esc(ev.description || "")}</p>
      <div class="card-actions">
        ${ev.registrationLink ? `<a class="btn small green" href="${esc(ev.registrationLink)}" target="_blank" rel="noopener">Register</a>` : ""}
        <button class="btn small" data-action="openEvent" data-id="${esc(ev.id)}">Edit</button>
        <button class="btn small red admin-only" data-action="deleteEvent" data-id="${esc(ev.id)}">Delete</button>
      </div>
    </article>`).join("");
  $("#eventsGrid") && ($("#eventsGrid").innerHTML = cards || `<div class="empty-state">No events saved yet. Add a youth event or generate Sunday services.</div>`);
}
function openEventModal(id=null){
  state.editing.event = id;
  const ev = id ? state.events.find(x=>x.id===id) : {};
  $("#eventModalTitle") && ($("#eventModalTitle").textContent = id ? "Edit Event" : "Add Event");
  setVal("eventTitle", ev?.title || ""); setVal("eventType", ev?.type || "Special Youth Event"); setVal("eventDate", shortDate(ev?.date) || ""); setVal("eventLocation", ev?.location || ""); setVal("eventFlyer", ev?.flyer || ""); setVal("eventRegistration", ev?.registrationLink || ""); setVal("eventDescription", ev?.description || "");
  showModal("eventModal");
}
async function saveEvent(){
  const data = {title:val("eventTitle"), type:val("eventType") || "Special Youth Event", date:val("eventDate"), location:val("eventLocation"), flyer:val("eventFlyer"), registrationLink:val("eventRegistration"), description:val("eventDescription"), updatedAt:serverTimestamp()};
  if(!data.title) return toast("Event title required");
  if(state.editing.event) await updateDoc(one("events", state.editing.event), data); else await addDoc(ref("events"), {...data, createdAt:serverTimestamp()});
  closeModal("eventModal"); toast("Event saved");
}
async function generateSundayServices(count=8){
  const batch = writeBatch(db);
  const today = new Date();
  let date = new Date(today);
  const day = date.getDay();
  const add = (7 - day) % 7 || 7;
  date.setDate(date.getDate() + add);
  for(let i=0;i<count;i++){
    const d = new Date(date); d.setDate(date.getDate() + i*7);
    const id = `sunday-${d.toISOString().slice(0,10)}`;
    batch.set(one("events", id), {title:`Sunday Service • ${d.toLocaleDateString(undefined,{month:"short",day:"numeric"})}`, type:"Sunday Service", date:d.toISOString().slice(0,10), location:"Church", description:"Auto-generated Sunday service attendance event.", createdAt:serverTimestamp(), updatedAt:serverTimestamp()}, {merge:true});
  }
  await batch.commit(); toast("Sunday services generated", `${count} services added without duplicates.`);
}
function renderSundays(){
  if(PAGE !== "sundays") return;
  const sundays = sortByDate(state.events.filter(e=>e.type === "Sunday Service"));
  renderMiniList("sundayList", sundays.slice(0,20).map(e=>`<div class="event-card"><h4>${esc(e.title)}</h4><p>${esc(fmtDate(e.date))} • ${esc(e.location||"Church")}</p><div class="card-actions"><button class="btn small" data-action="openEvent" data-id="${esc(e.id)}">Edit</button><button class="btn small red admin-only" data-action="deleteEvent" data-id="${esc(e.id)}">Delete</button></div></div>`), "No Sunday services yet.");
}

function updateAttendanceEventPreview(){
  const ev = state.events.find(e=>e.id === val("eventSelect"));
  $("#attendanceEventPreview") && ($("#attendanceEventPreview").innerHTML = ev ? `<b>${esc(ev.title)}</b><span>${esc(fmtDate(ev.date))} • ${esc(ev.type||"Event")}</span>` : `<span>Select an event to start marking attendance.</span>`);
}
async function markAttendance(){
  const eventId=val("eventSelect"), memberId=val("attendanceMember"), status=val("attendanceStatus") || "Present";
  const ev=state.events.find(e=>e.id===eventId), mem=state.members.find(m=>m.id===memberId);
  if(!eventId || !memberId) return toast("Select event and person");
  await addDoc(ref("attendance"), {eventId,eventTitle:ev?.title||"Event",memberId,memberName:mem?.name||"Person",status,date:ev?.date || new Date().toISOString().slice(0,10), markedBy:state.profile?.name || state.user?.email, createdAt:serverTimestamp()});
  if(mem) await updateDoc(one("youthMembers", memberId), {lastSeen:fmtDate(ev?.date || new Date()), lastSeenAt:serverTimestamp(), status:"Active"});
  toast("Attendance marked", `${mem?.name || "Person"} • ${status}`);
}
function renderAttendance(){
  if(PAGE !== "attendance") return;
  updateAttendanceEventPreview();
  const rows = sortByDate(state.attendance).slice(0,80).map(a=>`<tr><td><b>${esc(a.memberName)}</b></td><td>${esc(a.eventTitle || "Event")}</td><td>${esc(fmtDate(a.date || a.createdAt))}</td><td><span class="tag ${a.status === "Absent" ? "red" : a.status === "Late" ? "yellow" : "green"}">${esc(a.status||"Present")}</span></td><td>${esc(a.markedBy || "-")}</td><td><button class="btn small red admin-only" data-action="deleteAttendance" data-id="${esc(a.id)}">Delete</button></td></tr>`).join("");
  $("#attendanceTableBody") && ($("#attendanceTableBody").innerHTML = rows || `<tr><td colspan="6"><div class="empty-state">No attendance marked yet.</div></td></tr>`);
}

async function addCellLeader(){
  const name=val("leaderName"), phone=val("leaderPhone"); if(!name) return toast("Leader name required");
  await addDoc(ref("cellLeaders"), {name, phone, team:val("leaderTeam") || "Cell Leaders", createdAt:serverTimestamp()});
  ["leaderName","leaderPhone","leaderTeam"].forEach(id=>setVal(id,"")); toast("Cell leader added");
}
async function addCellGroup(){
  const name=val("groupName"); if(!name) return toast("Cell group name required");
  await addDoc(ref("cellGroups"), {name, leader:val("groupLeader"), area:val("groupArea"), createdAt:serverTimestamp()});
  ["groupName","groupLeader","groupArea"].forEach(id=>setVal(id,"")); toast("Cell group added");
}
function renderTeams(){
  if(PAGE !== "teams") return;
  renderMiniList("leadersList", state.leaders.map(l=>`<div class="team-card"><b>${esc(l.name)}</b><p class="muted">${esc(l.phone||"-")} • ${esc(l.team||"Cell Leaders")}</p><button class="btn small red admin-only" data-action="deleteLeader" data-id="${esc(l.id)}">Delete</button></div>`), "No cell leaders yet.");
  renderMiniList("groupsList", state.groups.map(g=>`<div class="team-card"><b>${esc(g.name)}</b><p class="muted">${esc(g.leader||"No leader")} • ${esc(g.area||"No area")}</p><button class="btn small red admin-only" data-action="deleteGroup" data-id="${esc(g.id)}">Delete</button></div>`), "No cell groups yet.");
  renderTeamChart("teamBreakdownChart");
}

async function addTask(){
  const title=val("taskTitle"); if(!title) return toast("Task title required");
  const task={title, description:val("taskDescription"), assignee:val("taskAssignee"), priority:val("taskPriority")||"Normal", dueDate:val("taskDue"), status:"todo", createdBy:state.profile?.name || state.user?.email, createdAt:serverTimestamp(), updatedAt:serverTimestamp()};
  await addDoc(ref("tasks"), task);
  await addDoc(ref("notifications"), {type:"task", title:"New task", message:title, createdAt:serverTimestamp()}).catch(()=>{});
  ["taskTitle","taskDescription","taskAssignee","taskPriority","taskDue"].forEach(id=>setVal(id,"")); toast("Task added");
}
async function moveTask(id, status){ await updateDoc(one("tasks", id), {status, updatedAt:serverTimestamp()}); }
function renderTasks(){
  if(PAGE !== "tasks") return;
  ["todo","progress","done"].forEach(status=>{
    const list = state.tasks.filter(t=> (t.status||"todo") === status).filter(t=>!state.filters.taskSearch || `${t.title||""} ${t.description||""} ${t.assignee||""}`.toLowerCase().includes(state.filters.taskSearch));
    const html = list.map(t=>`<article class="task-card"><h4>${esc(t.title)}</h4><p>${esc(t.description || "No description")}<br>${esc(t.assignee || "Unassigned")} ${t.dueDate ? "• Due "+esc(fmtDate(t.dueDate)) : ""}</p><span class="tag ${t.priority==="Urgent"?"red":t.priority==="High"?"yellow":"blue"}">${esc(t.priority||"Normal")}</span><div class="card-actions" style="margin-top:12px">${status!=="todo"?`<button class="btn small" data-action="moveTask" data-id="${esc(t.id)}" data-value="todo">To Do</button>`:""}${status!=="progress"?`<button class="btn small yellow" data-action="moveTask" data-id="${esc(t.id)}" data-value="progress">Progress</button>`:""}${status!=="done"?`<button class="btn small green" data-action="moveTask" data-id="${esc(t.id)}" data-value="done">Done</button>`:""}<button class="btn small red" data-action="deleteTask" data-id="${esc(t.id)}">Delete</button></div></article>`).join("");
    const lane = $(`#lane-${status}`); if(lane) lane.innerHTML = html || `<div class="empty-state">Nothing here yet.</div>`;
    const count = $(`#count-${status}`); if(count) count.textContent = list.length;
  });
}
async function enableAlerts(){
  if(!("Notification" in window)) return toast("Not supported", "This browser does not support notifications.");
  const perm = await Notification.requestPermission();
  toast(perm === "granted" ? "Alerts enabled" : "Alerts blocked", perm === "granted" ? "Browser notifications are ready." : "Enable them in browser settings.");
}

async function createFollowUp(){
  const memberId=val("followMember"); const mem=state.members.find(m=>m.id===memberId);
  if(!memberId) return toast("Select a person");
  await addDoc(ref("followUps"), {memberId, memberName:mem?.name || "Person", owner:val("followOwner") || state.profile?.name || "Team", reason:val("followReason") || "Care follow-up", status:"Pending", createdAt:serverTimestamp()});
  ["followMember","followOwner","followReason"].forEach(id=>setVal(id,"")); toast("Follow-up created");
}
function renderFollowups(){
  if(PAGE !== "followups") return;
  const cards = sortByDate(state.followups).map(f=>`<article class="follow-card"><h4>${esc(f.memberName || "Person")}</h4><p>${esc(f.reason || "Care follow-up")}<br>Owner: ${esc(f.owner || "Team")}</p><span class="tag ${f.status==="Completed"?"green":"yellow"}">${esc(f.status || "Pending")}</span><div class="card-actions" style="margin-top:12px">${f.status!=="Completed"?`<button class="btn small green" data-action="completeFollow" data-id="${esc(f.id)}">Complete</button>`:""}<button class="btn small red" data-action="deleteFollow" data-id="${esc(f.id)}">Delete</button></div></article>`).join("");
  $("#followupList") && ($("#followupList").innerHTML = cards || `<div class="empty-state">No follow-ups yet.</div>`);
}

function renderReports(){
  if(PAGE !== "reports") return;
  renderAttendanceTrend("reportAttendanceTrend"); renderTeamChart("reportTeamChart"); renderEventChart("reportEventChart"); renderFollowHealth("reportFollowChart");
  renderMiniList("careList", state.followups.filter(f=>f.status!=="Completed").slice(0,8).map(f=>`<div class="follow-card"><h4>${esc(f.memberName)}</h4><p>${esc(f.reason||"Follow-up")} • ${esc(f.owner||"Team")}</p></div>`), "Care list is clear.");
  renderMiniList("newcomerReport", state.members.filter(m=>m.type==="Newcomer").slice(0,8).map(m=>`<div class="follow-card"><h4>${esc(m.name)}</h4><p>${esc(m.phone||"-")} • ${esc(m.location||"-")}</p></div>`), "No newcomers yet.");
}
function renderTeamChart(id){
  const el=$("#"+id); if(!el) return;
  const counts = {};
  state.members.forEach(m=>{ const k=m.team||"General"; counts[k]=(counts[k]||0)+1; });
  const max = Math.max(1, ...Object.values(counts));
  el.innerHTML = Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>bar(k,v,max)).join("") || `<div class="empty-state">No team data yet.</div>`;
}
function renderAttendanceTrend(id){
  const el=$("#"+id); if(!el) return;
  const buckets = {};
  state.attendance.filter(a=>a.status!=="Absent").forEach(a=>{ const d=shortDate(a.date || a.createdAt) || "No date"; buckets[d]=(buckets[d]||0)+1; });
  const rows = Object.entries(buckets).sort((a,b)=>a[0].localeCompare(b[0])).slice(-8);
  const max = Math.max(1, ...rows.map(x=>x[1]));
  el.innerHTML = rows.map(([k,v])=>bar(fmtDate(k),v,max)).join("") || `<div class="empty-state">No attendance trend yet.</div>`;
}
function renderEventChart(id){
  const el=$("#"+id); if(!el) return;
  const counts={}; state.attendance.forEach(a=>{ if(a.status!=="Absent") counts[a.eventTitle||"Event"]=(counts[a.eventTitle||"Event"]||0)+1; });
  const rows=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8); const max=Math.max(1,...rows.map(x=>x[1]));
  el.innerHTML = rows.map(([k,v])=>bar(k,v,max)).join("") || `<div class="empty-state">No event attendance yet.</div>`;
}
function renderFollowHealth(id){
  const el=$("#"+id); if(!el) return;
  const pending=state.followups.filter(f=>f.status!=="Completed").length, done=state.followups.filter(f=>f.status==="Completed").length, max=Math.max(1,pending,done);
  el.innerHTML = bar("Pending",pending,max)+bar("Completed",done,max);
}
function bar(label,value,max){ return `<div class="bar-row"><div class="bar-label">${esc(label)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4,Math.round(value/max*100))}%"></div></div><div class="bar-value">${value}</div></div>`; }

function renderAccess(){
  if(PAGE !== "access") return;
  const rows = state.profiles.map(p=>`<tr><td><b>${esc(p.name || "User")}</b><br><span class="muted">${esc(p.email || p.uid || "-")}</span></td><td><select id="role-${esc(p.id)}" ${!isAdmin()?"disabled":""}><option ${p.role==="Member"?"selected":""}>Member</option><option ${p.role==="Leader"?"selected":""}>Leader</option><option ${p.role==="Admin"?"selected":""}>Admin</option><option ${p.role==="Owner"?"selected":""}>Owner</option></select></td><td>${esc(p.team || "General")}</td><td><span class="tag ${p.status==="Active"?"green":"yellow"}">${esc(p.status || "Active")}</span></td><td><button class="btn small admin-only" data-action="updateRole" data-id="${esc(p.id)}">Save Role</button></td></tr>`).join("");
  $("#accessTableBody") && ($("#accessTableBody").innerHTML = rows || `<tr><td colspan="5"><div class="empty-state">No users yet.</div></td></tr>`);
}
async function updateUserRole(id){
  if(!isAdmin()) return toast("Admin only", "Only admins can change roles.");
  const role = $(`#role-${CSS.escape(id)}`)?.value;
  if(!role) return;
  await updateDoc(one("userProfiles", id), {role, updatedAt:serverTimestamp()}); toast("Role updated", role);
}
async function importJsonData(){
  const raw = val("jsonImport");
  if(!raw) return toast("Paste JSON first");
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : data.people || data.members || [];
  const batch = writeBatch(db);
  list.forEach(item=>{
    const docRef = doc(ref("youthMembers"));
    batch.set(docRef, {name:item.name || item.Name || "Unnamed", phone:item.phone || item.Phone || "", gender:item.gender || item.Gender || "", location:item.location || item.Location || "", team:item.team || item.Team || "General", cellLeader:item.cellLeader || item["Cell Leader"] || "", type:item.type || item.Type || "Regular", status:item.status || item.Status || "Active", createdAt:serverTimestamp()});
  });
  await batch.commit(); setVal("jsonImport",""); toast("JSON imported", `${list.length} records added.`);
}

async function deleteItem(collectionName, id, message="Deleted"){
  if(!id) return;
  if(!confirm("Delete this item?")) return;
  await deleteDoc(one(collectionName, id)); toast(message);
}
function exportCSV(type){
  const maps = {
    people: state.members,
    attendance: state.attendance,
    followups: state.followups,
    tasks: state.tasks,
    events: state.events,
    teams: state.tournamentTeams,
    matches: state.tournamentMatches
  };
  const data = maps[type] || [];
  if(!data.length) return toast("Nothing to export");
  const keys = [...new Set(data.flatMap(Object.keys))].filter(k=>k!=="id");
  const csv = [keys.join(","), ...data.map(row=>keys.map(k=>`"${String(row[k]?.toDate ? row[k].toDate().toISOString() : row[k] ?? "").replaceAll('"','""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], {type:"text/csv"}); const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`youth-central-${type}.csv`; a.click(); URL.revokeObjectURL(url);
}

function playGameIntro(){
  const overlay = $("#introOverlay"); if(!overlay) return;
  overlay.classList.remove("hidden");
  const video = overlay.querySelector("video");
  video?.play?.().catch(()=>{});
  const finish = () => overlay.classList.add("hidden");
  video?.addEventListener("ended", finish, {once:true});
  setTimeout(finish, 12000);
}
async function seedFomoTeams(){
  const defaults = [
    ["Division 1","Shapthi Squad"],["Division 1","Dishan Squad"],["Division 1","Mishael Squad"],["Division 1","Bhagya Squad"],
    ["Division 2","Yohan Squad"],["Division 2","Ciara Squad"],["Division 2","Samuel Squad"],["Division 2","Oshara Squad"]
  ];
  const batch = writeBatch(db);
  defaults.forEach(([division,name])=>batch.set(doc(ref("tournamentTeams")), {division,name,captain:"",players:"",createdAt:serverTimestamp()}));
  await batch.commit(); toast("FOMO teams seeded");
}
async function addTournamentTeam(){
  const name=val("fomoTeamName"); if(!name) return toast("Team name required");
  await addDoc(ref("tournamentTeams"), {name, division:val("fomoTeamDivision") || "Division 1", captain:val("fomoTeamCaptain"), players:val("fomoTeamPlayers"), createdAt:serverTimestamp()});
  ["fomoTeamName","fomoTeamCaptain","fomoTeamPlayers"].forEach(id=>setVal(id,"")); toast("Team added");
}
async function addTournamentMatch(){
  const teamA=val("matchTeamA"), teamB=val("matchTeamB"); if(!teamA || !teamB || teamA===teamB) return toast("Select two teams");
  const a=state.tournamentTeams.find(t=>t.id===teamA), b=state.tournamentTeams.find(t=>t.id===teamB);
  await addDoc(ref("tournamentMatches"), {teamA, teamB, teamAName:a?.name||"Team A", teamBName:b?.name||"Team B", division:val("matchDivision") || a?.division || "Division 1", court:val("matchCourt") || "Court 1", status:"upcoming", scoreA:0, scoreB:0, createdAt:serverTimestamp()});
  ["matchTeamA","matchTeamB","matchCourt"].forEach(id=>setVal(id,"")); toast("Match added");
}
async function quickScore(id, side){
  const m=state.tournamentMatches.find(x=>x.id===id); if(!m) return;
  const field = side === "A" ? "scoreA" : "scoreB";
  await updateDoc(one("tournamentMatches", id), {[field]:(Number(m[field]||0)+1), status:m.status === "upcoming" ? "live" : m.status, updatedAt:serverTimestamp()});
}
async function setMatchStatus(id, status){
  const updates = {status, updatedAt:serverTimestamp()};
  if(status === "live") updates.startedAt = serverTimestamp();
  if(status === "completed") updates.completedAt = serverTimestamp();
  await updateDoc(one("tournamentMatches", id), updates); toast("Match updated", status);
}
function standings(){
  const table = {};
  state.tournamentTeams.forEach(t=>{ table[t.id] = {id:t.id,name:t.name||"Team",division:t.division||"Division",p:0,w:0,l:0,d:0,pts:0,diff:0}; });
  state.tournamentMatches.filter(m=>m.status === "completed").forEach(m=>{
    const a=table[m.teamA], b=table[m.teamB]; if(!a || !b) return;
    const sa=Number(m.scoreA||0), sb=Number(m.scoreB||0); a.p++; b.p++; a.diff += sa-sb; b.diff += sb-sa;
    if(sa>sb){a.w++;b.l++;a.pts+=3;} else if(sb>sa){b.w++;a.l++;b.pts+=3;} else {a.d++;b.d++;a.pts++;b.pts++;}
  });
  return Object.values(table).sort((a,b)=> b.pts-a.pts || b.diff-a.diff || a.name.localeCompare(b.name));
}
function renderGamePlan(){
  if(PAGE !== "fomo-gameplan") return;
  setMetric("fomoTeamCount", state.tournamentTeams.length); setMetric("fomoMatchCount", state.tournamentMatches.length); setMetric("fomoLiveCount", state.tournamentMatches.filter(m=>m.status==="live").length); setMetric("fomoDoneCount", state.tournamentMatches.filter(m=>m.status==="completed").length);
  const teams = state.tournamentTeams.map(t=>`<div class="team-card"><b>${esc(t.name)}</b><p class="muted">${esc(t.division||"Division")} ${t.captain?"• Captain: "+esc(t.captain):""}</p>${t.players?`<p class="muted">${esc(t.players)}</p>`:""}<button class="btn small red" data-action="deleteTournamentTeam" data-id="${esc(t.id)}">Delete</button></div>`).join("");
  $("#fomoTeamsList") && ($("#fomoTeamsList").innerHTML = teams || `<div class="empty-state">No FOMO teams yet.</div>`);
  const matches = sortByDate(state.tournamentMatches).map(m=>`<article class="task-card"><h4>${esc(m.teamAName)} vs ${esc(m.teamBName)}</h4><p>${esc(m.division||"Division")} • ${esc(m.court||"Court")}<br><b>${Number(m.scoreA||0)} - ${Number(m.scoreB||0)}</b></p><span class="tag ${m.status==="live"?"green":m.status==="completed"?"blue":"yellow"}">${esc(m.status||"upcoming")}</span><div class="card-actions" style="margin-top:12px"><button class="btn small" data-action="quickScore" data-id="${esc(m.id)}" data-value="A">+ ${esc(m.teamAName)}</button><button class="btn small" data-action="quickScore" data-id="${esc(m.id)}" data-value="B">+ ${esc(m.teamBName)}</button><button class="btn small green" data-action="matchStatus" data-id="${esc(m.id)}" data-value="live">Live</button><button class="btn small yellow" data-action="matchStatus" data-id="${esc(m.id)}" data-value="completed">Done</button><button class="btn small red" data-action="deleteTournamentMatch" data-id="${esc(m.id)}">Delete</button></div></article>`).join("");
  $("#fomoMatchesList") && ($("#fomoMatchesList").innerHTML = matches || `<div class="empty-state">No matches yet.</div>`);
  const rows = standings().map(s=>`<tr><td><b>${esc(s.name)}</b><br><span class="muted">${esc(s.division)}</span></td><td>${s.p}</td><td>${s.w}</td><td>${s.l}</td><td>${s.d}</td><td><b>${s.pts}</b></td><td>${s.diff}</td></tr>`).join("");
  $("#fomoStandingsBody") && ($("#fomoStandingsBody").innerHTML = rows || `<tr><td colspan="7"><div class="empty-state">Standings will appear after completed matches.</div></td></tr>`);
  const live = state.tournamentMatches.find(m=>m.status==="live") || state.tournamentMatches.find(m=>m.status==="upcoming") || {};
  $("#fomoLivePanel") && ($("#fomoLivePanel").innerHTML = live.id ? `<div class="score-line"><div class="score-team"><p>${esc(live.teamAName)}</p><h2>${Number(live.scoreA||0)}</h2></div><div class="score-vs">VS</div><div class="score-team"><p>${esc(live.teamBName)}</p><h2>${Number(live.scoreB||0)}</h2></div></div><div class="score-actions"><button class="btn" data-action="quickScore" data-id="${esc(live.id)}" data-value="A">+ A</button><button class="btn" data-action="quickScore" data-id="${esc(live.id)}" data-value="B">+ B</button><button class="btn green" data-action="matchStatus" data-id="${esc(live.id)}" data-value="live">Live</button><button class="btn yellow" data-action="matchStatus" data-id="${esc(live.id)}" data-value="completed">Finish</button></div>` : `<div class="empty-state">Add a fixture to activate live control.</div>`);
}
function copyPublicLink(){ navigator.clipboard?.writeText(`${location.origin}${location.pathname.replace(/pages\/[^/]+$/,"")}fomo-live.html`); toast("Public link copied"); }
function renderPublicLive(){
  if(PAGE !== "public-live") return;
  const live = state.tournamentMatches.find(m=>m.status==="live") || state.tournamentMatches.find(m=>m.status==="upcoming") || null;
  $("#publicMatch") && ($("#publicMatch").innerHTML = live ? `<div class="public-match-grid"><div><h2>${esc(live.teamAName)}</h2><div class="public-score">${Number(live.scoreA||0)}</div></div><div class="score-vs">${live.status==="live"?"LIVE":"NEXT"}</div><div><h2>${esc(live.teamBName)}</h2><div class="public-score">${Number(live.scoreB||0)}</div></div></div><p class="muted" style="margin-top:14px">${esc(live.division||"Division")} • ${esc(live.court||"Court")}</p>` : `<div class="empty-state">No live match yet.</div>`);
  const top = standings().slice(0,4).map(s=>`<div class="mini-stat"><b>${esc(s.pts)}</b><span>${esc(s.name)}</span></div>`).join("");
  $("#publicStandings") && ($("#publicStandings").innerHTML = top || `<div class="empty-state">Standings loading...</div>`);
}

window.addEventListener("error", e=>{ console.error(e.error || e.message); });
window.addEventListener("unhandledrejection", e=>{ console.error(e.reason); });

document.addEventListener("DOMContentLoaded", ()=>{
  setupMotion(); setupShell(); setupActionDelegation(); switchAuth("login"); bootstrapAuth();
  setTimeout(()=>document.body.classList.add("ready"), 80);
});
