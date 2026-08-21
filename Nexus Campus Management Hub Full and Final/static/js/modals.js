/* ================================================================
   js/modals.js  —  NEXus Solution CMS
   ================================================================ */

function renderStudentFees(s){
  const vouchers=feeVouchers[s.id]||[];
  const plan=feeInstallments[s.id];
  return `${secTitle('My Fee Vouchers')}
  ${plan?`<div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;margin-bottom:18px;box-shadow:${T.shadow}">
    ${secTitle('📋 Installment Plan')}
    <div style="background:${T.bg};border-radius:10px;padding:10px 12px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12px;color:${T.muted};margin-bottom:6px"><span>Total: <strong style="color:${T.text}">PKR ${plan.totalFee.toLocaleString()}</strong> · Session: ${plan.session||'—'}</span><span style="font-weight:700;color:${T.accent}">${(plan.installments||[]).filter(i=>i.status==='paid').length}/3 paid</span></div>${pbar(Math.round((plan.installments||[]).filter(i=>i.status==='paid').length/3*100),T.accent)}</div>
    <div style="display:grid;gap:8px">${(plan.installments||[]).map(inst=>{const iCol={paid:T.green,pending:T.yellow,overdue:T.red}[inst.status]||T.muted;return `<div style="background:${iCol}10;border:1px solid ${iCol}30;border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div><div style="font-size:13px;font-weight:700">Installment ${inst.no} · <span style="color:${T.accent}">PKR ${inst.amount.toLocaleString()}</span></div><div style="font-size:11px;color:${T.muted};margin-top:2px">📄 ${inst.voucherNo} · Due: ${inst.dueDate}${inst.status==='paid'?` · Paid: ${inst.paidDate}`:''}</div></div><span style="background:${iCol}20;color:${iCol};border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;text-transform:capitalize">${inst.status}</span></div>`;}).join('')}</div>
    <div style="margin-top:14px">${pbtn('🧾 Download Fee Receipt',`downloadFeeReceipt('${s.id}')`)}</div>
  </div>`:''}<div style="display:grid;gap:14px">${vouchers.length===0?card(`<div style="text-align:center;padding:40px;color:${T.muted}">No fee vouchers found</div>`):vouchers.map(v=>`<div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow};border-left:4px solid ${v.status==='paid'?T.green:v.status==='overdue'?T.red:T.yellow}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px">
      <div><div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:17px;margin-bottom:14px">${esc(v.month)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${[['Voucher #',v.voucherNo],['Amount','PKR '+v.amount.toLocaleString()],['Due Date',v.dueDate],['Paid Date',v.paidDate||'Not paid']].map(([k,val])=>`<div><div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;letter-spacing:.06em">${k}</div><div style="font-size:14px;font-weight:700;margin-top:3px">${esc(String(val))}</div></div>`).join('')}</div></div>
      <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-end">${badge(v.status,'lg')}${v.status!=='paid'?`<button style="background:${T.yellowL};color:${T.yellow};border:1px solid #fcd34d;border-radius:10px;padding:8px 16px;cursor:pointer;font-weight:700;font-size:13px">🏦 Pay Now</button>`:''}</div>
    </div>
  </div>`).join('')}</div>`;
}

function renderStudentTT(){const tt=timetables[teachers[0]?.id];return `${secTitle("Class Timetable")}${tt?card(`<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px"><div style="width:52px;height:52px;background:${T.accentL};border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px">📅</div><div><div style="font-weight:700;font-size:15px">${esc(tt.name)}</div><div style="font-size:12px;color:${T.muted};margin-top:2px">Uploaded: ${tt.uploadedAt}</div></div></div>${tt.data.startsWith("data:image")?`<img src="${tt.data}" alt="timetable" style="width:100%;border-radius:12px;border:1px solid ${T.border}"/>`:pbtn("📎 Open Timetable","window.open(timetables[teachers[0].id].data)")}`)
  :card(`<div style="text-align:center;padding:56px;color:${T.muted}"><div style="font-size:56px;margin-bottom:14px">📭</div><div style="font-weight:700;font-size:16px">No timetable available yet</div></div>`)}`;}

function renderStudentExams(s){const myEx=exams.filter(e=>e.cls===s.cls);return `${secTitle(`My Exams — ${s.cls}`)}${myEx.length===0?card(`<div style="text-align:center;padding:40px;color:${T.muted}">No exams scheduled for ${s.cls}</div>`):myEx.map(e=>`<div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;margin-bottom:12px;box-shadow:${T.shadow};border-left:4px solid ${T.accent}"><div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:16px;margin-bottom:14px">${esc(e.title)} — ${esc(e.subject)}</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px">${[["📅 Date",e.date],["🕐 Time",e.time],["⏱ Duration",e.duration],["🚪 Room",e.room],["📝 Marks",String(e.totalMarks)]].map(([k,v])=>`<div style="background:${T.bg};border-radius:10px;padding:10px 14px"><div style="font-size:10px;color:${T.muted};font-weight:700">${k}</div><div style="font-size:14px;font-weight:700;margin-top:3px">${esc(v)}</div></div>`).join("")}</div></div>`).join("")}`;}

// ═══════════════════════════════════════════════
// ================================================================
// SECTION 28 — MODALS
// ----------------------------------------------------------------
// renderModal() — returns the overlay + panel HTML for the
//                 currently open modal (modalState variable).
//
// Available modal types: addStudent, editStudent, addTeacher,
// editTeacher, addExam, addNotice, addComplaint, createAssignment,
// gradeSubmission, createFeePlan, editFeePlan, feeReport,
// changePassword, addSubAdmin, editSubAdmin
// ================================================================
function renderModal(){
  if(!modalState)return "";
  let title="",content="";

  // ─── CHANGE PASSWORD MODAL ───
  if(modalState==="changePassword"){
    title="🔑 Change Password";
    const role=currentUser.role;
    const isAdmin=role==="admin"&&!currentUser.isSubAdmin;
    content=`
    <div style="background:${T.accentL};border:1px solid ${T.border2};border-radius:10px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:${T.accentD};font-weight:600;display:flex;gap:8px;align-items:center">
      <span>🔐</span>
      ${isAdmin?"Changing main admin password":"Changing your account password. You'll use this to log in next time."}
    </div>
    <div style="margin-bottom:14px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">Current Password</label><input type="password" id="cp-cur" placeholder="Enter current password" style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif"/></div>
    <div style="margin-bottom:14px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">New Password</label><input type="password" id="cp-new" placeholder="Minimum 4 characters" style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif"/></div>
    <div style="margin-bottom:18px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">Confirm New Password</label><input type="password" id="cp-conf" placeholder="Re-enter new password" style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif"/></div>
    <div id="cp-msg" style="margin-bottom:12px;font-size:13px;min-height:20px;text-align:center"></div>
    <button onclick="submitChangePassword()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">🔑 Update Password</button>`;
  }

  // ─── ADD SUB-ADMIN MODAL ───
  if(modalState==="addSubAdmin"||modalState==="editSubAdmin"){
    const isEdit=modalState==="editSubAdmin";
    const sa=isEdit?subAdmins.find(x=>x.id===formData._saId):null;
    title=isEdit?"✏️ Edit Sub-Admin":"👥 Add Sub-Admin";
    content=`
    ${fld("Full Name","f-name",isEdit?sa?.name||formData.name||"":formData.name||"")}
    ${fld("Username (for login)","f-username",isEdit?sa?.username||formData.username||"":formData.username||"","text",null,"e.g. registrar")}
    ${isEdit?`<div style="margin-bottom:14px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">New Password <span style="font-weight:400;text-transform:none">(leave blank to keep)</span></label><input type="password" id="f-password" placeholder="Leave blank to keep current" style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif" oninput="setForm('f-password',this.value)"/></div>`:
    fld("Password","f-password",formData.password||"","password",null,"Set a login password")}
    <div style="margin-bottom:18px">
      <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Permissions (select what this sub-admin can access)</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="perm-grid">
        ${SUB_ADMIN_PERMS.map(p=>{const checked=(isEdit?(sa?.permissions||[]):(subAdminPermsSelected)).includes(p.key);return `<label style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:${checked?T.purpleL:T.bg};border:1.5px solid ${checked?"#c4b5fd":T.border};border-radius:10px;cursor:pointer;transition:all .15s" onclick="togglePermCheck('${p.key}',this)">
          <div style="width:18px;height:18px;border-radius:5px;border:2px solid ${checked?T.purple:T.border};background:${checked?T.purple:"#fff"};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:800" id="pchk-${p.key}">${checked?"✓":""}</div>
          <div><div style="font-size:12px;font-weight:700;color:${T.text}">${p.label}</div><div style="font-size:10px;color:${T.muted}">${p.desc}</div></div>
        </label>`;}).join("")}
      </div>
    </div>
    <button onclick="${isEdit?`submitEditSubAdmin('${sa?.id}')`:"submitAddSubAdmin()"}" style="width:100%;background:linear-gradient(135deg,${T.purple},#6d28d9);color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${isEdit?"💾 Save Changes":"👥 Create Sub-Admin"}</button>`;
  }

  if(modalState==="addStudent"){title="➕ Add New Student";content=`
    <div style="margin-bottom:18px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:8px;font-weight:700;text-transform:uppercase">Profile Photo (Optional)</label>
      <div style="display:flex;align-items:center;gap:14px"><div id="stu-photo-preview" style="width:64px;height:64px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid ${T.border2};background:linear-gradient(135deg,${T.accent},${T.accentD});display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#fff">${formData._photoData?`<img src="${formData._photoData}" style="width:100%;height:100%;object-fit:cover"/>`:formData.name?formData.name[0].toUpperCase():"👤"}</div>
      <div style="flex:1"><label style="display:inline-flex;align-items:center;gap:8px;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 16px;cursor:pointer;font-size:12px;font-weight:700;color:${T.accent}">📷 Choose Photo<input type="file" accept="image/*" style="display:none" onchange="previewStudentPhoto(this)"/></label>
      <div style="font-size:11px;color:${T.muted};margin-top:5px">JPG, PNG · Max 2MB</div></div></div></div>
    ${fld("Full Name","f-name",formData.name||"")}
    <div style="margin-bottom:14px">
      <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Class *</label>
      <select id="f-classId" onchange="onStudentClassChange(this.value,'f-sectionId')"
        style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        <option value="">-- Loading classes… --</option>
      </select>
    </div>
    <div style="margin-bottom:14px">
      <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Section</label>
      <select id="f-sectionId"
        style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        <option value="">-- Select a class first --</option>
      </select>
    </div>
    <div style="margin-bottom:14px">
      <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Subject Group</label>
      <select id="f-subjectGroup" onchange="setForm('f-subjectGroup',this.value);updateSubjectPreview('add-subject-preview',this.value)"
        style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        ${ALL_GROUPS.map(g=>`<option value="${g}" ${(formData.subjectGroup||"Computer Science")===g?"selected":""}>${g}</option>`).join("")}
      </select>
      <div id="add-subject-preview" style="background:${T.bg};border:1px solid ${T.border};border-radius:8px;padding:8px 12px;margin-top:6px;font-size:11px;color:${T.muted}">
        📚 Subjects: <strong style="color:${T.accent}">${(SUBJECT_GROUPS[formData.subjectGroup||"Computer Science"]||[]).join(" · ")}</strong>
      </div>
    </div>
    ${fld("Password (for login)","f-password",formData.password||"1234","text",null,"Login password")}${fld("Phone","f-phone",formData.phone||"")}${fld("Guardian Phone","f-guardianPhone",formData.guardianPhone||"")}${fld("Email","f-email",formData.email||"")}${fld("Date of Birth","f-dob",formData.dob||"","date")}${fld("Fee Status","f-feeStatus",formData.feeStatus||"pending","text",["paid","pending","overdue"])}
    <div style="background:${T.accentL};border:1px solid ${T.border2};border-radius:10px;padding:11px 14px;font-size:12px;color:${T.accentD};margin-bottom:16px;font-weight:600">💡 Auto-generated ID + password = student login credentials.</div>
    <button onclick="submitAddStudent()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Add Student</button>`;}

  if(modalState==="addTeacher"){title="➕ Add New Teacher";content=`
    <div style="margin-bottom:18px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:8px;font-weight:700;text-transform:uppercase">Profile Photo (Optional)</label>
      <div style="display:flex;align-items:center;gap:14px"><div id="teach-photo-preview" style="width:64px;height:64px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid ${T.border2};background:linear-gradient(135deg,${T.accent},${T.accentD});display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#fff">${formData._photoData?`<img src="${formData._photoData}" style="width:100%;height:100%;object-fit:cover"/>`:formData.name?formData.name[0].toUpperCase():"👨‍🏫"}</div>
      <div style="flex:1"><label style="display:inline-flex;align-items:center;gap:8px;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 16px;cursor:pointer;font-size:12px;font-weight:700;color:${T.accent}">📷 Choose Photo<input type="file" accept="image/*" style="display:none" onchange="previewTeacherPhoto(this)"/></label>
      <div style="font-size:11px;color:${T.muted};margin-top:5px">JPG, PNG · Max 2MB</div></div></div></div>
    ${fld("Full Name","f-name",formData.name||"")}
    ${fld("Subject","f-subject",formData.subject||SUBJECTS[0],"text",SUBJECTS)}
    <div class="teacher-form-row">
      <div>
        <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">🏫 Class</label>
        <select id="f-teachClassId" class="teacher-form-select" onchange="onTeacherClassChange(this.value,'f-teachSectionId')">
          <option value="">-- Select Class --</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">📋 Section</label>
        <select id="f-teachSectionId" class="teacher-form-select">
          <option value="">-- Select Class First --</option>
        </select>
      </div>
    </div>
    ${fld("Department","f-dept",formData.dept||"")}
    ${fld("Qualification","f-qualification",formData.qualification||"")}
    <div class="teacher-form-row-2">
      <div>${fld("Phone","f-phone",formData.phone||"")}</div>
      <div>${fld("Email","f-email",formData.email||"")}</div>
    </div>
    <button onclick="submitAddTeacher()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;margin-top:4px">Add Teacher</button>`;
  setTimeout(()=>initTeacherClassDropdown('f-teachClassId','f-teachSectionId',null,null),0);}

  if(modalState==="addExam"){title="📝 Schedule Exam";content=`
    ${fld("Exam Title","f-title",formData.title||"")}${fld("Subject","f-subject",formData.subject||SUBJECTS[0],"text",SUBJECTS)}${fld("Class","f-cls",formData.cls||"CS-A","text",contextClassCodes())}${fld("Date","f-date",formData.date||"","date")}${fld("Time","f-time",formData.time||"")}${fld("Duration","f-duration",formData.duration||"")}${fld("Room","f-room",formData.room||"")}${fld("Total Marks","f-totalMarks",formData.totalMarks||"100")}
    <button onclick="submitAddExam()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Schedule Exam</button>`;}

  if(modalState==="addNotice"){title="📢 Post Notice";content=`
    ${fld("Title","f-title",formData.title||"")}${fld("Type","f-type",formData.type||"academic","text",["academic","holiday","event","fee"])}${fld("Author","f-author",formData.author||"Principal")}
    <button onclick="submitAddNotice()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Post Notice</button>`;}

  if(modalState==="viewStudent"){const s=formData;title="👤 Student Profile";
    content=`
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding:18px;background:linear-gradient(135deg,${T.accentD},${T.accent});border-radius:14px;position:relative">
      <div style="position:relative">${ava(s.name||"?",72,s.photo||null)}<label style="position:absolute;bottom:0;right:0;width:24px;height:24px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,.2);border:2px solid ${T.border2}">📷<input type="file" accept="image/*" style="display:none" onchange="changeStudentPhoto('${s.id}',this)"/></label></div>
      <div style="flex:1"><div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:20px;color:#fff">${esc(s.name)}</div><div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:3px">${s.id} · ${s.cls} · Roll# ${s.rollNo}</div><div style="display:flex;gap:6px;margin-top:8px">${badge(s.feeStatus)}${badge(s.portal)}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
      ${[["📛 Full Name",s.name],["🆔 Student ID",s.id],["🏫 Class",s.cls],["📋 Roll No",s.rollNo],["📚 Subject Group",s.subjectGroup||"—"],["📞 Phone",s.phone],["👨‍👩‍👦 Guardian",s.guardianPhone],["✉️ Email",s.email],["🎂 Date of Birth",s.dob]].map(([lbl,val])=>`<div style="background:${T.bg};border-radius:10px;padding:11px 14px;border:1px solid ${T.border}"><div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:4px">${lbl}</div><div style="font-size:13px;font-weight:600">${esc(String(val||"—"))}</div></div>`).join("")}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <button onclick="openEditStudent('${s.id}')" style="background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer">✏️ Edit Student</button>
      <button onclick="confirmDelStudent('${s.id}')" style="background:${T.redL};color:${T.red};border:1.5px solid #fca5a5;border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer">🗑️ Delete</button>
    </div>`;}

  if(modalState==="editStudent"){const s=formData;title="✏️ Edit Student";content=`
    <div style="margin-bottom:18px;display:flex;align-items:center;gap:14px">
      <div id="edit-stu-photo-preview" style="width:64px;height:64px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid ${T.border2}">${s.photo?`<img src="${s.photo}" style="width:100%;height:100%;object-fit:cover"/>`:ava(s.name,64)}</div>
      <label style="display:inline-flex;align-items:center;gap:8px;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 16px;cursor:pointer;font-size:12px;font-weight:700;color:${T.accent}">📷 Change Photo<input type="file" accept="image/*" style="display:none" onchange="previewEditStuPhoto(this)"/></label>
    </div>
    ${fld("Full Name","f-name",s.name||"")}
    <div style="margin-bottom:14px">
      <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Class *</label>
      <select id="f-classId" onchange="onStudentClassChange(this.value,'f-sectionId')"
        style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        <option value="">-- Loading classes… --</option>
      </select>
    </div>
    <div style="margin-bottom:14px">
      <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Section</label>
      <select id="f-sectionId"
        style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        <option value="">-- Select a class first --</option>
      </select>
    </div>
    <div style="margin-bottom:14px">
      <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Subject Group</label>
      <select id="f-subjectGroup" onchange="setForm('f-subjectGroup',this.value);updateSubjectPreview('edit-subject-preview',this.value)"
        style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        ${ALL_GROUPS.map(g=>`<option value="${g}" ${(s.subjectGroup||"Computer Science")===g?"selected":""}>${g}</option>`).join("")}
      </select>
      <div id="edit-subject-preview" style="background:${T.bg};border:1px solid ${T.border};border-radius:8px;padding:8px 12px;margin-top:6px;font-size:11px;color:${T.muted}">
        📚 Subjects: <strong style="color:${T.accent}">${(SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||[]).join(" · ")}</strong>
      </div>
    </div>
    ${fld("Phone","f-phone",s.phone||"")}${fld("Guardian Phone","f-guardianPhone",s.guardianPhone||"")}${fld("Email","f-email",s.email||"")}${fld("Date of Birth","f-dob",s.dob||"","date")}${fld("Fee Status","f-feeStatus",s.feeStatus||"pending","text",["paid","pending","overdue"])}${fld("New Password (leave blank to keep)","f-password","","text",null,"Leave blank to keep")}
    <button onclick="submitEditStudent('${s.id}')" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;margin-top:6px">💾 Save Changes</button>`;}

  if(modalState==="editTeacher"){const t=formData;title="✏️ Edit Teacher";content=`
    <div style="margin-bottom:18px;display:flex;align-items:center;gap:14px">
      <div id="edit-teach-photo-preview" style="width:64px;height:64px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid ${T.border2}">${t.photo?`<img src="${t.photo}" style="width:100%;height:100%;object-fit:cover"/>`:ava(t.name,64)}</div>
      <label style="display:inline-flex;align-items:center;gap:8px;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 16px;cursor:pointer;font-size:12px;font-weight:700;color:${T.accent}">📷 Change Photo<input type="file" accept="image/*" style="display:none" onchange="previewEditTeachPhoto(this)"/></label>
    </div>
    ${fld("Full Name","f-name",t.name||"")}
    ${fld("Subject","f-subject",t.subject||SUBJECTS[0],"text",SUBJECTS)}
    <div class="teacher-form-row">
      <div>
        <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">🏫 Class</label>
        <select id="f-teachClassId" class="teacher-form-select" onchange="onTeacherClassChange(this.value,'f-teachSectionId')">
          <option value="">-- Loading… --</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">📋 Section</label>
        <select id="f-teachSectionId" class="teacher-form-select">
          <option value="">-- Select Class First --</option>
        </select>
      </div>
    </div>
    ${fld("Department","f-dept",t.dept||"")}
    ${fld("Qualification","f-qualification",t.qualification||"")}
    <div class="teacher-form-row-2">
      <div>${fld("Phone","f-phone",t.phone||"")}</div>
      <div>${fld("Email","f-email",t.email||"")}</div>
    </div>
    ${fld("New Password (leave blank to keep)","f-password","","text",null,"Leave blank to keep")}
    <button onclick="submitEditTeacher('${t.id}')" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;margin-top:6px">💾 Save Changes</button>`;
  setTimeout(()=>initTeacherClassDropdown('f-teachClassId','f-teachSectionId',t.classId||t.class_id||null,t.sectionId||t.section_id||null),0);}

  if(modalState==="addComplaint"){
    const t=teachers.find(x=>x.id===currentUser?.id);
    const cs=students.filter(s=>s.cls===attFilter.cls);
    const sel=students.find(s=>s.id===formData.studentId)||cs[0];
    title="⚠️ Send Complaint";
    content=`<div style="background:${T.redL};border:1px solid #fca5a5;border-radius:10px;padding:11px 14px;margin-bottom:18px;font-size:12px;color:${T.red};font-weight:600">⚠️ This complaint is logged and visible to Admin.</div>
    ${fld("Select Student","f-studentId",formData.studentId||cs[0]?.id||"","text",cs.map(s=>s.id))}
    ${sel?`<div style="background:${T.bg};border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:${T.muted};border:1px solid ${T.border}">👨‍👩‍👦 Guardian: <strong>${sel.guardianPhone}</strong></div>`:""}
    <div style="margin-bottom:14px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">Complaint Message</label><textarea id="f-message" rows="4" oninput="formData.message=this.value" style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif;resize:vertical">${esc(formData.message||"")}</textarea></div>
    ${sel&&formData.message?`<a href="sms:${sel.guardianPhone}?body=${encodeURIComponent(`Dear Guardian, regarding ${sel.name}: ${formData.message} - ${t?.name||""}, CMS`)}" style="display:block;text-align:center;background:${T.greenL};color:${T.green};border:1px solid #86efac;border-radius:10px;padding:10px;font-size:13px;font-weight:700;margin-bottom:12px">💬 Send SMS to Guardian</a>`:""}
    <button onclick="submitComplaint()" style="width:100%;background:linear-gradient(135deg,${T.red},#b91c1c);color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Log Complaint</button>`;}

  if(modalState==="createAssignment"){
    const teacher=teachers.find(x=>x.id===currentUser?.id);
    title="📎 Create Assignment";
    content=`${fld("Assignment Title","f-title",formData.title||"")}${fld("Subject","f-subject",formData.subject||teacher?.subject||SUBJECTS[0],"text",SUBJECTS)}${fld("Class","f-cls",formData.cls||"CS-A","text",contextClassCodes())}${fld("Due Date","f-dueDate",formData.dueDate||"","date")}
    <div style="margin-bottom:14px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">Description / Instructions</label><textarea id="f-description" rows="4" oninput="formData.description=this.value" placeholder="Write assignment instructions here..." style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif;resize:vertical">${esc(formData.description||"")}</textarea></div>
    <button onclick="submitCreateAssignment()" style="width:100%;background:linear-gradient(135deg,${T.blue},#1d4ed8);color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Create Assignment</button>`;}

  if(modalState==="gradeSubmission"){
    title="✏️ Grade Submission";
    const sub=submissions.find(s=>s.id===formData.subId);
    content=sub?`<div style="background:${T.bg};border-radius:10px;padding:14px;margin-bottom:18px"><div style="font-weight:700;font-size:14px;margin-bottom:4px">${esc(sub.studentName)}</div><div style="font-size:12px;color:${T.muted}">📎 ${esc(sub.fileName)} · Submitted: ${sub.submittedAt}</div></div>
    ${fld("Grade (0–100)","f-grade",String(formData.grade||""),"number")}
    <div style="margin-bottom:14px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">Feedback</label><textarea id="f-feedback" rows="3" oninput="formData.feedback=this.value" placeholder="Optional feedback..." style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif;resize:vertical">${esc(formData.feedback||"")}</textarea></div>
    <button onclick="submitGrade()" style="width:100%;background:linear-gradient(135deg,${T.green},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Submit Grade</button>`:"Submission not found.";}

  if(modalState==="createFeePlan"||modalState==="editFeePlan"){
    const isEdit=modalState==="editFeePlan";
    const sid=formData._sid||"";
    const s=students.find(x=>x.id===sid);
    const plan=isEdit?feeInstallments[sid]:null;
    title=isEdit?"✏️ Edit Fee Plan":"💳 Create 3-Installment Fee Plan";
    const tf=formData.totalFee||plan?.totalFee||"";
    const sess=formData.session||plan?.session||"2025-26";
    const d1=formData.due1||(plan?.installments?.[0]?.dueDate)||"";
    const d2=formData.due2||(plan?.installments?.[1]?.dueDate)||"";
    const d3=formData.due3||(plan?.installments?.[2]?.dueDate)||"";
    const instAmt=tf?Math.floor(Number(tf)/3):0;
    content=`
    <div style="background:${T.accentL};border:1px solid ${T.border2};border-radius:10px;padding:11px 14px;margin-bottom:18px;font-size:12px;color:${T.accentD};font-weight:600">
      🎓 Student: <strong>${s?s.name+" ("+s.id+")":"—"}</strong>
    </div>
    ${fld("Academic Session","f-session",sess,"text",["2024-25","2025-26","2026-27"])}
    <div style="margin-bottom:14px">
      <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">Total Fee Amount (PKR)</label>
      <input type="number" id="f-totalFee" value="${tf}" placeholder="e.g. 45000" min="0"
        style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif"
        oninput="formData.totalFee=this.value;document.getElementById('fp-preview').innerHTML=feeInstallPreview(this.value)"/>
    </div>
    <div id="fp-preview" style="background:${T.bg};border:1px solid ${T.border};border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;text-align:center;color:${T.muted}">${tf?feeInstallPreview(tf):"Enter total fee to see installment breakdown"}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
      ${fld("Installment 1 Due","f-due1",d1,"date")}
      ${fld("Installment 2 Due","f-due2",d2,"date")}
      ${fld("Installment 3 Due","f-due3",d3,"date")}
    </div>
    <button onclick="${isEdit?`submitEditFeePlan('${sid}')`:`submitCreateFeePlan('${sid}')`}" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${isEdit?"💾 Save Changes":"🚀 Create Plan & Generate Vouchers"}</button>`;
  }

  if(modalState==="feeReport"){title="📊 Fee Report Summary";
    const paidC=students.filter(s=>s.feeStatus==="paid").length;
    const pendC=students.filter(s=>s.feeStatus==="pending").length;
    const ovdC=students.filter(s=>s.feeStatus==="overdue").length;
    const totalCol=paidC*15000;
    content=`<div style="display:grid;gap:12px;margin-bottom:18px">
      ${[["✅ Paid",paidC,T.green,"PKR "+totalCol.toLocaleString()+" collected"],["⏳ Pending",pendC,T.yellow,"PKR "+(pendC*15000).toLocaleString()+" expected"],["🚨 Overdue",ovdC,T.red,"PKR "+(ovdC*15000).toLocaleString()+" overdue"]].map(([l,c,col,sub])=>`<div style="background:${col}10;border:1px solid ${col}30;border-radius:12px;padding:16px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:700;font-size:13px">${l}</div><div style="font-size:12px;color:${T.muted};margin-top:2px">${sub}</div></div><div style="font-size:28px;font-weight:800;color:${col};font-family:'Space Grotesk',sans-serif">${c}</div></div>`).join("")}
    </div>
    <div style="background:${T.accentL};border-radius:10px;padding:14px;text-align:center;margin-bottom:16px"><div style="font-size:12px;color:${T.muted};font-weight:600;margin-bottom:4px">TOTAL MONTHLY COLLECTION</div><div style="font-size:24px;font-weight:800;color:${T.accent};font-family:'Space Grotesk',sans-serif">PKR ${totalCol.toLocaleString()}</div></div>
    <button onclick="closeModal()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Close</button>`;}

  return `<div onclick="closeModal()" style="position:fixed;inset:0;background:rgba(6,78,59,.45);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px">
    <div onclick="event.stopPropagation()" style="background:#fff;border-radius:20px;padding:30px;width:100%;max-width:${modalState==="addSubAdmin"||modalState==="editSubAdmin"?"580px":"520px"};max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.25)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <span style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:18px;color:${T.text}">${title}</span>
        <button onclick="closeModal()" style="background:${T.bg};border:none;color:${T.muted};border-radius:10px;width:34px;height:34px;cursor:pointer;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center">✕</button>
      </div>${content}
    </div>
  </div>`;}

