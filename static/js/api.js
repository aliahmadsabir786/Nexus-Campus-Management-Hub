/* ================================================================
   js/api.js  —  NEXus Solution CMS
   ================================================================ */

/* ── Duplicate-load guard (spec §21) ─────────────────────────────
   Several handlers finish by refreshing everything, and a fast double
   click used to fire two identical waves of ~15 requests at the server.
   Callers now share whichever load is already in flight. */
let _loadInFlight = null;
function loadAllDataFromDB() {
  if (_loadInFlight) return _loadInFlight;
  _loadInFlight = _loadAllDataFromDB().finally(() => { _loadInFlight = null; });
  return _loadInFlight;
}

async function _loadAllDataFromDB() {
  const isAdmin    = !!(currentUser && currentUser.role === 'admin');
  const isFullAdm  = isAdmin && !currentUser.isSubAdmin;
  try {
    // One wave instead of four. Grades, fees and sub-admins do not depend on
    // anything in this batch, so waiting for the students list before asking
    // for them only added round trips (spec §21).
    const [stuRes, tchRes, examRes, noticeRes, compRes, assignRes, clsRes, secRes,
           gRes, fRes, saRes] = await Promise.all([
      fetch('/api/students'),
      fetch('/api/teachers'),
      fetch('/api/exams'),
      fetch('/api/notices'),
      fetch('/api/complaints'),
      fetch('/api/assignments'),
      fetch('/api/classes/dropdown'),
      fetch('/api/sections/dropdown'),
      fetch('/api/grades'),
      fetch('/api/fees'),
      isFullAdm ? fetch('/api/subadmins') : Promise.resolve(null),
    ]);

    // ── Students ──
    if (stuRes.ok) students = (await stuRes.json()).map(s=>({...s,feeStatus:s.fee_status||s.feeStatus||"pending",subjectGroup:s.subject_group||s.subjectGroup||"Computer Science",rollNo:s.roll_no||s.rollNo||"",guardianPhone:s.guardian_phone||s.guardianPhone||"",portal:s.portal||"active",photo:s.photo||null}));

    // ── Classes & Sections dropdowns ──
    if (clsRes.ok) {
      dbClasses = await clsRes.json();
      window.dbClasses = dbClasses;
      if (!dbClasses.length) {
        // Fallback: unique cls strings from students
        dbClasses = [...new Set(students.map(s=>s.cls).filter(Boolean))].sort()
          .map(c=>({id:c, name:c, code:c}));
        window.dbClasses = dbClasses;
      }
    }
    if (secRes.ok) {
      dbSections = await secRes.json();
      window.dbSections = dbSections;
    }

    // ── attFilter defaults ──
    if (dbClasses.length && !attFilter.class_id) {
      attFilter.class_id = dbClasses[0].id;
      attFilter.cls      = dbClasses[0].code || dbClasses[0].name;
    }
    if (tchRes.ok)    teachers    = (await tchRes.json()).map(t=>({...t,joinDate:t.join_date||t.joinDate||"",portal:t.portal||"active",photo:t.photo||null}));
    if (examRes.ok)   exams       = (await examRes.json()).map(e=>({...e,date:e.exam_date||e.date||''}));
    if (noticeRes.ok) notices     = (await noticeRes.json()).map(n=>({...n,date:n.created_date||n.date||''}));
    if (compRes.ok)   complaints  = (await compRes.json()).map(c=>({...c,date:c.created_date||c.date||''}));
    if (assignRes.ok) assignments = (await assignRes.json()).map(a=>({...a,dueDate:a.due_date||a.dueDate||'',createdAt:a.created_date||a.createdAt||''}));

    // Grades — response already collected above
    if (gRes && gRes.ok) grades = await gRes.json();

    // Attendance — teacher: subject-based + full week; admin: class-based
    if (currentUser && currentUser.role === 'teacher') {
      // Teacher: load full week attendance for all their students (for graph + today marking)
      const weekFetches = weekDays.map(d => fetch(`/api/teacher/${currentUser.id}/students?date=${d}`));
      const weekResults = await Promise.allSettled(weekFetches);
      // The bodies are parsed here rather than in a detached .then(): the old
      // version resolved after refreshContent() had already drawn the charts,
      // so the week graph could render a day short (spec §21).
      await Promise.all(weekResults.map(async (result, idx) => {
        const d = weekDays[idx];
        if (result.status !== 'fulfilled' || !result.value.ok) return;
        let subjStudents = [];
        try { subjStudents = await result.value.json(); } catch (_) { return; }
        subjStudents.forEach(s => {
          if (!students.find(x => x.id === s.id)) {
            students.push({...s, feeStatus:s.fee_status||s.feeStatus||'pending',
              subjectGroup:s.subject_group||s.subjectGroup||'Computer Science',
              rollNo:s.roll_no||s.rollNo||'', guardianPhone:s.guardian_phone||s.guardianPhone||'',
              portal:s.portal||'active', photo:s.photo||null});
          }
          if (!attendance[s.id]) attendance[s.id] = {};
          attendance[s.id][d] = s.attendanceStatus || 'absent';
        });
      }));
      // The selected day is usually one of the week days above, in which case
      // it is already in hand — only fetch it when it really is missing.
      const teacherSubjRes = weekDays.includes(attFilter.date)
        ? null
        : await fetch(`/api/teacher/${currentUser.id}/students?date=${attFilter.date}`);
      if (teacherSubjRes && teacherSubjRes.ok) {
        const subjStudents = await teacherSubjRes.json();
        subjStudents.forEach(s => {
          if (!students.find(x => x.id === s.id)) {
            students.push({...s, feeStatus:s.fee_status||s.feeStatus||'pending',
              subjectGroup:s.subject_group||s.subjectGroup||'Computer Science',
              rollNo:s.roll_no||s.rollNo||'', guardianPhone:s.guardian_phone||s.guardianPhone||'',
              portal:s.portal||'active', photo:s.photo||null});
          }
          if (!attendance[s.id]) attendance[s.id] = {};
          attendance[s.id][attFilter.date] = s.attendanceStatus || 'absent';
        });
      }
    } else if (currentUser && currentUser.role === 'student') {
      // Student: load own full attendance history for chart + calendar
      try {
        const sAttRes = await fetch(`/api/attendance/student/${currentUser.id}`);
        if (sAttRes.ok) {
          const sAttData = await sAttRes.json();
          if (!attendance[currentUser.id]) attendance[currentUser.id] = {};
          Object.assign(attendance[currentUser.id], sAttData);
        }
      } catch(e) { console.error('Student att load error:', e); }
    } else {
      // Admin: load all attendance for selected class + full week for charts
      const weekAdminFetches = weekDays.map(d => fetch(`/api/attendance?date=${d}`));
      const weekAdminResults = await Promise.allSettled(weekAdminFetches);
      // Awaited for the same reason as the teacher branch above: the charts are
      // drawn as soon as this function returns.
      await Promise.all(weekAdminResults.map(async (result, idx) => {
        const d = weekDays[idx];
        if (result.status !== 'fulfilled' || !result.value.ok) return;
        let attRows = [];
        try { attRows = await result.value.json(); } catch (_) { return; }
        attRows.forEach(r => {
          if (!attendance[r.id]) attendance[r.id] = {};
          attendance[r.id][d] = r.status;
        });
      }));
      const aRes = await fetch(`/api/attendance?cls=${attFilter.cls}&date=${attFilter.date}`);
      if (aRes.ok) {
        const attRows = await aRes.json();
        attRows.forEach(r => {
          if (!attendance[r.id]) attendance[r.id] = {};
          attendance[r.id][attFilter.date] = r.status;
        });
      }
    }

    // Sub-admins — only requested for a full admin, so the guard is the null check
    if (saRes && saRes.ok) subAdmins = await saRes.json();

    // Fee data — response already collected above
    if (fRes && fRes.ok) {
      const feeData = await fRes.json();
      feeData.forEach(item => {
        const s = item.student;
        if (s) {
          feeVouchers[s.id] = (item.vouchers || []).map(v => ({
            ...v, dueDate: v.due_date || v.dueDate, paidDate: v.paid_date || v.paidDate
          }));
          if (item.installments) {
            feeInstallments[s.id] = {
              totalFee: item.installments.total_fee,
              session: item.installments.session,
              installments: (item.installments.installments || []).map(i => ({
                no: i.inst_no, amount: i.amount,
                dueDate: i.due_date || i.dueDate,
                status: i.status,
                voucherNo: i.voucher_no || i.voucherNo,
                paidDate: i.paid_date || i.paidDate,
                receiptNo: i.receipt_no || i.receiptNo,
              }))
            };
          }
        }
      });
    }
  } catch(e) {
    console.error('DB load error:', e);
  }
  refreshContent();
}

