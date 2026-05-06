/* ================================================================
   js/shell.js  —  NEXus Solution CMS
   ================================================================ */

/* ── Dark Mode ─────────────────────────────────────────────────── */
let _darkMode = localStorage.getItem('nexus-theme') === 'dark';
function _applyTheme() {
  document.documentElement.setAttribute('data-theme', _darkMode ? 'dark' : 'light');
  localStorage.setItem('nexus-theme', _darkMode ? 'dark' : 'light');
  // Update toggle icon wherever it exists
  document.querySelectorAll('.dark-toggle').forEach(btn => {
    btn.textContent = _darkMode ? '☀️' : '🌙';
    btn.title = _darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  });
}
function toggleDarkMode() {
  _darkMode = !_darkMode;
  _applyTheme();
}
// Apply on load
_applyTheme();

function renderShell(){
  const nav=getNav(),isMobile=window.innerWidth<=768,sw=sidebarCollapsed?64:240,lbl=nav.find(n=>n.key===currentPage)?.label||"";
  const sidebarStyle=isMobile
    ?`position:fixed;left:0;top:0;height:100vh;z-index:1000;width:240px;background:${T.sidebar};display:flex;flex-direction:column;flex-shrink:0;overflow:hidden;box-shadow:4px 0 20px rgba(6,78,59,.3);transition:transform .25s;transform:${sidebarCollapsed?"translateX(-100%)":"translateX(0)"}`
    :`width:${sw}px;background:${T.sidebar};display:flex;flex-direction:column;flex-shrink:0;overflow:hidden;box-shadow:4px 0 20px rgba(6,78,59,.3);transition:width .25s`;
  return `
  ${isMobile&&!sidebarCollapsed?`<div onclick="toggleSidebar()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:999"></div>`:""}
  <div style="display:flex;height:100vh;overflow:hidden">
  <div style="${sidebarStyle}">
    <div style="padding:18px 14px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px;justify-content:${(!isMobile&&sidebarCollapsed)?"center":"flex-start"};height:68px;flex-shrink:0">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,${T.accent},${T.accentD});border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:16px">🎓</div>
      ${(isMobile||!sidebarCollapsed)?`<div><div style="font-weight:800;font-size:15px;font-family:'Space Grotesk',sans-serif;color:#fff">NEXus Solution</div><div style="font-size:10px;color:${T.sidebarText};opacity:.6">2025–26</div></div>`:""}
    </div>
    <nav style="flex:1;padding:10px 8px;overflow-y:auto">
      ${nav.map(n=>{const a=currentPage===n.key;return `<div onclick="navTo('${n.key}')" title="${n.label}" class="nav-item" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;margin-bottom:2px;background:${a?"rgba(16,185,129,.2)":"transparent"};color:${a?"#fff":T.sidebarText};font-weight:${a?700:500};font-size:13px;white-space:nowrap;overflow:hidden;justify-content:${(!isMobile&&sidebarCollapsed)?"center":"flex-start"};border-left:${a?`3px solid ${T.accent}`:"3px solid transparent"};transition:all .15s"><span style="font-size:16px;flex-shrink:0">${n.icon}</span>${(isMobile||!sidebarCollapsed)?`<span>${n.label}</span>`:""}</div>`;}).join("")}
    </nav>
    ${(isMobile||!sidebarCollapsed)?`<div style="padding:12px 14px;border-top:1px solid rgba(255,255,255,.08)"><div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,.07);border-radius:10px">${ava(currentUser.name,32,getUserPhoto())}<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(currentUser.name)}</div><div style="font-size:10px;color:${T.sidebarText};opacity:.6;text-transform:capitalize">${currentUser.isSubAdmin?"Sub-Admin":currentUser.role}</div></div></div></div>`:""}
    ${!isMobile?`<div style="padding:10px 8px;border-top:1px solid rgba(255,255,255,.08)"><div onclick="toggleSidebar()" style="display:flex;align-items:center;justify-content:center;padding:8px;border-radius:10px;cursor:pointer;background:rgba(255,255,255,.06);color:${T.sidebarText};font-size:16px">${sidebarCollapsed?"→":"←"}</div></div>`:""}
  </div>
  <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:${T.bg}">
    <div style="background:#fff;border-bottom:1px solid ${T.border};padding:0 ${isMobile?"12px":"28px"};display:flex;align-items:center;justify-content:space-between;height:68px;flex-shrink:0;box-shadow:0 1px 8px rgba(5,150,105,.06)">
      <div style="display:flex;align-items:center;gap:10px">
        ${isMobile?`<button onclick="toggleSidebar()" style="background:${T.accentL};border:none;border-radius:8px;width:36px;height:36px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:${T.accentD}">☰</button>`:""}
        <div>
          <div style="font-weight:800;font-size:${isMobile?"14px":"17px"};font-family:'Space Grotesk',sans-serif;color:${T.text}">${lbl}</div>
          ${!isMobile?`<div style="font-size:11px;color:${T.muted};margin-top:1px">${new Date().toLocaleDateString("en-PK",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>`:""}
        </div>
      </div>
      <div style="display:flex;gap:${isMobile?"6px":"12px"};align-items:center">
        ${!isMobile?`<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:${T.text}">${esc(currentUser.name)}</div><div style="font-size:10px;color:${T.muted};text-transform:capitalize">${currentUser.isSubAdmin?"Sub-Admin":currentUser.role}</div></div>`:""}
        ${ava(currentUser.name,38,getUserPhoto())}
        <button onclick="toggleDarkMode()" class="dark-toggle" title="Toggle Dark Mode">${_darkMode ? '☀️' : '🌙'}</button>
        <button onclick="openModal('changePassword')" style="background:${T.accentL};color:${T.accentD};border:1.5px solid ${T.border2};border-radius:10px;padding:7px ${isMobile?"8px":"14px"};font-size:12px;font-weight:700;cursor:pointer">🔑${!isMobile?" Password":""}</button>
        <button onclick="doLogout()" style="background:${T.redL};color:${T.red};border:1px solid #fca5a5;border-radius:10px;padding:7px ${isMobile?"8px":"14px"};font-size:12px;font-weight:700;cursor:pointer">${isMobile?"⬅️":"Logout"}</button>
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:${isMobile?"12px":"28px"}" id="main-content">${renderPage()}</div>
  </div>
</div>
${renderModal()}`;}

function getNav(){
  if(currentUser.role==="admin"){
    if(currentUser.isSubAdmin){
      const perms=currentUser.permissions||[];
      const allNav=[{key:"dashboard",icon:"📊",label:"Dashboard"},...SUB_ADMIN_PERMS.filter(p=>perms.includes(p.key)).map(p=>({key:p.key,icon:p.label.split(" ")[0],label:p.label.replace(/^[^ ]+ /,"")}))]
      return allNav;
    }
    return [{key:"dashboard",icon:"📊",label:"Dashboard"},{key:"academics",icon:"🏫",label:"Academics"},{key:"students",icon:"🎓",label:"Students"},{key:"teachers",icon:"👨‍🏫",label:"Teachers"},{key:"attendance",icon:"📋",label:"Attendance"},{key:"exams",icon:"📝",label:"Exams"},{key:"grades",icon:"📈",label:"Grades"},{key:"fees",icon:"💳",label:"Fees"},{key:"assignments",icon:"📎",label:"Assignments"},{key:"timetable",icon:"🕐",label:"Timetable"},{key:"notices",icon:"📢",label:"Notices"},{key:"complaints",icon:"⚠️",label:"Complaints"},{key:"reports",icon:"📋",label:"Reports"},{key:"portals",icon:"🔐",label:"Portal Access"},{key:"subadmins",icon:"👥",label:"Sub-Admins"},{key:"settings",icon:"⚙️",label:"Settings"}];
  }
  if(currentUser.role==="teacher")return [{key:"dashboard",icon:"📊",label:"Dashboard"},{key:"attendance",icon:"📋",label:"Mark Attendance"},{key:"grades",icon:"📈",label:"Enter Grades"},{key:"assignments",icon:"📎",label:"Assignments"},{key:"complaints",icon:"⚠️",label:"Complaints"},{key:"timetable",icon:"🕐",label:"My Timetable"},{key:"notices",icon:"📢",label:"Notices"}];
  return [{key:"dashboard",icon:"📊",label:"Dashboard"},{key:"attendance",icon:"📋",label:"My Attendance"},{key:"grades",icon:"📈",label:"My Grades"},{key:"assignments",icon:"📎",label:"Assignments"},{key:"fees",icon:"💳",label:"Fee Vouchers"},{key:"timetable",icon:"🕐",label:"Timetable"},{key:"exams",icon:"📝",label:"Exams"},{key:"notices",icon:"📢",label:"Notices"}];
}

function renderPage(){if(currentUser.role==="admin")return renderAdminPage();if(currentUser.role==="teacher")return renderTeacherPage();return renderStudentPage();}