// ================================================================
// SECTION 29 — ACTIONS  (Event Handlers)
// ----------------------------------------------------------------
// All onclick="" handlers used in the rendered HTML live here.
//
// Navigation
//   navTo(p)            — change page, reset search, re-render
//   toggleSidebar()     — collapse / expand sidebar
//   doLogout()          — clear currentUser, back to login
//
// Modal helpers
//   openModal(type)     — set modalState + seed formData, re-render
//   closeModal()        — clear modalState + formData, re-render
//   setForm(id, val)    — sync a form field value into formData
//
// CRUD — Students
//   submitAddStudent()  — validate + push new student
//   submitEditStudent() — validate + update existing student
//   delStudent(id)      — confirm + splice from array
//   previewStudentPhoto / previewEditStudentPhoto
//
// CRUD — Teachers
//   submitAddTeacher / submitEditTeacher / delTeacher
//
// CRUD — Exams
//   submitAddExam / delExam
//
// CRUD — Notices
//   submitAddNotice / delNotice
//
// Attendance
//   markAtt(sid, status)  — mark single student attendance
//   bulkAtt(status)       — mark all visible students
//
// Grades
//   updateGrade(sid, sub, field, val)
//   saveExamGrade(sid, sub, examId, val)
//
// Fees
//   submitCreateFeePlan / submitEditFeePlan / removeFeePlan
//   markInstallmentPaid / revertInstallmentPaid / setInstallmentOverdue
//
// Assignments
//   submitCreateAssignment / submitGrade / uploadAssignment
//
// Portals
//   togglePortal(type, id)
//
// Sub-admins
//   submitAddSubAdmin / submitEditSubAdmin / delSubAdmin
//   toggleSubAdminPerm(key)
//
// Password
//   submitChangePassword
// ================================================================
function navTo(p){currentPage=p;searchQuery="";render();}
function toggleSidebar(){
  if(window.innerWidth<=768){
    sidebarCollapsed=!sidebarCollapsed;
  } else {
    sidebarCollapsed=!sidebarCollapsed;
  }
  render();
}
function doLogout(){currentUser=null;loginErr="";loginRole="admin";render();}
function closeModal(){modalState=null;formData={};subAdminPermsSelected=[];render();}
function updateSubjectPreview(previewId,group){
  const el=document.getElementById(previewId);
  if(el){const subs=SUBJECT_GROUPS[group]||[];el.innerHTML='📚 Subjects: <strong style="color:'+T.accent+'">'+subs.join(" · ")+"</strong>";}
}
function setForm(id,val){formData[id.replace("f-","")]=val;}