// ── LOGIN — DB se ──
// The department/campus chosen on the selection screens travels with the
// credentials as a *claim*.  /api/login validates it against the
// departments/campuses tables and against the account's own institution,
// then answers with the authoritative context we display (spec §13/§14).
/**
 * Report a failed sign-in.
 *
 * Deliberately does NOT call render(): a re-render rebuilds the whole form
 * and throws away the User ID the person just typed, which makes a genuine
 * typo feel like a much bigger failure than it is.  The message is written
 * straight into the always-present #login-err-slot instead, and also raised
 * as a toast so it is announced even if the slot is scrolled out of view
 * (spec §13 — no browser alerts).
 *
 * The wording is whatever the server sent.  routes/auth.py answers every
 * bad-credential case with the same generic "Invalid username or password"
 * so nothing here can leak whether the account exists.
 */
function _loginFailed(message) {
  loginErr = message;
  const slot = document.getElementById('login-err-slot');
  if (slot) {
    slot.innerHTML = `<div class="login-err"><span>⚠️</span>${esc(message)}</div>`;
  }
  const pwd = document.getElementById('l-pwd');
  if (pwd) { pwd.value = ''; pwd.focus(); }
  showToast('error', message);
}

async function doLogin() {
  const btn = document.getElementById('login-submit');
  const uid = (document.getElementById('l-uid')?.value || '').trim();
  const pwd = (document.getElementById('l-pwd')?.value || '').trim();

  // Empty fields never reach the server — there is nothing to authenticate
  // and a round trip would only slow the correction down.
  if (!uid || !pwd) {
    _loginFailed(!uid && !pwd ? 'Enter your user ID and password.'
                : !uid       ? 'Enter your user ID.'
                :              'Enter your password.');
    if (!uid) document.getElementById('l-uid')?.focus();
    return;
  }

  loginErr = '';
  const slot = document.getElementById('login-err-slot');
  if (slot) slot.innerHTML = '';

  await withBusy(btn, async () => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          role: loginRole, username: uid, password: pwd,
          department: appContext.departmentCode || appContext.department,
          campus:     appContext.campus,
        })
      });
      const data = await res.json().catch(() => ({}));
      // A session exists only if the server says so — every failure path,
      // including 401/403, lands in _loginFailed (spec §2).
      if (res.ok && data.success && data.user) {
        currentUser = {
          id: data.user.id,
          role: data.user.role,
          name: data.user.name,
          isSubAdmin: data.user.isSubAdmin || false,
          permissions: data.user.permissions || [],
          context: data.user.context || null
        };
        hydrateContext(data.user.context);
        clearContextCaches();
        currentPage = 'dashboard';
        loginErr = '';
        render();
        showToast('success', `Welcome back, ${currentUser.name}.`);
        await loadAllDataFromDB();
      } else {
        _loginFailed(data.error || 'Invalid username or password');
      }
    } catch(e) {
      _loginFailed('Could not reach the server. Please check your connection and try again.');
    }
  }, 'Signing in…');
}

