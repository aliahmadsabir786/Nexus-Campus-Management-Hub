/* ================================================================
   js/classes.js  —  NEXus Solution: Class Management Module
   ================================================================
   Provides three admin pages:
     renderClassList()      — Class List with CRUD + status toggle
     renderSectionMgmt()    — Section management per class
     renderClassStudents()  — Student management per section

   Global helpers exported:
     classesDropdown()      — returns <option> HTML for class selects
     sectionsDropdown(cid)  — returns <option> HTML for section selects
   ================================================================ */

/* ── Module state ─────────────────────────────────────────────── */
let cmClasses        = [];   // all classes from API
let cmSections       = [];   // sections for selected class
let cmStudents       = [];   // students for selected section
let cmSelectedClass  = null; // {id, name, code, …}
let cmSelectedSection= null; // {id, name, classId, …}
let cmStudentMeta    = {total:0, page:1, totalPages:1};
let cmStudentSearch  = '';
let cmStudentPage    = 1;
let cmLoading        = false;

/* ── Toast helper (uses existing CMS toast if available) ──────── */
function cmToast(msg, type='success'){
  if(typeof showToast === 'function'){ showToast(msg, type); return; }
  const colors = {
    success: 'background:#059669;color:#fff',
    error:   'background:#dc2626;color:#fff',
    info:    'background:#2563eb;color:#fff',
  };
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;
    border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.2);
    transition:all .3s;${colors[type]||colors.success}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),400); }, 3000);
}