function openModal(type){
  if(type==="addStudent")formData={name:"",cls:"CS-A",classId:null,sectionId:null,subjectGroup:"Computer Science",phone:"",guardianPhone:"",email:"",feeStatus:"pending",dob:"",password:"1234",_photoData:null};
  else if(type==="addTeacher")formData={name:"",subject:SUBJECTS[0],dept:"Computer Science",phone:"",email:"",qualification:"",_photoData:null};
  else if(type==="addExam")formData={title:"",subject:SUBJECTS[0],cls:"CS-A",date:"",time:"09:00 AM",duration:"3 hours",room:"",totalMarks:"100"};
  else if(type==="addNotice")formData={title:"",type:"academic",author:"Principal"};
  else if(type==="addComplaint"){const cs=students.filter(s=>s.cls===attFilter.cls);formData={studentId:cs[0]?.id||"",message:""};}
  else if(type==="createAssignment"){const t=teachers.find(x=>x.id===currentUser?.id);formData={title:"",subject:t?.subject||SUBJECTS[0],cls:"CS-A",dueDate:"",description:""};}
  else if(type==="feeReport")formData={};
  else if(type==="changePassword")formData={};
  else if(type==="addSubAdmin"){formData={name:"",username:"",password:""};subAdminPermsSelected=[];}
  modalState=type;render();
  // Init dynamic class/section dropdowns for student forms
  if (type === 'addStudent') {
    initStudentClassDropdown(null, null);
  }
}

