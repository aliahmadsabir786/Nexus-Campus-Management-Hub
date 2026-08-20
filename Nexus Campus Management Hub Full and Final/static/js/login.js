/* ================================================================
   js/login.js  —  NEXus Solution CMS
   ----------------------------------------------------------------
   Reached only after a department (and, for Intermediate, a campus)
   has been chosen — see context.js.  The chosen context is shown here
   for confirmation and posted with the credentials, where the backend
   validates it against the account's own department/campus.
   ================================================================ */
function renderLogin(){
  const sampleT=contextIdSample('teacher'), sampleS=contextIdSample('student');
  const hints={
    admin:{h:"admin / admin123 (or sub-admin credentials)",i:"🛡️",l:"Admin"},
    teacher:{h:`Teacher ID (e.g. ${sampleT}) + your password`,i:"👨‍🏫",l:"Teacher"},
    student:{h:`Student ID (e.g. ${sampleS}) + your password`,i:"🎓",l:"Student"}
  };
  const ctxLbl=contextLabel();
  const backTo=appContext.campus?"backToCampusSelect()":"backToDepartments()";
  const backLbl=appContext.campus?"← Change campus":"← Change department";
  return `<div class="login-page">

  <!-- LEFT: green branding panel — hidden below 900px via CSS -->
  <div class="login-left">
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.06) 0%,transparent 60%)"></div>
    <div style="max-width:420px;width:100%;position:relative;z-index:1">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:52px">
        <div style="width:52px;height:52px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px">🎓</div>
        <div><div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:800;color:#fff">${esc(appContext.institution)}</div><div style="font-size:12px;color:rgba(255,255,255,.55);margin-top:1px">Campus Management Hub</div></div>
      </div>
      <div style="font-family:'Space Grotesk',sans-serif;font-size:38px;font-weight:800;color:#fff;line-height:1.15;margin-bottom:16px">Welcome<br>Back! 👋</div>
      <div style="font-size:15px;color:rgba(255,255,255,.65);line-height:1.8;margin-bottom:40px">Attendance · Grades · Fees · Reports · Assignments — all in one secure portal.</div>
      <div style="display:flex;flex-wrap:wrap;gap:9px;margin-bottom:44px">
        ${["📋 Attendance","📈 Grades","💳 Fees","📊 Reports","📝 Assignments","🕐 Timetable"].map(f=>`<span style="background:rgba(255,255,255,.1);color:rgba(255,255,255,.85);border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:5px 14px;font-size:12px;font-weight:600">${f}</span>`).join("")}
      </div>
      <!-- Chosen institution — confirmation only, the server re-validates it -->
      <div class="login-ctx-panel">
        <div class="login-ctx-mark">${appContext.campus?"🏫":"🎓"}</div>
        <div style="flex:1;min-width:0">
          <div class="login-ctx-name">${esc(appContext.departmentName||"")}</div>
          <div class="login-ctx-sub">${esc(appContext.campusName||"Single campus department")}</div>
        </div>
        <button type="button" class="login-ctx-change" onclick="${backTo}">Change</button>
      </div>
    </div>
  </div>

  <!-- RIGHT: login form — full width on mobile -->
  <div class="login-right">
    <div class="login-form-inner">
      <button type="button" class="select-back login-back" onclick="${backTo}">${backLbl}</button>
      <div style="margin-bottom:26px">
        ${ctxLbl?`<div style="margin-bottom:10px">${contextBadge()}</div>`:""}
        <div class="login-h1">Sign In</div>
        <div class="login-sub">Select your role and enter your credentials</div>
      </div>
      <div class="login-roles">
        ${["admin","teacher","student"].map(r=>`<button type="button" class="login-role${loginRole===r?" active":""}" onclick="switchLoginRole('${r}')"><span class="login-role-icon">${hints[r].i}</span>${hints[r].l}</button>`).join("")}
      </div>
      <div class="login-hint"><span>💡</span>${hints[loginRole].h}</div>
      <div style="margin-bottom:14px">
        <label class="login-label" for="l-uid">User ID</label>
        <input id="l-uid" class="login-input" type="text" placeholder="${loginRole==="admin"?"admin or sub-admin username":loginRole==="teacher"?`e.g. ${sampleT}`:`e.g. ${sampleS}`}" style="box-sizing:border-box"/>
      </div>
      <div style="margin-bottom:20px">
        <label class="login-label" for="l-pwd">Password</label>
        <input id="l-pwd" class="login-input" type="password" placeholder="Enter your password" style="box-sizing:border-box" onkeydown="if(event.key==='Enter')doLogin()"/>
      </div>
      ${loginErr?`<div class="login-err"><span>⚠️</span>${esc(loginErr)}</div>`:""}
      <button type="button" class="login-submit" onclick="doLogin()">Sign In →</button>
      <div class="login-foot">
        <button type="button" onclick="toggleDarkMode()" class="dark-toggle" title="Toggle Dark Mode">${_darkMode?'☀️':'🌙'}</button>
        <span>${esc(appContext.institution)} · 2025–26 Academic Year</span>
      </div>
    </div>
  </div>

</div>`;}

function switchLoginRole(r){loginRole=r;loginErr="";render();}

// ----------------------------------------------------------------
// doLogin() lives in api.js and is the ONLY implementation.
// The old offline/demo version that matched credentials against the
// seed arrays in data.js was removed: it authenticated in the browser
// and therefore carried no institution context, which would have been
// a way around the department/campus isolation (spec §14).
// ----------------------------------------------------------------

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
