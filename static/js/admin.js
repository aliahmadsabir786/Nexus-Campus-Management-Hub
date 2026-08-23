/* ================================================================
   js/admin.js  —  NEXus Solution CMS
   ================================================================ */
// ================================================================
// SECTION 10 — ADMIN PAGES
// ----------------------------------------------------------------
// renderAdminPage()   — switch on currentPage to pick sub-renderer.
// renderNoAccess()    — locked screen for sub-admins without permission.
// renderAdminDash()   — dashboard with KPI cards + charts.
// renderAdminStudents() — searchable student list + add/edit/delete.
// renderAdminTeachers() — teacher list + add/edit/delete.
// renderAttPage()     — attendance marking grid (shared admin+teacher).
// renderAdminExams()  — exam cards + add/delete.
// renderGrades()      — grades table (admin view = read-only summary).
// renderAdminFees()   — full fee management with installment plans.
// renderAdminAssignments() — admin overview of all assignments.
// renderAdminTT()     — timetable upload per teacher.
// renderAdminNotices()  — post and delete notices.
// renderAdminComplaints() — view all student complaints.
// renderReports()     — reports centre (attendance/grades/fees/performance).
// renderAdminPortals()  — grant/revoke student & teacher portal access.
// renderSubAdmins()   — create and manage sub-admin accounts.
// renderAdminSettings() — change admin password, college info.
// ================================================================
function renderAdminPage(){
  switch(currentPage){
    case "dashboard":   return renderAdminDash();
    // ── Class Management Module ──────────────────────────────
    case "academics":   return canAccess("classes")?renderAcademicModule():renderNoAccess();
    case "bs-academics": return (appContext.departmentCode==="BS"&&canAccess("classes"))?renderBSAcademicAdmin():renderNoAccess();
    // Legacy aliases — redirect to unified module
    case "classes":
    case "sections":
    case "cm-students": { setTimeout(()=>navTo('academics'),0); return renderAcademicModule(); }
    // ────────────────────────────────────────────────────────
    case "students":    return canAccess("students")?renderAdminStudents():renderNoAccess();
    case "teachers":    return canAccess("teachers")?renderAdminTeachers():renderNoAccess();
    case "attendance":  return canAccess("attendance")?renderAttPage(true):renderNoAccess();
    case "exams":       return canAccess("exams")?renderAdminExams():renderNoAccess();
    case "grades":      return canAccess("grades")?renderGrades(false):renderNoAccess();
    case "fees":        return canAccess("fees")?renderAdminFees():renderNoAccess();
    case "assignments": return canAccess("assignments")?renderAdminAssignments():renderNoAccess();
    case "timetable":   return canAccess("timetable")?renderAdminTT():renderNoAccess();
    case "notices":     return canAccess("notices")?renderAdminNotices():renderNoAccess();
    case "complaints":  return canAccess("complaints")?renderAdminComplaints():renderNoAccess();
    case "reports":     return canAccess("reports")?renderReports():renderNoAccess();
    case "portals":     return (!currentUser.isSubAdmin)?renderAdminPortals():renderNoAccess();
    case "subadmins":   return (!currentUser.isSubAdmin)?renderSubAdmins():renderNoAccess();
    case "settings":    return (!currentUser.isSubAdmin)?renderAdminSettings():renderNoAccess();
    default:            return renderAdminDash();
  }
}

function renderNoAccess(){
  return card(`<div style="text-align:center;padding:60px"><div style="font-size:56px;margin-bottom:16px">🔒</div><div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:20px;margin-bottom:10px;color:${T.red}">Access Restricted</div><div style="color:${T.muted};font-size:14px;line-height:1.6">You don't have permission to access this section.<br>Contact the main administrator.</div></div>`);
}

// ─── ADMIN DASHBOARD ───

/** Small empty state for a dashboard panel with nothing to plot yet. */
function dashEmpty(msg){
  return `<div style="text-align:center;padding:22px 8px;color:var(--muted);font-size:12.5px">${esc(msg)}</div>`;
}

/**
 * Dashboard context banner (spec §16).
 * Every figure on this page comes from one institution only, so the dashboard
 * names that institution instead of implying campus-wide totals. Built from
 * contextTitle() rather than a hard-coded label, so the same renderer serves
 * BS, Intermediate/Boys and Intermediate/Girls.
 */
function dashContextBanner(){
  const inst = appContext.title || appContext.departmentName || '';
  if (!inst) return '';
  return `<div class="dash-context">
    <div class="dash-context-mark">${appContext.campus?'🏫':'🎓'}</div>
    <div style="flex:1;min-width:0">
      <div class="dash-context-title">${esc(contextTitle())}</div>
      <div class="dash-context-sub">Every figure on this page is limited to this institution's records.</div>
    </div>
    <div class="dash-context-pill">Academic Year 2025–26</div>
  </div>`;
}

function renderAdminDash(){
  const tp=Object.values(attendance).filter(r=>r[today]==="present").length;
  const pc=students.filter(s=>s.feeStatus==="paid").length;
  const totalSubs=submissions.length;
  const pendingGrade=submissions.filter(s=>s.status==="submitted").length;
  // Classes of the CURRENT institution only: dbClasses comes from
  // /api/classes/dropdown, which the backend already scopes to the session's
  // department/campus (see contextClassCodes in context.js).
  const dashClasses=contextClassCodes();
  const classAttData=dashClasses.map(cls=>{const cs=students.filter(s=>s.cls===cls);const pres=cs.filter(s=>attendance[s.id]?.[today]==="present").length;return cs.length?Math.round(pres/cs.length*100):0;});
  const classGradeData=dashClasses.map(cls=>{const cs=students.filter(s=>s.cls===cls);const avgs=cs.map(s=>{const tots=SUBJECTS.slice(0,5).map(sub=>grades[s.id]?.[sub]?.total||0);return tots.length?Math.round(tots.reduce((a,b)=>a+b,0)/tots.length):0;});return avgs.length?Math.round(avgs.reduce((a,b)=>a+b,0)/avgs.length):0;});
  const campusAtt=weekDays.map(d=>{const pres=students.filter(s=>attendance[s.id]?.[d]==="present").length;return students.length?Math.round(pres/students.length*100):0;});
  const dayLabels=weekDays.map(d=>new Date(d).toLocaleDateString("en",{weekday:"short"}));
  scheduleChart(()=>drawLineChart('campusAttChart',dayLabels,[{label:'Campus Attendance %',data:campusAtt,color:T.accent}]),'campusAttChart');
  scheduleChart(()=>drawBarChart('classCompChart',dashClasses,[{label:'Attendance %',data:classAttData,color:T.accent},{label:'Avg Grade %',data:classGradeData.map(v=>Math.round((v/175)*100)),color:T.purple}],{maxVal:100}),'classCompChart');
  const clsLabel=dashClasses.length?`${dashClasses.length} ${dashClasses.length===1?"class":"classes"}`:"No classes yet";
  return `
  ${currentUser.isSubAdmin?`<div style="background:${T.yellowL};border:1px solid #fcd34d;border-radius:12px;padding:12px 18px;margin-bottom:18px;display:flex;gap:10px;align-items:center"><span style="font-size:18px">👥</span><div><strong style="color:${T.yellow}">Sub-Admin Access:</strong><span style="font-size:13px;color:${T.yellow};margin-left:6px">Permissions: ${(currentUser.permissions||[]).join(", ") || "None"}</span></div></div>`:""}
  <!-- Institution the figures below belong to (spec §16) -->
  ${dashContextBanner()}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:24px">
    ${statCard("🎓",students.length,"Total Students",T.accent,clsLabel)}
    ${statCard("👨‍🏫",teachers.length,"Teachers",T.purple,`${teachers.filter(t=>t.portal!=="blocked").length} active`)}
    ${statCard("✅",tp,"Present Today",T.green,`${students.length-tp} absent`)}
    ${statCard("💳",`${pc}/${students.length}`,"Fee Paid",T.yellow,`${students.filter(s=>s.feeStatus==="overdue").length} overdue`)}
    ${statCard("📎",assignments.length,"Assignments",T.blue,`${pendingGrade} pending grade`)}
    ${statCard("⚠️",complaints.length,"Complaints",T.red,"Pending")}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px">
    ${card(`${secTitle("📊 Campus Attendance This Week")}<canvas id="campusAttChart" width="480" height="200" style="width:100%;height:200px"></canvas>`)}
    ${card(`${secTitle("📈 Class Attendance vs Grades Today")}<canvas id="classCompChart" width="480" height="200" style="width:100%;height:200px"></canvas>`)}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px">
    ${card(`${secTitle("🏫 Attendance by Class (Today)")}<div style="display:grid;gap:10px;margin-top:4px">${dashClasses.length?dashClasses.map((cls,i)=>{const pct=classAttData[i];const col=pct>=80?T.green:pct>=60?T.yellow:T.red;return `<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span style="font-weight:700">${esc(cls)}</span><span style="color:${col};font-weight:700">${pct}%</span></div>${pbar(pct,col)}</div>`;}).join(""):dashEmpty("No classes in this institution yet")}</div>`)}
    ${card(`${secTitle("📚 Average Grade by Class")}<div style="display:grid;gap:10px;margin-top:4px">${dashClasses.length?dashClasses.map((cls,i)=>{const avg=classGradeData[i];const col=gradeColor(avg);return `<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span style="font-weight:700">${esc(cls)}</span><span style="color:${col};font-weight:700">${avg}/175 · ${gradeLabel(avg)}</span></div>${pbar((avg/175)*100,col)}</div>`;}).join(""):dashEmpty("No classes in this institution yet")}</div>`)}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
    ${card(`${secTitle("📢 Recent Notices")}${notices.slice(0,4).map(n=>`<div style="border-bottom:1px solid ${T.border};padding-bottom:10px;margin-bottom:10px"><div style="font-size:13px;font-weight:600;margin-bottom:5px">${esc(n.title)}</div><div style="display:flex;gap:8px">${badge(n.type)}<span style="font-size:11px;color:${T.muted}">${n.date}</span></div></div>`).join("")}`)}
    ${card(`${secTitle("📈 Fee Overview")}${["paid","pending","overdue"].map(st=>{const cnt=students.filter(s=>s.feeStatus===st).length;const pct=students.length?Math.round(cnt/students.length*100):0;const col={paid:T.green,pending:T.yellow,overdue:T.red}[st];return `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span style="font-weight:600;text-transform:capitalize">${st}</span><span style="color:${col};font-weight:700">${cnt} students (${pct}%)</span></div>${pbar(pct,col)}</div>`;}).join("")}`)}
  </div>`;
}