// ─── PASSWORD CHANGE HANDLER ───
// Owned by api.js (submitChangePassword -> POST /api/change-password), which
// loads last and is the version that actually runs.  The client-side copy that
// used to live here compared the typed password against a plaintext `password`
// field on the loaded records; those fields are gone now that accounts are
// DB-backed with hashed passwords, so only the server can verify.

// ─── SUB-ADMIN PERMISSION TOGGLE ───
function togglePermCheck(key,el){
  const chk=document.getElementById("pchk-"+key);
  const idx=subAdminPermsSelected.indexOf(key);
  if(idx>=0){subAdminPermsSelected.splice(idx,1);chk.textContent="";chk.style.background="#fff";chk.style.borderColor=T.border;el.style.background=T.bg;el.style.borderColor=T.border;}
  else{subAdminPermsSelected.push(key);chk.textContent="✓";chk.style.background=T.purple;chk.style.borderColor=T.purple;el.style.background=T.purpleL;el.style.borderColor="#c4b5fd";}
}

// ─── ADD SUB-ADMIN ───
function submitAddSubAdmin(){
  const name=(document.getElementById("f-name")?.value||"").trim();
  const username=(document.getElementById("f-username")?.value||"").trim();
  const password=(document.getElementById("f-password")?.value||"").trim();
  if(!name){alert("Please enter a name");return;}
  if(!username){alert("Please enter a username");return;}
  if(!password){alert("Please enter a password");return;}
  if(username==="admin"){alert("Username 'admin' is reserved for the main admin");return;}
  if(subAdmins.some(x=>x.username===username)){alert("Username already taken. Choose a different one.");return;}
  const newSA={id:"SA"+Date.now(),name,username,password,permissions:[...subAdminPermsSelected],portal:"active",createdAt:today};
  subAdmins.push(newSA);
  alert(`✅ Sub-Admin Created!

Username: ${username}
Password: ${password}

They can log in using the Admin tab.`);
  closeModal();
}

