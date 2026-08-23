/* ================================================================
   js/bs_academic.js  —  BS Department Academic Architecture
   ================================================================
   Programs -> Curriculum versions -> Courses (reusable, never tied to
   a semester) -> Academic Sessions -> Course Offerings (actual
   semester) -> Sections -> Teaching Assignments -> Enrollment ->
   Timetable -> Attendance -> Results -> Progress.

   BS-only.  Every request already lands on a BS-scoped backend route;
   this file does not gate on department itself — shell.js only shows
   the nav entry when appContext.departmentCode === 'BS'.

 
   ================================================================ */

/* ─── Module State ──────────────────────────────────────────────── */
let bsaTab      = 'overview';   // overview | programs | courses | curriculums | sessions | batches | progress
let bsaLoading  = false;
let bsaCache    = {};           // generic per-entity cache: programs, courses, sessions, curriculums, batches
let bsaView     = {             // drill-down state for the Curriculums and Sessions tabs
  programId: null, curriculumId: null,
  sessionId: null, offeringId: null, sectionId: null, sectionTab: 'teachers',
};
let bsaProgressStudentId = '';
let bsaProgressData      = null;

/* ─── API helper ─────────────────────────────────────────────────── */
async function bsaFetch(url, opts = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
function bsaToast(msg, type = 'success') { showToast(type, msg); }

function _bsaRender() {
  const el = document.getElementById('bsa-root');
  if (el) el.innerHTML = _bsaBody();
}

/* ─── Bootstrap per-tab ──────────────────────────────────────────── */
async function bsaLoad(tab) {
  bsaLoading = true; _bsaRender();
  try {
    if (tab === 'overview')    bsaCache.overview    = await bsaFetch('/api/bs/overview');
    if (tab === 'programs')    bsaCache.programs     = await bsaFetch('/api/bs/programs');
    if (tab === 'courses')     bsaCache.courses      = await bsaFetch('/api/bs/courses');
    if (tab === 'curriculums') {
      bsaCache.programs = bsaCache.programs || await bsaFetch('/api/bs/programs');
      bsaCache.curriculums = await bsaFetch('/api/bs/curriculums');
      if (bsaView.curriculumId) await bsaLoadCurriculumDetail(bsaView.curriculumId);
    }
    if (tab === 'sessions') {
      bsaCache.sessions = await bsaFetch('/api/bs/sessions');
      if (bsaView.sessionId)  await bsaLoadSessionOfferings(bsaView.sessionId);
      if (bsaView.offeringId) await bsaLoadOfferingDetail(bsaView.offeringId);
    }
    if (tab === 'batches') {
      bsaCache.batches     = await bsaFetch('/api/bs/batches');
      bsaCache.programs    = bsaCache.programs    || await bsaFetch('/api/bs/programs');
      bsaCache.curriculums = bsaCache.curriculums || await bsaFetch('/api/bs/curriculums');
      bsaCache.sessions    = bsaCache.sessions    || await bsaFetch('/api/bs/sessions');
    }
  } catch (e) {
    bsaToast(e.message || 'Failed to load BS academic data', 'error');
  }
  bsaLoading = false; _bsaRender();
}

async function bsaLoadCurriculumDetail(cuid) {
  bsaCache.curriculumDetail = await bsaFetch(`/api/bs/curriculums/${cuid}/courses`);
  bsaCache.electiveGroups   = await bsaFetch(`/api/bs/curriculums/${cuid}/elective-groups`);
}
async function bsaLoadSessionOfferings(sid) {
  bsaCache.offerings = await bsaFetch(`/api/bs/offerings?session_id=${sid}`);
}
async function bsaLoadOfferingDetail(oid) {
  bsaCache.offeringDetail = await bsaFetch(`/api/bs/offerings/${oid}`);
}
async function bsaLoadSectionExtra(sid) {
  const t = bsaView.sectionTab;
  if (t === 'teachers')  bsaCache.secTeachers  = await bsaFetch(`/api/bs/offering-sections/${sid}/teachers`);
  if (t === 'roster')    bsaCache.secRoster    = await bsaFetch(`/api/bs/offering-sections/${sid}/students`);
  if (t === 'timetable') bsaCache.secTimetable = await bsaFetch(`/api/bs/offering-sections/${sid}/timetable`);
  if (t === 'attendance') {
    bsaCache.secAttDate = bsaCache.secAttDate || new Date().toISOString().slice(0, 10);
    bsaCache.secAttendance = await bsaFetch(`/api/bs/offering-sections/${sid}/attendance?date=${bsaCache.secAttDate}`);
  }
  if (t === 'results')   bsaCache.secRoster    = bsaCache.secRoster || await bsaFetch(`/api/bs/offering-sections/${sid}/students`);
}

function bsaSwitchTab(tab) {
  bsaTab = tab;
  bsaView = { programId: null, curriculumId: null, sessionId: null, offeringId: null, sectionId: null, sectionTab: 'teachers' };
  bsaCache = { overview: bsaCache.overview };
  bsaLoad(tab);
}

/* ─── Field builders (T-token aware, matches academic_module.js) ──── */
function bsaField(label, id, val = '', type = 'text', placeholder = '') {
  return `<div>
    <label for="${id}" style="display:block;font-size:11px;font-weight:700;color:${T.muted};margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">${esc(label)}</label>
    <input id="${id}" type="${type}" value="${esc(String(val))}" placeholder="${esc(placeholder)}"
      style="width:100%;padding:9px 12px;border:1.5px solid ${T.border2};border-radius:8px;font-size:13px;font-family:inherit;color:${T.text};background:${T.surface};box-sizing:border-box">
  </div>`;
}
function bsaTextArea(label, id, val = '', placeholder = '') {
  return `<div>
    <label for="${id}" style="display:block;font-size:11px;font-weight:700;color:${T.muted};margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">${esc(label)}</label>
    <textarea id="${id}" rows="2" placeholder="${esc(placeholder)}"
      style="width:100%;padding:9px 12px;border:1.5px solid ${T.border2};border-radius:8px;font-size:13px;font-family:inherit;color:${T.text};background:${T.surface};resize:vertical;box-sizing:border-box">${esc(String(val))}</textarea>
  </div>`;
}
function bsaSelect(label, id, options, selected = '') {
  const opts = options.map(o => `<option value="${esc(String(o.value))}" ${String(o.value) === String(selected) ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
  return `<div>
    <label for="${id}" style="display:block;font-size:11px;font-weight:700;color:${T.muted};margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">${esc(label)}</label>
    <select id="${id}" style="width:100%;padding:9px 12px;border:1.5px solid ${T.border2};border-radius:8px;font-size:13px;font-family:inherit;color:${T.text};background:${T.surface};box-sizing:border-box">
      ${opts}
    </select>
  </div>`;
}
function bsaFormErr() {
  return `<div id="bsa-form-err" style="margin-top:10px;font-size:13px;color:${T.red};text-align:center;font-weight:600;min-height:20px"></div>`;
}
function bsaSetErr(msg) { const el = document.getElementById('bsa-form-err'); if (el) el.textContent = msg; }

/* ── Lightweight self-contained popup (dark-mode aware) ──────────── */
function bsaShowPopup(html, width = 380) {
  bsaHidePopup();
  const overlay = document.createElement('div');
  overlay.id = 'bsa-popup-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:4000;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.onclick = (e) => { if (e.target === overlay) bsaHidePopup(); };
  const popup = document.createElement('div');
  popup.id = 'bsa-popup';
  popup.style.cssText = `background:${T.surface};border-radius:16px;padding:22px;width:${width}px;max-width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.25);border:1px solid ${T.border}`;
  popup.innerHTML = html;
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
}
function bsaHidePopup() { const el = document.getElementById('bsa-popup-overlay'); if (el) el.remove(); }
function bsaPopupHeader(title) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
    <h3 style="font-size:16px;font-weight:800;color:${T.text};margin:0;font-family:'Space Grotesk',sans-serif">${title}</h3>
    <button type="button" onclick="bsaHidePopup()" style="background:none;border:none;font-size:20px;cursor:pointer;color:${T.muted};padding:2px 6px;border-radius:6px">×</button>
  </div>`;
}

/* ================================================================
   ADMIN ENTRY POINT
   ================================================================ */
function renderBSAcademicAdmin() {
  if (!bsaCache.overview && !bsaLoading) bsaLoad(bsaTab);
  return `<div id="bsa-root">${_bsaBody()}</div>`;
}

function _bsaBody() {
  const TABS = [
    { key: 'overview',    label: '📊 Overview' },
    { key: 'programs',    label: '🎓 Programs' },
    { key: 'courses',     label: '📘 Courses' },
    { key: 'curriculums', label: '🧭 Curriculums' },
    { key: 'sessions',    label: '🗓️ Sessions & Offerings' },
    { key: 'batches',     label: '👥 Batches' },
    { key: 'progress',    label: '📈 Progress' },
  ];
  const tabBar = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;border-bottom:1px solid ${T.border};padding-bottom:2px">
    ${TABS.map(t => `<button type="button" onclick="bsaSwitchTab('${t.key}')" style="padding:9px 16px;border:none;border-radius:10px 10px 0 0;background:${bsaTab === t.key ? T.accentL : 'transparent'};color:${bsaTab === t.key ? T.accentD : T.muted};font-weight:${bsaTab === t.key ? 800 : 600};font-size:13px;cursor:pointer;border-bottom:2px solid ${bsaTab === t.key ? T.accent : 'transparent'};white-space:nowrap">${t.label}</button>`).join('')}
  </div>`;

  if (bsaLoading) return tabBar + card(`<div style="text-align:center;padding:40px;color:${T.muted}">Loading…</div>`);

  let body = '';
  if (bsaTab === 'overview')    body = _bsaOverview();
  if (bsaTab === 'programs')    body = _bsaPrograms();
  if (bsaTab === 'courses')     body = _bsaCourses();
  if (bsaTab === 'curriculums') body = _bsaCurriculums();
  if (bsaTab === 'sessions')    body = _bsaSessions();
  if (bsaTab === 'batches')     body = _bsaBatches();
  if (bsaTab === 'progress')    body = _bsaProgress();
  return tabBar + body;
}

/* ================================================================
   OVERVIEW TAB
   ================================================================ */
function _bsaOverview() {
  const o = bsaCache.overview || {};
  const as = o.activeSession;
  const s = o.activeSessionStats || {};
  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:22px">
    ${statCard('🎓', o.programs || 0, 'Programs', T.accent)}
    ${statCard('📘', o.courses || 0, 'Courses', T.blue)}
    ${statCard('🧭', o.curriculums || 0, 'Curriculum Versions', T.purple)}
    ${statCard('👥', o.batches || 0, 'Batches', T.orange)}
    ${statCard('🗓️', o.sessions || 0, 'Academic Sessions', T.green)}
    ${statCard('📚', o.offerings || 0, 'Course Offerings', T.yellow)}
  </div>
  ${as ? card(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:16px;color:${T.text}">Active Session — ${esc(as.name)}</div>
        <div style="font-size:12px;color:${T.muted};margin-top:2px">${esc(as.term || '')} ${esc(as.academicYear || '')}</div>
      </div>
      ${badge(as.status)}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">
      ${statCard('📚', s.offerings || 0, 'Offerings', T.accent)}
      ${statCard('🏫', s.sections || 0, 'Sections', T.blue)}
      ${statCard('📝', s.enrollments || 0, 'Enrollments', T.green)}
      ${statCard('👨‍🏫', s.assignments || 0, 'Teaching Assignments', T.purple)}
    </div>
  `) : card(`<div style="text-align:center;padding:30px;color:${T.muted}">No active academic session yet. Create one in the Sessions tab.</div>`)}`;
}

/* ================================================================
   PROGRAMS TAB
   ================================================================ */
function _bsaPrograms() {
  const rows = bsaCache.programs || [];
  return card(`
    ${secTitle('BS Programs', pbtn('+ Add Program', 'bsaOpenAddProgram()', 'sm'))}
    ${!rows.length ? `<div style="text-align:center;padding:30px;color:${T.muted}">No programs yet — add one to get started.</div>` : `
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="text-align:left;color:${T.muted};font-size:11px;text-transform:uppercase">
        <th style="padding:8px">Code</th><th style="padding:8px">Program</th><th style="padding:8px">Duration</th>
        <th style="padding:8px">Semesters</th><th style="padding:8px">Credit Hrs</th><th style="padding:8px">Curriculums</th>
        <th style="padding:8px">Status</th><th style="padding:8px"></th>
      </tr></thead>
      <tbody>
        ${rows.map(p => `<tr style="border-top:1px solid ${T.border}">
          <td style="padding:8px;font-weight:700">${esc(p.code)}</td>
          <td style="padding:8px">${esc(p.name)}</td>
          <td style="padding:8px">${p.durationYears} yrs</td>
          <td style="padding:8px">${p.totalSemesters}</td>
          <td style="padding:8px">${p.requiredCreditHours}</td>
          <td style="padding:8px">${p.curriculumCount}</td>
          <td style="padding:8px">${badge(p.status)}</td>
          <td style="padding:8px;text-align:right;white-space:nowrap">
            ${obtn('Edit', `bsaOpenEditProgram(${p.id})`, 'sm')}
            ${dbtn('Delete', `bsaDeleteProgram(${p.id})`, 'sm')}
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`}
  `);
}