// ── LOGOUT ──
// Clears the session server-side and drops every cached record, then
// returns to the Department Selection screen (spec §19).
async function doLogout() {
  try { await fetch('/api/logout', {method:'POST'}); } catch(e) {}
  currentUser = null; loginErr = ''; loginRole = 'admin';
  clearContextCaches();
  resetContext();
  render();
}

/**
 * Forget everything loaded for the previous institution so a new context
 * can never render another campus's cached rows.
 */
function clearContextCaches() {
  students = []; teachers = []; exams = []; notices = []; complaints = [];
  assignments = []; submissions = []; subAdmins = [];
  grades = {}; attendance = {}; timetables = {};
  feeVouchers = {}; feeInstallments = {};
  dbClasses = []; dbSections = [];
  window.dbClasses = dbClasses; window.dbSections = dbSections;
  _cachedClasses = null;
  _cachedSectionsByClass = {};
  attFilter.class_id = null; attFilter.section_id = null;
  gradesFilter.class_id = null;
  reportFilter.class_id = null;
}

/* ================================================================
   SHARED SUBMIT PLUMBING  (spec §14, §15, §23)
   ================================================================
   Every handler below reports through the one notification system and locks
   its own button while the request is in flight, so a double click cannot
   create the same record twice.
   ================================================================ */

/**
 * The button that fired the current inline onclick. Read synchronously at the
 * top of a handler — window.event is stale after the first await.
 */
function _submitBtn() {
  const ev = window.event;
  let el = ev && (ev.currentTarget || ev.target);
  if (el && el.tagName !== 'BUTTON' && el.closest) el = el.closest('button');
  if (!el || el.tagName !== 'BUTTON') {
    const a = document.activeElement;
    el = (a && a.tagName === 'BUTTON') ? a : null;
  }
  return el;
}

/** Message for a failed write, without leaking server internals. */
function _writeFailed(data, fallback) {
  notify.fromError(data, fallback);
}

/**
 * Credentials for a newly created account, shown once in a dialog the admin
 * can actually read and copy from (a toast would time out mid-sentence).
 * The server generates these on create; nothing stored is ever echoed back.
 */
function _showNewCredentials(kind, id, password) {
  showModal({
    title:    kind + ' created',
    subtitle: 'Hand these over now — the password is not shown again.',
    tone:     'success',
    size:     'sm',
    body:
      '<div class="nx-cred"><span class="nx-cred__k">Login ID</span>' +
        '<span class="nx-cred__v">' + esc(id || '—') + '</span></div>' +
      '<div class="nx-cred"><span class="nx-cred__k">Password</span>' +
        '<span class="nx-cred__v">' + esc(password || '—') + '</span></div>' +
      '<div class="nx-modal__note">They can change it from their own profile ' +
      'after signing in for the first time.</div>',
    actions: [{ label: 'Done', tone: 'primary' }],
  });
}