/* ── API calls ────────────────────────────────────────────────── */
async function cmFetch(url, opts={}){
  try {
    const r = await fetch(url, { headers:{'Content-Type':'application/json'}, ...opts });
    const j = await r.json();
    if(!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  } catch(e) {
    throw e;
  }
}

async function cmLoadClasses(){
  cmLoading = true; refreshClassesView();
  try {
    cmClasses = await cmFetch('/api/classes');
  } catch(e){ cmToast('Failed to load classes: '+e.message,'error'); }
  cmLoading = false; refreshClassesView();
}

async function cmLoadSections(classId){
  try {
    cmSections = await cmFetch(`/api/classes/${classId}/sections`);
  } catch(e){ cmToast('Failed to load sections: '+e.message,'error'); }
}

async function cmLoadStudents(sectionId, page=1){
  try {
    const params = new URLSearchParams({page, limit:10, search:cmStudentSearch});
    const data = await cmFetch(`/api/sections/${sectionId}/students?${params}`);
    cmStudents    = data.students;
    cmStudentMeta = { total:data.total, page:data.page, totalPages:data.totalPages };
    cmStudentPage = data.page;
  } catch(e){ cmToast('Failed to load students: '+e.message,'error'); }
}

/* ── Refresh helpers ──────────────────────────────────────────── */
function refreshClassesView(){
  const el = document.getElementById('cm-classes-panel');
  if(el) el.innerHTML = renderClassesPanel();
}
function refreshSectionsView(){
  const el = document.getElementById('cm-sections-panel');
  if(el) el.innerHTML = renderSectionsPanel();
}
function refreshStudentsView(){
  const el = document.getElementById('cm-students-panel');
  if(el) el.innerHTML = renderStudentsPanel();
}

/* ================================================================
   PAGE 1 — CLASS LIST
   ================================================================ */
function renderClassList(){
  // Kick off data load async
  if(cmClasses.length === 0) cmLoadClasses();
  return `
  <!-- Page Header -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
    <div>
      <h1 style="font-size:22px;font-weight:800;color:${T.text};margin:0">🏫 Class Management</h1>
      <p style="font-size:13px;color:${T.muted};margin:4px 0 0">Create and manage classes, sections, and enrolled students</p>
    </div>
    <button onclick="cmOpenAddClass()" style="${pbtnStyle()}">
      + Add New Class
    </button>
  </div>

  <!-- Quick-nav tabs -->
  <div style="display:flex;gap:8px;margin-bottom:22px;flex-wrap:wrap">
    ${cmTabBtn('classes','🏫 Classes','classes')}
    ${cmTabBtn('sections','📚 Sections','sections')}
    ${cmTabBtn('cm-students','👨‍🎓 Students','cm-students')}
  </div>

  <!-- Main panel -->
  <div id="cm-classes-panel">${renderClassesPanel()}</div>

  <!-- Modal container -->
  <div id="cm-modal"></div>
  `;
}

function cmTabBtn(page, label, key){
  const active = currentPage === key;
  return `<button onclick="navTo('${key}')" style="
    padding:9px 18px;border-radius:10px;border:1.5px solid ${active?T.accent:T.border2};
    background:${active?T.accentL:'#fff'};color:${active?T.accentD:T.muted};
    font-size:13px;font-weight:700;cursor:pointer;transition:all .15s">${label}</button>`;
}

function renderClassesPanel(){
  if(cmLoading) return `<div style="text-align:center;padding:60px;color:${T.muted}">
    <div style="font-size:32px;margin-bottom:12px;animation:spin 1s linear infinite">⟳</div>
    <div>Loading classes…</div></div>`;

  if(cmClasses.length === 0) return `
    <div style="background:#fff;border:1px solid ${T.border};border-radius:16px;padding:60px;text-align:center;box-shadow:${T.shadow}">
      <div style="font-size:56px;margin-bottom:16px">🏫</div>
      <div style="font-size:18px;font-weight:800;color:${T.text};margin-bottom:8px">No Classes Yet</div>
      <p style="color:${T.muted};font-size:13px;margin-bottom:20px">Start by adding your first class to the system.</p>
      <button onclick="cmOpenAddClass()" style="${pbtnStyle()}">+ Add First Class</button>
    </div>`;

  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px">
    ${cmClasses.map(cls => cmClassCard(cls)).join('')}
  </div>`;
}

function cmClassCard(cls){
  const isActive = cls.status === 'active';
  return `
  <div class="cm-card cm-card-hover" style="
    background:#fff;border:1px solid ${T.border};border-radius:18px;
    padding:22px;box-shadow:${T.shadow};
    border-top:4px solid ${isActive?T.accent:'#94a3b8'};
    transition:transform .2s,box-shadow .2s;position:relative;overflow:hidden">

    <!-- Subtle bg pattern -->
    <div style="position:absolute;right:-20px;top:-20px;width:80px;height:80px;
      border-radius:50%;background:${isActive?T.accentL:'#f1f5f9'};opacity:.5"></div>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;position:relative">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:48px;height:48px;border-radius:14px;
          background:${isActive?T.accentL:'#f1f5f9'};
          display:flex;align-items:center;justify-content:center;font-size:22px">🎓</div>
        <div>
          <div style="font-weight:800;font-size:15px;color:${T.text}">${esc(cls.name)}</div>
          <div style="font-size:11px;color:${T.muted};margin-top:2px">
            <span style="background:${T.accentL};color:${T.accentD};border-radius:6px;
              padding:2px 7px;font-weight:700;font-size:10px">${esc(cls.code)}</span>
          </div>
        </div>
      </div>
      <span style="background:${isActive?T.greenL:T.border};color:${isActive?T.green:T.muted};
        border-radius:20px;padding:4px 10px;font-size:11px;font-weight:700">
        ${isActive?'Active':'Inactive'}
      </span>
    </div>

    ${cls.description ? `<p style="font-size:12px;color:${T.muted};margin-bottom:14px;line-height:1.5">${esc(cls.description)}</p>` : ''}

    <!-- Stats row -->
    <div style="display:flex;gap:16px;margin-bottom:18px;padding:12px;
      background:${T.bg};border-radius:10px">
      <div style="flex:1;text-align:center">
        <div style="font-size:20px;font-weight:800;color:${T.accent}">${cls.sectionCount||0}</div>
        <div style="font-size:10px;color:${T.muted};font-weight:600">Sections</div>
      </div>
      <div style="width:1px;background:${T.border}"></div>
      <div style="flex:1;text-align:center">
        <div style="font-size:20px;font-weight:800;color:${T.purple}">${cls.studentCount||0}</div>
        <div style="font-size:10px;color:${T.muted};font-weight:600">Students</div>
      </div>
    </div>

    <!-- Actions -->
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button onclick="cmOpenSections(${cls.id})" style="${sbtnStyle('sm')}">📚 Sections</button>
      <button onclick="cmOpenEditClass(${cls.id})" style="${obtnStyle('sm')}">✏️ Edit</button>
      <button onclick="cmToggleClassStatus(${cls.id})" style="
        padding:6px 12px;border-radius:8px;border:1px solid ${isActive?'#fca5a5':'#86efac'};
        background:${isActive?T.redL:T.greenL};color:${isActive?T.red:T.green};
        font-size:11px;font-weight:700;cursor:pointer">
        ${isActive?'🔒 Deactivate':'✅ Activate'}</button>
      <button onclick="cmDeleteClass(${cls.id},'${esc(cls.name)}')" style="${dbtnStyle('sm')}">🗑️</button>
    </div>
  </div>`;
}

/* ================================================================
   PAGE 2 — SECTION MANAGEMENT
   ================================================================ */
function renderSectionMgmt(){
  if(cmClasses.length === 0) cmLoadClasses();
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
    <div>
      <h1 style="font-size:22px;font-weight:800;color:${T.text};margin:0">📚 Section Management</h1>
      <p style="font-size:13px;color:${T.muted};margin:4px 0 0">Manage sections within each class</p>
    </div>
  </div>

  <!-- Class selector -->
  <div style="background:#fff;border:1px solid ${T.border};border-radius:14px;padding:18px;
    margin-bottom:20px;box-shadow:${T.shadow}">
    <label style="font-size:12px;font-weight:700;color:${T.muted};display:block;margin-bottom:8px;
      text-transform:uppercase;letter-spacing:.06em">Select Class</label>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${cmClasses.map(c => `
        <button onclick="cmSelectClassForSections(${c.id})" style="
          padding:8px 16px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;
          border:2px solid ${cmSelectedClass?.id===c.id?T.accent:T.border2};
          background:${cmSelectedClass?.id===c.id?T.accentL:'#fff'};
          color:${cmSelectedClass?.id===c.id?T.accentD:T.text};transition:all .15s">
          ${esc(c.name)} <span style="opacity:.6;font-size:11px">(${c.code})</span>
        </button>`).join('')}
    </div>
  </div>

  <div id="cm-sections-panel">${renderSectionsPanel()}</div>
  <div id="cm-modal"></div>`;
}

async function cmSelectClassForSections(classId){
  cmSelectedClass = cmClasses.find(c => c.id === classId) || null;
  if(cmSelectedClass){
    await cmLoadSections(classId);
  }
  refreshSectionsView();
  // Re-render the whole page to update selector buttons
  const el = document.getElementById('main-content');
  if(el) el.innerHTML = renderSectionMgmt();
}

function renderSectionsPanel(){
  if(!cmSelectedClass) return `
    <div style="background:#fff;border:1px solid ${T.border};border-radius:16px;padding:60px;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">📚</div>
      <div style="font-size:16px;font-weight:700;color:${T.muted}">Select a class above to manage its sections</div>
    </div>`;

  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div style="font-weight:800;font-size:16px;color:${T.text}">
      Sections in <span style="color:${T.accent}">${esc(cmSelectedClass.name)}</span>
    </div>
    <button onclick="cmOpenAddSection(${cmSelectedClass.id})" style="${pbtnStyle()}">+ Add Section</button>
  </div>

  ${cmSections.length === 0 ?
    `<div style="background:#fff;border:1px solid ${T.border};border-radius:14px;padding:48px;text-align:center">
      <div style="font-size:40px;margin-bottom:10px">📁</div>
      <div style="font-weight:700;color:${T.muted}">No sections yet. Add the first section.</div>
    </div>` :
    `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
      ${cmSections.map(sec => cmSectionCard(sec)).join('')}
    </div>`
  }`;
}

function cmSectionCard(sec){
  return `
  <div class="cm-card-hover" style="background:#fff;border:1px solid ${T.border};
    border-radius:14px;padding:20px;box-shadow:${T.shadow};border-left:4px solid ${T.accent};
    transition:transform .2s,box-shadow .2s">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <div style="font-weight:800;font-size:15px;color:${T.text}">${esc(sec.name)}</div>
        <div style="font-size:12px;color:${T.muted};margin-top:3px">${sec.room||'No room assigned'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:20px;font-weight:800;color:${T.accent}">${sec.studentCount||0}</div>
        <div style="font-size:10px;color:${T.muted}">Students</div>
      </div>
    </div>
    <div style="background:${T.bg};border-radius:8px;padding:8px 12px;margin-bottom:14px;
      font-size:12px;color:${T.muted}">
      Capacity: <strong style="color:${T.text}">${sec.capacity}</strong> seats
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="cmOpenStudentMgmt(${sec.id})" style="${sbtnStyle('sm')}">👨‍🎓 Students</button>
      <button onclick="cmOpenEditSection(${sec.id})" style="${obtnStyle('sm')}">✏️ Edit</button>
      <button onclick="cmDeleteSection(${sec.id},'${esc(sec.name)}')" style="${dbtnStyle('sm')}">🗑️</button>
    </div>
  </div>`;
}

/* ================================================================
   PAGE 3 — STUDENT MANAGEMENT
   ================================================================ */
function renderClassStudents(){
  if(cmClasses.length === 0) cmLoadClasses();
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
    <div>
      <h1 style="font-size:22px;font-weight:800;color:${T.text};margin:0">👨‍🎓 Student Management</h1>
      <p style="font-size:13px;color:${T.muted};margin:4px 0 0">Search, filter, and manage students across all classes</p>
    </div>
  </div>

  <!-- Selectors row -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
    <div style="background:#fff;border:1px solid ${T.border};border-radius:12px;padding:16px">
      <label style="font-size:11px;font-weight:700;color:${T.muted};display:block;margin-bottom:8px;
        text-transform:uppercase;letter-spacing:.06em">Class</label>
      <select onchange="cmSelectClassForStudents(this.value)"
        style="width:100%;padding:9px 12px;border:1.5px solid ${T.border2};border-radius:8px;
        font-size:13px;font-family:inherit;color:${T.text};background:#fff;cursor:pointer">
        <option value="">— Select Class —</option>
        ${cmClasses.map(c => `<option value="${c.id}" ${cmSelectedClass?.id==c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div style="background:#fff;border:1px solid ${T.border};border-radius:12px;padding:16px">
      <label style="font-size:11px;font-weight:700;color:${T.muted};display:block;margin-bottom:8px;
        text-transform:uppercase;letter-spacing:.06em">Section</label>
      <select onchange="cmSelectSectionForStudents(this.value)"
        style="width:100%;padding:9px 12px;border:1.5px solid ${T.border2};border-radius:8px;
        font-size:13px;font-family:inherit;color:${T.text};background:#fff;cursor:pointer"
        ${!cmSelectedClass?'disabled':''}>
        <option value="">— Select Section —</option>
        ${cmSections.map(s => `<option value="${s.id}" ${cmSelectedSection?.id==s.id?'selected':''}>${esc(s.name)}</option>`).join('')}
      </select>
    </div>
  </div>

  <div id="cm-students-panel">${renderStudentsPanel()}</div>
  <div id="cm-modal"></div>`;
}

async function cmSelectClassForStudents(classId){
  cmSelectedClass   = cmClasses.find(c => c.id == classId) || null;
  cmSelectedSection = null;
  cmStudents        = [];
  if(cmSelectedClass) await cmLoadSections(classId);
  const el = document.getElementById('main-content');
  if(el) el.innerHTML = renderClassStudents();
}

async function cmSelectSectionForStudents(sectionId){
  cmSelectedSection = cmSections.find(s => s.id == sectionId) || null;
  if(cmSelectedSection){
    cmStudentSearch = '';
    cmStudentPage   = 1;
    await cmLoadStudents(sectionId);
  }
  refreshStudentsView();
}

function renderStudentsPanel(){
  if(!cmSelectedSection) return `
    <div style="background:#fff;border:1px solid ${T.border};border-radius:16px;padding:60px;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">👨‍🎓</div>
      <div style="font-size:16px;font-weight:700;color:${T.muted}">Select a class and section to view students</div>
    </div>`;

  const isMobile = window.innerWidth <= 768;
  return `
  <!-- Toolbar -->
  <div style="background:#fff;border:1px solid ${T.border};border-radius:14px;
    padding:16px 18px;margin-bottom:16px;box-shadow:${T.shadow}">
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between">
      <div style="font-weight:800;font-size:15px;color:${T.text}">
        ${esc(cmSelectedClass?.name||'')} — ${esc(cmSelectedSection.name)}
        <span style="font-size:12px;font-weight:500;color:${T.muted};margin-left:8px">
          (${cmStudentMeta.total} students)
        </span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input type="text" placeholder="🔍 Search students…" value="${esc(cmStudentSearch)}"
          oninput="cmSearchStudents(this.value)"
          style="padding:8px 14px;border:1.5px solid ${T.border2};border-radius:9px;
          font-size:13px;width:${isMobile?'100%':'200px'};font-family:inherit;color:${T.text}">
        <button onclick="cmOpenAddStudent(${cmSelectedSection.id})" style="${pbtnStyle()}">+ Add Student</button>
      </div>
    </div>
  </div>

  <!-- Student list -->
  ${cmStudents.length === 0 ?
    `<div style="background:#fff;border:1px solid ${T.border};border-radius:14px;padding:48px;text-align:center">
      <div style="font-size:40px;margin-bottom:10px">👤</div>
      <div style="font-weight:700;color:${T.muted}">No students found${cmStudentSearch?' for "'+esc(cmStudentSearch)+'"':''}</div>
    </div>` :
    isMobile ? renderStudentCards() : renderStudentTable()
  }

  <!-- Pagination -->
  ${cmStudentMeta.totalPages > 1 ? renderPagination() : ''}`;
}

function renderStudentTable(){
  return `
  <div style="background:#fff;border:1px solid ${T.border};border-radius:14px;
    overflow:hidden;box-shadow:${T.shadow}">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:${T.bg};border-bottom:2px solid ${T.border}">
          <th style="${thStyle()}">Roll No</th>
          <th style="${thStyle()}">Name</th>
          <th style="${thStyle()}">Email</th>
          <th style="${thStyle()}">Phone</th>
          <th style="${thStyle()}">Status</th>
          <th style="${thStyle()}">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${cmStudents.map((st, i) => `
        <tr style="border-bottom:1px solid ${T.border};transition:background .15s"
          onmouseover="this.style.background='${T.bg}'" onmouseout="this.style.background='#fff'">
          <td style="${tdStyle()}">
            <span style="background:${T.accentL};color:${T.accentD};border-radius:6px;
              padding:2px 8px;font-size:12px;font-weight:700">${esc(st.rollNo)}</span>
          </td>
          <td style="${tdStyle()}">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:32px;height:32px;border-radius:10px;background:${T.accentL};
                display:flex;align-items:center;justify-content:center;font-size:14px;
                font-weight:800;color:${T.accentD}">${(st.name||'?')[0].toUpperCase()}</div>
              <span style="font-weight:600">${esc(st.name)}</span>
            </div>
          </td>
          <td style="${tdStyle()};color:${T.muted}">${esc(st.email||'—')}</td>
          <td style="${tdStyle()};color:${T.muted}">${esc(st.phone||'—')}</td>
          <td style="${tdStyle()}">
            <span style="background:${st.status==='active'?T.greenL:T.border};
              color:${st.status==='active'?T.green:T.muted};
              border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700">
              ${st.status==='active'?'Active':'Inactive'}
            </span>
          </td>
          <td style="${tdStyle()}">
            <div style="display:flex;gap:6px">
              <button onclick="cmOpenEditStudent(${st.id})" style="${obtnStyle('xs')}">✏️</button>
              <button onclick="cmDeleteStudent(${st.id},'${esc(st.name)}')" style="${dbtnStyle('xs')}">🗑️</button>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderStudentCards(){
  return `<div style="display:grid;gap:12px">
    ${cmStudents.map(st => `
    <div style="background:#fff;border:1px solid ${T.border};border-radius:14px;padding:16px;
      box-shadow:${T.shadow}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:38px;height:38px;border-radius:10px;background:${T.accentL};
            display:flex;align-items:center;justify-content:center;font-weight:800;
            color:${T.accentD};font-size:15px">${(st.name||'?')[0].toUpperCase()}</div>
          <div>
            <div style="font-weight:700;font-size:14px">${esc(st.name)}</div>
            <div style="font-size:11px;color:${T.muted}">Roll: ${esc(st.rollNo)}</div>
          </div>
        </div>
        <span style="background:${st.status==='active'?T.greenL:T.border};
          color:${st.status==='active'?T.green:T.muted};
          border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700">
          ${st.status==='active'?'Active':'Inactive'}
        </span>
      </div>
      <div style="font-size:12px;color:${T.muted};margin-bottom:12px">
        ${st.email?`📧 ${esc(st.email)}<br>`:''}
        ${st.phone?`📱 ${esc(st.phone)}`:''}
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="cmOpenEditStudent(${st.id})" style="${obtnStyle('sm')}">✏️ Edit</button>
        <button onclick="cmDeleteStudent(${st.id},'${esc(st.name)}')" style="${dbtnStyle('sm')}">🗑️ Delete</button>
      </div>
    </div>`).join('')}
  </div>`;
}

function renderPagination(){
  const {page, totalPages} = cmStudentMeta;
  return `
  <div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:16px">
    <button onclick="cmGoPage(${page-1})" ${page<=1?'disabled':''} style="${paginBtn()}">← Prev</button>
    ${Array.from({length:totalPages},(_,i)=>i+1).map(p=>
      `<button onclick="cmGoPage(${p})" style="${paginBtn(p===page)}">${p}</button>`
    ).join('')}
    <button onclick="cmGoPage(${page+1})" ${page>=totalPages?'disabled':''} style="${paginBtn()}">Next →</button>
  </div>`;
}

async function cmGoPage(p){
  if(!cmSelectedSection) return;
  await cmLoadStudents(cmSelectedSection.id, p);
  refreshStudentsView();
}

let _cmSearchTimer;
async function cmSearchStudents(val){
  cmStudentSearch = val;
  clearTimeout(_cmSearchTimer);
  _cmSearchTimer = setTimeout(async()=>{
    if(!cmSelectedSection) return;
    cmStudentPage = 1;
    await cmLoadStudents(cmSelectedSection.id, 1);
    refreshStudentsView();
  }, 300);
}

/* ================================================================
   MODALS — Class / Section / Student forms
   ================================================================ */
function cmShowModal(html){
  let el = document.getElementById('cm-modal');
  if(!el){ el = document.createElement('div'); el.id='cm-modal'; document.body.appendChild(el); }
  el.innerHTML = `
  <div onclick="cmCloseModal(event,this)" style="position:fixed;inset:0;background:rgba(0,0,0,.5);
    z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;
    animation:fadeIn .2s ease">
    <div onclick="event.stopPropagation()" style="background:#fff;border-radius:20px;
      padding:28px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;
      box-shadow:0 20px 60px rgba(0,0,0,.25);animation:slideUp .25s ease">
      ${html}
    </div>
  </div>`;
}

function cmCloseModal(e, overlay){ if(e.target===overlay) cmHideModal(); }
function cmHideModal(){
  const el = document.getElementById('cm-modal');
  if(el) el.innerHTML='';
}

/* ── Add / Edit Class modal ───────────────────────────────────── */
function cmOpenAddClass(){
  cmShowModal(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <h2 style="font-size:17px;font-weight:800;color:${T.text}">🏫 Add New Class</h2>
    <button onclick="cmHideModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:${T.muted}">✕</button>
  </div>
  ${cmClassForm()}
  <div style="display:flex;gap:10px;margin-top:20px">
    <button onclick="cmHideModal()" style="${obtnStyle()}">Cancel</button>
    <button onclick="cmSaveClass()" style="${pbtnStyle()};flex:1">Save Class</button>
  </div>
  <div id="cm-form-err" style="margin-top:10px;font-size:13px;color:${T.red};text-align:center"></div>`);
}

function cmOpenEditClass(classId){
  const cls = cmClasses.find(c => c.id === classId);
  if(!cls) return;
  cmShowModal(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <h2 style="font-size:17px;font-weight:800;color:${T.text}">✏️ Edit Class</h2>
    <button onclick="cmHideModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:${T.muted}">✕</button>
  </div>
  ${cmClassForm(cls)}
  <div style="display:flex;gap:10px;margin-top:20px">
    <button onclick="cmHideModal()" style="${obtnStyle()}">Cancel</button>
    <button onclick="cmUpdateClass(${classId})" style="${pbtnStyle()};flex:1">Update Class</button>
  </div>
  <div id="cm-form-err" style="margin-top:10px;font-size:13px;color:${T.red};text-align:center"></div>`);
}

function cmClassForm(cls={}){
  return `
  <div style="display:grid;gap:14px">
    ${cmField('Class Name','cm-cls-name',cls.name||'','text','e.g. Computer Science')}
    ${cmField('Class Code','cm-cls-code',cls.code||'','text','e.g. CS')}
    ${cmField('Description','cm-cls-desc',cls.description||'','text','Optional description','',true)}
    <div>
      <label style="${labelStyle()}">Status</label>
      <select id="cm-cls-status" style="${selectStyle()}">
        <option value="active" ${(cls.status||'active')==='active'?'selected':''}>Active</option>
        <option value="inactive" ${cls.status==='inactive'?'selected':''}>Inactive</option>
      </select>
    </div>
  </div>`;
}

async function cmSaveClass(){
  const name  = document.getElementById('cm-cls-name')?.value.trim();
  const code  = document.getElementById('cm-cls-code')?.value.trim();
  const desc  = document.getElementById('cm-cls-desc')?.value.trim();
  const status= document.getElementById('cm-cls-status')?.value;
  if(!name||!code){ document.getElementById('cm-form-err').textContent='Name and Code are required.'; return; }
  try {
    const result = await cmFetch('/api/classes',{method:'POST',body:JSON.stringify({name,code,description:desc,status})});
    cmClasses.push({...result.class, sectionCount:0, studentCount:0});
    // ── Attendance dropdown sync ──────────────────────────────────────
    // dbClasses aur dbSections attendance page ke class/section select
    // mein use hote hain. Nai class add hone par fresh data load karo.
    if(status === 'active'){
      const newCls = {id: result.class.id, name: result.class.name, code: result.class.code};
      if(window.dbClasses) window.dbClasses.push(newCls);
      if(typeof dbClasses !== 'undefined') dbClasses.push(newCls);
    }
    // Full refresh to keep everything in sync
    if(typeof loadDropdownsFromDB === 'function') loadDropdownsFromDB();
    cmHideModal(); cmToast('Class created successfully!');
    refreshClassesView();
  } catch(e){ document.getElementById('cm-form-err').textContent=e.message; }
}

async function cmUpdateClass(classId){
  const name  = document.getElementById('cm-cls-name')?.value.trim();
  const code  = document.getElementById('cm-cls-code')?.value.trim();
  const desc  = document.getElementById('cm-cls-desc')?.value.trim();
  const status= document.getElementById('cm-cls-status')?.value;
  if(!name||!code){ document.getElementById('cm-form-err').textContent='Name and Code are required.'; return; }
  try {
    const result = await cmFetch(`/api/classes/${classId}`,{method:'PUT',body:JSON.stringify({name,code,description:desc,status})});
    const idx = cmClasses.findIndex(c=>c.id===classId);
    if(idx>=0) cmClasses[idx]={...cmClasses[idx],...result.class};
    // ── Attendance dropdown sync ──────────────────────────────────────
    const syncCls = arr => {
      if(!arr) return;
      const i = arr.findIndex(c=>c.id===classId);
      if(status==='inactive' && i>=0){ arr.splice(i,1); }
      else if(status==='active'){
        const updated = {id:classId, name:result.class.name, code:result.class.code};
        if(i>=0) arr[i]=updated; else arr.push(updated);
      }
    };
    syncCls(window.dbClasses);
    if(typeof dbClasses !== 'undefined') syncCls(dbClasses);
    if(typeof loadDropdownsFromDB === 'function') loadDropdownsFromDB();
    cmHideModal(); cmToast('Class updated!');
    refreshClassesView();
  } catch(e){ document.getElementById('cm-form-err').textContent=e.message; }
}

async function cmToggleClassStatus(classId){
  try {
    const r = await cmFetch(`/api/classes/${classId}/status`,{method:'PATCH'});
    const idx = cmClasses.findIndex(c=>c.id===classId);
    if(idx>=0) cmClasses[idx].status = r.status;
    cmToast(`Class ${r.status==='active'?'activated':'deactivated'}`);
    refreshClassesView();
  } catch(e){ cmToast(e.message,'error'); }
}

async function cmDeleteClass(classId, name){
  if(!confirm(`Delete class "${name}"?\nThis will also delete all sections and students.`)) return;
  try {
    await cmFetch(`/api/classes/${classId}`,{method:'DELETE'});
    cmClasses = cmClasses.filter(c=>c.id!==classId);
    cmToast('Class deleted');
    refreshClassesView();
  } catch(e){ cmToast(e.message,'error'); }
}

/* ── Section modals ───────────────────────────────────────────── */
async function cmOpenSections(classId){
  cmSelectedClass = cmClasses.find(c=>c.id===classId)||null;
  if(cmSelectedClass) await cmLoadSections(classId);
  navTo('sections');
}

function cmOpenAddSection(classId){
  cmShowModal(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <h2 style="font-size:17px;font-weight:800;color:${T.text}">📁 Add Section</h2>
    <button onclick="cmHideModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:${T.muted}">✕</button>
  </div>
  ${cmSectionForm()}
  <div style="display:flex;gap:10px;margin-top:20px">
    <button onclick="cmHideModal()" style="${obtnStyle()}">Cancel</button>
    <button onclick="cmSaveSection(${classId})" style="${pbtnStyle()};flex:1">Save Section</button>
  </div>
  <div id="cm-form-err" style="margin-top:10px;font-size:13px;color:${T.red};text-align:center"></div>`);
}

function cmOpenEditSection(sectionId){
  const sec = cmSections.find(s=>s.id===sectionId);
  if(!sec) return;
  cmShowModal(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <h2 style="font-size:17px;font-weight:800;color:${T.text}">✏️ Edit Section</h2>
    <button onclick="cmHideModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:${T.muted}">✕</button>
  </div>
  ${cmSectionForm(sec)}
  <div style="display:flex;gap:10px;margin-top:20px">
    <button onclick="cmHideModal()" style="${obtnStyle()}">Cancel</button>
    <button onclick="cmUpdateSection(${sectionId})" style="${pbtnStyle()};flex:1">Update</button>
  </div>
  <div id="cm-form-err" style="margin-top:10px;font-size:13px;color:${T.red};text-align:center"></div>`);
}

function cmSectionForm(sec={}){
  return `<div style="display:grid;gap:14px">
    ${cmField('Section Name','cm-sec-name',sec.name||'','text','e.g. Section A')}
    ${cmField('Room','cm-sec-room',sec.room||'','text','e.g. Room 101')}
    ${cmField('Capacity','cm-sec-cap',sec.capacity||40,'number','Max students')}
  </div>`;
}

async function cmSaveSection(classId){
  const name = document.getElementById('cm-sec-name')?.value.trim();
  const room = document.getElementById('cm-sec-room')?.value.trim();
  const cap  = parseInt(document.getElementById('cm-sec-cap')?.value)||40;
  if(!name){ document.getElementById('cm-form-err').textContent='Section name is required.'; return; }
  try {
    const r = await cmFetch(`/api/classes/${classId}/sections`,{method:'POST',body:JSON.stringify({name,room,capacity:cap})});
    cmSections.push({...r.section, studentCount:0});
    // ── Attendance dropdown sync ──────────────────────────────────────
    // Naya section dbSections mein add karo taake attendance page par
    // class select karne ke baad yeh section bhi nazar aaye.
    const parentClass = cmClasses.find(c=>c.id===classId);
    const newSec = {
      id: r.section.id,
      name: r.section.name,
      classId: classId,
      className: parentClass ? parentClass.name : ''
    };
    if(window.dbSections) window.dbSections.push(newSec);
    if(typeof dbSections !== 'undefined') dbSections.push(newSec);
    if(typeof loadDropdownsFromDB === 'function') loadDropdownsFromDB();
    cmHideModal(); cmToast('Section added!');
    refreshSectionsView();
  } catch(e){ document.getElementById('cm-form-err').textContent=e.message; }
}

async function cmUpdateSection(sectionId){
  const name = document.getElementById('cm-sec-name')?.value.trim();
  const room = document.getElementById('cm-sec-room')?.value.trim();
  const cap  = parseInt(document.getElementById('cm-sec-cap')?.value)||40;
  if(!name){ document.getElementById('cm-form-err').textContent='Section name is required.'; return; }
  try {
    const r = await cmFetch(`/api/sections/${sectionId}`,{method:'PUT',body:JSON.stringify({name,room,capacity:cap})});
    const idx = cmSections.findIndex(s=>s.id===sectionId);
    if(idx>=0) cmSections[idx]={...cmSections[idx],...r.section};
    // ── Attendance dropdown sync ──────────────────────────────────────
    const syncSec = arr => {
      if(!arr) return;
      const i = arr.findIndex(s=>s.id===sectionId);
      if(i>=0) arr[i]={...arr[i], name:r.section.name};
    };
    syncSec(window.dbSections);
    if(typeof dbSections !== 'undefined') syncSec(dbSections);
    if(typeof loadDropdownsFromDB === 'function') loadDropdownsFromDB();
    cmHideModal(); cmToast('Section updated!');
    refreshSectionsView();
  } catch(e){ document.getElementById('cm-form-err').textContent=e.message; }
}

async function cmDeleteSection(sectionId, name){
  if(!confirm(`Delete section "${name}"?\nAll students in this section will be removed.`)) return;
  try {
    await cmFetch(`/api/sections/${sectionId}`,{method:'DELETE'});
    cmSections = cmSections.filter(s=>s.id!==sectionId);
    // ── Attendance dropdown sync ──────────────────────────────────────
    if(window.dbSections) window.dbSections = window.dbSections.filter(s=>s.id!==sectionId);
    if(typeof dbSections !== 'undefined') dbSections = dbSections.filter(s=>s.id!==sectionId);
    if(typeof loadDropdownsFromDB === 'function') loadDropdownsFromDB();
    cmToast('Section deleted');
    refreshSectionsView();
  } catch(e){ cmToast(e.message,'error'); }
}

/* ── Student modals ───────────────────────────────────────────── */
async function cmOpenStudentMgmt(sectionId){
  cmSelectedSection = cmSections.find(s=>s.id===sectionId)||null;
  if(cmSelectedSection){
    cmStudentSearch=''; cmStudentPage=1;
    await cmLoadStudents(sectionId);
  }
  navTo('cm-students');
}

function cmOpenAddStudent(sectionId){
  cmShowModal(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <h2 style="font-size:17px;font-weight:800;color:${T.text}">👤 Add Student</h2>
    <button onclick="cmHideModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:${T.muted}">✕</button>
  </div>
  ${cmStudentForm()}
  <div style="display:flex;gap:10px;margin-top:20px">
    <button onclick="cmHideModal()" style="${obtnStyle()}">Cancel</button>
    <button onclick="cmSaveStudent(${sectionId})" style="${pbtnStyle()};flex:1">Add Student</button>
  </div>
  <div id="cm-form-err" style="margin-top:10px;font-size:13px;color:${T.red};text-align:center"></div>`);
}

function cmOpenEditStudent(studentId){
  const st = cmStudents.find(s=>s.id===studentId);
  if(!st) return;
  cmShowModal(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <h2 style="font-size:17px;font-weight:800;color:${T.text}">✏️ Edit Student</h2>
    <button onclick="cmHideModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:${T.muted}">✕</button>
  </div>
  ${cmStudentForm(st)}
  <div style="display:flex;gap:10px;margin-top:20px">
    <button onclick="cmHideModal()" style="${obtnStyle()}">Cancel</button>
    <button onclick="cmUpdateStudent(${studentId})" style="${pbtnStyle()};flex:1">Update</button>
  </div>
  <div id="cm-form-err" style="margin-top:10px;font-size:13px;color:${T.red};text-align:center"></div>`);
}

function cmStudentForm(st={}){
  return `<div style="display:grid;gap:14px">
    ${cmField('Full Name *','cm-st-name',st.name||'','text','Student full name')}
    ${cmField('Roll Number *','cm-st-roll',st.rollNo||'','text','e.g. 01')}
    ${cmField('Email','cm-st-email',st.email||'','email','student@cms.edu')}
    ${cmField('Phone','cm-st-phone',st.phone||'','tel','03XXXXXXXXX')}
    <div>
      <label style="${labelStyle()}">Status</label>
      <select id="cm-st-status" style="${selectStyle()}">
        <option value="active" ${(st.status||'active')==='active'?'selected':''}>Active</option>
        <option value="inactive" ${st.status==='inactive'?'selected':''}>Inactive</option>
      </select>
    </div>
  </div>`;
}

async function cmSaveStudent(sectionId){
  const name   = document.getElementById('cm-st-name')?.value.trim();
  const rollNo = document.getElementById('cm-st-roll')?.value.trim();
  const email  = document.getElementById('cm-st-email')?.value.trim();
  const phone  = document.getElementById('cm-st-phone')?.value.trim();
  const status = document.getElementById('cm-st-status')?.value;
  if(!name||!rollNo){ document.getElementById('cm-form-err').textContent='Name and Roll No are required.'; return; }
  try {
    const r = await cmFetch(`/api/sections/${sectionId}/students`,{method:'POST',body:JSON.stringify({name,rollNo,email,phone,status})});
    cmStudents.unshift(r.student);
    cmStudentMeta.total++;
    cmHideModal(); cmToast('Student added!');
    refreshStudentsView();
  } catch(e){ document.getElementById('cm-form-err').textContent=e.message; }
}

async function cmUpdateStudent(studentId){
  const name   = document.getElementById('cm-st-name')?.value.trim();
  const rollNo = document.getElementById('cm-st-roll')?.value.trim();
  const email  = document.getElementById('cm-st-email')?.value.trim();
  const phone  = document.getElementById('cm-st-phone')?.value.trim();
  const status = document.getElementById('cm-st-status')?.value;
  if(!name||!rollNo){ document.getElementById('cm-form-err').textContent='Name and Roll No are required.'; return; }
  try {
    const r = await cmFetch(`/api/class-students/${studentId}`,{method:'PUT',body:JSON.stringify({name,rollNo,email,phone,status})});
    const idx = cmStudents.findIndex(s=>s.id===studentId);
    if(idx>=0) cmStudents[idx]={...cmStudents[idx],...r.student};
    cmHideModal(); cmToast('Student updated!');
    refreshStudentsView();
  } catch(e){ document.getElementById('cm-form-err').textContent=e.message; }
}

async function cmDeleteStudent(studentId, name){
  if(!confirm(`Remove student "${name}" from this section?`)) return;
  try {
    await cmFetch(`/api/class-students/${studentId}`,{method:'DELETE'});
    cmStudents = cmStudents.filter(s=>s.id!==studentId);
    cmStudentMeta.total = Math.max(0, cmStudentMeta.total-1);
    cmToast('Student removed');
    refreshStudentsView();
  } catch(e){ cmToast(e.message,'error'); }
}

/* ================================================================
   GLOBAL DROPDOWN HELPERS — usable anywhere in the CMS
   ================================================================ */

/**
 * Fetch active classes and return <option> HTML.
 * Usage: document.getElementById('mySelect').innerHTML = await classesDropdown();
 */
async function classesDropdown(selectedId=''){
  try {
    const rows = await cmFetch('/api/classes/dropdown');
    return `<option value="">— Select Class —</option>` +
      rows.map(c=>`<option value="${c.id}" ${c.id==selectedId?'selected':''}>${esc(c.name)} (${esc(c.code)})</option>`).join('');
  } catch { return '<option value="">Failed to load classes</option>'; }
}

/**
 * Fetch sections (optionally filtered by classId) and return <option> HTML.
 */
async function sectionsDropdown(classId='', selectedId=''){
  try {
    const url = classId ? `/api/sections/dropdown?class_id=${classId}` : '/api/sections/dropdown';
    const rows = await cmFetch(url);
    return `<option value="">— Select Section —</option>` +
      rows.map(s=>`<option value="${s.id}" ${s.id==selectedId?'selected':''}>${esc(s.className)} — ${esc(s.name)}</option>`).join('');
  } catch { return '<option value="">Failed to load sections</option>'; }
}

/* ================================================================
   STYLE HELPERS  (mirrors existing CMS button styles from T)
   ================================================================ */
function pbtnStyle(size=''){
  const p = size==='sm'?'7px 14px':'10px 20px';
  return `padding:${p};background:linear-gradient(135deg,${T.accent},${T.accentD});
    color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;
    cursor:pointer;box-shadow:0 2px 8px rgba(5,150,105,.3);transition:all .15s;
    font-family:inherit`;
}
function sbtnStyle(size=''){
  const p = size==='sm'?'6px 12px':size==='xs'?'4px 10px':'9px 18px';
  return `padding:${p};background:${T.accentL};color:${T.accentD};
    border:1px solid ${T.border2};border-radius:8px;font-size:${size==='xs'?'11':'12'}px;
    font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit`;
}
function obtnStyle(size=''){
  const p = size==='sm'?'6px 12px':size==='xs'?'4px 10px':'9px 18px';
  return `padding:${p};background:#fff;color:${T.text};
    border:1.5px solid ${T.border2};border-radius:8px;font-size:${size==='xs'?'11':'12'}px;
    font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit`;
}
function dbtnStyle(size=''){
  const p = size==='sm'?'6px 12px':size==='xs'?'4px 10px':'9px 18px';
  return `padding:${p};background:${T.redL};color:${T.red};
    border:1px solid #fca5a5;border-radius:8px;font-size:${size==='xs'?'11':'12'}px;
    font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit`;
}
function paginBtn(active=false){
  return `padding:6px 12px;border-radius:8px;border:1.5px solid ${active?T.accent:T.border2};
    background:${active?T.accentL:'#fff'};color:${active?T.accentD:T.text};
    font-size:12px;font-weight:700;cursor:pointer;transition:all .15s`;
}
function thStyle(){
  return `padding:12px 16px;text-align:left;font-size:11px;font-weight:700;
    color:${T.muted};text-transform:uppercase;letter-spacing:.06em`;
}
function tdStyle(){
  return `padding:12px 16px;font-size:13px;color:${T.text}`;
}
function labelStyle(){
  return `display:block;font-size:11px;font-weight:700;color:${T.muted};
    margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em`;
}
function selectStyle(){
  return `width:100%;padding:9px 12px;border:1.5px solid ${T.border2};border-radius:8px;
    font-size:13px;font-family:inherit;color:${T.text};background:#fff;cursor:pointer`;
}

function cmField(label, id, val='', type='text', placeholder='', hint='', isArea=false){
  return `<div>
    <label for="${id}" style="${labelStyle()}">${label}</label>
    ${isArea ?
      `<textarea id="${id}" placeholder="${placeholder}" rows="2"
        style="width:100%;padding:9px 12px;border:1.5px solid ${T.border2};border-radius:8px;
        font-size:13px;font-family:inherit;color:${T.text};resize:vertical">${esc(String(val))}</textarea>` :
      `<input id="${id}" type="${type}" value="${esc(String(val))}" placeholder="${placeholder}"
        style="width:100%;padding:9px 12px;border:1.5px solid ${T.border2};border-radius:8px;
        font-size:13px;font-family:inherit;color:${T.text}">`
    }
    ${hint?`<div style="font-size:11px;color:${T.muted};margin-top:4px">${hint}</div>`:''}
  </div>`;
}

/* ── CSS animations ───────────────────────────────────────────── */
(function injectCmStyles(){
  if(document.getElementById('cm-styles')) return;
  const s = document.createElement('style');
  s.id = 'cm-styles';
  s.textContent = `
    @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
    @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes spin    { to{transform:rotate(360deg)} }
    .cm-card-hover { transition:transform .2s,box-shadow .2s; }
    .cm-card-hover:hover { transform:translateY(-3px); box-shadow:0 8px 30px rgba(5,150,105,.18) !important; }
    @media(max-width:768px){
      .cm-hide-mobile { display:none !important; }
    }
  `;
  document.head.appendChild(s);
})();