function bsaOpenAddProgram() {
  bsaShowPopup(bsaPopupHeader('🎓 Add BS Program') + `
    <div style="display:grid;gap:12px;grid-template-columns:1fr 1fr">
      ${bsaField('Program Name *', 'bsa-p-name', '', 'text', 'BS Computer Science')}
      ${bsaField('Code *', 'bsa-p-code', '', 'text', 'BSCS')}
      ${bsaField('Duration (Years)', 'bsa-p-duration', '4', 'number')}
      ${bsaField('Total Semesters', 'bsa-p-semesters', '8', 'number')}
      ${bsaField('Required Credit Hours', 'bsa-p-credits', '130', 'number')}
      ${bsaSelect('Status', 'bsa-p-status', [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }])}
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Create Program', 'bsaSubmitAddProgram()')}</div>
  `, 480);
}
async function bsaSubmitAddProgram() {
  const g = id => document.getElementById(id)?.value || '';
  try {
    await bsaFetch('/api/bs/programs', {
      method: 'POST', body: JSON.stringify({
        name: g('bsa-p-name'), code: g('bsa-p-code'),
        durationYears: parseFloat(g('bsa-p-duration')) || 4,
        totalSemesters: parseInt(g('bsa-p-semesters')) || 8,
        requiredCreditHours: parseInt(g('bsa-p-credits')) || 130,
        status: g('bsa-p-status'),
      }),
    });
    bsaHidePopup(); bsaToast('Program created.'); await bsaLoad('programs');
  } catch (e) { bsaSetErr(e.message); }
}

function bsaOpenEditProgram(id) {
  const p = (bsaCache.programs || []).find(x => x.id === id);
  if (!p) return;
  bsaShowPopup(bsaPopupHeader('✏️ Edit Program') + `
    <div style="display:grid;gap:12px;grid-template-columns:1fr 1fr">
      ${bsaField('Program Name *', 'bsa-p-name', p.name)}
      ${bsaField('Code *', 'bsa-p-code', p.code)}
      ${bsaField('Duration (Years)', 'bsa-p-duration', p.durationYears, 'number')}
      ${bsaField('Total Semesters', 'bsa-p-semesters', p.totalSemesters, 'number')}
      ${bsaField('Required Credit Hours', 'bsa-p-credits', p.requiredCreditHours, 'number')}
      ${bsaSelect('Status', 'bsa-p-status', [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], p.status)}
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Save Changes', `bsaSubmitEditProgram(${id})`)}</div>
  `, 480);
}
async function bsaSubmitEditProgram(id) {
  const g = i => document.getElementById(i)?.value || '';
  try {
    await bsaFetch(`/api/bs/programs/${id}`, {
      method: 'PUT', body: JSON.stringify({
        name: g('bsa-p-name'), code: g('bsa-p-code'),
        durationYears: parseFloat(g('bsa-p-duration')) || 4,
        totalSemesters: parseInt(g('bsa-p-semesters')) || 8,
        requiredCreditHours: parseInt(g('bsa-p-credits')) || 130,
        status: g('bsa-p-status'),
      }),
    });
    bsaHidePopup(); bsaToast('Program updated.'); await bsaLoad('programs');
  } catch (e) { bsaSetErr(e.message); }
}
async function bsaDeleteProgram(id) {
  const ok = await confirmAction({ title: 'Delete program', tone: 'danger', message: 'Delete this program? This cannot be undone.', confirmLabel: 'Delete' });
  if (!ok) return;
  try { await bsaFetch(`/api/bs/programs/${id}`, { method: 'DELETE' }); bsaToast('Program deleted.'); await bsaLoad('programs'); }
  catch (e) { bsaToast(e.message, 'error'); }
}

/* ================================================================
   COURSES TAB  —  never carries a semester (spec Rule 1)
   ================================================================ */