// ── ADD STUDENT ──
async function submitAddStudent() {
  const btn = _submitBtn();
  const name = (document.getElementById('f-name')?.value || '').trim();
  if (!name) { showToast('warning', 'Enter the student name.'); return; }
  const classId = document.getElementById('f-classId')?.value || '';
  if (!classId) { showToast('warning', 'Select a class.'); return; }
  // Resolve class name for the cls field (legacy text field kept for compatibility)
  const classEl = document.getElementById('f-classId');
  const clsName = classEl?.options[classEl.selectedIndex]?.text || classId;
  const sectionId = document.getElementById('f-sectionId')?.value || null;
  const pwd = (document.getElementById('f-password')?.value || '1234').trim();
  const body = {
    name, password: pwd,
    cls: clsName,
    classId: parseInt(classId) || null,
    sectionId: sectionId ? (parseInt(sectionId) || null) : null,
    subjectGroup: document.getElementById('f-subjectGroup')?.value || 'Computer Science',
    phone: document.getElementById('f-phone')?.value || '',
    guardianPhone: document.getElementById('f-guardianPhone')?.value || '',
    email: document.getElementById('f-email')?.value || '',
    feeStatus: document.getElementById('f-feeStatus')?.value || 'pending',
    dob: document.getElementById('f-dob')?.value || '',
    photo: formData._photoData || null,
  };
  await withBusy(btn, async () => {
    try {
      const res = await fetch('/api/students', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
      const data = await res.json();
      if (!res.ok || !data.success) { _writeFailed(data, 'Could not add the student.'); return; }
      closeModal();
      await loadAllDataFromDB();
      showToast('success', `${name} added to ${clsName}.`);
      _showNewCredentials('Student', data.id, data.plainPassword);
    } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
  }, 'Saving…');
}

// ── EDIT STUDENT ──
async function submitEditStudent(sid) {
  const btn = _submitBtn();
  const g = (id) => document.getElementById(id)?.value || formData[id.replace('f-','')] || '';
  const name = g('f-name').trim();
  if (!name) { showToast('warning', 'Name cannot be empty.'); return; }
  const classIdVal = document.getElementById('f-classId')?.value || '';
  const classEl2 = document.getElementById('f-classId');
  const clsName2 = classEl2?.options[classEl2?.selectedIndex]?.text || '';
  const sectionIdVal = document.getElementById('f-sectionId')?.value || '';
  const body = {
    name,
    cls: clsName2 || g('f-cls'),
    classId: classIdVal ? (parseInt(classIdVal) || null) : undefined,
    sectionId: sectionIdVal ? (parseInt(sectionIdVal) || null) : undefined,
    subjectGroup: g('f-subjectGroup'),
    phone: g('f-phone'), guardianPhone: g('f-guardianPhone'),
    email: g('f-email'), dob: g('f-dob'), feeStatus: g('f-feeStatus'),
  };
  const pwd = g('f-password').trim(); if (pwd) body.password = pwd;
  if (formData._photoData) body.photo = formData._photoData;
  await withBusy(btn, async () => {
    try {
      const res = await fetch(`/api/students/${sid}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
      const data = await res.json();
      if (!res.ok || !data.success) { _writeFailed(data, 'Could not update the student.'); return; }
      if (currentUser && currentUser.id === sid) currentUser.name = name;
      closeModal();
      await loadAllDataFromDB();
      showToast('success', `${name} updated.`);
    } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
  }, 'Saving…');
}

// ── DELETE STUDENT ──
async function delStudent(sid) {
  const s = students.find(x => x.id === sid);
  if (!await confirmAction({
    title:   'Delete student',
    message: `Delete ${s ? s.name : 'this student'}?`,
    note:    'Attendance, grades and fee records for this student go with them. This cannot be undone.',
    confirmLabel: 'Delete student',
  })) return;
  try {
    const res  = await fetch(`/api/students/${sid}`, {method:'DELETE'});
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) { _writeFailed(data, 'Could not delete the student.'); return; }
    students = students.filter(x => x.id !== sid);
    if (modalState === 'viewStudent' || modalState === 'editStudent') closeModal();
    refreshContent();
    showToast('success', `${s ? s.name : 'Student'} deleted.`);
  } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
}
function confirmDelStudent(sid) { return delStudent(sid); }

// ── ADD TEACHER ──
async function submitAddTeacher() {
  const btn = _submitBtn();
  const name = (document.getElementById('f-name')?.value || '').trim();
  if (!name) { showToast('warning', 'Enter the teacher name.'); return; }
  const classId   = document.getElementById('f-teachClassId')?.value   || null;
  const sectionId = document.getElementById('f-teachSectionId')?.value || null;
  const body = {
    name,
    subject: document.getElementById('f-subject')?.value || '',
    dept: document.getElementById('f-dept')?.value || '',
    qualification: document.getElementById('f-qualification')?.value || '',
    phone: document.getElementById('f-phone')?.value || '',
    email: document.getElementById('f-email')?.value || '',
    photo: formData._photoData || null,
    class_id:   classId   ? parseInt(classId)   : null,
    section_id: sectionId ? parseInt(sectionId) : null,
  };
  await withBusy(btn, async () => {
    try {
      const res = await fetch('/api/teachers', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
      const data = await res.json();
      if (!res.ok || !data.success) { _writeFailed(data, 'Could not add the teacher.'); return; }
      closeModal();
      await loadAllDataFromDB();
      showToast('success', `${name} added to the staff list.`);
      _showNewCredentials('Teacher', data.id, data.plainPassword);
    } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
  }, 'Saving…');
}

// ── EDIT TEACHER ──
async function submitEditTeacher(tid) {
  const btn = _submitBtn();
  const g = (id) => document.getElementById(id)?.value || formData[id.replace('f-','')] || '';
  const name = g('f-name').trim();
  if (!name) { showToast('warning', 'Name cannot be empty.'); return; }
  const classId   = document.getElementById('f-teachClassId')?.value   || null;
  const sectionId = document.getElementById('f-teachSectionId')?.value || null;
  const body = {
    name, subject: g('f-subject'), dept: g('f-dept'),
    qualification: g('f-qualification'), phone: g('f-phone'), email: g('f-email'),
    class_id:   classId   ? parseInt(classId)   : null,
    section_id: sectionId ? parseInt(sectionId) : null,
  };
  const pwd = g('f-password').trim(); if (pwd) body.password = pwd;
  if (formData._photoData) body.photo = formData._photoData;
  await withBusy(btn, async () => {
    try {
      const res = await fetch(`/api/teachers/${tid}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
      const data = await res.json();
      if (!res.ok || !data.success) { _writeFailed(data, 'Could not update the teacher.'); return; }
      if (currentUser && currentUser.id === tid) currentUser.name = name;
      closeModal();
      await loadAllDataFromDB();
      showToast('success', `${name} updated.`);
    } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
  }, 'Saving…');
}

// ── DELETE TEACHER ──
async function delTeacher(tid) {
  const t = teachers.find(x => x.id === tid);
  if (!await confirmAction({
    title:   'Remove teacher',
    message: `Remove ${t ? t.name : 'this teacher'} from the staff list?`,
    note:    'Their classes are left without an assigned teacher. This cannot be undone.',
    confirmLabel: 'Remove teacher',
  })) return;
  try {
    const res  = await fetch(`/api/teachers/${tid}`, {method:'DELETE'});
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) { _writeFailed(data, 'Could not remove the teacher.'); return; }
    teachers = teachers.filter(x => x.id !== tid);
    refreshContent();
    showToast('success', `${t ? t.name : 'Teacher'} removed.`);
  } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
}

// ── MARK ATTENDANCE ──
async function markAtt(sid, status) {
  if (!attendance[sid]) attendance[sid] = {};
  attendance[sid][attFilter.date] = status;
  refreshContent();
  try {
    await fetch('/api/attendance', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({studentId: sid, date: attFilter.date, status})});
  } catch(e) { console.error('Att error:', e); }
}

// ── BULK ATTENDANCE (Admin — by class) ──
async function bulkAtt(status) {
  // Filter students matching current class + section selection
  const cls_students = students.filter(s => {
    const classMatch = attFilter.class_id
      ? (s.class_id === attFilter.class_id || s.classId === attFilter.class_id)
      : s.cls === attFilter.cls;
    const sectionMatch = attFilter.section_id
      ? (s.section_id === attFilter.section_id || s.sectionId === attFilter.section_id)
      : true;
    return classMatch && sectionMatch;
  });

  // Optimistic UI update
  cls_students.forEach(s => { if(!attendance[s.id])attendance[s.id]={}; attendance[s.id][attFilter.date]=status; });
  refreshContent();

  // Build payload — prefer class_id/section_id (DB-precise), fallback to cls string
  const payload = { date: attFilter.date, status };
  if (attFilter.class_id) {
    payload.class_id = attFilter.class_id;
    if (attFilter.section_id) payload.section_id = attFilter.section_id;
  } else {
    payload.cls = attFilter.cls;
  }

  try {
    await fetch('/api/attendance', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)});
  } catch(e) { console.error('Bulk att error:', e); }
}