// ─── SUB-ADMINS MANAGEMENT ───
function renderSubAdmins(){
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px">
    ${secTitle("👥 Sub-Admin Management")}
    ${pbtn("+ Add Sub-Admin","openModal('addSubAdmin')")}
  </div>

  <!-- Info Banner -->
  <div style="background:${T.blueL};border:1px solid #bfdbfe;border-radius:12px;padding:14px 18px;margin-bottom:20px;display:flex;gap:12px;align-items:flex-start">
    <span style="font-size:20px">ℹ️</span>
    <div><div style="font-weight:700;color:${T.blue};font-size:13px;margin-bottom:4px">About Sub-Admins</div>
    <div style="font-size:12px;color:${T.blue};line-height:1.7">Sub-admins can log in using the <strong>Admin</strong> role tab with their username & password. They only see the sections you grant them access to. The full admin (admin/admin123) always has complete access.</div></div>
  </div>

  ${subAdmins.length===0?card(`<div style="text-align:center;padding:56px;color:${T.muted}"><div style="font-size:56px;margin-bottom:14px">👥</div><div style="font-weight:700;font-size:16px">No sub-admins yet</div><div style="font-size:13px;margin-top:8px">Create sub-admins with limited portal access</div></div>`):
  `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
    ${subAdmins.map(sa=>`<div class="card-hover" style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow};border-top:3px solid ${T.purple}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:44px;height:44px;border-radius:12px;background:${T.purpleL};display:flex;align-items:center;justify-content:center;font-size:20px">👤</div>
          <div>
            <div style="font-weight:800;font-size:14px">${esc(sa.name)}</div>
            <div style="font-size:12px;color:${T.muted};margin-top:1px">@${esc(sa.username)}</div>
          </div>
        </div>
        ${badge(sa.portal)}
      </div>
      <div style="background:${T.bg};border-radius:10px;padding:12px;margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Permissions (${sa.permissions.length}/${SUB_ADMIN_PERMS.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          ${SUB_ADMIN_PERMS.map(p=>`<span style="background:${sa.permissions.includes(p.key)?T.purpleL:"#f1f5f9"};color:${sa.permissions.includes(p.key)?T.purple:T.muted};border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;border:1px solid ${sa.permissions.includes(p.key)?"#c4b5fd":"#e2e8f0"}">${p.label.split(" ")[0]} ${p.label.replace(/^[^ ]+ /,"")}</span>`).join("")}
        </div>
      </div>
      <div style="font-size:11px;color:${T.muted};margin-bottom:12px">📅 Created: ${sa.createdAt}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${obtn("✏️ Edit",`openEditSubAdmin('${sa.id}')`, "sm")}
        ${sa.portal==="active"?wbtn("🔒 Revoke",`toggleSubAdmin('${sa.id}')`, "sm"):sbtn("✅ Activate",`toggleSubAdmin('${sa.id}')`, "sm")}
        ${dbtn("🗑️ Delete",`delSubAdmin('${sa.id}')`, "sm")}
      </div>
    </div>`).join("")}
  </div>`}`;
}

// ─── ADMIN SETTINGS ───
function renderAdminSettings(){
  return `${secTitle("⚙️ Admin Settings")}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

    <!-- Change Admin Password -->
    ${card(`<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div style="width:48px;height:48px;background:${T.accentL};border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px">🔑</div>
      <div><div style="font-weight:800;font-size:15px">Change Admin Password</div><div style="font-size:12px;color:${T.muted};margin-top:2px">Update the main administrator login password</div></div>
    </div>
    <div style="background:${T.yellowL};border:1px solid #fcd34d;border-radius:10px;padding:11px 14px;font-size:12px;color:${T.yellow};margin-bottom:18px;font-weight:600;display:flex;gap:8px;align-items:center"><span>⚠️</span>This changes the password for the main admin account (username: admin)</div>
    ${fld("Current Password","s-curpwd","","password",null,"Enter current password")}
    ${fld("New Password","s-newpwd","","password",null,"Minimum 6 characters")}
    ${fld("Confirm New Password","s-confpwd","","password",null,"Re-enter new password")}
    <button onclick="changeAdminPassword()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;box-shadow:0 2px 8px rgba(5,150,105,.3)">🔑 Update Password</button>
    <div id="admin-pwd-msg" style="margin-top:10px;font-size:13px;text-align:center"></div>`)}

    <!-- System Info -->
    ${card(`<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div style="width:48px;height:48px;background:${T.blueL};border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px">ℹ️</div>
      <div><div style="font-weight:800;font-size:15px">System Information</div><div style="font-size:12px;color:${T.muted};margin-top:2px">Current system status</div></div>
    </div>
    <div style="display:grid;gap:10px">
      ${[["👨‍🎓 Total Students",students.length],["👨‍🏫 Total Teachers",teachers.length],["📎 Total Assignments",assignments.length],["📋 Total Submissions",submissions.length],["👥 Sub-Admins",subAdmins.length],["⚠️ Complaints",complaints.length]].map(([l,v])=>`<div style="display:flex;justify-content:space-between;background:${T.bg};border-radius:10px;padding:11px 14px;border:1px solid ${T.border}"><span style="font-size:13px;color:${T.muted};font-weight:600">${l}</span><span style="font-weight:800;font-size:14px;color:${T.text}">${v}</span></div>`).join("")}
    </div>`)}
  </div>`;
}

/*
 * Admin password change — Settings page.
 * Delegates to POST /api/settings/admin-password (routes/admin.py), which
 * verifies the current password against the stored hash in admin_config and
 * writes a new one.  The previous version only reassigned a JavaScript
 * variable, so the "updated" message was not true after a reload.
 */
async function changeAdminPassword(){
  const cur=document.getElementById("s-curpwd")?.value||"";
  const n=document.getElementById("s-newpwd")?.value||"";
  const c=document.getElementById("s-confpwd")?.value||"";
  const msg=document.getElementById("admin-pwd-msg");
  if(!cur||!n||!c){msg.innerHTML=`<span style="color:${T.red}">Please fill all fields.</span>`;return;}
  if(n.length<6){msg.innerHTML=`<span style="color:${T.red}">New password must be at least 6 characters.</span>`;return;}
  if(n!==c){msg.innerHTML=`<span style="color:${T.red}">New passwords do not match.</span>`;return;}

  msg.innerHTML=`<span style="color:${T.muted}">Updating…</span>`;
  try{
    const res=await fetch("/api/settings/admin-password",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({currentPassword:cur,newPassword:n,confirmPassword:c}),
    });
    const data=await res.json();
    if(!res.ok||!data.success){
      msg.innerHTML=`<span style="color:${T.red}">${esc(data.error||"Could not update password.")}</span>`;
      return;
    }
    msg.innerHTML=`<span style="color:${T.green};font-weight:700">✅ Password updated successfully!</span>`;
    document.getElementById("s-curpwd").value="";document.getElementById("s-newpwd").value="";document.getElementById("s-confpwd").value="";
  }catch(e){
    msg.innerHTML=`<span style="color:${T.red}">Server error. Please try again.</span>`;
  }
}

// ─── STUDENTS ───
function renderAdminStudents(){
  const filtS=students.filter(s=>s.name.toLowerCase().includes(searchQuery.toLowerCase())||s.id.toLowerCase().includes(searchQuery.toLowerCase()));
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:12px;flex-wrap:wrap">
    <div style="position:relative"><span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px">🔍</span><input id="student-search-input" value="${esc(searchQuery)}" oninput="handleSearch(this.value)" placeholder="Search students..." style="background:#fff;border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px 9px 36px;font-size:13px;outline:none;width:260px;font-family:'Plus Jakarta Sans',sans-serif"/></div>
    ${pbtn("+ Add Student","openModal('addStudent')")}
  </div>
  ${card(tblHtml(["ID","Name","Class","Roll#","Phone","Guardian","Fee","Portal","Actions"],filtS.map(s=>[
    `<span style="color:${T.accent};font-weight:800;font-family:'Space Grotesk',sans-serif">${s.id}</span>`,
    `<div style="display:flex;align-items:center;gap:8px">${ava(s.name,28,s.photo||null)}<span style="font-weight:700">${esc(s.name)}</span></div>`,
    `<span style="background:${T.accentL};color:${T.accentD};border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700">${s.cls}</span>`,
    s.rollNo,s.phone,s.guardianPhone,badge(s.feeStatus),badge(s.portal),
    `<div style="display:flex;gap:6px">${obtn("View",`viewStudent('${s.id}')`, "sm")}${obtn("Edit",`openEditStudent('${s.id}')`, "sm")}${dbtn("Del",`confirmDelStudent('${s.id}')`, "sm")}</div>`
  ])),"",0)}`;}