function _bsaCourses() {
  const rows = bsaCache.courses || [];
  return card(`
    ${secTitle('Course Catalogue', pbtn('+ Add Course', 'bsaOpenAddCourse()', 'sm'))}
    <div style="font-size:12px;color:${T.muted};margin:-8px 0 14px">
      A course is reusable and never tied to a semester — place it in a curriculum for its recommended semester, or in a session for its actual offering.
    </div>
    ${!rows.length ? `<div style="text-align:center;padding:30px;color:${T.muted}">No courses yet.</div>` : `
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="text-align:left;color:${T.muted};font-size:11px;text-transform:uppercase">
        <th style="padding:8px">Code</th><th style="padding:8px">Name</th><th style="padding:8px">Credit Hrs</th>
        <th style="padding:8px">Type</th><th style="padding:8px">In Curriculums</th><th style="padding:8px">Offerings</th>
        <th style="padding:8px">Status</th><th style="padding:8px"></th>
      </tr></thead>
      <tbody>
        ${rows.map(c => `<tr style="border-top:1px solid ${T.border}">
          <td style="padding:8px;font-weight:700">${esc(c.code)}</td>
          <td style="padding:8px">${esc(c.name)}</td>
          <td style="padding:8px">${c.creditHours}</td>
          <td style="padding:8px;text-transform:capitalize">${esc(c.courseType)}</td>
          <td style="padding:8px">${c.curriculumCount}</td>
          <td style="padding:8px">${c.offeringCount}</td>
          <td style="padding:8px">${badge(c.status)}</td>
          <td style="padding:8px;text-align:right;white-space:nowrap">
            ${obtn('Edit', `bsaOpenEditCourse(${c.id})`, 'sm')}
            ${dbtn('Delete', `bsaDeleteCourse(${c.id})`, 'sm')}
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`}
  `);
}
function bsaOpenAddCourse() {
  bsaShowPopup(bsaPopupHeader('📘 Add Course') + `
    <div style="display:grid;gap:12px;grid-template-columns:1fr 1fr">
      ${bsaField('Course Code *', 'bsa-c-code', '', 'text', 'CS-101')}
      ${bsaField('Course Name *', 'bsa-c-name', '', 'text', 'Programming Fundamentals')}
      ${bsaField('Credit Hours', 'bsa-c-credits', '3', 'number')}
      ${bsaSelect('Type', 'bsa-c-type', [{ value: 'theory', label: 'Theory' }, { value: 'lab', label: 'Lab' }])}
    </div>
    <div style="margin-top:12px">${bsaTextArea('Description', 'bsa-c-desc', '', 'Optional')}</div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Create Course', 'bsaSubmitAddCourse()')}</div>
  `, 480);
}
async function bsaSubmitAddCourse() {
  const g = i => document.getElementById(i)?.value || '';
  try {
    await bsaFetch('/api/bs/courses', {
      method: 'POST', body: JSON.stringify({
        code: g('bsa-c-code'), name: g('bsa-c-name'),
        creditHours: parseInt(g('bsa-c-credits')) || 3,
        courseType: g('bsa-c-type'), description: g('bsa-c-desc'),
      }),
    });
    bsaHidePopup(); bsaToast('Course created.'); await bsaLoad('courses');
  } catch (e) { bsaSetErr(e.message); }
}
function bsaOpenEditCourse(id) {
  const c = (bsaCache.courses || []).find(x => x.id === id);
  if (!c) return;
  bsaShowPopup(bsaPopupHeader('✏️ Edit Course') + `
    <div style="display:grid;gap:12px;grid-template-columns:1fr 1fr">
      ${bsaField('Course Code *', 'bsa-c-code', c.code)}
      ${bsaField('Course Name *', 'bsa-c-name', c.name)}
      ${bsaField('Credit Hours', 'bsa-c-credits', c.creditHours, 'number')}
      ${bsaSelect('Type', 'bsa-c-type', [{ value: 'theory', label: 'Theory' }, { value: 'lab', label: 'Lab' }], c.courseType)}
    </div>
    <div style="margin-top:12px">${bsaTextArea('Description', 'bsa-c-desc', c.description)}</div>
    <div style="margin-top:12px">${bsaSelect('Status', 'bsa-c-status', [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], c.status)}</div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Save Changes', `bsaSubmitEditCourse(${id})`)}</div>
  `, 480);
}
async function bsaSubmitEditCourse(id) {
  const g = i => document.getElementById(i)?.value || '';
  try {
    await bsaFetch(`/api/bs/courses/${id}`, {
      method: 'PUT', body: JSON.stringify({
        code: g('bsa-c-code'), name: g('bsa-c-name'),
        creditHours: parseInt(g('bsa-c-credits')) || 3,
        courseType: g('bsa-c-type'), description: g('bsa-c-desc'), status: g('bsa-c-status'),
      }),
    });
    bsaHidePopup(); bsaToast('Course updated.'); await bsaLoad('courses');
  } catch (e) { bsaSetErr(e.message); }
}
async function bsaDeleteCourse(id) {
  const ok = await confirmAction({ title: 'Delete course', tone: 'danger', message: 'Delete this course? This is blocked if it has offerings or attempts.', confirmLabel: 'Delete' });
  if (!ok) return;
  try { await bsaFetch(`/api/bs/courses/${id}`, { method: 'DELETE' }); bsaToast('Course deleted.'); await bsaLoad('courses'); }
  catch (e) { bsaToast(e.message, 'error'); }
}

/* ================================================================
   CURRICULUMS TAB  —  historical versions, semester plan, electives
   ================================================================ */
function _bsaCurriculums() {
  if (bsaView.curriculumId) return _bsaCurriculumDetail();
  const rows = bsaCache.curriculums || [];
  const programs = bsaCache.programs || [];
  return card(`
    ${secTitle('Curriculum Versions', pbtn('+ New Version', 'bsaOpenAddCurriculum()', 'sm'))}
    ${!rows.length ? `<div style="text-align:center;padding:30px;color:${T.muted}">No curriculum versions yet.</div>` : `
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="text-align:left;color:${T.muted};font-size:11px;text-transform:uppercase">
        <th style="padding:8px">Program</th><th style="padding:8px">Version</th><th style="padding:8px">Courses</th>
        <th style="padding:8px">Credits</th><th style="padding:8px">Batches</th><th style="padding:8px">Default</th>
        <th style="padding:8px">Status</th><th style="padding:8px"></th>
      </tr></thead>
      <tbody>
        ${rows.map(c => `<tr style="border-top:1px solid ${T.border}">
          <td style="padding:8px">${esc(c.programName)} <span style="color:${T.muted}">(${esc(c.programCode)})</span></td>
          <td style="padding:8px;font-weight:700">${esc(c.name)} · ${c.versionYear}</td>
          <td style="padding:8px">${c.courseCount}</td>
          <td style="padding:8px">${c.totalCredits}</td>
          <td style="padding:8px">${c.batchCount}</td>
          <td style="padding:8px">${c.isDefault ? '⭐' : ''}</td>
          <td style="padding:8px">${badge(c.status)}</td>
          <td style="padding:8px;text-align:right;white-space:nowrap">
            ${obtn('Open', `bsaOpenCurriculum(${c.id})`, 'sm')}
            ${purpbtn('Clone', `bsaOpenCloneCurriculum(${c.id})`, 'sm')}
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`}
  `);
}
function bsaOpenAddCurriculum() {
  const programs = bsaCache.programs || [];
  if (!programs.length) { bsaToast('Add a program first.', 'warning'); return; }
  bsaShowPopup(bsaPopupHeader('🧭 New Curriculum Version') + `
    <div style="display:grid;gap:12px">
      ${bsaSelect('Program *', 'bsa-cu-program', programs.map(p => ({ value: p.id, label: `${p.name} (${p.code})` })))}
      ${bsaField('Version Year *', 'bsa-cu-year', new Date().getFullYear(), 'number')}
      ${bsaField('Name', 'bsa-cu-name', '', 'text', 'e.g. BSCS Curriculum 2026')}
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:${T.text}"><input type="checkbox" id="bsa-cu-default"> Set as default version for this program</label>
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Create Version', 'bsaSubmitAddCurriculum()')}</div>
  `, 440);
}
async function bsaSubmitAddCurriculum() {
  const g = i => document.getElementById(i)?.value || '';
  try {
    const r = await bsaFetch('/api/bs/curriculums', {
      method: 'POST', body: JSON.stringify({
        programId: parseInt(g('bsa-cu-program')), versionYear: parseInt(g('bsa-cu-year')),
        name: g('bsa-cu-name'), isDefault: document.getElementById('bsa-cu-default')?.checked,
      }),
    });
    bsaHidePopup(); bsaToast('Curriculum version created.');
    await bsaLoad('curriculums'); bsaOpenCurriculum(r.curriculum.id);
  } catch (e) { bsaSetErr(e.message); }
}
function bsaOpenCloneCurriculum(cuid) {
  const c = (bsaCache.curriculums || []).find(x => x.id === cuid);
  if (!c) return;
  bsaShowPopup(bsaPopupHeader(`📑 Clone "${esc(c.name)}"`) + `
    <div style="font-size:12px;color:${T.muted};margin-bottom:12px">
      The source version stays untouched. Every course, semester placement and elective group is copied into a new version.
    </div>
    <div style="display:grid;gap:12px">
      ${bsaField('New Version Year *', 'bsa-cl-year', (c.versionYear || new Date().getFullYear()) + 1, 'number')}
      ${bsaField('New Name', 'bsa-cl-name', '', 'text', `e.g. ${c.programName} Curriculum ${(c.versionYear || 0) + 1}`)}
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Clone Version', `bsaSubmitClone(${cuid})`)}</div>
  `, 440);
}
async function bsaSubmitClone(cuid) {
  const g = i => document.getElementById(i)?.value || '';
  try {
    const r = await bsaFetch(`/api/bs/curriculums/${cuid}/clone`, {
      method: 'POST', body: JSON.stringify({ versionYear: parseInt(g('bsa-cl-year')), name: g('bsa-cl-name') }),
    });
    bsaHidePopup(); bsaToast('New curriculum version published.');
    await bsaLoad('curriculums'); bsaOpenCurriculum(r.curriculum.id);
  } catch (e) { bsaSetErr(e.message); }
}

function bsaOpenCurriculum(cuid) {
  bsaView.curriculumId = cuid;
  bsaLoadCurriculumDetail(cuid).then(_bsaRender);
}
function bsaBackToCurriculums() { bsaView.curriculumId = null; _bsaRender(); }

function _bsaCurriculumDetail() {
  const d = bsaCache.curriculumDetail;
  const eg = bsaCache.electiveGroups || [];
  if (!d) return card(`<div style="padding:30px;text-align:center;color:${T.muted}">Loading…</div>`);
  const cur = d.curriculum;
  return `
  <div style="margin-bottom:14px">${obtn('← All Versions', 'bsaBackToCurriculums()', 'sm')}</div>
  ${card(`
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
      <div>
        <div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:17px;color:${T.text}">${esc(cur.programName)} — ${esc(cur.name)}</div>
        <div style="font-size:12px;color:${T.muted};margin-top:2px">Version ${cur.versionYear} · ${d.totalCredits} total credit hours across ${d.semesters.length} semester(s)</div>
      </div>
      <div style="display:flex;gap:8px">${pbtn('+ Add Course to Curriculum', 'bsaOpenAddCurriculumCourse()', 'sm')}${purpbtn('+ Elective Group', 'bsaOpenAddElectiveGroup()', 'sm')}</div>
    </div>
  `)}
  <div style="margin-top:16px;display:grid;gap:14px">
    ${Array.from({ length: cur.totalSemesters || 8 }, (_, i) => i + 1).map(sem => {
      const semData = d.semesters.find(s => s.semester === sem);
      const courses = semData ? semData.courses : [];
      const groups = eg.filter(g => g.semester === sem);
      if (!courses.length && !groups.length) return '';
      return card(`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-weight:800;font-family:'Space Grotesk',sans-serif;color:${T.accentD}">Semester ${sem}</div>
          <div style="font-size:12px;color:${T.muted}">${semData ? semData.credits : 0} credit hours</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${courses.map(c => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:${T.bg2};border-radius:8px">
            <div><span style="font-weight:700">${esc(c.courseCode)}</span> ${esc(c.courseName)} <span style="color:${T.muted};font-size:12px">(${c.creditHours} cr, ${esc(c.classification)}${c.electiveGroup ? ' · ' + esc(c.electiveGroup) : ''})</span></div>
            <div>${dbtn('Remove', `bsaDeleteCurriculumCourse(${c.id})`, 'sm')}</div>
          </div>`).join('')}
          ${groups.map(g => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:${T.purpleL};border-radius:8px">
            <div>🧩 <span style="font-weight:700">${esc(g.name)}</span> <span style="color:${T.muted};font-size:12px">— choose ${g.requiredCourses} of ${g.courseCount} elective course(s)</span></div>
            <div>${dbtn('Remove Group', `bsaDeleteElectiveGroup(${g.id})`, 'sm')}</div>
          </div>`).join('')}
        </div>
      `);
    }).filter(Boolean).join('') || `<div style="text-align:center;padding:30px;color:${T.muted}">No courses placed in this curriculum yet.</div>`}
  </div>`;
}

function bsaOpenAddCurriculumCourse() {
  const courses = bsaCache.courses || [];
  bsaShowPopup(bsaPopupHeader('📘 Place Course in Curriculum') + `
    <div style="font-size:12px;color:${T.muted};margin-bottom:12px">This sets the RECOMMENDED semester only — the course itself stays reusable and untouched.</div>
    <div style="display:grid;gap:12px">
      ${courses.length ? bsaSelect('Course *', 'bsa-cc-course', courses.map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }))) : `<div style="color:${T.red};font-size:13px">No courses yet — add one in the Courses tab first.</div>`}
      ${bsaField('Recommended Semester *', 'bsa-cc-sem', '1', 'number')}
      ${bsaSelect('Classification', 'bsa-cc-class', [
        { value: 'core', label: 'Core' }, { value: 'elective', label: 'Elective' },
        { value: 'university', label: 'University Requirement' }, { value: 'department', label: 'Department Requirement' },
        { value: 'lab', label: 'Lab' },
      ])}
      ${bsaField('Elective Group (optional)', 'bsa-cc-group', '', 'text', 'e.g. CS Elective I')}
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Add to Curriculum', 'bsaSubmitAddCurriculumCourse()')}</div>
  `, 460);
}
async function bsaSubmitAddCurriculumCourse() {
  const g = i => document.getElementById(i)?.value || '';
  try {
    await bsaFetch(`/api/bs/curriculums/${bsaView.curriculumId}/courses`, {
      method: 'POST', body: JSON.stringify({
        courseId: parseInt(g('bsa-cc-course')), recommendedSemester: parseInt(g('bsa-cc-sem')),
        classification: g('bsa-cc-class'), electiveGroup: g('bsa-cc-group') || null,
      }),
    });
    bsaHidePopup(); bsaToast('Course placed in curriculum.'); await bsaLoadCurriculumDetail(bsaView.curriculumId); _bsaRender();
  } catch (e) { bsaSetErr(e.message); }
}
async function bsaDeleteCurriculumCourse(ccid) {
  const ok = await confirmAction({ title: 'Remove from curriculum', tone: 'warning', message: 'Remove this course from the curriculum plan? The course and any existing offerings are unaffected.', confirmLabel: 'Remove' });
  if (!ok) return;
  try { await bsaFetch(`/api/bs/curriculum-courses/${ccid}`, { method: 'DELETE' }); bsaToast('Removed.'); await bsaLoadCurriculumDetail(bsaView.curriculumId); _bsaRender(); }
  catch (e) { bsaToast(e.message, 'error'); }
}
function bsaOpenAddElectiveGroup() {
  bsaShowPopup(bsaPopupHeader('🧩 Add Elective Group') + `
    <div style="display:grid;gap:12px">
      ${bsaField('Group Name *', 'bsa-eg-name', '', 'text', 'e.g. CS Elective I')}
      ${bsaField('Semester *', 'bsa-eg-sem', '1', 'number')}
      ${bsaField('Required Courses', 'bsa-eg-required', '1', 'number')}
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Create Group', 'bsaSubmitAddElectiveGroup()')}</div>
  `, 420);
}
async function bsaSubmitAddElectiveGroup() {
  const g = i => document.getElementById(i)?.value || '';
  try {
    await bsaFetch(`/api/bs/curriculums/${bsaView.curriculumId}/elective-groups`, {
      method: 'POST', body: JSON.stringify({ name: g('bsa-eg-name'), semester: parseInt(g('bsa-eg-sem')), requiredCourses: parseInt(g('bsa-eg-required')) || 1 }),
    });
    bsaHidePopup(); bsaToast('Elective group created. Tag courses with this group name when placing them.'); await bsaLoadCurriculumDetail(bsaView.curriculumId); _bsaRender();
  } catch (e) { bsaSetErr(e.message); }
}
async function bsaDeleteElectiveGroup(egid) {
  const ok = await confirmAction({ title: 'Delete elective group', tone: 'danger', message: 'Delete this elective group?', confirmLabel: 'Delete' });
  if (!ok) return;
  try { await bsaFetch(`/api/bs/elective-groups/${egid}`, { method: 'DELETE' }); bsaToast('Deleted.'); await bsaLoadCurriculumDetail(bsaView.curriculumId); _bsaRender(); }
  catch (e) { bsaToast(e.message, 'error'); }
}

/* ================================================================
   SESSIONS & OFFERINGS TAB
   Sessions list -> Offerings (per session) -> Offering detail
   (sections) -> Section detail (Teachers/Roster/Timetable/
   Attendance/Results)
   ================================================================ */
function _bsaSessions() {
  if (bsaView.sectionId)  return _bsaSectionDetail();
  if (bsaView.offeringId) return _bsaOfferingDetail();
  if (bsaView.sessionId)  return _bsaSessionOfferings();
  const rows = bsaCache.sessions || [];
  return card(`
    ${secTitle('Academic Sessions', pbtn('+ New Session', 'bsaOpenAddSession()', 'sm'))}
    ${!rows.length ? `<div style="text-align:center;padding:30px;color:${T.muted}">No academic sessions yet.</div>` : `
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="text-align:left;color:${T.muted};font-size:11px;text-transform:uppercase">
        <th style="padding:8px">Session</th><th style="padding:8px">Term</th><th style="padding:8px">Dates</th>
        <th style="padding:8px">Offerings</th><th style="padding:8px">Status</th><th style="padding:8px"></th>
      </tr></thead>
      <tbody>
        ${rows.map(s => `<tr style="border-top:1px solid ${T.border}">
          <td style="padding:8px;font-weight:700">${esc(s.name)}</td>
          <td style="padding:8px">${esc(s.term || '—')}</td>
          <td style="padding:8px;color:${T.muted};font-size:12px">${esc(s.startDate || '')} → ${esc(s.endDate || '')}</td>
          <td style="padding:8px">${s.offeringCount}</td>
          <td style="padding:8px">${badge(s.status)}</td>
          <td style="padding:8px;text-align:right;white-space:nowrap">
            ${obtn('Open', `bsaOpenSession(${s.id})`, 'sm')}
            ${dbtn('Delete', `bsaDeleteSession(${s.id})`, 'sm')}
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`}
  `);
}
function bsaOpenAddSession() {
  bsaShowPopup(bsaPopupHeader('🗓️ New Academic Session') + `
    <div style="display:grid;gap:12px;grid-template-columns:1fr 1fr">
      ${bsaField('Session Name *', 'bsa-s-name', '', 'text', 'Fall 2027')}
      ${bsaSelect('Term', 'bsa-s-term', [{ value: '', label: '—' }, { value: 'Fall', label: 'Fall' }, { value: 'Spring', label: 'Spring' }, { value: 'Summer', label: 'Summer' }])}
      ${bsaField('Academic Year', 'bsa-s-year', new Date().getFullYear(), 'text')}
      ${bsaSelect('Status', 'bsa-s-status', [{ value: 'planned', label: 'Planned' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }])}
      ${bsaField('Start Date', 'bsa-s-start', '', 'date')}
      ${bsaField('End Date', 'bsa-s-end', '', 'date')}
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Create Session', 'bsaSubmitAddSession()')}</div>
  `, 480);
}
async function bsaSubmitAddSession() {
  const g = i => document.getElementById(i)?.value || '';
  try {
    await bsaFetch('/api/bs/sessions', {
      method: 'POST', body: JSON.stringify({
        name: g('bsa-s-name'), term: g('bsa-s-term'), academicYear: g('bsa-s-year'),
        status: g('bsa-s-status'), startDate: g('bsa-s-start'), endDate: g('bsa-s-end'),
      }),
    });
    bsaHidePopup(); bsaToast('Session created.'); await bsaLoad('sessions');
  } catch (e) { bsaSetErr(e.message); }
}
async function bsaDeleteSession(sid) {
  const ok = await confirmAction({ title: 'Delete session', tone: 'danger', message: 'Delete this session? Blocked if it has offerings.', confirmLabel: 'Delete' });
  if (!ok) return;
  try { await bsaFetch(`/api/bs/sessions/${sid}`, { method: 'DELETE' }); bsaToast('Session deleted.'); await bsaLoad('sessions'); }
  catch (e) { bsaToast(e.message, 'error'); }
}

function bsaOpenSession(sid) { bsaView.sessionId = sid; bsaLoadSessionOfferings(sid).then(_bsaRender); }
function bsaBackToSessions() { bsaView = { ...bsaView, sessionId: null, offeringId: null, sectionId: null }; _bsaRender(); }
function bsaBackToOfferings() { bsaView.offeringId = null; bsaView.sectionId = null; _bsaRender(); }

function _bsaSessionOfferings() {
  const rows = bsaCache.offerings || [];
  const sess = (bsaCache.sessions || []).find(s => s.id === bsaView.sessionId);
  return `
  <div style="margin-bottom:14px">${obtn('← Sessions', 'bsaBackToSessions()', 'sm')}</div>
  ${card(`
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px">
      <div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:17px;color:${T.text}">${esc(sess ? sess.name : '')} — Offerings</div>
      <div style="display:flex;gap:8px">${pbtn('+ Add Offering', 'bsaOpenAddOffering()', 'sm')}${purpbtn('⚡ Generate from Curriculum', 'bsaOpenGenerateOfferings()', 'sm')}</div>
    </div>
  `)}
  <div style="margin-top:14px">${!rows.length ? card(`<div style="text-align:center;padding:30px;color:${T.muted}">No offerings yet in this session.</div>`) : card(`
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="text-align:left;color:${T.muted};font-size:11px;text-transform:uppercase">
        <th style="padding:8px">Course</th><th style="padding:8px">Actual Sem.</th><th style="padding:8px">Sections</th>
        <th style="padding:8px">Enrolled</th><th style="padding:8px">Status</th><th style="padding:8px"></th>
      </tr></thead>
      <tbody>
        ${rows.map(o => `<tr style="border-top:1px solid ${T.border}">
          <td style="padding:8px"><span style="font-weight:700">${esc(o.courseCode)}</span> ${esc(o.courseName)}</td>
          <td style="padding:8px">Sem ${o.actualSemester} ${o.isShifted ? `<span title="Curriculum recommends semester ${o.recommendedSemester}" style="color:${T.orange};font-weight:700">⚠ shifted</span>` : ''}</td>
          <td style="padding:8px">${o.sectionCount}</td>
          <td style="padding:8px">${o.enrolledCount}</td>
          <td style="padding:8px">${badge(o.status)}</td>
          <td style="padding:8px;text-align:right;white-space:nowrap">
            ${obtn('Open', `bsaOpenOffering(${o.id})`, 'sm')}
            ${dbtn('Delete', `bsaDeleteOffering(${o.id})`, 'sm')}
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`)}</div>`;
}
function bsaOpenAddOffering() {
  const courses = bsaCache.courses || [];
  bsaShowPopup(bsaPopupHeader('📚 Add Course Offering') + `
    <div style="display:grid;gap:12px">
      ${courses.length ? bsaSelect('Course *', 'bsa-o-course', courses.map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }))) : `<div style="color:${T.red};font-size:13px">Add a course first.</div>`}
      ${bsaField('Actual Semester *', 'bsa-o-sem', '1', 'number')}
      ${bsaSelect('Status', 'bsa-o-status', [{ value: 'planned', label: 'Planned' }, { value: 'open', label: 'Open' }, { value: 'ongoing', label: 'Ongoing' }])}
      ${bsaField('Sections to Create', 'bsa-o-sections', '1', 'number')}
      ${bsaField('Capacity per Section', 'bsa-o-capacity', '50', 'number')}
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Create Offering', 'bsaSubmitAddOffering()')}</div>
  `, 460);
}
async function bsaSubmitAddOffering() {
  const g = i => document.getElementById(i)?.value || '';
  try {
    await bsaFetch('/api/bs/offerings', {
      method: 'POST', body: JSON.stringify({
        courseId: parseInt(g('bsa-o-course')), sessionId: bsaView.sessionId,
        actualSemester: parseInt(g('bsa-o-sem')), status: g('bsa-o-status'),
        sections: parseInt(g('bsa-o-sections')) || 1, capacity: parseInt(g('bsa-o-capacity')) || 50,
      }),
    });
    bsaHidePopup(); bsaToast('Offering created.'); await bsaLoadSessionOfferings(bsaView.sessionId); _bsaRender();
  } catch (e) { bsaSetErr(e.message); }
}
function bsaOpenGenerateOfferings() {
  const curriculums = bsaCache.curriculums || [];
  bsaShowPopup(bsaPopupHeader('⚡ Generate Offerings from Curriculum') + `
    <div style="font-size:12px;color:${T.muted};margin-bottom:12px">Opens every course the curriculum recommends for a semester, all at once. Existing offerings are skipped.</div>
    <div style="display:grid;gap:12px">
      ${curriculums.length ? bsaSelect('Curriculum Version *', 'bsa-g-cu', curriculums.map(c => ({ value: c.id, label: `${c.programName} — ${c.name} (${c.versionYear})` }))) : `<div style="color:${T.red};font-size:13px">Create a curriculum version first.</div>`}
      ${bsaField('Recommended Semester to Open *', 'bsa-g-sem', '1', 'number')}
      ${bsaField('Actual Semester (leave blank = same)', 'bsa-g-actual', '', 'number')}
      ${bsaField('Sections per Course', 'bsa-g-sections', '1', 'number')}
      ${bsaField('Capacity per Section', 'bsa-g-capacity', '50', 'number')}
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Generate', 'bsaSubmitGenerateOfferings()')}</div>
  `, 460);
}
async function bsaSubmitGenerateOfferings() {
  const g = i => document.getElementById(i)?.value || '';
  try {
    const r = await bsaFetch(`/api/bs/sessions/${bsaView.sessionId}/generate-offerings`, {
      method: 'POST', body: JSON.stringify({
        curriculumId: parseInt(g('bsa-g-cu')), semester: parseInt(g('bsa-g-sem')),
        actualSemester: g('bsa-g-actual') ? parseInt(g('bsa-g-actual')) : undefined,
        sections: parseInt(g('bsa-g-sections')) || 1, capacity: parseInt(g('bsa-g-capacity')) || 50,
      }),
    });
    bsaHidePopup(); bsaToast(r.message); await bsaLoadSessionOfferings(bsaView.sessionId); _bsaRender();
  } catch (e) { bsaSetErr(e.message); }
}
async function bsaDeleteOffering(oid) {
  const ok = await confirmAction({ title: 'Delete offering', tone: 'danger', message: 'Delete this offering and its sections? Blocked if students are enrolled.', confirmLabel: 'Delete' });
  if (!ok) return;
  try { await bsaFetch(`/api/bs/offerings/${oid}`, { method: 'DELETE' }); bsaToast('Offering deleted.'); await bsaLoadSessionOfferings(bsaView.sessionId); _bsaRender(); }
  catch (e) { bsaToast(e.message, 'error'); }
}

function bsaOpenOffering(oid) { bsaView.offeringId = oid; bsaLoadOfferingDetail(oid).then(_bsaRender); }

function _bsaOfferingDetail() {
  const d = bsaCache.offeringDetail;
  if (!d) return card(`<div style="padding:30px;text-align:center;color:${T.muted}">Loading…</div>`);
  const off = d.offering;
  return `
  <div style="margin-bottom:14px">${obtn('← Offerings', 'bsaBackToOfferings()', 'sm')}</div>
  ${card(`
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:17px;color:${T.text}">${esc(off.courseCode)} — ${esc(off.courseName)}</div>
        <div style="font-size:12px;color:${T.muted};margin-top:2px">${esc(off.sessionName)} · Actual Semester ${off.actualSemester}${off.isShifted ? ` (curriculum recommends ${off.recommendedSemester})` : ''} · ${off.creditHours} credit hours</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">${badge(off.status)}${pbtn('+ Add Section', 'bsaOpenAddSection()', 'sm')}</div>
    </div>
  `)}
  <div style="margin-top:14px;display:grid;gap:12px">
    ${d.sections.map(s => `${card(`
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-weight:800;font-family:'Space Grotesk',sans-serif;color:${T.text}">Section ${esc(s.name)}</div>
          <div style="font-size:12px;color:${T.muted};margin-top:2px">${s.enrolledCount}/${s.capacity} students${s.room ? ' · Room ' + esc(s.room) : ''} · Teachers: ${s.teachers.map(t => esc(t.teacherName)).join(', ') || '—'}</div>
        </div>
        <div>${obtn('Manage', `bsaOpenSection(${s.id})`, 'sm')}${dbtn('Delete', `bsaDeleteSection(${s.id})`, 'sm')}</div>
      </div>
    `)}`).join('') || card(`<div style="text-align:center;padding:20px;color:${T.muted}">No sections yet.</div>`)}
  </div>`;
}
function bsaOpenAddSection() {
  bsaShowPopup(bsaPopupHeader('🏫 Add Section') + `
    <div style="display:grid;gap:12px;grid-template-columns:1fr 1fr">
      ${bsaField('Section Name', 'bsa-sec-name', '', 'text', 'auto (A, B, C…)')}
      ${bsaField('Capacity', 'bsa-sec-cap', '50', 'number')}
      ${bsaField('Room', 'bsa-sec-room', '', 'text', 'Room 101')}
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Create Section', 'bsaSubmitAddSection()')}</div>
  `, 440);
}
async function bsaSubmitAddSection() {
  const g = i => document.getElementById(i)?.value || '';
  try {
    await bsaFetch(`/api/bs/offerings/${bsaView.offeringId}/sections`, {
      method: 'POST', body: JSON.stringify({ name: g('bsa-sec-name'), capacity: parseInt(g('bsa-sec-cap')) || 50, room: g('bsa-sec-room') }),
    });
    bsaHidePopup(); bsaToast('Section created.'); await bsaLoadOfferingDetail(bsaView.offeringId); _bsaRender();
  } catch (e) { bsaSetErr(e.message); }
}
async function bsaDeleteSection(sid) {
  const ok = await confirmAction({ title: 'Delete section', tone: 'danger', message: 'Delete this section? Blocked if students are enrolled.', confirmLabel: 'Delete' });
  if (!ok) return;
  try { await bsaFetch(`/api/bs/offering-sections/${sid}`, { method: 'DELETE' }); bsaToast('Section deleted.'); await bsaLoadOfferingDetail(bsaView.offeringId); _bsaRender(); }
  catch (e) { bsaToast(e.message, 'error'); }
}

/* ================================================================
   SECTION DETAIL  —  Teachers / Roster / Timetable / Attendance / Results
   ================================================================ */
function bsaOpenSection(sid) {
  bsaView.sectionId = sid; bsaView.sectionTab = 'teachers';
  bsaLoadSectionExtra(sid).then(_bsaRender);
}
function bsaBackToOffering() { bsaView.sectionId = null; _bsaRender(); }
function bsaSectionSwitchTab(t) {
  bsaView.sectionTab = t;
  bsaLoadSectionExtra(bsaView.sectionId).then(_bsaRender);
}

function _bsaSectionDetail() {
  const sid = bsaView.sectionId;
  const off = bsaCache.offeringDetail?.offering;
  const sec = bsaCache.offeringDetail?.sections.find(s => s.id === sid);
  const SUBTABS = [
    { key: 'teachers',   label: '👨‍🏫 Teachers' },
    { key: 'roster',     label: '🎓 Roster' },
    { key: 'timetable',  label: '🕐 Timetable' },
    { key: 'attendance', label: '📋 Attendance' },
    { key: 'results',    label: '📝 Results' },
  ];
  return `
  <div style="margin-bottom:14px">${obtn('← Sections', 'bsaBackToOffering()', 'sm')}</div>
  ${card(`
    <div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:16px;color:${T.text}">
      ${esc(off?.courseCode || '')} — Section ${esc(sec?.name || '')}
    </div>
    <div style="font-size:12px;color:${T.muted};margin-top:2px">${esc(off?.sessionName || '')} · Semester ${off?.actualSemester || ''}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:14px">
      ${SUBTABS.map(t => `<button type="button" onclick="bsaSectionSwitchTab('${t.key}')" style="padding:7px 14px;border:none;border-radius:8px;background:${bsaView.sectionTab === t.key ? T.accentL : T.bg2};color:${bsaView.sectionTab === t.key ? T.accentD : T.muted};font-weight:${bsaView.sectionTab === t.key ? 800 : 600};font-size:12px;cursor:pointer">${t.label}</button>`).join('')}
    </div>
  `)}
  <div style="margin-top:14px">
    ${bsaView.sectionTab === 'teachers'   ? _bsaSecTeachers(sid)   : ''}
    ${bsaView.sectionTab === 'roster'     ? _bsaSecRoster(sid)     : ''}
    ${bsaView.sectionTab === 'timetable'  ? _bsaSecTimetable(sid)  : ''}
    ${bsaView.sectionTab === 'attendance' ? _bsaSecAttendance(sid) : ''}
    ${bsaView.sectionTab === 'results'    ? _bsaSecResults(sid)    : ''}
  </div>`;
}

/* ── Teachers sub-tab ─────────────────────────────────────────── */
function _bsaSecTeachers(sid) {
  const rows = bsaCache.secTeachers || [];
  return card(`
    ${secTitle('Assigned Teachers', pbtn('+ Assign Teacher', `bsaOpenAssignTeacher(${sid})`, 'sm'))}
    ${!rows.length ? `<div style="text-align:center;padding:20px;color:${T.muted}">No teacher assigned yet.</div>` : `
    <div style="display:flex;flex-direction:column;gap:8px">
      ${rows.map(t => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:${T.bg2};border-radius:8px">
        <div>${ava(t.teacherName, 30)} <span style="margin-left:8px;font-weight:700">${esc(t.teacherName)}</span> <span style="color:${T.muted};font-size:12px">(${esc(t.role)})</span></div>
        <div>${dbtn('Unassign', `bsaUnassignTeacher(${t.id})`, 'sm')}</div>
      </div>`).join('')}
    </div>`}
  `);
}
function bsaOpenAssignTeacher(sid) {
  const teachers = bsaCache.teachers || [];
  bsaShowPopup(bsaPopupHeader('👨‍🏫 Assign Teacher') + `
    <div style="display:grid;gap:12px">
      ${teachers.length ? bsaSelect('Teacher *', 'bsa-ta-teacher', teachers.map(t => ({ value: t.id, label: `${t.name} (${t.sectionCount} section${t.sectionCount === 1 ? '' : 's'})` }))) : `<div id="bsa-ta-loading" style="font-size:13px;color:${T.muted}">Loading teachers…</div>`}
      ${bsaSelect('Role', 'bsa-ta-role', [{ value: 'lead', label: 'Lead' }, { value: 'co', label: 'Co-Teacher' }])}
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Assign', `bsaSubmitAssignTeacher(${sid})`)}</div>
  `, 440);
  if (!teachers.length) bsaFetch('/api/bs/teachers').then(rows => { bsaCache.teachers = rows; bsaOpenAssignTeacher(sid); });
}
async function bsaSubmitAssignTeacher(sid) {
  const g = i => document.getElementById(i)?.value || '';
  try {
    const r = await bsaFetch(`/api/bs/offering-sections/${sid}/teachers`, {
      method: 'POST', body: JSON.stringify({ teacherId: g('bsa-ta-teacher'), role: g('bsa-ta-role') }),
    });
    bsaHidePopup();
    bsaToast(r.warnings?.length ? `Assigned — timetable clash: ${r.warnings[0]}` : 'Teacher assigned.', r.warnings?.length ? 'warning' : 'success');
    await bsaLoadSectionExtra(sid); _bsaRender();
  } catch (e) { bsaSetErr(e.message); }
}
async function bsaUnassignTeacher(taid) {
  const ok = await confirmAction({ title: 'Unassign teacher', tone: 'warning', message: 'Remove this teacher from the section?', confirmLabel: 'Unassign' });
  if (!ok) return;
  try { await bsaFetch(`/api/bs/teaching-assignments/${taid}`, { method: 'DELETE' }); bsaToast('Unassigned.'); await bsaLoadSectionExtra(bsaView.sectionId); _bsaRender(); }
  catch (e) { bsaToast(e.message, 'error'); }
}

/* ── Roster sub-tab ───────────────────────────────────────────── */
function _bsaSecRoster(sid) {
  const d = bsaCache.secRoster || { students: [], capacity: 0, enrolled: 0 };
  return card(`
    ${secTitle(`Roster — ${d.enrolled}/${d.capacity} seats`, pbtn('+ Enroll Students', `bsaOpenEnroll(${sid})`, 'sm'))}
    ${!d.students.length ? `<div style="text-align:center;padding:20px;color:${T.muted}">No students enrolled yet.</div>` : `
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="text-align:left;color:${T.muted};font-size:11px;text-transform:uppercase">
        <th style="padding:8px">Roll</th><th style="padding:8px">Student</th><th style="padding:8px">Status</th><th style="padding:8px"></th>
      </tr></thead>
      <tbody>${d.students.map(en => `<tr style="border-top:1px solid ${T.border}">
        <td style="padding:8px">${esc(en.rollNo)}</td>
        <td style="padding:8px">${esc(en.studentName)}</td>
        <td style="padding:8px">${badge(en.status === 'enrolled' ? 'active' : en.status)}</td>
        <td style="padding:8px;text-align:right">${dbtn('Remove', `bsaDeleteEnrollment(${en.id})`, 'sm')}</td>
      </tr>`).join('')}</tbody>
    </table></div>`}
  `);
}
function bsaOpenEnroll(sid) {
  bsaShowPopup(bsaPopupHeader('🎓 Enroll Students') + `
    <div style="font-size:12px;color:${T.muted};margin-bottom:10px">Enter one or more BS student IDs, comma or newline separated.</div>
    ${bsaTextArea('Student IDs *', 'bsa-en-ids', '', 'S001, S002, S003')}
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Enroll', `bsaSubmitEnroll(${sid})`)}</div>
  `, 440);
}
async function bsaSubmitEnroll(sid) {
  const raw = document.getElementById('bsa-en-ids')?.value || '';
  const ids = raw.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  if (!ids.length) { bsaSetErr('Enter at least one student ID.'); return; }
  try {
    const r = await bsaFetch(`/api/bs/offering-sections/${sid}/students`, { method: 'POST', body: JSON.stringify({ studentIds: ids }) });
    bsaHidePopup();
    bsaToast(r.message + (r.skipped?.length ? ` — ${r.skipped.length} skipped` : ''), r.skipped?.length ? 'warning' : 'success');
    await bsaLoadSectionExtra(sid); _bsaRender();
  } catch (e) { bsaSetErr(e.message); }
}
async function bsaDeleteEnrollment(eid) {
  const ok = await confirmAction({ title: 'Remove enrollment', tone: 'warning', message: 'Remove this student from the section?', confirmLabel: 'Remove' });
  if (!ok) return;
  try { await bsaFetch(`/api/bs/enrollments/${eid}`, { method: 'DELETE' }); bsaToast('Removed.'); await bsaLoadSectionExtra(bsaView.sectionId); _bsaRender(); }
  catch (e) { bsaToast(e.message, 'error'); }
}

/* ── Timetable sub-tab ────────────────────────────────────────── */
function _bsaSecTimetable(sid) {
  const rows = bsaCache.secTimetable || [];
  return card(`
    ${secTitle('Weekly Lecture Slots', pbtn('+ Add Slot', `bsaOpenAddSlot(${sid})`, 'sm'))}
    ${!rows.length ? `<div style="text-align:center;padding:20px;color:${T.muted}">No lecture slots yet.</div>` : `
    <div style="display:flex;flex-direction:column;gap:8px">
      ${rows.map(s => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:${T.bg2};border-radius:8px">
        <div><span style="font-weight:700">${esc(s.day)}</span> ${esc(s.startTime)}–${esc(s.endTime)} ${s.room ? `· Room ${esc(s.room)}` : ''}</div>
        <div>${dbtn('Remove', `bsaDeleteSlot(${s.id})`, 'sm')}</div>
      </div>`).join('')}
    </div>`}
  `);
}
function bsaOpenAddSlot(sid) {
  bsaShowPopup(bsaPopupHeader('🕐 Add Lecture Slot') + `
    <div style="display:grid;gap:12px;grid-template-columns:1fr 1fr">
      ${bsaSelect('Day *', 'bsa-tt-day', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => ({ value: d, label: d })))}
      ${bsaField('Room', 'bsa-tt-room', '', 'text', 'Room 101')}
      ${bsaField('Start Time *', 'bsa-tt-start', '09:00', 'time')}
      ${bsaField('End Time *', 'bsa-tt-end', '10:00', 'time')}
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Add Slot', `bsaSubmitAddSlot(${sid})`)}</div>
  `, 440);
}
async function bsaSubmitAddSlot(sid) {
  const g = i => document.getElementById(i)?.value || '';
  try {
    await bsaFetch(`/api/bs/offering-sections/${sid}/timetable`, {
      method: 'POST', body: JSON.stringify({ day: g('bsa-tt-day'), startTime: g('bsa-tt-start'), endTime: g('bsa-tt-end'), room: g('bsa-tt-room') }),
    });
    bsaHidePopup(); bsaToast('Slot added.'); await bsaLoadSectionExtra(sid); _bsaRender();
  } catch (e) { bsaSetErr(e.message); }
}
async function bsaDeleteSlot(tsid) {
  const ok = await confirmAction({ title: 'Remove slot', tone: 'warning', message: 'Remove this lecture slot?', confirmLabel: 'Remove' });
  if (!ok) return;
  try { await bsaFetch(`/api/bs/timetable-slots/${tsid}`, { method: 'DELETE' }); bsaToast('Removed.'); await bsaLoadSectionExtra(bsaView.sectionId); _bsaRender(); }
  catch (e) { bsaToast(e.message, 'error'); }
}

/* ── Attendance sub-tab ───────────────────────────────────────── */
function _bsaSecAttendance(sid) {
  const d = bsaCache.secAttendance || { records: [] };
  return card(`
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
      <div style="font-family:'Space Grotesk',sans-serif;font-weight:800;color:${T.text}">Mark Attendance</div>
      <input type="date" value="${bsaCache.secAttDate}" onchange="bsaChangeAttDate(this.value,${sid})" style="padding:7px 10px;border:1.5px solid ${T.border2};border-radius:8px;font-size:13px;background:${T.surface};color:${T.text}">
    </div>
    ${!d.records.length ? `<div style="text-align:center;padding:20px;color:${T.muted}">No students enrolled yet.</div>` : `
    <div style="display:flex;flex-direction:column;gap:6px" id="bsa-att-list">
      ${d.records.map(r => `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 10px;background:${T.bg2};border-radius:8px" data-sid="${esc(r.studentId)}">
        <div>${esc(r.rollNo)} — ${esc(r.studentName)}</div>
        <div style="display:flex;gap:5px">
          ${['present', 'absent', 'late', 'leave'].map(st => `<button type="button" data-status="${st}" onclick="bsaSetAttStatus(this,'${esc(r.studentId)}')" style="padding:5px 10px;border-radius:6px;border:1.5px solid ${r.status === st ? T.accent : T.border2};background:${r.status === st ? T.accentL : T.surface};color:${r.status === st ? T.accentD : T.muted};font-size:11px;font-weight:700;cursor:pointer;text-transform:capitalize">${st}</button>`).join('')}
        </div>
      </div>`).join('')}
    </div>
    <div style="margin-top:16px;text-align:right">${pbtn('Save Attendance', `bsaSubmitAttendance(${sid})`)}</div>`}
  `);
}
function bsaChangeAttDate(val, sid) { bsaCache.secAttDate = val; bsaLoadSectionExtra(sid).then(_bsaRender); }
function bsaSetAttStatus(btn, studentId) {
  const row = btn.closest('[data-sid]');
  row.querySelectorAll('button[data-status]').forEach(b => {
    const active = b === btn;
    b.style.borderColor = active ? T.accent : T.border2;
    b.style.background  = active ? T.accentL : T.surface;
    b.style.color        = active ? T.accentD : T.muted;
  });
  row.dataset.chosen = btn.dataset.status;
}
async function bsaSubmitAttendance(sid) {
  const rows = document.querySelectorAll('#bsa-att-list [data-sid]');
  const records = [];
  rows.forEach(r => { const status = r.dataset.chosen; if (status) records.push({ studentId: r.dataset.sid, status }); });
  if (!records.length) { bsaToast('Mark at least one student first.', 'warning'); return; }
  try {
    const r = await bsaFetch(`/api/bs/offering-sections/${sid}/attendance`, {
      method: 'POST', body: JSON.stringify({ date: bsaCache.secAttDate, records }),
    });
    bsaToast(r.message); await bsaLoadSectionExtra(sid); _bsaRender();
  } catch (e) { bsaToast(e.message, 'error'); }
}

/* ── Results sub-tab ──────────────────────────────────────────── */
function _bsaSecResults(sid) {
  const d = bsaCache.secRoster || { students: [] };
  const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'];
  return card(`
    ${secTitle('Enter Final Results')}
    ${!d.students.length ? `<div style="text-align:center;padding:20px;color:${T.muted}">No students enrolled yet.</div>` : `
    <div style="display:flex;flex-direction:column;gap:8px" id="bsa-results-list">
      ${d.students.filter(s => s.status !== 'dropped').map(s => `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 10px;background:${T.bg2};border-radius:8px" data-sid="${esc(s.studentId)}">
        <div>${esc(s.rollNo)} — ${esc(s.studentName)}</div>
        <select style="padding:6px 10px;border:1.5px solid ${T.border2};border-radius:8px;font-size:12px;background:${T.surface};color:${T.text}">
          <option value="">— Grade —</option>
          ${GRADES.map(g => `<option value="${g}">${g}</option>`).join('')}
        </select>
      </div>`).join('')}
    </div>
    <div style="margin-top:16px;text-align:right">${pbtn('Save Results', `bsaSubmitResults(${sid})`)}</div>`}
  `);
}
async function bsaSubmitResults(sid) {
  const rows = document.querySelectorAll('#bsa-results-list [data-sid]');
  const results = [];
  rows.forEach(r => { const g = r.querySelector('select')?.value; if (g) results.push({ studentId: r.dataset.sid, grade: g }); });
  if (!results.length) { bsaToast('Select at least one grade first.', 'warning'); return; }
  try {
    const r = await bsaFetch(`/api/bs/offering-sections/${sid}/results`, { method: 'POST', body: JSON.stringify({ results }) });
    bsaToast(r.message); await bsaLoadSectionExtra(sid); _bsaRender();
  } catch (e) { bsaToast(e.message, 'error'); }
}

/* ================================================================
   BATCHES TAB
   ================================================================ */
function _bsaBatches() {
  const rows = bsaCache.batches || [];
  return card(`
    ${secTitle('Admission Batches', pbtn('+ Add Batch', 'bsaOpenAddBatch()', 'sm'))}
    ${!rows.length ? `<div style="text-align:center;padding:30px;color:${T.muted}">No batches yet.</div>` : `
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="text-align:left;color:${T.muted};font-size:11px;text-transform:uppercase">
        <th style="padding:8px">Batch</th><th style="padding:8px">Program</th><th style="padding:8px">Curriculum</th>
        <th style="padding:8px">Current Sem.</th><th style="padding:8px">Students</th><th style="padding:8px">Status</th><th style="padding:8px"></th>
      </tr></thead>
      <tbody>
        ${rows.map(b => `<tr style="border-top:1px solid ${T.border}">
          <td style="padding:8px;font-weight:700">${esc(b.name)}</td>
          <td style="padding:8px">${esc(b.programName)}</td>
          <td style="padding:8px">${esc(b.curriculumName)} ${b.curriculumVersion ? `(${b.curriculumVersion})` : ''}</td>
          <td style="padding:8px">${b.currentSemester}</td>
          <td style="padding:8px">${b.studentCount}</td>
          <td style="padding:8px">${badge(b.status)}</td>
          <td style="padding:8px;text-align:right;white-space:nowrap">
            ${obtn('Edit', `bsaOpenEditBatch(${b.id})`, 'sm')}
            ${purpbtn('Bulk Enroll', `bsaOpenBulkEnroll(${b.id})`, 'sm')}
            ${dbtn('Delete', `bsaDeleteBatch(${b.id})`, 'sm')}
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`}
  `);
}
function bsaOpenAddBatch() {
  const programs = bsaCache.programs || [];
  const curriculums = bsaCache.curriculums || [];
  const sessions = bsaCache.sessions || [];
  bsaShowPopup(bsaPopupHeader('👥 Add Batch') + `
    <div style="display:grid;gap:12px">
      ${programs.length ? bsaSelect('Program *', 'bsa-b-program', programs.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))) : `<div style="color:${T.red};font-size:13px">Add a program first.</div>`}
      ${curriculums.length ? bsaSelect('Curriculum Version *', 'bsa-b-curriculum', curriculums.map(c => ({ value: c.id, label: `${c.programName} — ${c.name} (${c.versionYear})` }))) : `<div style="color:${T.red};font-size:13px">Add a curriculum version first.</div>`}
      ${bsaSelect('Admission Session', 'bsa-b-session', [{ value: '', label: '—' }, ...sessions.map(s => ({ value: s.id, label: s.name }))])}
      ${bsaField('Batch Name *', 'bsa-b-name', '', 'text', 'BSCS-2027')}
      ${bsaField('Current Semester', 'bsa-b-sem', '1', 'number')}
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Create Batch', 'bsaSubmitAddBatch()')}</div>
  `, 460);
}
async function bsaSubmitAddBatch() {
  const g = i => document.getElementById(i)?.value || '';
  try {
    await bsaFetch('/api/bs/batches', {
      method: 'POST', body: JSON.stringify({
        programId: parseInt(g('bsa-b-program')), curriculumId: parseInt(g('bsa-b-curriculum')),
        admissionSessionId: g('bsa-b-session') ? parseInt(g('bsa-b-session')) : null,
        name: g('bsa-b-name'), currentSemester: parseInt(g('bsa-b-sem')) || 1,
      }),
    });
    bsaHidePopup(); bsaToast('Batch created.'); await bsaLoad('batches');
  } catch (e) { bsaSetErr(e.message); }
}
function bsaOpenEditBatch(id) {
  const b = (bsaCache.batches || []).find(x => x.id === id);
  if (!b) return;
  bsaShowPopup(bsaPopupHeader('✏️ Edit Batch') + `
    <div style="display:grid;gap:12px">
      ${bsaField('Batch Name *', 'bsa-b-name', b.name)}
      ${bsaField('Current Semester', 'bsa-b-sem', b.currentSemester, 'number')}
      ${bsaSelect('Status', 'bsa-b-status', [{ value: 'active', label: 'Active' }, { value: 'graduated', label: 'Graduated' }, { value: 'inactive', label: 'Inactive' }], b.status)}
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Save Changes', `bsaSubmitEditBatch(${id})`)}</div>
  `, 420);
}
async function bsaSubmitEditBatch(id) {
  const g = i => document.getElementById(i)?.value || '';
  try {
    await bsaFetch(`/api/bs/batches/${id}`, {
      method: 'PUT', body: JSON.stringify({ name: g('bsa-b-name'), currentSemester: parseInt(g('bsa-b-sem')) || 1, status: g('bsa-b-status') }),
    });
    bsaHidePopup(); bsaToast('Batch updated.'); await bsaLoad('batches');
  } catch (e) { bsaSetErr(e.message); }
}
async function bsaDeleteBatch(id) {
  const ok = await confirmAction({ title: 'Delete batch', tone: 'danger', message: 'Delete this batch? Blocked if students belong to it.', confirmLabel: 'Delete' });
  if (!ok) return;
  try { await bsaFetch(`/api/bs/batches/${id}`, { method: 'DELETE' }); bsaToast('Batch deleted.'); await bsaLoad('batches'); }
  catch (e) { bsaToast(e.message, 'error'); }
}
function bsaOpenBulkEnroll(bid) {
  const sessions = bsaCache.sessions || [];
  bsaShowPopup(bsaPopupHeader('⚡ Bulk-Enroll Batch') + `
    <div style="font-size:12px;color:${T.muted};margin-bottom:12px">Enrolls every student in this batch into the offerings open for their semester in the chosen session. Already-enrolled students are skipped safely.</div>
    <div style="display:grid;gap:12px">
      ${sessions.length ? bsaSelect('Academic Session *', 'bsa-be-session', sessions.map(s => ({ value: s.id, label: s.name }))) : `<div style="color:${T.red};font-size:13px">Create a session first.</div>`}
      ${bsaField('Semester (blank = batch current)', 'bsa-be-sem', '', 'number')}
    </div>
    ${bsaFormErr()}
    <div style="margin-top:16px;text-align:right">${pbtn('Bulk Enroll', `bsaSubmitBulkEnroll(${bid})`)}</div>
  `, 460);
}
async function bsaSubmitBulkEnroll(bid) {
  const g = i => document.getElementById(i)?.value || '';
  try {
    const r = await bsaFetch(`/api/bs/batches/${bid}/enroll`, {
      method: 'POST', body: JSON.stringify({ sessionId: parseInt(g('bsa-be-session')), semester: g('bsa-be-sem') ? parseInt(g('bsa-be-sem')) : undefined }),
    });
    bsaHidePopup(); bsaToast(r.message); await bsaLoad('batches');
  } catch (e) { bsaSetErr(e.message); }
}

/* ================================================================
   PROGRESS TAB  —  credit-hour based academic progress
   ================================================================ */
function _bsaProgress() {
  return card(`
    <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px">
      <div style="flex:1;min-width:200px">${bsaField('BS Student ID', 'bsa-prog-sid', bsaProgressStudentId, 'text', 'e.g. S001')}</div>
      ${pbtn('View Progress', 'bsaSearchProgress()', 'sm')}
    </div>
    ${bsaProgressData ? _bsaProgressResult(bsaProgressData) : `<div style="text-align:center;padding:20px;color:${T.muted}">Enter a student ID to view their academic progress.</div>`}
  `);
}
async function bsaSearchProgress() {
  const sid = document.getElementById('bsa-prog-sid')?.value.trim();
  if (!sid) return;
  bsaProgressStudentId = sid;
  try {
    bsaProgressData = await bsaFetch(`/api/bs/students/${encodeURIComponent(sid)}/progress`);
    _bsaRender();
  } catch (e) { bsaToast(e.message, 'error'); }
}
function _bsaProgressResult(p) {
  const pct = p.percentComplete ?? 0;
  return `
  <div style="border-top:1px solid ${T.border};padding-top:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
      <div>
        <div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:16px;color:${T.text}">${esc(p.studentName)} <span style="color:${T.muted};font-weight:600;font-size:13px">(${esc(p.rollNo)})</span></div>
        <div style="font-size:12px;color:${T.muted};margin-top:2px">${esc(p.programName)} · ${esc(p.curriculumName)} · ${esc(p.batchName)} · Semester ${p.currentSemester}/${p.totalSemesters}</div>
      </div>
      ${p.cgpa !== null ? `<div style="text-align:right"><div style="font-size:22px;font-weight:800;color:${T.accentD};font-family:'Space Grotesk',sans-serif">${p.cgpa}</div><div style="font-size:11px;color:${T.muted};text-transform:uppercase">CGPA</div></div>` : ''}
    </div>
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:${T.muted};margin-bottom:6px">
        <span>${p.earnedCredits} / ${p.requiredCredits || '—'} credit hours earned</span><span>${pct}%</span>
      </div>
      ${pbar(pct)}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:18px">
      ${statCard('✅', p.earnedCredits, 'Earned Credits', T.green)}
      ${statCard('⏳', p.inProgressCredits, 'In Progress', T.blue)}
      ${statCard('📊', p.attemptedCredits, 'Attempted', T.orange)}
      ${statCard('🎯', p.remainingCredits ?? '—', 'Remaining', T.purple)}
    </div>
    ${p.pendingRepeats.length ? `<div style="margin-bottom:16px;padding:12px;background:${T.redL || '#fef2f2'};border-radius:10px">
      <div style="font-weight:700;color:${T.red};font-size:13px;margin-bottom:6px">⚠ Courses to Repeat</div>
      ${p.pendingRepeats.map(a => `<div style="font-size:12px;color:${T.text}">${esc(a.courseCode)} — ${esc(a.courseName)} (Attempt ${a.attemptNo}, Grade ${esc(a.grade)})</div>`).join('')}
    </div>` : ''}
    <div style="font-weight:700;font-size:13px;color:${T.text};margin-bottom:8px">Course Attempt History</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="text-align:left;color:${T.muted};font-size:10px;text-transform:uppercase">
        <th style="padding:6px">Course</th><th style="padding:6px">Attempt</th><th style="padding:6px">Session</th><th style="padding:6px">Status</th><th style="padding:6px">Grade</th>
      </tr></thead>
      <tbody>${p.attempts.map(a => `<tr style="border-top:1px solid ${T.border}">
        <td style="padding:6px">${esc(a.courseCode)} ${esc(a.courseName)}</td>
        <td style="padding:6px">#${a.attemptNo}</td>
        <td style="padding:6px">${esc(a.sessionLabel)}</td>
        <td style="padding:6px">${badge(a.status === 'passed' ? 'active' : a.status === 'failed' ? 'inactive' : a.status)}</td>
        <td style="padding:6px;font-weight:700">${esc(a.grade || '—')}</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

/* ================================================================
   TEACHER — MY TEACHING  (spec §31)
   ================================================================ */
let bsaMyTeaching = null;
let bsaMyTeachingSectionId = null;
let bsaMyTeachingSubTab = 'roster';

function renderBSMyTeaching() {
  if (!bsaMyTeaching && !bsaLoading) {
    bsaLoading = true;
    bsaFetch('/api/bs/my/teaching').then(rows => { bsaMyTeaching = rows; bsaLoading = false; _bsaTeachRender(); })
      .catch(e => { bsaToast(e.message, 'error'); bsaLoading = false; _bsaTeachRender(); });
  }
  return `<div id="bsa-teach-root">${_bsaTeachBody()}</div>`;
}
function _bsaTeachRender() { const el = document.getElementById('bsa-teach-root'); if (el) el.innerHTML = _bsaTeachBody(); }

function _bsaTeachBody() {
  if (bsaLoading || !bsaMyTeaching) return card(`<div style="text-align:center;padding:40px;color:${T.muted}">Loading…</div>`);
  if (bsaMyTeachingSectionId) return _bsaTeachSectionDetail();

  const rows = bsaMyTeaching;
  if (!rows.length) return card(`<div style="text-align:center;padding:30px;color:${T.muted}">No BS teaching assignments yet.</div>`);

  const bySession = {};
  rows.forEach(r => { (bySession[r.sessionName] = bySession[r.sessionName] || []).push(r); });

  return Object.entries(bySession).map(([sessionName, list]) => card(`
    <div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:15px;color:${T.text};margin-bottom:12px">${esc(sessionName)}</div>
    <div style="display:grid;gap:10px">
      ${list.map(r => `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding:12px;background:${T.bg2};border-radius:10px">
        <div>
          <div style="font-weight:700;color:${T.text}">${esc(r.courseCode)} — ${esc(r.courseName)} <span style="color:${T.muted};font-weight:500">· Section ${esc(r.sectionName)}</span></div>
          <div style="font-size:12px;color:${T.muted};margin-top:2px">Semester ${r.actualSemester} · ${r.creditHours} credit hours · ${r.enrolledCount} student(s) · ${r.timetable.map(t => `${t.day} ${t.startTime}`).join(', ') || 'No timetable set'}</div>
        </div>
        <div>${badge(r.offeringStatus)} ${obtn('Manage', `bsaOpenMyTeachSection(${r.offeringSectionId})`, 'sm')}</div>
      </div>`).join('')}
    </div>
  `)).join('');
}
function bsaOpenMyTeachSection(sid) {
  bsaMyTeachingSectionId = sid; bsaMyTeachingSubTab = 'roster';
  bsaView.sectionId = sid; // reuse the admin section-detail loaders
  bsaLoadSectionExtra(sid).then(_bsaTeachRender);
}
function bsaBackToMyTeaching() { bsaMyTeachingSectionId = null; bsaView.sectionId = null; _bsaTeachRender(); }
function bsaTeachSwitchSubTab(t) { bsaMyTeachingSubTab = t; bsaView.sectionTab = t; bsaLoadSectionExtra(bsaMyTeachingSectionId).then(_bsaTeachRender); }

function _bsaTeachSectionDetail() {
  const info = bsaMyTeaching.find(r => r.offeringSectionId === bsaMyTeachingSectionId);
  const SUBTABS = [
    { key: 'roster',     label: '🎓 Roster' },
    { key: 'attendance', label: '📋 Attendance' },
    { key: 'results',    label: '📝 Results' },
  ];
  bsaView.sectionTab = bsaMyTeachingSubTab; // keep shared renderers pointed at the right sub-view
  return `
  <div style="margin-bottom:14px">${obtn('← My Teaching', 'bsaBackToMyTeaching()', 'sm')}</div>
  ${card(`
    <div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:16px;color:${T.text}">${esc(info?.courseCode || '')} — Section ${esc(info?.sectionName || '')}</div>
    <div style="font-size:12px;color:${T.muted};margin-top:2px">${esc(info?.sessionName || '')} · Semester ${info?.actualSemester || ''}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:14px">
      ${SUBTABS.map(t => `<button type="button" onclick="bsaTeachSwitchSubTab('${t.key}')" style="padding:7px 14px;border:none;border-radius:8px;background:${bsaMyTeachingSubTab === t.key ? T.accentL : T.bg2};color:${bsaMyTeachingSubTab === t.key ? T.accentD : T.muted};font-weight:${bsaMyTeachingSubTab === t.key ? 800 : 600};font-size:12px;cursor:pointer">${t.label}</button>`).join('')}
    </div>
  `)}
  <div style="margin-top:14px">
    ${bsaMyTeachingSubTab === 'roster'     ? _bsaSecRoster(bsaMyTeachingSectionId).replace(/bsaOpenEnroll|bsaDeleteEnrollment/g, m => m) : ''}
    ${bsaMyTeachingSubTab === 'attendance' ? _bsaSecAttendance(bsaMyTeachingSectionId) : ''}
    ${bsaMyTeachingSubTab === 'results'    ? _bsaSecResults(bsaMyTeachingSectionId)    : ''}
  </div>`;
}

/* ================================================================
   STUDENT — MY COURSES  (spec §32)
   ================================================================ */
let bsaMyCourses = null;

function renderBSMyCourses() {
  if (!bsaMyCourses && !bsaLoading) {
    bsaLoading = true;
    bsaFetch('/api/bs/my/enrollments').then(d => { bsaMyCourses = d; bsaLoading = false; _bsaStudRender(); })
      .catch(e => { bsaToast(e.message, 'error'); bsaLoading = false; _bsaStudRender(); });
  }
  return `<div id="bsa-stud-root">${_bsaStudBody()}</div>`;
}
function _bsaStudRender() { const el = document.getElementById('bsa-stud-root'); if (el) el.innerHTML = _bsaStudBody(); }

function _bsaStudBody() {
  if (bsaLoading || !bsaMyCourses) return card(`<div style="text-align:center;padding:40px;color:${T.muted}">Loading…</div>`);
  const { enrollments, progress } = bsaMyCourses;

  return `
  ${progress ? card(`
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
      <div>
        <div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:16px;color:${T.text}">${esc(progress.programName)}</div>
        <div style="font-size:12px;color:${T.muted};margin-top:2px">${esc(progress.curriculumName)} · Semester ${progress.currentSemester}/${progress.totalSemesters}</div>
      </div>
      ${progress.cgpa !== null ? `<div style="text-align:right"><div style="font-size:22px;font-weight:800;color:${T.accentD};font-family:'Space Grotesk',sans-serif">${progress.cgpa}</div><div style="font-size:11px;color:${T.muted};text-transform:uppercase">CGPA</div></div>` : ''}
    </div>
    <div style="margin-bottom:6px;display:flex;justify-content:space-between;font-size:12px;color:${T.muted}">
      <span>${progress.earnedCredits} / ${progress.requiredCredits || '—'} credit hours</span><span>${progress.percentComplete ?? 0}%</span>
    </div>
    ${pbar(progress.percentComplete ?? 0)}
    ${progress.pendingRepeats.length ? `<div style="margin-top:14px;padding:10px;background:${T.redL || '#fef2f2'};border-radius:8px;font-size:12px;color:${T.red}">
      ⚠ Courses to repeat: ${progress.pendingRepeats.map(a => esc(a.courseCode)).join(', ')}
    </div>` : ''}
  `) : ''}
  <div style="margin-top:16px">${card(`
    <div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:15px;color:${T.text};margin-bottom:12px">My Current Courses</div>
    ${!enrollments.length ? `<div style="text-align:center;padding:20px;color:${T.muted}">No BS course enrollments yet.</div>` : `
    <div style="display:grid;gap:10px">
      ${enrollments.map(en => `<div style="padding:12px;background:${T.bg2};border-radius:10px">
        <div style="font-weight:700;color:${T.text}">${esc(en.courseCode)} — ${esc(en.courseName)} <span style="color:${T.muted};font-weight:500">· Section ${esc(en.sectionName)}</span></div>
        <div style="font-size:12px;color:${T.muted};margin-top:2px">${en.creditHours} credit hours · Semester ${en.actualSemester} · ${esc(en.sessionName)} · Taught by ${esc(en.teacherNames || '—')}</div>
      </div>`).join('')}
    </div>`}
  `)}</div>`;
}