// ── BULK ATTENDANCE (Teacher — by subject scope) ──
async function bulkSubjectAtt(status, ids) {
  // Use passed ids, fallback to globally stored visible ids
  const targetIds = (ids && ids.length) ? ids : (window._tAttVisibleIds || []);
  if (!targetIds.length) { console.warn('bulkSubjectAtt: no student ids found'); return; }

  // Optimistic UI update
  targetIds.forEach(sid => { if(!attendance[sid])attendance[sid]={}; attendance[sid][attFilter.date]=status; });
  refreshContent();

  try {
    // Post each student individually — reliable, scope-checked by backend
    await Promise.all(targetIds.map(sid =>
      fetch('/api/attendance', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({studentId: sid, date: attFilter.date, status})
      })
    ));
  } catch(e) {
    console.error('Subject bulk att error:', e);
  }
}

let _gradeTimer=null;
async function updateGrade(sid, sub, field, val) {
  if (!grades[sid]) grades[sid] = {};
  if (!grades[sid][sub]) grades[sid][sub] = {midterm:0, final:0, internal:0, total:0};
  grades[sid][sub][field] = Number(val);
  const g = grades[sid][sub];
  g.total = (g.midterm||0) + (g.final||0) + (g.internal||0);
  // Update only the total display cell without full re-render
  const totalEl = document.getElementById(`grade-total-${sid}-${sub.replace(/\s/g,'_')}`);
  if(totalEl) totalEl.innerHTML = `${g.total||0} · ${gradeLabel(g.total)}`;
  // Debounced backend save
  clearTimeout(_gradeTimer);
  _gradeTimer = setTimeout(async()=>{
    try {
      await fetch('/api/grades', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({studentId:sid, subject:sub, midterm:g.midterm, final:g.final, internal:g.internal})});
    } catch(e) { console.error('Grade error:', e); }
  }, 800);
}

// ── ADD EXAM ──
async function submitAddExam() {
  const btn = _submitBtn();
  const title = (document.getElementById('f-title')?.value || '').trim();
  if (!title) { showToast('warning', 'Enter an exam title.'); return; }
  const body = {
    title, subject: document.getElementById('f-subject')?.value || '',
    cls: document.getElementById('f-cls')?.value || 'CS-A',
    date: document.getElementById('f-date')?.value || '',
    time: document.getElementById('f-time')?.value || '',
    duration: document.getElementById('f-duration')?.value || '',
    room: document.getElementById('f-room')?.value || '',
    totalMarks: document.getElementById('f-totalMarks')?.value || '100',
  };
  await withBusy(btn, async () => {
    try {
      const res = await fetch('/api/exams', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
      const data = await res.json();
      if (!res.ok || !data.success) { _writeFailed(data, 'Could not schedule the exam.'); return; }
      closeModal();
      await loadAllDataFromDB();
      showToast('success', `Exam "${title}" scheduled.`);
    } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
  }, 'Saving…');
}

// ── DELETE EXAM ──
async function delExam(eid) {
  const x = exams.find(e => e.id === eid);
  if (!await confirmAction({
    title:   'Delete exam',
    message: `Delete "${x ? x.title : 'this exam'}" from the schedule?`,
    note:    'Marks already recorded against this exam are removed too. This cannot be undone.',
    confirmLabel: 'Delete exam',
  })) return;
  try {
    const res  = await fetch(`/api/exams/${eid}`, {method:'DELETE'});
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) { _writeFailed(data, 'Could not delete the exam.'); return; }
    exams = exams.filter(e => e.id !== eid);
    refreshContent();
    showToast('success', 'Exam deleted.');
  } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
}

// ── ADD NOTICE ──
async function submitAddNotice() {
  const btn = _submitBtn();
  const title = (document.getElementById('f-title')?.value || '').trim();
  if (!title) { showToast('warning', 'Enter a notice title.'); return; }
  const body = {
    title, type: document.getElementById('f-type')?.value || 'academic',
    author: document.getElementById('f-author')?.value || 'Admin',
  };
  await withBusy(btn, async () => {
    try {
      const res = await fetch('/api/notices', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
      const data = await res.json();
      if (!res.ok || !data.success) { _writeFailed(data, 'Could not publish the notice.'); return; }
      closeModal();
      await loadAllDataFromDB();
      showToast('success', 'Notice published.');
    } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
  }, 'Publishing…');
}

// ── DELETE NOTICE ──
async function delNotice(nid) {
  const n = notices.find(x => x.id === nid);
  if (!await confirmAction({
    title:   'Delete notice',
    message: `Delete "${n ? n.title : 'this notice'}"?`,
    confirmLabel: 'Delete notice',
  })) return;
  try {
    const res  = await fetch(`/api/notices/${nid}`, {method:'DELETE'});
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) { _writeFailed(data, 'Could not delete the notice.'); return; }
    notices = notices.filter(x => x.id !== nid);
    refreshContent();
    showToast('success', 'Notice deleted.');
  } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
}