function renderAdminTeachers(){
  const filtT=teachers.filter(t=>t.name.toLowerCase().includes(searchQuery.toLowerCase())||t.id.toLowerCase().includes(searchQuery.toLowerCase()));
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:12px;flex-wrap:wrap">
    <div style="position:relative"><span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px">🔍</span><input id="teacher-search-input" value="${esc(searchQuery)}" oninput="handleSearch(this.value)" placeholder="Search teachers..." style="background:#fff;border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px 9px 36px;font-size:13px;outline:none;width:260px;font-family:'Plus Jakarta Sans',sans-serif"/></div>
    ${pbtn("+ Add Teacher","openModal('addTeacher')")}
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px">
    ${filtT.map(t=>`<div class="card-hover" style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow}">
      <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:16px">${ava(t.name,46,t.photo||null)}<div style="flex:1"><div style="font-weight:700;font-size:14px">${esc(t.name)}</div><div style="font-size:12px;color:${T.accent};font-weight:600;margin-top:2px">${t.subject}</div><div style="font-size:11px;color:${T.muted}">${t.dept}</div></div>${badge(t.portal)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;background:${T.bg};border-radius:10px;padding:12px">${[["ID",t.id],["Qual.",t.qualification],["Phone",t.phone],["Joined",t.joinDate]].map(([k,v])=>`<div><div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase">${k}</div><div style="font-size:12px;margin-top:2px;font-weight:600">${esc(v)}</div></div>`).join("")}</div>
      <div style="display:flex;gap:8px">${obtn("Edit",`openEditTeacher('${t.id}')`, "sm")}${dbtn("Remove",`delTeacher('${t.id}')`, "sm")}${timetables[t.id]?`<button onclick="window.open(timetables['${t.id}'].data)" style="background:${T.accentL};color:${T.accent};border:1px solid ${T.border2};border-radius:10px;padding:5px 13px;font-size:12px;font-weight:700;cursor:pointer">View TT</button>`:""}</div>
    </div>`).join("")}
  </div>`;}

function renderAttPage(isAdmin){
  // ── Effective class list: DB-backed preferred, fallback to student cls strings ──
  const effCls = (window.dbClasses && window.dbClasses.length)
    ? window.dbClasses
    : [...new Set(students.map(s=>s.cls).filter(Boolean))].sort().map(c=>({id:c,name:c,code:c}));

  // ── Auto-select first class if nothing selected ──
  if (effCls.length && !attFilter.class_id && !attFilter.cls) {
    attFilter.class_id = effCls[0].id;
    attFilter.cls = effCls[0].code || effCls[0].name;
  }

  // ── Filter students ──
  const cs = attFilter.class_id && window.dbClasses && window.dbClasses.length
    ? students.filter(s => s.class_id === attFilter.class_id || s.classId === attFilter.class_id)
    : students.filter(s => s.cls === attFilter.cls);

  // ── Class dropdown options ──
  const classOptions = effCls.map(c => {
    const sel = (window.dbClasses && window.dbClasses.length)
      ? c.id === attFilter.class_id
      : (c.code||c.name) === attFilter.cls;
    return `<option value="${c.id}" data-cls="${c.code||c.name}" ${sel?'selected':''}>${c.name}${c.code&&c.code!==c.name?' ('+c.code+')':''}</option>`;
  }).join('');

  // ── Section dropdown ──
  const relevantSections = (window.dbSections||[]).filter(s => s.classId === attFilter.class_id);
  const sectionDropdown = relevantSections.length ? `
    <div><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase">Section</label>
    <select onchange="attFilter.section_id=this.value?parseInt(this.value):null;refreshContent()" style="background:#fff;border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
      <option value="">All Sections</option>
      ${relevantSections.map(s=>`<option value="${s.id}" ${s.id===attFilter.section_id?'selected':''}>${s.name}</option>`).join('')}
    </select></div>` : '';

  return `${isAdmin?"":secTitle("Mark Attendance")}
  <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:flex-end">
    <div><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase">Class</label>
    <select onchange="
      const sel=this.options[this.selectedIndex];
      attFilter.class_id=parseInt(this.value)||null;
      attFilter.cls=sel.dataset.cls||this.value;
      attFilter.section_id=null;
      refreshContent()
    " style="background:#fff;border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
      ${classOptions}
    </select></div>
    ${sectionDropdown}
    <div><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase">Date</label><input type="date" value="${attFilter.date}" onchange="attFilter.date=this.value;refreshContent()" style="background:#fff;border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif"/></div>
    ${sbtn("✅ All Present","bulkAtt('present')")}${dbtn("❌ All Absent","bulkAtt('absent')")}
  </div>
  <div style="display:grid;gap:10px">${cs.map(s=>{
    const st=attendance[s.id]?.[attFilter.date]||"absent";
    const sc={present:T.green,absent:T.red,late:T.yellow}[st];
    return `<div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:14px 18px;box-shadow:${T.shadow};display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;border-left:4px solid ${sc}">
      <div style="display:flex;align-items:center;gap:12px">${ava(s.name,38)}<div><div style="font-weight:700;font-size:14px">${esc(s.name)}</div><div style="font-size:11px;color:${T.muted}">Roll# ${s.rollNo} · ${s.cls}</div></div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${badge(st)}${["present","absent","late"].map(opt=>`<button onclick="markAtt('${s.id}','${opt}')" style="background:${st===opt?(opt==="present"?T.greenL:opt==="absent"?T.redL:T.yellowL):"#fff"};color:${st===opt?(opt==="present"?T.green:opt==="absent"?T.red:T.yellow):T.muted};border:1.5px solid ${st===opt?(opt==="present"?T.green:opt==="absent"?T.red:T.yellow):T.border};border-radius:8px;padding:5px 12px;cursor:pointer;font-weight:700;font-size:11px;font-family:'Plus Jakarta Sans',sans-serif;text-transform:capitalize">${opt}</button>`).join("")}${!isAdmin?dbtn("⚠️",`openComplaint('${s.id}')`, "sm"):""}</div>
    </div>`;}).join("")}
  </div>`;}


function renderAdminExams(){
  return `<div style="display:flex;justify-content:flex-end;margin-bottom:18px">${pbtn("+ Schedule Exam","openModal('addExam')")}</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
    ${exams.map(e=>`<div class="card-hover" style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow};border-top:3px solid ${T.accent}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px"><div><div style="font-weight:800;font-size:15px;font-family:'Space Grotesk',sans-serif">${esc(e.title)}</div><div style="font-size:13px;color:${T.accent};font-weight:600;margin-top:3px">${esc(e.subject)}</div></div><span style="background:${T.accentL};color:${T.accentD};border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700">${e.cls}</span></div>
      <div style="background:${T.bg};border-radius:10px;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">${[["📅 Date",e.date],["🕐 Time",e.time],["⏱ Duration",e.duration],["🚪 Room",e.room],["📝 Marks",String(e.totalMarks)]].map(([k,v])=>`<div><div style="font-size:10px;color:${T.muted};font-weight:700">${k}</div><div style="font-size:12px;font-weight:700;margin-top:2px">${esc(v)}</div></div>`).join("")}</div>
      ${dbtn("Remove",`delExam('${e.id}')`, "sm")}
    </div>`).join("")}
  </div>`;}

function renderGrades(editable){
  const cs=students.filter(s=>s.cls===gradesFilter.cls);
  // Collect all unique subjects for the displayed students
  const groupSubjects=["English","Urdu","Islamiyat","Biology","Physics","Chemistry","Mathematics","Computer Science"];
  return `<div style="margin-bottom:16px"><select onchange="gradesFilter.cls=this.value;refreshContent()" style="background:#fff;border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">${contextClassCodes().map(c=>`<option value="${c}" ${c===gradesFilter.cls?"selected":""}>${c}</option>`).join("")}</select></div>
  ${card(`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:600px">
    <thead><tr style="border-bottom:2px solid ${T.border}">
      <th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2}">Student</th>
      <th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2}">Group</th>
      <th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2}">Subjects & Marks</th>
      <th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2}">Grade</th>
    </tr></thead>
    <tbody>${cs.map((s,i)=>{
      const subs=SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||[];
      const mg=grades[s.id]||{};
      const tots=subs.map(sub=>mg[sub]?.total||0);
      const total=tots.reduce((a,b)=>a+b,0);
      const avg=subs.length?Math.round(total/subs.length):0;
      const subsDisplay=subs.map(sub=>{
        const g=mg[sub];
        return `<span style="display:inline-block;background:${g?gradeColor(g.total)+"15":"#f1f5f9"};border:1px solid ${g?gradeColor(g.total)+"40":T.border};border-radius:6px;padding:2px 8px;font-size:10px;margin:2px;font-weight:700;color:${g?gradeColor(g.total):T.muted}">${sub.split(" ")[0]}${g?":"+g.total:""}</span>`;
      }).join("");
      return `<tr style="border-bottom:1px solid ${T.border};background:${i%2?"#f9fffe":"#fff"}">
        <td style="padding:10px 14px;font-weight:700;font-size:13px">${esc(s.name)}</td>
        <td style="padding:10px 14px;font-size:11px"><span style="background:${T.accentL};color:${T.accentD};border-radius:12px;padding:2px 8px;font-weight:700">${s.subjectGroup||"CS"}</span></td>
        <td style="padding:8px 14px">${subsDisplay}</td>
        <td style="padding:10px 14px;text-align:center"><span style="background:${alpha(gradeColor(avg),13)};color:${gradeColor(avg)};border-radius:20px;padding:3px 12px;font-weight:800;font-size:12px">${gradeLabel(avg)}</span></td>
      </tr>`;}).join("")}
    </tbody></table></div>`,"",0)}`;
}

