/* ================================================================
   js/login.js  —  NEXus Solution CMS
   ================================================================ */
function renderLogin(){
  const hints={admin:{h:"admin / admin123 (or sub-admin credentials)",i:"🛡️",l:"Admin"},teacher:{h:"T001–T005 / teach1–teach5",i:"👨‍🏫",l:"Teacher"},student:{h:"S001–S008 / 1234",i:"🎓",l:"Student"}};
  return `<div class="login-page">

  <!-- LEFT: green branding panel — hidden below 900px via CSS -->
  <div class="login-left">
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.06) 0%,transparent 60%)"></div>
    <div style="max-width:420px;width:100%;position:relative;z-index:1">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:52px">
        <div style="width:52px;height:52px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px">🎓</div>
        <div><div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:800;color:#fff">NEXus Solution</div><div style="font-size:12px;color:rgba(255,255,255,.55);margin-top:1px">College Management System</div></div>
      </div>
      <div style="font-family:'Space Grotesk',sans-serif;font-size:38px;font-weight:800;color:#fff;line-height:1.15;margin-bottom:16px">Welcome<br>Back! 👋</div>
      <div style="font-size:15px;color:rgba(255,255,255,.65);line-height:1.8;margin-bottom:40px">Attendance · Grades · Fees · Reports · Assignments — all in one secure portal.</div>
      <div style="display:flex;flex-wrap:wrap;gap:9px;margin-bottom:44px">
        ${["📋 Attendance","📈 Grades","💳 Fees","📊 Reports","📝 Assignments","🕐 Timetable"].map(f=>`<span style="background:rgba(255,255,255,.1);color:rgba(255,255,255,.85);border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:5px 14px;font-size:12px;font-weight:600">${f}</span>`).join("")}
      </div>
      <div style="display:flex;gap:28px;padding-top:32px;border-top:1px solid rgba(255,255,255,.12)">
        ${[["8+","Students"],["5","Teachers"],["4","Classes"],["3","Exams"]].map(([n,l])=>`<div><div style="font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:800;color:#fff">${n}</div><div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:3px">${l}</div></div>`).join("")}
      </div>
    </div>
  </div>

  <!-- RIGHT: login form — full width on mobile -->
  <div class="login-right">
    <div class="login-form-inner">
      <div style="margin-bottom:32px">
        <div style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:800;color:${T.text}">Sign In</div>
        <div style="font-size:13px;color:${T.muted};margin-top:5px">Select your role and enter your credentials</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:28px">
        ${["admin","teacher","student"].map(r=>`<button onclick="switchLoginRole('${r}')" style="padding:14px 8px;border-radius:12px;cursor:pointer;font-weight:700;font-size:12px;border:2px solid ${loginRole===r?T.accent:T.border};background:${loginRole===r?T.accentL:"#fff"};color:${loginRole===r?T.accentD:T.muted};display:flex;flex-direction:column;align-items:center;gap:5px;font-family:'Plus Jakarta Sans',sans-serif;transition:all .2s"><span style="font-size:22px">${hints[r].i}</span>${hints[r].l}</button>`).join("")}
      </div>
      <div style="background:${T.accentL};border:1px solid ${T.border2};border-radius:10px;padding:11px 14px;font-size:12px;color:${T.accentD};margin-bottom:22px;font-weight:600;display:flex;align-items:center;gap:8px"><span>💡</span>${hints[loginRole].h}</div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">User ID</label>
        <input id="l-uid" type="text" placeholder="${loginRole==="admin"?"admin or sub-admin username":loginRole==="teacher"?"e.g. T001":"e.g. S001"}" style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:12px 14px;color:${T.text};font-size:14px;outline:none;box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif" onfocus="this.style.borderColor='${T.accent}'" onblur="this.style.borderColor='${T.border}'"/>
      </div>
      <div style="margin-bottom:20px">
        <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Password</label>
        <input id="l-pwd" type="password" placeholder="Enter your password" style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:12px 14px;color:${T.text};font-size:14px;outline:none;box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif" onfocus="this.style.borderColor='${T.accent}'" onblur="this.style.borderColor='${T.border}'" onkeydown="if(event.key==='Enter')doLogin()"/>
      </div>
      ${loginErr?`<div style="background:${T.redL};border:1px solid #fca5a5;border-radius:10px;padding:12px 14px;font-size:13px;color:${T.red};margin-bottom:16px;font-weight:600;display:flex;gap:8px;align-items:center"><span>⚠️</span>${esc(loginErr)}</div>`:""}
      <button onclick="doLogin()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;box-shadow:0 4px 14px rgba(5,150,105,.4)">Sign In →</button>
      <div style="text-align:center;margin-top:28px;font-size:12px;color:${T.muted}">NEXus Solution · 2025–26 Academic Year</div>
    </div>
  </div>

</div>`;}

function switchLoginRole(r){loginRole=r;loginErr="";render();}
function doLogin(){
  const uid=(document.getElementById("l-uid")?.value||"").trim();
  const pwd=(document.getElementById("l-pwd")?.value||"").trim();
  loginErr="";
  if(loginRole==="admin"){
    if(uid==="admin"&&pwd===adminPassword){
      currentUser={role:"admin",name:"Admin / Principal",id:"ADMIN",isSubAdmin:false};currentPage="dashboard";render();
    } else {
      // Check sub-admins
      const sa=subAdmins.find(x=>x.username===uid&&x.password===pwd&&x.portal==="active");
      if(sa){currentUser={role:"admin",name:sa.name,id:sa.id,isSubAdmin:true,permissions:sa.permissions};currentPage="dashboard";render();}
      else{loginErr="Invalid credentials.";render();}
    }
  } else if(loginRole==="teacher"){
    const t=teachers.find(x=>x.id===uid&&x.password===pwd);
    if(t){currentUser={role:"teacher",name:t.name,id:t.id,photo:t.photo||null};currentPage="dashboard";render();}
    else{loginErr="Invalid ID or password. Try: T001 / teach1";render();}
  } else {
    const s=students.find(x=>x.id===uid&&x.password===pwd);
    if(s){currentUser={role:"student",name:s.name,id:s.id,photo:s.photo||null};currentPage="dashboard";render();}
    else{loginErr="Invalid ID or password. Try: S001 / 1234";render();}
  }
}

// ================================================================
// SECTION 8 — PERMISSION CHECK
// ----------------------------------------------------------------
// canAccess(page)
//   Returns true if the logged-in user may view the given page.
//   Full admins always pass. Sub-admins are checked against their
//   permissions array. Students and teachers always pass (they have
//   their own limited nav so they never reach admin-only pages).
//
//   Pages only the full admin can see:
//     dashboard, portals, subadmins, settings
// ================================================================
function canAccess(page){
  if(!currentUser||currentUser.role!=="admin")return true;
  if(!currentUser.isSubAdmin)return true;
  const map={students:"students",teachers:"teachers",attendance:"attendance",grades:"grades",fees:"fees",exams:"exams",notices:"notices",complaints:"complaints",reports:"reports",timetable:"timetable",dashboard:null,portals:null,settings:null,subadmins:null};
  const perm=map[page];
  if(perm===null)return false; // full admin only
  if(perm===undefined)return false;
  return (currentUser.permissions||[]).includes(perm);
}

// ================================================================
// SECTION 9 — SHELL
// ----------------------------------------------------------------
// renderShell()
//   The outer chrome rendered after login.
//   Builds the sidebar, top header, and the #main-content region.
//   Also appends renderModal() output so modals overlay everything.
//
// getNav()
//   Returns the navigation items array for the current user's role.
//   Admin   → full 15-item nav (or sub-set for sub-admins)
//   Teacher → 7-item nav
//   Student → 8-item nav
//
// renderPage()
//   Router: calls renderAdminPage / renderTeacherPage / renderStudentPage
//   based on currentUser.role.