// ── ADD COMPLAINT ──
async function submitComplaint() {
  const btn = _submitBtn();
  const sid = document.getElementById('f-studentId')?.value || formData.studentId || '';
  const msg = (document.getElementById('f-message')?.value || '').trim();
  if (!sid) { showToast('warning', 'Select a student first.'); return; }
  if (!msg) { showToast('warning', 'Write the complaint before sending it.'); return; }
  await withBusy(btn, async () => {
    try {
      const res = await fetch('/api/complaints', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({studentId: sid, message: msg})});
      const data = await res.json();
      if (!res.ok || !data.success) { _writeFailed(data, 'Could not file the complaint.'); return; }
      closeModal();
      await loadAllDataFromDB();
      showToast('success', 'Complaint filed.');
    } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
  }, 'Sending…');
}

// ── FEE STATUS ──
async function setFeeStatus(sid, status) {
  const s = students.find(x => x.id === sid); if (s) s.feeStatus = status;
  refreshContent();
  try {
    const res  = await fetch(`/api/fees/${sid}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({status})});
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) { _writeFailed(data, 'Could not save the fee status.'); }
    await loadAllDataFromDB();
  } catch(e) {
    console.error('Fee error:', e);
    showToast('error', 'Could not reach the server — the fee status was not saved.');
  }
}
async function markPaid(sid) { await setFeeStatus(sid, 'paid'); showToast('success', 'Fee marked as paid.'); }
async function revertFee(sid) {
  if (!await confirmAction({
    title:   'Revert fee status',
    tone:    'warning',
    icon:    '↺',
    message: 'Set this fee back to Pending?',
    note:    'The recorded payment date is cleared.',
    confirmLabel: 'Revert to pending',
  })) return;
  await setFeeStatus(sid, 'pending');
  showToast('success', 'Fee reverted to pending.');
}

// ── FEE PLAN ──
async function submitCreateFeePlan(sid) {
  const btn = _submitBtn();
  const tf = Number(document.getElementById('f-totalFee')?.value || 0);
  const sess = (document.getElementById('f-session')?.value || '2025-26').trim();
  const d1 = document.getElementById('f-due1')?.value || '';
  const d2 = document.getElementById('f-due2')?.value || '';
  const d3 = document.getElementById('f-due3')?.value || '';
  if (!tf || tf < 1) { showToast('warning', 'Enter a valid total fee.'); return; }
  if (!d1 || !d2 || !d3) { showToast('warning', 'Fill all three due dates.'); return; }
  await withBusy(btn, async () => {
    try {
      const res = await fetch(`/api/fees/${sid}/plan`, {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({totalFee: tf, session: sess, due1: d1, due2: d2, due3: d3})});
      const data = await res.json();
      if (!res.ok || !data.success) { _writeFailed(data, 'Could not create the fee plan.'); return; }
      closeModal();
      await loadAllDataFromDB();
      showToast('success', 'Fee plan created — 3 installment vouchers are ready to print.');
    } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
  }, 'Saving…');
}

// ── MARK INSTALLMENT PAID ──
async function markInstallmentPaid(sid, no) {
  try {
    const res  = await fetch(`/api/fees/${sid}/installment/${no}/pay`, {method:'POST'});
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) { _writeFailed(data, 'Could not record the payment.'); return; }
    await loadAllDataFromDB();
    showToast('success', `Installment ${no} marked as paid.`);
    setTimeout(() => printInstallmentReceipt(sid, no), 300);
  } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
}

async function revertInstallmentPaid(sid, no) {
  if (!await confirmAction({
    title:   'Revert installment',
    tone:    'warning',
    icon:    '↺',
    message: `Mark installment ${no} as pending again?`,
    note:    'The payment date and receipt number are cleared.',
    confirmLabel: 'Revert to pending',
  })) return;
  try {
    const res  = await fetch(`/api/fees/${sid}/installment/${no}/revert`, {method:'POST'});
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) { _writeFailed(data, 'Could not revert the installment.'); return; }
    await loadAllDataFromDB();
    showToast('success', `Installment ${no} reverted to pending.`);
  } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
}

// ── PORTAL TOGGLE ──
async function togglePortal(type, id) {
  try {
    const url = type === 'student' ? `/api/portal/student/${id}` : `/api/portal/teacher/${id}`;
    const res = await fetch(url, {method:'POST'});
    const data = await res.json();
    if (!res.ok || !data.success) { _writeFailed(data, 'Could not change portal access.'); return; }
    if (type === 'student') { const s = students.find(x=>x.id===id); if(s) s.portal = data.portal; }
    else { const t = teachers.find(x=>x.id===id); if(t) t.portal = data.portal; }
    refreshContent();
    showToast('success', data.portal === 'active' ? 'Portal access enabled.' : 'Portal access disabled.');
  } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
}

// ── SUB-ADMINS ──
async function submitAddSubAdmin() {
  const btn = _submitBtn();
  const name = (document.getElementById('f-name')?.value || '').trim();
  const username = (document.getElementById('f-username')?.value || '').trim();
  const password = (document.getElementById('f-password')?.value || '').trim();
  if (!name) { showToast('warning', 'Enter a name.'); return; }
  if (!username) { showToast('warning', 'Enter a username.'); return; }
  if (!password) { showToast('warning', 'Enter a password.'); return; }
  if (username === 'admin') { showToast('error', "The username 'admin' is reserved for the main administrator."); return; }
  await withBusy(btn, async () => {
    try {
      const res = await fetch('/api/subadmins', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({name, username, password, permissions: subAdminPermsSelected})});
      const data = await res.json();
      if (!res.ok || !data.success) { _writeFailed(data, 'Could not create the sub-admin.'); return; }
      closeModal();
      await loadAllDataFromDB();
      // The password was typed by the admin, so it is deliberately NOT echoed back (spec §3).
      showToast('success', `Sub-admin "${name}" created. They sign in as ${username} on the Admin tab.`);
    } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
  }, 'Creating…');
}

async function submitEditSubAdmin(id) {
  const btn = _submitBtn();
  const name = (document.getElementById('f-name')?.value || '').trim();
  const username = (document.getElementById('f-username')?.value || '').trim();
  const pwd = (document.getElementById('f-password')?.value || '').trim();
  if (!name) { showToast('warning', 'Name cannot be empty.'); return; }
  if (!username) { showToast('warning', 'Username cannot be empty.'); return; }
  const body = {name, username, permissions: subAdminPermsSelected};
  if (pwd) body.password = pwd;
  await withBusy(btn, async () => {
    try {
      const res = await fetch(`/api/subadmins/${id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
      const data = await res.json();
      if (!res.ok || !data.success) { _writeFailed(data, 'Could not update the sub-admin.'); return; }
      if (currentUser && currentUser.id === id) { currentUser.name = name; currentUser.permissions = [...subAdminPermsSelected]; }
      closeModal();
      await loadAllDataFromDB();
      showToast('success', `Sub-admin "${name}" updated.`);
    } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
  }, 'Saving…');
}