function renderAdminFees(){
  const paid=students.filter(s=>s.feeStatus==="paid").length;
  const pending=students.filter(s=>s.feeStatus==="pending").length;
  const overdue=students.filter(s=>s.feeStatus==="overdue").length;
  const partial=students.filter(s=>s.feeStatus==="partial").length;
  const totalCollected=Object.values(feeInstallments).reduce((acc,plan)=>acc+(plan.installments||[]).filter(i=>i.status==="paid").reduce((s,i)=>s+i.amount,0),0);

  // ── FILTER BAR ──────────────────────────────────────────────────
  const feeFilterBar=`
  <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:14px 18px;margin-bottom:18px;display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;box-shadow:${T.shadow}">
    <div style="position:relative;flex:1;min-width:200px">
      <span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:14px;pointer-events:none">🔍</span>
      <input id="fee-search-input" type="text" value="${esc(feeFilter.search)}" oninput="handleFeeSearch(this.value)" placeholder="Search by name or ID…"
        style="width:100%;box-sizing:border-box;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 12px 9px 34px;font-size:13px;color:${T.text};outline:none;font-family:'Plus Jakarta Sans',sans-serif"/>
    </div>
    <div>
      <label style="font-size:10px;color:${T.muted};display:block;margin-bottom:4px;font-weight:700;text-transform:uppercase">Class</label>
      <select onchange="feeFilter.cls=this.value;refreshContent()" style="background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        <option value="ALL" ${feeFilter.cls==="ALL"?"selected":""}>All Classes</option>
        ${contextClassCodes().map(cl=>`<option value="${cl}" ${feeFilter.cls===cl?"selected":""}>${cl}</option>`).join("")}
      </select>
    </div>
    <div>
      <label style="font-size:10px;color:${T.muted};display:block;margin-bottom:4px;font-weight:700;text-transform:uppercase">Status</label>
      <select onchange="feeFilter.status=this.value;refreshContent()" style="background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        <option value="ALL"     ${feeFilter.status==="ALL"?"selected":""}>All Status</option>
        <option value="paid"    ${feeFilter.status==="paid"?"selected":""}>✅ Paid</option>
        <option value="partial" ${feeFilter.status==="partial"?"selected":""}>🔄 Partial</option>
        <option value="pending" ${feeFilter.status==="pending"?"selected":""}>⏳ Pending</option>
        <option value="overdue" ${feeFilter.status==="overdue"?"selected":""}>🚨 Overdue</option>
        <option value="noPlan"  ${feeFilter.status==="noPlan"?"selected":""}>📋 No Plan</option>
      </select>
    </div>
    ${(feeFilter.cls!=="ALL"||feeFilter.status!=="ALL"||feeFilter.search.trim())
      ?`<button onclick="feeFilter={cls:'ALL',status:'ALL',search:''};refreshContent()" style="background:${T.redL};color:${T.red};border:1px solid #fca5a5;border-radius:10px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer">✕ Clear</button>`
      :""}
  </div>`;

  // ── STATS (clicking a stat filters by that status) ───────────────
  const statsHtml=`<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:14px">
    <div onclick="feeFilter={cls:'ALL',status:'paid',search:''};refreshContent()" style="background:${T.surface};border:1px solid ${feeFilter.status==='paid'?T.green:T.border};border-radius:14px;padding:18px;text-align:center;border-top:3px solid ${T.green};box-shadow:${T.shadow};cursor:pointer">
      <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:6px">✅ Paid</div>
      <div style="font-size:28px;font-weight:800;color:${T.green};font-family:'Space Grotesk',sans-serif">${paid}</div></div>
    <div onclick="feeFilter={cls:'ALL',status:'partial',search:''};refreshContent()" style="background:${T.surface};border:1px solid ${feeFilter.status==='partial'?T.orange:T.border};border-radius:14px;padding:18px;text-align:center;border-top:3px solid ${T.orange};box-shadow:${T.shadow};cursor:pointer">
      <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:6px">🔄 Partial</div>
      <div style="font-size:28px;font-weight:800;color:${T.orange};font-family:'Space Grotesk',sans-serif">${partial}</div></div>
    <div onclick="feeFilter={cls:'ALL',status:'pending',search:''};refreshContent()" style="background:${T.surface};border:1px solid ${feeFilter.status==='pending'?T.yellow:T.border};border-radius:14px;padding:18px;text-align:center;border-top:3px solid ${T.yellow};box-shadow:${T.shadow};cursor:pointer">
      <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:6px">⏳ Pending</div>
      <div style="font-size:28px;font-weight:800;color:${T.yellow};font-family:'Space Grotesk',sans-serif">${pending}</div></div>
    <div onclick="feeFilter={cls:'ALL',status:'overdue',search:''};refreshContent()" style="background:${T.surface};border:1px solid ${feeFilter.status==='overdue'?T.red:T.border};border-radius:14px;padding:18px;text-align:center;border-top:3px solid ${T.red};box-shadow:${T.shadow};cursor:pointer">
      <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:6px">🚨 Overdue</div>
      <div style="font-size:28px;font-weight:800;color:${T.red};font-family:'Space Grotesk',sans-serif">${overdue}</div></div>
    <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:18px;text-align:center;border-top:3px solid ${T.accent};box-shadow:${T.shadow}">
      <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:6px">💰 Collected</div>
      <div style="font-size:16px;font-weight:800;color:${T.accent};font-family:'Space Grotesk',sans-serif">PKR ${totalCollected.toLocaleString()}</div></div>
  </div>`;

  // ── APPLY FILTERS ────────────────────────────────────────────────
  const q=(feeFilter.search||"").toLowerCase().trim();
  const visibleStudents=students.filter(s=>{
    if(feeFilter.cls!=="ALL"&&s.cls!==feeFilter.cls)return false;
    if(feeFilter.status==="noPlan"&&feeInstallments[s.id])return false;
    if(feeFilter.status!=="ALL"&&feeFilter.status!=="noPlan"&&s.feeStatus!==feeFilter.status)return false;
    if(q&&!s.name.toLowerCase().includes(q)&&!s.id.toLowerCase().includes(q)&&!s.cls.toLowerCase().includes(q))return false;
    return true;
  });

  const planCards=visibleStudents.map(s=>{
    const plan=feeInstallments[s.id];
    const paidCount=plan?(plan.installments||[]).filter(i=>i.status==="paid").length:0;
    const borderCol=!plan?T.border:paidCount===3?T.green:paidCount>0?T.orange:T.yellow;
    return `<div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow};border-left:4px solid ${borderCol}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        ${ava(s.name,38,s.photo||null)}
        <div style="flex:1"><div style="font-weight:800;font-size:14px">${esc(s.name)}</div><div style="font-size:11px;color:${T.muted}">${s.id} · ${s.cls}${s.subjectGroup?` · ${s.subjectGroup}`:""}</div></div>
        ${badge(s.feeStatus)}
      </div>
      ${plan?`
        <div style="background:${T.bg};border-radius:10px;padding:10px 12px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:${T.muted};margin-bottom:6px">
            <span>Total: <strong style="color:${T.text}">PKR ${plan.totalFee.toLocaleString()}</strong> · Session: ${plan.session||"—"}</span>
            <span style="font-weight:700;color:${paidCount===3?T.green:T.orange}">${paidCount}/3 paid</span>
          </div>
          ${pbar(Math.round(paidCount/3*100),paidCount===3?T.green:T.orange)}
        </div>
        <div style="display:grid;gap:7px;margin-bottom:12px">
          ${(plan.installments||[]).map(inst=>{
            const iCol={paid:T.green,pending:T.yellow,overdue:T.red}[inst.status]||T.muted;
            return `<div style="background:${alpha(iCol,7)};border:1px solid ${alpha(iCol,21)};border-radius:10px;padding:10px 12px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px">
                <div>
                  <div style="font-size:12px;font-weight:700;color:${T.text}">Installment ${inst.no} &nbsp;·&nbsp; <span style="color:${T.accent}">PKR ${inst.amount.toLocaleString()}</span></div>
                  <div style="font-size:10px;color:${T.muted};margin-top:2px">📄 ${inst.voucherNo} &nbsp;|&nbsp; Due: ${inst.dueDate}</div>
                  ${inst.status==="paid"?`<div style="font-size:10px;color:${T.green};font-weight:700;margin-top:2px">✅ Paid ${inst.paidDate} · ${inst.receiptNo||""}</div>`:""}
                </div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
                  ${badge(inst.status,"sm")}
                  ${inst.status!=="paid"?`<button onclick="printFeeVoucher('${s.id}',${inst.no})" title="Print Voucher" style="background:${T.blueL};color:${T.blue};border:1px solid #bfdbfe;border-radius:7px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">🖨️ Voucher</button>`:""}
                  ${inst.status!=="paid"?`<button onclick="markInstallmentPaid('${s.id}',${inst.no})" style="background:${T.greenL};color:${T.green};border:1px solid #86efac;border-radius:7px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">✅ Mark Paid</button>`:""}
                  ${inst.status==="pending"?`<button onclick="setInstallmentOverdue('${s.id}',${inst.no})" style="background:${T.redL};color:${T.red};border:1px solid #fca5a5;border-radius:7px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">🚨</button>`:""}
                  ${inst.status==="paid"?`<button onclick="printInstallmentReceipt('${s.id}',${inst.no})" style="background:${T.purpleL};color:${T.purple};border:1px solid #c4b5fd;border-radius:7px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">🧾 Receipt</button>`:""}
                  ${inst.status==="paid"?`<button onclick="revertInstallmentPaid('${s.id}',${inst.no})" title="Revert" style="background:${T.yellowL};color:${T.yellow};border:1px solid #fcd34d;border-radius:7px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">↩️</button>`:""}
                </div>
              </div>
            </div>`;}).join("")}
        </div>
        <div style="display:flex;gap:8px">${obtn("✏️ Edit Plan",`openEditFeePlan('${s.id}')`, "sm")}${dbtn("🗑️ Remove",`removeFeePlan('${s.id}')`, "sm")}</div>
      `:`
        <div style="background:${T.bg};border-radius:10px;padding:12px;text-align:center;font-size:12px;color:${T.muted};margin-bottom:12px;border:1px dashed ${T.border2}">No fee plan yet</div>
        ${pbtn("+ Create 3-Installment Plan",`openCreateFeePlan('${s.id}')`, "sm")}
      `}
    </div>`;
  }).join("");

  const noResults=visibleStudents.length===0?`<div style="text-align:center;padding:60px;color:${T.muted};background:${T.surface};border:1px solid ${T.border};border-radius:16px;box-shadow:${T.shadow}"><div style="font-size:48px;margin-bottom:14px">🔍</div><div style="font-weight:700;font-size:16px">No students match</div><div style="font-size:13px;margin-top:6px">Try adjusting class, status, or search term</div></div>`:"";
  const countInfo=visibleStudents.length!==students.length?`<div style="font-size:12px;color:${T.muted};margin-bottom:12px;font-weight:600">Showing ${visibleStudents.length} of ${students.length} students</div>`:"";

  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
    ${secTitle("💳 Fee Management — 3 Installments")}${pbtn("📊 Fee Report","openModal('feeReport')")}
  </div>
  ${statsHtml}
  ${feeFilterBar}
  ${countInfo}
  ${noResults||`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">${planCards}</div>`}`;
}

function renderAdminAssignments(){
  return `${secTitle("Assignments Overview")}
  ${assignments.length===0?card(`<div style="text-align:center;padding:48px;color:${T.muted}"><div style="font-size:48px;margin-bottom:12px">📎</div><div style="font-weight:700">No assignments yet</div><div style="font-size:13px;margin-top:6px">Teachers post assignments from their portal</div></div>`):
  `<div style="display:grid;gap:12px">${assignments.map(a=>{const subs=submissions.filter(s=>s.assignmentId===a.id);const graded=subs.filter(s=>s.status==="graded").length;return `<div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:20px;box-shadow:${T.shadow};border-left:4px solid ${T.blue}"><div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px"><div><div style="font-weight:700;font-size:15px;margin-bottom:4px">${esc(a.title)}</div><div style="font-size:12px;color:${T.muted};margin-bottom:8px">📚 ${a.subject} · 🏫 ${a.cls} · 👨‍🏫 ${esc(a.teacherName)}</div><div style="display:flex;gap:8px;align-items:center"><span style="font-size:12px;color:${T.muted}">📅 Due: ${a.dueDate}</span><span style="font-size:12px;background:${T.blueL};color:${T.blue};border-radius:20px;padding:2px 10px;font-weight:700">${subs.length} submitted</span><span style="font-size:12px;background:${T.greenL};color:${T.green};border-radius:20px;padding:2px 10px;font-weight:700">${graded} graded</span></div></div></div></div>`;}).join("")}</div>`}`;}

function renderAdminTT(){
  return `${secTitle("Upload Teacher Timetables")}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px">
    ${teachers.map(t=>`<div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">${ava(t.name,40)}<div><div style="font-weight:700;font-size:14px">${esc(t.name)}</div><div style="font-size:11px;color:${T.accent};font-weight:600">${t.subject}</div></div></div>
      ${timetables[t.id]?`<div style="background:${T.accentL};border:1px solid ${T.border2};border-radius:10px;padding:10px 12px;margin-bottom:12px"><div style="font-size:12px;font-weight:600;color:${T.accent}">📎 ${esc(timetables[t.id].name)}</div><div style="font-size:11px;color:${T.muted};margin-top:2px">Uploaded: ${timetables[t.id].uploadedAt}</div></div>`:`<div style="background:${T.bg};border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:${T.muted}">No timetable uploaded yet</div>`}
      <label style="display:block;cursor:pointer"><input type="file" accept=".pdf,.xlsx,.csv,.jpg,.png" style="display:none" onchange="uploadTT('${t.id}',this)"/><span style="display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border-radius:10px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer">📤 ${timetables[t.id]?"Re-upload":"Upload"}</span></label>
    </div>`).join("")}
  </div>`;}

function renderAdminNotices(){
  const cmap={holiday:T.orange,academic:T.blue,event:T.green,fee:T.yellow};
  return `<div style="display:flex;justify-content:flex-end;margin-bottom:18px">${pbtn("+ Post Notice","openModal('addNotice')")}</div>
  <div style="display:grid;gap:12px">${notices.map(n=>`<div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:18px 22px;box-shadow:${T.shadow};border-left:4px solid ${cmap[n.type]||T.accent};display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
    <div><div style="font-weight:700;font-size:14px;margin-bottom:6px">${esc(n.title)}</div><div style="display:flex;gap:8px;align-items:center">${badge(n.type)}<span style="font-size:11px;color:${T.muted}">By ${esc(n.author)} · ${n.date}</span></div></div>
    ${dbtn("Delete",`delNotice(${n.id})`, "sm")}
  </div>`).join("")}</div>`;}

function renderAdminComplaints(){
  return complaints.length===0?card(`<div style="text-align:center;padding:48px;color:${T.muted}"><div style="font-size:48px;margin-bottom:12px">📭</div><div style="font-weight:700;font-size:16px">No complaints yet</div></div>`):
  `<div style="display:grid;gap:12px">${complaints.map(c=>`<div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:20px;box-shadow:${T.shadow};border-left:4px solid ${T.red}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
      <div style="flex:1"><div style="font-weight:700;font-size:14px;margin-bottom:4px">${esc(c.studentName)} <span style="font-size:11px;color:${T.muted}">(${c.studentId})</span></div><div style="font-size:13px;margin-bottom:8px;line-height:1.6">${esc(c.message)}</div><div style="font-size:12px;color:${T.muted}">📅 ${c.date} · 👨‍🏫 ${esc(c.teacherName)} · 📱 ${c.guardianPhone}</div></div>
      <a href="sms:${c.guardianPhone}?body=${encodeURIComponent(`Dear Guardian, regarding ${c.studentName}: ${c.message} - CMS`)}" style="display:inline-flex;align-items:center;gap:6px;background:${T.greenL};color:${T.green};border:1px solid #86efac;border-radius:10px;padding:8px 16px;font-size:12px;font-weight:700;flex-shrink:0">💬 SMS Guardian</a>
    </div>
  </div>`).join("")}</div>`;}

function renderAdminPortals(){
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
    ${card(`${secTitle("👨‍🎓 Student Portals")}<div style="display:grid;gap:8px">${students.map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:${T.bg};border-radius:10px;border:1px solid ${T.border}"><div style="display:flex;align-items:center;gap:8px">${ava(s.name,28,s.photo||null)}<div><div style="font-weight:600;font-size:13px">${esc(s.name)}</div><div style="font-size:11px;color:${T.muted}">${s.id} · ${s.cls}</div></div></div><div style="display:flex;gap:8px;align-items:center">${badge(s.portal)}${s.portal==="active"?wbtn("Revoke",`togglePortal('student','${s.id}')`, "sm"):sbtn("Grant",`togglePortal('student','${s.id}')`, "sm")}</div></div>`).join("")}</div>`)}
    ${card(`${secTitle("👨‍🏫 Teacher Portals")}<div style="display:grid;gap:8px">${teachers.map(t=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:${T.bg};border-radius:10px;border:1px solid ${T.border}"><div style="display:flex;align-items:center;gap:8px">${ava(t.name,28,t.photo||null)}<div><div style="font-weight:600;font-size:13px">${esc(t.name)}</div><div style="font-size:11px;color:${T.muted}">${t.id} · ${t.subject}</div></div></div><div style="display:flex;gap:8px;align-items:center">${badge(t.portal)}${t.portal==="active"?wbtn("Revoke",`togglePortal('teacher','${t.id}')`, "sm"):sbtn("Grant",`togglePortal('teacher','${t.id}')`, "sm")}</div></div>`).join("")}</div>`)}
  </div>`;}

// ═══════════════════════════════════════════════
// REPORTS MODULE
// ═══════════════════════════════════════════════
function renderReports(){
  const rTypes=["Attendance Report","Grade Sheet","Exam Sheet","Fee Report","Class Performance"];
  const months=MONTHS.map(m=>m+" "+new Date().getFullYear());
  return `
  ${secTitle("📋 Reports Center")}
  <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:18px;margin-bottom:20px;display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;box-shadow:${T.shadow}">
    <div><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase">Report Type</label>
      <select onchange="reportFilter.type=this.value;refreshContent()" style="background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        ${rTypes.map((r,i)=>`<option value="${["attendance","grades","exams","fees","performance"][i]}" ${reportFilter.type===["attendance","grades","exams","fees","performance"][i]?"selected":""}>${r}</option>`).join("")}
      </select></div>
    ${reportFilter.type!=="fees"&&reportFilter.type!=="performance"?`<div><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase">Class</label>
      <select onchange="
        const sel=this.options[this.selectedIndex];
        if(this.value==='ALL'){reportFilter.class_id=null;reportFilter.cls='ALL';}
        else{reportFilter.class_id=parseInt(this.value)||null;reportFilter.cls=sel.dataset.cls||this.value;}
        refreshContent()
      " style="background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        ${(()=>{
          const effCls=(window.dbClasses&&window.dbClasses.length)
            ?window.dbClasses
            :[...new Set(students.map(s=>s.cls).filter(Boolean))].sort().map(c=>({id:c,name:c,code:c}));
          return effCls.map(c=>`<option value="${c.id}" data-cls="${c.code||c.name}" ${c.id===reportFilter.class_id?'selected':''}>${c.name}${c.code&&c.code!==c.name?' ('+c.code+')':''}</option>`).join('');
        })()}
        <option value="ALL" ${reportFilter.cls==="ALL"?"selected":""}>All Classes</option>
      </select></div>`:""}
    ${reportFilter.type==="attendance"||reportFilter.type==="fees"?`<div><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase">Month</label>
      <select onchange="reportFilter.month=this.value;refreshContent()" style="background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        ${months.map(m=>`<option value="${m}" ${m===reportFilter.month?"selected":""}>${m}</option>`).join("")}
      </select></div>`:""}
    <button onclick="printReport()" style="background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:10px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(5,150,105,.3)">🖨️ Print</button>
    <button onclick="downloadReportPDF()" style="background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;border:none;border-radius:10px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px">📄 PDF</button>
    <button onclick="downloadReportExcel()" style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:10px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px">📊 Excel</button>
    ${reportFilter.type==="performance"?`<button onclick="downloadPerformanceReport()" style="background:linear-gradient(135deg,${T.purple},#6d28d9);color:#fff;border:none;border-radius:10px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(124,58,237,.3)">⬇️ Download Report</button>`:""}
  </div>
  <div id="report-content" style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:28px;box-shadow:${T.shadow}">${generateReport()}</div>`;}

function generateReport(){
  const cls=reportFilter.cls||"CS-A";
  const rStudents=cls==="ALL"?students:students.filter(s=>s.cls===cls);
  if(reportFilter.type==="attendance"){
    const dates=weekDays;const totalDays=dates.length;
    return `<div style="text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid ${T.border}"><div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:800;color:${T.text}">Monthly Attendance Report</div><div style="font-size:13px;color:${T.muted};margin-top:4px">Class: ${cls==="ALL"?"All Classes":cls} · Month: ${reportFilter.month} · Total Working Days: ${totalDays}</div><div style="font-size:11px;color:${T.muted};margin-top:2px">${esc(contextTitle())} · Generated: ${new Date().toLocaleDateString()}</div></div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:${T.bg2}"><th style="padding:10px 12px;text-align:left;font-weight:700;border:1px solid ${T.border}">Roll#</th><th style="padding:10px 12px;text-align:left;font-weight:700;border:1px solid ${T.border}">Student Name</th><th style="padding:10px 12px;text-align:left;font-weight:700;border:1px solid ${T.border}">Class</th>${dates.map(d=>`<th style="padding:10px 6px;text-align:center;font-weight:700;border:1px solid ${T.border};white-space:nowrap;font-size:10px">${d.slice(5)}</th>`).join("")}<th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">Present</th><th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">Absent</th><th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">%</th><th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">Status</th></tr></thead>
    <tbody>${rStudents.map((s,i)=>{const myAtt=attendance[s.id]||{};const pres=dates.filter(d=>myAtt[d]==="present").length;const abs=dates.filter(d=>myAtt[d]==="absent").length;const pct=totalDays?Math.round(pres/totalDays*100):0;const col=pct>=75?T.green:T.red;return `<tr style="background:${i%2?"#f9fffe":"#fff"}"><td style="padding:8px 12px;border:1px solid ${T.border};font-weight:600">${s.rollNo}</td><td style="padding:8px 12px;border:1px solid ${T.border};font-weight:600">${esc(s.name)}</td><td style="padding:8px 12px;border:1px solid ${T.border}">${s.cls}</td>${dates.map(d=>{const st=myAtt[d]||"absent";const ic=st==="present"?"✓":st==="late"?"L":"✗";const c=st==="present"?T.green:st==="late"?T.yellow:T.red;return `<td style="padding:6px;text-align:center;border:1px solid ${T.border};color:${c};font-weight:700;font-size:11px">${ic}</td>`;}).join("")}<td style="padding:8px;text-align:center;border:1px solid ${T.border};color:${T.green};font-weight:700">${pres}</td><td style="padding:8px;text-align:center;border:1px solid ${T.border};color:${T.red};font-weight:700">${abs}</td><td style="padding:8px;text-align:center;border:1px solid ${T.border};color:${col};font-weight:800">${pct}%</td><td style="padding:8px;text-align:center;border:1px solid ${T.border}"><span style="background:${alpha(col,13)};color:${col};border-radius:20px;padding:2px 8px;font-weight:700;font-size:10px">${pct>=75?"Regular":"Short"}</span></td></tr>`;}).join("")}</tbody></table></div>`;
  }
  if(reportFilter.type==="grades"){
    return `<div style="text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid ${T.border}"><div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:800">Grade Sheet</div><div style="font-size:13px;color:${T.muted};margin-top:4px">Class: ${cls==="ALL"?"All Classes":cls} · Academic Year: 2025–26</div></div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:${T.bg2}"><th style="padding:10px 12px;border:1px solid ${T.border};text-align:left">Roll#</th><th style="padding:10px 12px;border:1px solid ${T.border};text-align:left">Name</th><th style="padding:10px 12px;border:1px solid ${T.border};text-align:left">Class</th>${SUBJECTS.slice(0,5).map(sub=>`<th style="padding:10px 8px;border:1px solid ${T.border};text-align:center;font-size:10px;white-space:nowrap">${sub.split(" ")[0]}</th>`).join("")}<th style="padding:10px 8px;border:1px solid ${T.border};text-align:center">Grade</th><th style="padding:10px 8px;border:1px solid ${T.border};text-align:center">Result</th><th style="padding:10px 8px;border:1px solid ${T.border};text-align:center">Sheet</th></tr></thead>
    <tbody>${rStudents.map((s,i)=>{const sg=grades[s.id]||{};const tots=SUBJECTS.slice(0,5).map(sub=>sg[sub]?.total||0);const total=tots.reduce((a,b)=>a+b,0);const avg=tots.length?Math.round(total/tots.length):0;const gl=gradeLabel(avg);const col=gradeColor(avg);const passed=avg>=45;return `<tr style="background:${i%2?"#f9fffe":"#fff"}"><td style="padding:8px 12px;border:1px solid ${T.border};font-weight:600">${s.rollNo}</td><td style="padding:8px 12px;border:1px solid ${T.border};font-weight:700">${esc(s.name)}</td><td style="padding:8px 12px;border:1px solid ${T.border}">${s.cls}</td>${SUBJECTS.slice(0,5).map(sub=>{const t=sg[sub]?.total||0;return `<td style="padding:8px;text-align:center;border:1px solid ${T.border};color:${gradeColor(t)};font-weight:700">${t||"-"}</td>`;}).join("")}<td style="padding:8px;text-align:center;border:1px solid ${T.border}"><span style="background:${alpha(col,13)};color:${col};border-radius:20px;padding:2px 8px;font-weight:800">${gl}</span></td><td style="padding:8px;text-align:center;border:1px solid ${T.border}"><span style="background:${passed?T.greenL:T.redL};color:${passed?T.green:T.red};border-radius:20px;padding:2px 8px;font-weight:700;font-size:11px">${passed?"Pass":"Fail"}</span></td><td style="padding:6px;text-align:center;border:1px solid ${T.border}"><button onclick="downloadStudentGradesPDF('${s.id}')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:8px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer">📄 PDF</button></td></tr>`;}).join("")}</tbody></table></div>`;
  }
  if(reportFilter.type==="exams"){
    const clsExams=cls==="ALL"?exams:exams.filter(e=>e.cls===cls);
    return `<div style="text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid ${T.border}"><div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:800">Exam Schedule Sheet</div><div style="font-size:13px;color:${T.muted};margin-top:4px">Class: ${cls==="ALL"?"All Classes":cls}</div></div>
    ${clsExams.length===0?`<div style="text-align:center;padding:40px;color:${T.muted}">No exams scheduled</div>`:`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:${T.bg2}"><th style="padding:12px 14px;font-weight:700;border:1px solid ${T.border}">#</th><th style="padding:12px 14px;font-weight:700;border:1px solid ${T.border}">Exam</th><th style="padding:12px 14px;font-weight:700;border:1px solid ${T.border}">Subject</th><th style="padding:12px 14px;font-weight:700;border:1px solid ${T.border}">Class</th><th style="padding:12px 14px;font-weight:700;border:1px solid ${T.border}">Date</th><th style="padding:12px 14px;font-weight:700;border:1px solid ${T.border}">Time</th><th style="padding:12px 14px;font-weight:700;border:1px solid ${T.border}">Room</th><th style="padding:12px 14px;text-align:center;font-weight:700;border:1px solid ${T.border}">Marks</th></tr></thead><tbody>${clsExams.map((e,i)=>`<tr style="background:${i%2?"#f9fffe":"#fff"}"><td style="padding:10px 14px;border:1px solid ${T.border}">${i+1}</td><td style="padding:10px 14px;border:1px solid ${T.border};font-weight:700">${esc(e.title)}</td><td style="padding:10px 14px;border:1px solid ${T.border}">${esc(e.subject)}</td><td style="padding:10px 14px;border:1px solid ${T.border}">${e.cls}</td><td style="padding:10px 14px;border:1px solid ${T.border};font-weight:600">${e.date}</td><td style="padding:10px 14px;border:1px solid ${T.border}">${e.time}</td><td style="padding:10px 14px;border:1px solid ${T.border}">${e.room}</td><td style="padding:10px 14px;text-align:center;border:1px solid ${T.border};font-weight:800;color:${T.accent}">${e.totalMarks}</td></tr>`).join("")}</tbody></table></div>`}`;
  }
  if(reportFilter.type==="fees"){
    const paidStudents=students.filter(s=>s.feeStatus==="paid");
    const totalCollected=paidStudents.reduce((acc,s)=>{const v=(feeVouchers[s.id]||[])[0];return acc+(v?.amount||15000);},0);
    return `<div style="text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid ${T.border}"><div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:800">Fee Collection Report</div><div style="font-size:13px;color:${T.muted};margin-top:4px">Month: ${reportFilter.month}</div></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px">${[["💰 Collected","PKR "+totalCollected.toLocaleString(),T.green],["✅ Paid",paidStudents.length+" students",T.green],["⏳ Pending",students.filter(s=>s.feeStatus==="pending").length+" students",T.yellow],["🚨 Overdue",students.filter(s=>s.feeStatus==="overdue").length+" students",T.red]].map(([l,v,c])=>`<div style="background:${alpha(c,6)};border:1px solid ${alpha(c,19)};border-radius:12px;padding:16px;text-align:center"><div style="font-size:11px;color:${T.muted};font-weight:700;margin-bottom:6px">${l}</div><div style="font-size:18px;font-weight:800;color:${c};font-family:'Space Grotesk',sans-serif">${v}</div></div>`).join("")}</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:${T.bg2}"><th style="padding:10px 14px;text-align:left;border:1px solid ${T.border};font-weight:700">Student</th><th style="padding:10px 14px;text-align:left;border:1px solid ${T.border};font-weight:700">ID</th><th style="padding:10px 14px;text-align:left;border:1px solid ${T.border};font-weight:700">Class</th><th style="padding:10px 14px;text-align:center;border:1px solid ${T.border};font-weight:700">Amount</th><th style="padding:10px 14px;text-align:center;border:1px solid ${T.border};font-weight:700">Status</th></tr></thead><tbody>${students.map((s,i)=>{const col={paid:T.green,pending:T.yellow,overdue:T.red}[s.feeStatus]||T.muted;return `<tr style="background:${i%2?"#f9fffe":"#fff"}"><td style="padding:9px 14px;border:1px solid ${T.border};font-weight:700">${esc(s.name)}</td><td style="padding:9px 14px;border:1px solid ${T.border};color:${T.accent};font-weight:700">${s.id}</td><td style="padding:9px 14px;border:1px solid ${T.border}">${s.cls}</td><td style="padding:9px 14px;text-align:center;border:1px solid ${T.border};font-weight:700">15,000</td><td style="padding:9px 14px;text-align:center;border:1px solid ${T.border}"><span style="background:${alpha(col,13)};color:${col};border-radius:20px;padding:2px 10px;font-weight:700;font-size:11px;text-transform:capitalize">${s.feeStatus}</span></td></tr>`;}).join("")}</tbody></table></div>`;
  }
  if(reportFilter.type==="performance"){
    // ── per-class stats ──────────────────────────────────────────────
    const classStats=contextClassCodes().map(cl=>{
      const cs=students.filter(s=>s.cls===cl);
      if(!cs.length)return null;
      const results=cs.map(s=>{
        const subs=SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||[];
        const sg=grades[s.id]||{};
        const tots=subs.map(sub=>sg[sub]?.total||0);
        const avg=tots.length?Math.round(tots.reduce((a,b)=>a+b,0)/tots.length):0;
        const passed=avg>=45;
        return {s,avg,passed};
      });
      const passed=results.filter(r=>r.passed).length;
      const failed=results.filter(r=>!r.passed).length;
      const passPct=Math.round(passed/cs.length*100);
      const failPct=100-passPct;
      const avgScore=Math.round(results.reduce((a,r)=>a+r.avg,0)/results.length);
      // attendance
      const attDates=weekDays;
      const attPcts=cs.map(s=>{const ma=attendance[s.id]||{};const p=attDates.filter(d=>ma[d]==="present").length;return attDates.length?Math.round(p/attDates.length*100):0;});
      const avgAtt=attDates.length&&cs.length?Math.round(attPcts.reduce((a,b)=>a+b,0)/attPcts.length):0;
      // grade distribution
      const gradeDistrib={A:0,B:0,C:0,D:0,F:0};
      results.forEach(r=>{const g=gradeLabel(r.avg);if(g==="A+"||g==="A")gradeDistrib.A++;else if(g==="B+"||g==="B")gradeDistrib.B++;else if(g==="C")gradeDistrib.C++;else if(g==="D")gradeDistrib.D++;else gradeDistrib.F++;});
      return {cl,total:cs.length,passed,failed,passPct,failPct,avgScore,avgAtt,gradeDistrib,results};
    }).filter(Boolean);

    // ── overall totals ───────────────────────────────────────────────
    const grandTotal=students.length;
    const grandPassed=classStats.reduce((a,c)=>a+c.passed,0);
    const grandFailed=classStats.reduce((a,c)=>a+c.failed,0);
    const grandPassPct=grandTotal?Math.round(grandPassed/grandTotal*100):0;
    const grandAvg=classStats.length?Math.round(classStats.reduce((a,c)=>a+c.avgScore,0)/classStats.length):0;
    const grandAtt=classStats.length?Math.round(classStats.reduce((a,c)=>a+c.avgAtt,0)/classStats.length):0;

    // ── draw bar charts after render ─────────────────────────────────
    scheduleChart(()=>{
      // pass/fail chart
      const canvas=document.getElementById("perfBarChart");
      if(canvas){
        const ctx=canvas.getContext("2d");
        const W=canvas.width,H=canvas.height;
        const pad={top:20,right:20,bottom:36,left:40};
        const cw=W-pad.left-pad.right,ch=H-pad.top-pad.bottom;
        ctx.clearRect(0,0,W,H);ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
        const gLines=5;
        for(let i=0;i<=gLines;i++){const y=pad.top+ch-(i/gLines)*ch;ctx.strokeStyle="#e5e7eb";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(pad.left+cw,y);ctx.stroke();ctx.fillStyle="#9ca3af";ctx.font="9px Plus Jakarta Sans,sans-serif";ctx.textAlign="right";ctx.fillText(Math.round(i/gLines*100)+"%",pad.left-4,y+3);}
        const gw=cw/classStats.length;const bw=Math.min(gw*0.3,28);
        classStats.forEach((c,li)=>{
          const passH=(c.passPct/100)*ch;const failH=(c.failPct/100)*ch;
          const gx=pad.left+gw*li+gw/2;
          // pass bar
          const px=gx-bw-2;const py=pad.top+ch-passH;
          ctx.fillStyle="#16a34a";ctx.beginPath();const r=Math.min(4,passH/2);ctx.moveTo(px+r,py);ctx.lineTo(px+bw-r,py);ctx.arcTo(px+bw,py,px+bw,py+r,r);ctx.lineTo(px+bw,pad.top+ch);ctx.lineTo(px,pad.top+ch);ctx.lineTo(px,py+r);ctx.arcTo(px,py,px+r,py,r);ctx.closePath();ctx.fill();
          if(passH>14){ctx.fillStyle="#fff";ctx.font="bold 9px Plus Jakarta Sans,sans-serif";ctx.textAlign="center";ctx.fillText(c.passPct+"%",px+bw/2,py+12);}
          // fail bar
          const fx=gx+2;const fy=pad.top+ch-failH;
          ctx.fillStyle="#dc2626";ctx.beginPath();const r2=Math.min(4,failH/2);ctx.moveTo(fx+r2,fy);ctx.lineTo(fx+bw-r2,fy);ctx.arcTo(fx+bw,fy,fx+bw,fy+r2,r2);ctx.lineTo(fx+bw,pad.top+ch);ctx.lineTo(fx,pad.top+ch);ctx.lineTo(fx,fy+r2);ctx.arcTo(fx,fy,fx+r2,fy,r2);ctx.closePath();ctx.fill();
          if(failH>14){ctx.fillStyle="#fff";ctx.font="bold 9px Plus Jakarta Sans,sans-serif";ctx.textAlign="center";ctx.fillText(c.failPct+"%",fx+bw/2,fy+12);}
          // label
          ctx.fillStyle="#374151";ctx.font="11px Plus Jakarta Sans,sans-serif";ctx.textAlign="center";ctx.fillText(c.cl,gx,pad.top+ch+16);
        });
        // legend
        ctx.fillStyle="#16a34a";ctx.fillRect(pad.left,H-10,12,8);ctx.fillStyle="#374151";ctx.font="10px Plus Jakarta Sans,sans-serif";ctx.textAlign="left";ctx.fillText("Pass %",pad.left+16,H-3);
        ctx.fillStyle="#dc2626";ctx.fillRect(pad.left+80,H-10,12,8);ctx.fillStyle="#374151";ctx.fillText("Fail %",pad.left+96,H-3);
      }
      // avg score chart
      const canvas2=document.getElementById("perfAvgChart");
      if(canvas2)drawBarChart("perfAvgChart",classStats.map(c=>c.cl),[{label:"Avg Score",data:classStats.map(c=>c.avgScore),color:"#7c3aed"},{label:"Avg Att %",data:classStats.map(c=>c.avgAtt),color:"#059669"}],{maxVal:100});
    });

    return `
    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid ${T.border}">
      <div style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800;color:${T.text}">📊 Class Performance Report</div>
      <div style="font-size:13px;color:${T.muted};margin-top:5px">Academic Year 2025–26 &nbsp;·&nbsp; All Classes &nbsp;·&nbsp; ${esc(contextTitle())}</div>
      <div style="font-size:11px;color:${T.muted};margin-top:2px">Generated: ${new Date().toLocaleString()}</div>
    </div>

    <!-- Overall summary cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-bottom:26px">
      ${[
        ["🎓","Total Students",grandTotal,T.accent],
        ["✅","Total Passed",grandPassed,T.green],
        ["❌","Total Failed",grandFailed,T.red],
        ["📊","Overall Pass %",grandPassPct+"%",grandPassPct>=50?T.green:T.red],
        ["📈","Overall Avg Score",grandAvg,gradeColor(grandAvg)],
        ["📋","Avg Attendance",grandAtt+"%",grandAtt>=75?T.green:T.red]
      ].map(([icon,label,val,col])=>`
        <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:18px 14px;text-align:center;box-shadow:${T.shadow};border-top:3px solid ${col}">
          <div style="font-size:22px;margin-bottom:6px">${icon}</div>
          <div style="font-size:26px;font-weight:800;color:${col};font-family:'Space Grotesk',sans-serif;line-height:1">${val}</div>
          <div style="font-size:11px;color:${T.muted};font-weight:600;margin-top:5px">${label}</div>
        </div>`).join("")}
    </div>

    <!-- Charts row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:26px">
      <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:20px;box-shadow:${T.shadow}">
        <div style="font-weight:800;font-size:13px;color:${T.text};margin-bottom:14px;font-family:'Space Grotesk',sans-serif">✅ Pass vs ❌ Fail — By Class</div>
        <canvas id="perfBarChart" width="420" height="200" style="width:100%;height:200px"></canvas>
      </div>
      <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:20px;box-shadow:${T.shadow}">
        <div style="font-weight:800;font-size:13px;color:${T.text};margin-bottom:14px;font-family:'Space Grotesk',sans-serif">📈 Avg Score & Attendance — By Class</div>
        <canvas id="perfAvgChart" width="420" height="200" style="width:100%;height:200px"></canvas>
      </div>
    </div>

    <!-- Per-class breakdown cards -->
    <div style="font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:800;color:${T.text};margin-bottom:14px">📋 Detailed Breakdown by Class</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-bottom:26px">
      ${classStats.map(c=>{
        const passCol=c.passPct>=50?T.green:T.red;
        return `
        <div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow};border-top:4px solid ${passCol}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:800;color:${T.text}">${c.cl}</div>
            <span style="background:${alpha(passCol,8)};color:${passCol};border-radius:20px;padding:4px 14px;font-size:12px;font-weight:800">${c.total} Students</span>
          </div>
          <!-- Pass / Fail row -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <div style="background:${T.greenL};border:1px solid #86efac;border-radius:12px;padding:12px;text-align:center">
              <div style="font-size:28px;font-weight:800;color:${T.green};font-family:'Space Grotesk',sans-serif">${c.passed}</div>
              <div style="font-size:11px;color:${T.green};font-weight:700;margin-top:2px">✅ Passed</div>
              <div style="font-size:20px;font-weight:800;color:${T.green};margin-top:4px">${c.passPct}%</div>
            </div>
            <div style="background:${T.redL};border:1px solid #fca5a5;border-radius:12px;padding:12px;text-align:center">
              <div style="font-size:28px;font-weight:800;color:${T.red};font-family:'Space Grotesk',sans-serif">${c.failed}</div>
              <div style="font-size:11px;color:${T.red};font-weight:700;margin-top:2px">❌ Failed</div>
              <div style="font-size:20px;font-weight:800;color:${T.red};margin-top:4px">${c.failPct}%</div>
            </div>
          </div>
          <!-- Pass % progress bar -->
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:5px"><span style="color:${T.green}">Pass Rate</span><span style="color:${passCol}">${c.passPct}%</span></div>
            <div style="background:#f1f5f9;border-radius:99px;height:10px;overflow:hidden">
              <div style="width:${c.passPct}%;height:100%;background:linear-gradient(90deg,${T.green},#4ade80);border-radius:99px;transition:width .4s"></div>
            </div>
          </div>
          <!-- Avg score & attendance -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <div style="background:${T.bg};border-radius:10px;padding:10px 12px;border:1px solid ${T.border}">
              <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:4px">Avg Score</div>
              <div style="font-size:20px;font-weight:800;color:${gradeColor(c.avgScore)};font-family:'Space Grotesk',sans-serif">${c.avgScore}</div>
              <div style="font-size:10px;font-weight:700;color:${gradeColor(c.avgScore)};margin-top:2px">${gradeLabel(c.avgScore)}</div>
            </div>
            <div style="background:${T.bg};border-radius:10px;padding:10px 12px;border:1px solid ${T.border}">
              <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:4px">Avg Attendance</div>
              <div style="font-size:20px;font-weight:800;color:${c.avgAtt>=75?T.green:T.red};font-family:'Space Grotesk',sans-serif">${c.avgAtt}%</div>
              <div style="font-size:10px;font-weight:700;color:${c.avgAtt>=75?T.green:T.red};margin-top:2px">${c.avgAtt>=75?"Regular":"Short"}</div>
            </div>
          </div>
          <!-- Grade distribution -->
          <div style="background:${T.bg};border-radius:10px;padding:12px;border:1px solid ${T.border}">
            <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:8px">Grade Distribution</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${Object.entries(c.gradeDistrib).map(([g,cnt])=>{
                const gc=g==="A"?T.green:g==="B"?T.accent:g==="C"?T.blue:g==="D"?T.yellow:T.red;
                const pct=c.total?Math.round(cnt/c.total*100):0;
                return `<div style="flex:1;min-width:38px;text-align:center;background:${alpha(gc,8)};border:1px solid ${alpha(gc,25)};border-radius:8px;padding:6px 4px">
                  <div style="font-size:16px;font-weight:800;color:${gc};font-family:'Space Grotesk',sans-serif">${cnt}</div>
                  <div style="font-size:10px;font-weight:700;color:${gc}">${g}</div>
                  <div style="font-size:9px;color:${T.muted}">${pct}%</div>
                </div>`;}).join("")}
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>

    <!-- Full student-level table -->
    <div style="font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:800;color:${T.text};margin-bottom:14px">👨‍🎓 Student-Level Results</div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:${T.bg2}">
            <th style="padding:10px 12px;text-align:left;font-weight:700;border:1px solid ${T.border}">#</th>
            <th style="padding:10px 12px;text-align:left;font-weight:700;border:1px solid ${T.border}">Student</th>
            <th style="padding:10px 12px;text-align:left;font-weight:700;border:1px solid ${T.border}">Class</th>
            <th style="padding:10px 12px;text-align:left;font-weight:700;border:1px solid ${T.border}">Group</th>
            <th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">Avg Score</th>
            <th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">Grade</th>
            <th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">Attendance %</th>
            <th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">Result</th>
          </tr>
        </thead>
        <tbody>
          ${students.map((s,i)=>{
            const subs=SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||[];
            const sg=grades[s.id]||{};
            const tots=subs.map(sub=>sg[sub]?.total||0);
            const avg=tots.length?Math.round(tots.reduce((a,b)=>a+b,0)/tots.length):0;
            const passed=avg>=45;
            const ma=attendance[s.id]||{};
            const attP=weekDays.filter(d=>ma[d]==="present").length;
            const attPct=weekDays.length?Math.round(attP/weekDays.length*100):0;
            const gl=gradeLabel(avg);const gc=gradeColor(avg);
            return `<tr style="background:${i%2?"#f9fffe":"#fff"}">
              <td style="padding:8px 12px;border:1px solid ${T.border};color:${T.muted};font-weight:600">${i+1}</td>
              <td style="padding:8px 12px;border:1px solid ${T.border};font-weight:700">${esc(s.name)}</td>
              <td style="padding:8px 12px;border:1px solid ${T.border}"><span style="background:${T.accentL};color:${T.accentD};border-radius:12px;padding:1px 8px;font-weight:700">${s.cls}</span></td>
              <td style="padding:8px 12px;border:1px solid ${T.border};font-size:11px;color:${T.muted};font-weight:600">${s.subjectGroup||"—"}</td>
              <td style="padding:8px;text-align:center;border:1px solid ${T.border};font-weight:800;color:${gc}">${avg}</td>
              <td style="padding:8px;text-align:center;border:1px solid ${T.border}"><span style="background:${alpha(gc,13)};color:${gc};border-radius:20px;padding:2px 10px;font-weight:800;font-size:11px">${gl}</span></td>
              <td style="padding:8px;text-align:center;border:1px solid ${T.border};font-weight:700;color:${attPct>=75?T.green:T.red}">${attPct}%</td>
              <td style="padding:8px;text-align:center;border:1px solid ${T.border}"><span style="background:${passed?T.greenL:T.redL};color:${passed?T.green:T.red};border-radius:20px;padding:2px 10px;font-weight:800;font-size:11px">${passed?"✅ Pass":"❌ Fail"}</span></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
  }
  return `<div style="text-align:center;padding:40px;color:${T.muted}">Select a report type above</div>`;
}