// ─── EDIT SUB-ADMIN ───
function openEditSubAdmin(id){
  const sa=subAdmins.find(x=>x.id===id);
  if(sa){formData={...sa,_saId:id};subAdminPermsSelected=[...sa.permissions];modalState="editSubAdmin";render();}
}
function submitEditSubAdmin(id){
  const sa=subAdmins.find(x=>x.id===id);if(!sa)return;
  const name=(document.getElementById("f-name")?.value||"").trim();
  const username=(document.getElementById("f-username")?.value||"").trim();
  const pwd=(document.getElementById("f-password")?.value||"").trim();
  if(!name){alert("Name cannot be empty");return;}
  if(!username){alert("Username cannot be empty");return;}
  if(username==="admin"){alert("Username 'admin' is reserved");return;}
  if(subAdmins.some(x=>x.username===username&&x.id!==id)){alert("Username already taken.");return;}
  sa.name=name;sa.username=username;
  if(pwd)sa.password=pwd;
  sa.permissions=[...subAdminPermsSelected];
  if(currentUser&&currentUser.id===id){currentUser.name=sa.name;currentUser.permissions=[...sa.permissions];}
  alert("✅ Sub-admin updated!");
  closeModal();
}
function toggleSubAdmin(id){const sa=subAdmins.find(x=>x.id===id);if(sa)sa.portal=sa.portal==="active"?"inactive":"active";refreshContent();}
function delSubAdmin(id){if(confirm("Delete this sub-admin?"))subAdmins=subAdmins.filter(x=>x.id!==id);refreshContent();}