async function toggleSubAdmin(id) {
  try {
    const res = await fetch(`/api/subadmins/${id}/toggle`, {method:'POST'});
    const data = await res.json();
    if (!res.ok || !data.success) { _writeFailed(data, 'Could not change that account.'); return; }
    const sa = subAdmins.find(x=>x.id===id); if(sa) sa.portal = data.portal;
    refreshContent();
    showToast('success', data.portal === 'active' ? 'Sub-admin enabled.' : 'Sub-admin disabled.');
  } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
}

async function delSubAdmin(id) {
  const sa = subAdmins.find(x => x.id === id);
  if (!await confirmAction({
    title:   'Delete sub-admin',
    message: `Delete sub-admin "${sa ? sa.name : id}"?`,
    note:    'Their account and permissions are removed. This cannot be undone.',
    confirmLabel: 'Delete sub-admin',
  })) return;
  try {
    const res  = await fetch(`/api/subadmins/${id}`, {method:'DELETE'});
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) { _writeFailed(data, 'Could not delete the sub-admin.'); return; }
    subAdmins = subAdmins.filter(x => x.id !== id);
    refreshContent();
    showToast('success', 'Sub-admin deleted.');
  } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
}

// ── CHANGE PASSWORD ──
async function submitChangePassword() {
  const cur = document.getElementById('cp-cur')?.value || '';
  const n = document.getElementById('cp-new')?.value || '';
  const c = document.getElementById('cp-conf')?.value || '';
  const msg = document.getElementById('cp-msg');
  if (!cur||!n||!c) { msg.innerHTML=`<span style="color:${T.red}">Please fill all fields.</span>`; return; }
  if (n.length < 4) { msg.innerHTML=`<span style="color:${T.red}">Min 4 characters.</span>`; return; }
  if (n !== c) { msg.innerHTML=`<span style="color:${T.red}">Passwords do not match.</span>`; return; }
  try {
    const res = await fetch('/api/change-password', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({currentPassword: cur, newPassword: n})});
    const data = await res.json();
    if (data.success) {
      msg.innerHTML=`<span style="color:${T.green};font-weight:700">✅ Password updated successfully!</span>`;
      setTimeout(()=>closeModal(), 1800);
    } else { msg.innerHTML=`<span style="color:${T.red}">${data.error}</span>`; }
  } catch(e) { msg.innerHTML=`<span style="color:${T.red}">Server error.</span>`; }
}

// ── CREATE ASSIGNMENT ──
async function submitCreateAssignment() {
  const btn = _submitBtn();
  const title = (document.getElementById('f-title')?.value || '').trim();
  if (!title) { showToast('warning', 'Enter an assignment title.'); return; }
  const dueDate = document.getElementById('f-dueDate')?.value || '';
  if (!dueDate) { showToast('warning', 'Set a due date.'); return; }
  const body = {
    title, dueDate,
    subject: document.getElementById('f-subject')?.value || '',
    cls: document.getElementById('f-cls')?.value || 'CS-A',
    description: document.getElementById('f-description')?.value || '',
  };
  await withBusy(btn, async () => {
    try {
      const res = await fetch('/api/assignments', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
      const data = await res.json();
      if (!res.ok || !data.success) { _writeFailed(data, 'Could not create the assignment.'); return; }
      closeModal();
      await loadAllDataFromDB();
      showToast('success', `Assignment "${title}" created.`);
    } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
  }, 'Saving…');
}

// ── ASSIGNMENT SUBMIT (STUDENT) ──
async function submitAssignment(assignmentId, studentId, studentName, cls, input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('warning', 'That file is over 5 MB. Please upload a smaller one.');
    input.value = '';
    return;
  }
  showToast('info', `Uploading ${file.name}…`, {duration: 2000});
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submit`, {method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({fileName: file.name, fileData: ev.target.result})});
      const data = await res.json();
      if (!res.ok || !data.success) { _writeFailed(data, 'Could not submit the assignment.'); return; }
      await loadAllDataFromDB();
      showToast('success', 'Assignment submitted.');
    } catch(e) { showToast('error', 'Could not reach the server. Please try again.'); }
  };
  reader.onerror = () => showToast('error', 'That file could not be read.');
  reader.readAsDataURL(file);
}

// ── TIMETABLE ──
async function uploadTT(tid, input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = async ev => {
    try {
      await fetch(`/api/timetable/${tid}`, {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({name: file.name, data: ev.target.result})});
      timetables[tid] = {name: file.name, data: ev.target.result, uploadedAt: today};
      refreshContent();
    } catch(e) { console.error('TT upload error:', e); }
  };
  r.readAsDataURL(file);
}

// ── ON PAGE LOAD: check if already logged in ──
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = {id: data.id, role: data.role, name: data.name, isSubAdmin: data.isSubAdmin, permissions: data.permissions || [], context: data.context || null};
      // Restore the institution context from the session, never from
      // localStorage — the server is the only authority (spec §13).
      hydrateContext(data.context);
      currentPage = 'dashboard';
      render();
      await loadAllDataFromDB();
    } else {
      // No session → Department Selection (context.js fetches the tree).
      render();
    }
  } catch(e) {
    render();
  }
});


/* ================================================================
   DYNAMIC CLASS / SECTION DROPDOWNS — Student Module Integration
   ================================================================ */

// Cache to avoid redundant fetches
let _cachedClasses = null;
let _cachedSectionsByClass = {};

/** Fetch active classes from Academics module and populate a <select> element. */
async function loadClassesDropdown(selectId, selectedClassId) {
  try {
    if (!_cachedClasses) {
      const res = await fetch('/api/classes/dropdown');
      _cachedClasses = await res.json();
    }
    const el = document.getElementById(selectId);
    if (!el) return;
    el.innerHTML = '<option value="">-- Select Class --</option>' +
      _cachedClasses.map(c =>
        `<option value="${c.id}" ${String(c.id) === String(selectedClassId) ? 'selected' : ''}>${esc ? esc(c.name) : c.name} (${c.code})</option>`
      ).join('');
    // If a class was pre-selected, load its sections too
    if (selectedClassId) {
      await loadSectionsDropdown('f-sectionId', selectedClassId, null);
    }
  } catch (e) {
    console.error('Failed to load classes dropdown:', e);
  }
}

/** Fetch sections for a given classId and populate the sections <select>. */
async function loadSectionsDropdown(selectId, classId, selectedSectionId) {
  try {
    if (!_cachedSectionsByClass[classId]) {
      const res = await fetch(`/api/sections/dropdown?class_id=${classId}`);
      _cachedSectionsByClass[classId] = await res.json();
    }
    const sections = _cachedSectionsByClass[classId] || [];
    const el = document.getElementById(selectId);
    if (!el) return;
    el.innerHTML = '<option value="">-- No Section --</option>' +
      sections.map(s =>
        `<option value="${s.id}" ${String(s.id) === String(selectedSectionId) ? 'selected' : ''}>${esc ? esc(s.name) : s.name}</option>`
      ).join('');
  } catch (e) {
    console.error('Failed to load sections dropdown:', e);
  }
}

/** Called when user changes the Class dropdown — refreshes Section dropdown. */
async function onStudentClassChange(classId, sectionSelectId) {
  const el = document.getElementById(sectionSelectId);
  if (!classId) {
    if (el) el.innerHTML = '<option value="">-- Select a class first --</option>';
    return;
  }
  if (el) el.innerHTML = '<option value="">Loading sections…</option>';
  await loadSectionsDropdown(sectionSelectId, classId, null);
}

/** Called after Add Student / Edit Student modal renders — populates dropdowns. */
function initStudentClassDropdown(selectedClassId, selectedSectionId) {
  // Use setTimeout so the DOM has rendered
  setTimeout(async () => {
    await loadClassesDropdown('f-classId', selectedClassId);
    if (selectedClassId) {
      await loadSectionsDropdown('f-sectionId', selectedClassId, selectedSectionId);
    }
  }, 0);
}

// ── TEACHER FORM — Class / Section dropdown helpers ──────────────────────────

/**
 * Populate Class + Section dropdowns in the Teacher Add/Edit modal.
 * Uses the SAME API endpoints as the Student form (/api/classes/dropdown,
 * /api/sections/dropdown?class_id=…) so no new backend route is needed.
 */
async function initTeacherClassDropdown(classSelectId, sectionSelectId, selectedClassId, selectedSectionId) {
  try {
    // Populate class dropdown (reuse shared cache)
    if (!_cachedClasses) {
      const res = await fetch('/api/classes/dropdown');
      _cachedClasses = await res.json();
    }
    const classEl = document.getElementById(classSelectId);
    if (classEl) {
      classEl.innerHTML =
        '<option value="">-- Select Class --</option>' +
        _cachedClasses.map(c =>
          `<option value="${c.id}" ${String(c.id) === String(selectedClassId) ? 'selected' : ''}>${esc ? esc(c.name) : c.name} (${c.code})</option>`
        ).join('');
    }
    // If a class was pre-selected, immediately populate sections
    if (selectedClassId) {
      await loadTeacherSectionsDropdown(sectionSelectId, selectedClassId, selectedSectionId);
    }
  } catch(e) {
    console.error('Teacher class dropdown error:', e);
  }
}

/** Fetch sections for the Teacher modal's section <select>. */
async function loadTeacherSectionsDropdown(sectionSelectId, classId, selectedSectionId) {
  try {
    if (!_cachedSectionsByClass[classId]) {
      const res = await fetch(`/api/sections/dropdown?class_id=${classId}`);
      _cachedSectionsByClass[classId] = await res.json();
    }
    const sections = _cachedSectionsByClass[classId] || [];
    const el = document.getElementById(sectionSelectId);
    if (!el) return;
    if (!sections.length) {
      el.innerHTML = '<option value="">-- No Sections for this Class --</option>';
      return;
    }
    el.innerHTML =
      '<option value="">-- No Section --</option>' +
      sections.map(s =>
        `<option value="${s.id}" ${String(s.id) === String(selectedSectionId) ? 'selected' : ''}>${esc ? esc(s.name) : s.name}</option>`
      ).join('');
  } catch(e) {
    console.error('Teacher section dropdown error:', e);
  }
}

/** Called when the Class dropdown in the Teacher form changes. */
async function onTeacherClassChange(classId, sectionSelectId) {
  const el = document.getElementById(sectionSelectId);
  if (!classId) {
    if (el) el.innerHTML = '<option value="">-- Select Class First --</option>';
    return;
  }
  if (el) el.innerHTML = '<option value="">Loading sections…</option>';
  await loadTeacherSectionsDropdown(sectionSelectId, classId, null);
}