// ─── PHOTO PREVIEW HELPERS ───
function previewStudentPhoto(input){const file=input.files[0];if(!file)return;if(file.size>2*1024*1024){alert("Photo too large. Max 2MB.");return;}const reader=new FileReader();reader.onload=ev=>{formData._photoData=ev.target.result;const prev=document.getElementById("stu-photo-preview");if(prev)prev.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover"/>`;};reader.readAsDataURL(file);}
function previewTeacherPhoto(input){const file=input.files[0];if(!file)return;if(file.size>2*1024*1024){alert("Photo too large. Max 2MB.");return;}const reader=new FileReader();reader.onload=ev=>{formData._photoData=ev.target.result;const prev=document.getElementById("teach-photo-preview");if(prev)prev.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover"/>`;};reader.readAsDataURL(file);}
function previewEditStuPhoto(input){const file=input.files[0];if(!file)return;if(file.size>2*1024*1024){alert("Photo too large. Max 2MB.");return;}const reader=new FileReader();reader.onload=ev=>{formData._photoData=ev.target.result;const prev=document.getElementById("edit-stu-photo-preview");if(prev)prev.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover"/>`;};reader.readAsDataURL(file);}
function previewEditTeachPhoto(input){const file=input.files[0];if(!file)return;if(file.size>2*1024*1024){alert("Photo too large. Max 2MB.");return;}const reader=new FileReader();reader.onload=ev=>{formData._photoData=ev.target.result;const prev=document.getElementById("edit-teach-photo-preview");if(prev)prev.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover"/>`;};reader.readAsDataURL(file);}

// ─── EDIT STUDENT / TEACHER ───
function openEditStudent(sid){const s=students.find(x=>x.id===sid);if(s){formData={...s,_photoData:null};modalState="editStudent";render();initStudentClassDropdown(s.classId||s.class_id||null, s.sectionId||s.section_id||null);}}
function openEditTeacher(tid){const t=teachers.find(x=>x.id===tid);if(t){formData={...t,_photoData:null};modalState="editTeacher";render();}}
// NOTE: confirmDelStudent is also defined in api.js (which loads after this file).
// The api.js version (which actually calls the backend) will override this one.
function confirmDelStudent(sid){if(confirm("Are you sure you want to delete this student?")){students=students.filter(s=>s.id!==sid);if(modalState==="viewStudent"||modalState==="editStudent"){closeModal();}else{refreshContent();}}}
function changeStudentPhoto(sid,input){const file=input.files[0];if(!file)return;if(file.size>2*1024*1024){alert("Photo too large. Maximum is 2MB.");return;}const reader=new FileReader();reader.onload=async ev=>{const s=students.find(x=>x.id===sid);if(s){s.photo=ev.target.result;formData={...s};}render();try{const res=await fetch(`/api/students/${sid}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({photo:ev.target.result})});const d=await res.json();if(!d.success)alert('Photo update failed: '+(d.error||'Unknown error'));}catch(e){console.error('Photo update error:',e);}};reader.readAsDataURL(file);}

// ─── NAVIGATION & ATTENDANCE ───
function openComplaint(sid){formData={studentId:sid,message:""};modalState="addComplaint";render();}
function viewStudent(sid){const s=students.find(x=>x.id===sid);if(s){formData={...s};modalState="viewStudent";render();}}
// NOTE: delStudent, delTeacher, delExam, submitEditStudent, submitEditTeacher,
//       submitAddStudent, submitAddTeacher, submitAddExam, submitAddNotice, submitComplaint
//       are ALL properly defined in api.js (loaded after this file).
//       Those api.js versions call the backend and reload data — they win.
function delNotice(nid){notices=notices.filter(n=>n.id!==nid);refreshContent();}
function markPaid(sid){const s=students.find(x=>x.id===sid);if(s){s.feeStatus="paid";const v=(feeVouchers[s.id]||[])[0];if(v){v.status="paid";v.paidDate=today;}refreshContent();}}
function revertFee(sid){if(!confirm("Revert paid status to Pending?"))return;const s=students.find(x=>x.id===sid);if(s){s.feeStatus="pending";const v=(feeVouchers[s.id]||[])[0];if(v){v.status="pending";v.paidDate=null;}refreshContent();}}
function setFeeStatus(sid,status){const s=students.find(x=>x.id===sid);if(s){s.feeStatus=status;const v=(feeVouchers[s.id]||[])[0];if(v){v.status=status;if(status==="paid")v.paidDate=today;else v.paidDate=null;}refreshContent();}}
function togglePortal(type,id){if(type==="student"){const s=students.find(x=>x.id===id);if(s)s.portal=s.portal==="active"?"inactive":"active";}else{const t=teachers.find(x=>x.id===id);if(t)t.portal=t.portal==="active"?"inactive":"active";}refreshContent();}
function bulkAtt(status){const filtered=students.filter(s=>{const cm=attFilter.class_id?(s.class_id===attFilter.class_id||s.classId===attFilter.class_id):s.cls===attFilter.cls;const sm=attFilter.section_id?(s.section_id===attFilter.section_id||s.sectionId===attFilter.section_id):true;return cm&&sm;});filtered.forEach(s=>{if(!attendance[s.id])attendance[s.id]={};attendance[s.id][attFilter.date]=status;});refreshContent();const payload={date:attFilter.date,status};if(attFilter.class_id){payload.class_id=attFilter.class_id;if(attFilter.section_id)payload.section_id=attFilter.section_id;}else{payload.cls=attFilter.cls;}fetch('/api/attendance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(e=>console.error('Bulk att error:',e));}
function bulkSubjectAtt(status,ids){ids.forEach(sid=>{if(!attendance[sid])attendance[sid]={};attendance[sid][attFilter.date]=status;});refreshContent();const t=teachers.find(x=>x.id===currentUser?.id);const subj=t?.subject||'';fetch('/api/attendance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subjectBulk:subj,cls:attFilter.cls,date:attFilter.date,status})}).catch(e=>console.error('Subject bulk att error:',e));}
function saveExamGrade(sid,subj,examId,val){if(!grades[sid])grades[sid]={};if(!grades[sid][subj])grades[sid][subj]={midterm:0,final:0,internal:0,total:0};grades[sid][subj]["exam_"+examId]=Number(val);}
function markAtt(sid,status){if(!attendance[sid])attendance[sid]={};attendance[sid][attFilter.date]=status;refreshContent();fetch('/api/attendance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:sid,date:attFilter.date,status})}).catch(e=>console.error('Att error:',e));}
function updateGrade(sid,sub,field,val){if(!grades[sid])grades[sid]={};if(!grades[sid][sub])grades[sid][sub]={midterm:0,final:0,internal:0,total:0};grades[sid][sub][field]=Number(val);const g=grades[sid][sub];g.total=(g.midterm||0)+(g.final||0)+(g.internal||0);}
function uploadTT(tid,input){const file=input.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>{timetables[tid]={name:file.name,data:ev.target.result,uploadedAt:today};refreshContent();};r.readAsDataURL(file);}
function printReport(){window.print();}
function openGradeSubmission(subId){formData={subId,grade:"",feedback:""};modalState="gradeSubmission";render();}
function submitAssignment(assignmentId,studentId,studentName,cls,input){const file=input.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>{const newSub={id:"SUB"+Date.now(),assignmentId,studentId,studentName,cls,fileData:ev.target.result,fileName:file.name,submittedAt:today,grade:null,feedback:"",status:"submitted"};window["sub_"+newSub.id+"_data"]=ev.target.result;submissions.push(newSub);refreshContent();alert("✅ Assignment submitted!");};reader.readAsDataURL(file);}
function submitGrade(){const subId=formData.subId;const grade=parseInt(document.getElementById("f-grade")?.value||formData.grade||"0");const feedback=document.getElementById("f-feedback")?.value||formData.feedback||"";if(isNaN(grade)||grade<0||grade>100){alert("Please enter a valid grade (0–100)");return;}const sub=submissions.find(s=>s.id===subId);if(sub){sub.grade=grade;sub.feedback=feedback;sub.status="graded";}closeModal();}
function submitCreateAssignment(){const title=(document.getElementById("f-title")?.value||formData.title||"").trim();if(!title){alert("Please enter assignment title");return;}const teacher=teachers.find(x=>x.id===currentUser?.id);const dueDate=document.getElementById("f-dueDate")?.value||formData.dueDate||"";if(!dueDate){alert("Please set a due date");return;}const newA={id:"A"+Date.now(),title,subject:document.getElementById("f-subject")?.value||formData.subject||SUBJECTS[0],cls:document.getElementById("f-cls")?.value||formData.cls||"CS-A",teacherId:currentUser.id,teacherName:teacher?.name||"Teacher",dueDate,description:document.getElementById("f-description")?.value||formData.description||"",createdAt:today};assignments.push(newA);closeModal();}

// ================================================================
// SECTION 30 — PDF / EXCEL DOWNLOADS
// ----------------------------------------------------------------
// These functions open a new browser window with a print-ready
// HTML page, or trigger a CSV file download.
//
//   downloadReportPDF()          — current report → print window
//   downloadReportExcel()        — current report → .csv download
//   downloadPerformanceReport()  — class performance → print + CSV
//   downloadStudentGradesPDF(sid)— individual grade sheet → print
//   downloadMarksSheetExcel()    — all marks → .csv
//   printFeeVoucher(sid, no)     — single installment voucher → print
//   printInstallmentReceipt(sid, no) — paid receipt → print
// ================================================================
