/* ================================================================
   js/context.js  —  Institution context (Department + Campus)
   ================================================================
   NCMH
    ├── BS DEPARTMENT              → straight to the login screen
    └── INTERMEDIATE DEPARTMENT    → Boys / Girls campus, then login

   ONE module for every institution.  This file only handles the *UI* of
   choosing a context and the *labels* that go with it.  It grants nothing:
   what a session may read or write is decided by the backend
   (utils/context.py) from the validated session, so tampering with
   appContext in the console changes labels and nothing else.

   Reference data comes from GET /api/institutions (public, pre-login) —
   names, descriptions and logo *paths*.  Logos are never inlined as
   base64 here; they are plain <img src> pointing at /static/assets/logos
   with a graceful placeholder tile when the file is missing.
   ================================================================ */

/* ── Context the browser currently believes it is in ────────────
   Filled from the selection screens before login (a claim), then
   overwritten by the server's validated context after login. */
const appContext = {
  department:     null,   // "BS" | "INTER" pre-login, "BS" | "INTERMEDIATE" after
  departmentCode: null,   // database code sent to /api/login
  departmentName: null,   // "BS Department"
  campus:         null,   // "BOYS" | "GIRLS" | null
  campusName:     null,   // "Boys Campus"
  label:          '',     // header badge  — "Intermediate • Boys Campus"
  title:          '',     // page heading  — "Intermediate — Boys Campus"
  institution:    'NEXus Solution',
  logo:           null,
};
window.appContext = appContext;

/* ── Pre-login flow stage: department → campus → login ────────── */
let authStage    = 'department';
let _institutions = null;
let _instLoading  = false;
let _instError    = '';

// ================================================================
// REFERENCE DATA
// ================================================================
async function loadInstitutions(force) {
  if (_instLoading) return;
  if (_institutions && !force) return;
  _instLoading = true;
  _instError   = '';
  try {
    const res = await fetch('/api/institutions');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    _institutions = await res.json();
    if (!Array.isArray(_institutions) || !_institutions.length)
      throw new Error('No active departments configured');
  } catch (e) {
    _institutions = null;
    _instError    = 'Could not load departments. Make sure the server is running.';
  } finally {
    _instLoading = false;
    render();
  }
}

/** Department record from the cached tree, by database code. */
function findDepartment(code) {
  return (_institutions || []).find(d => String(d.code).toUpperCase() === String(code).toUpperCase()) || null;
}

/** Campus record inside a department, by database code. */
function findCampus(dept, code) {
  if (!dept) return null;
  return (dept.campuses || []).find(c => String(c.code).toUpperCase() === String(code).toUpperCase()) || null;
}

// ================================================================
// SELECTION HANDLERS
// ================================================================
function selectDepartment(code) {
  const d = findDepartment(code);
  if (!d) return;
  appContext.department     = d.code;          // claim only — server validates
  appContext.departmentCode = d.code;
  appContext.departmentName = d.name;
  appContext.campus         = null;
  appContext.campusName     = null;
  appContext.logo           = d.logo || null;
  appContext.label          = d.name;
  appContext.title          = d.name;
  loginErr  = '';
  authStage = d.requiresCampus ? 'campus' : 'login';
  render();
}

function selectCampus(code) {
  const d = findDepartment(appContext.departmentCode);
  const c = findCampus(d, code);
  if (!c) return;
  appContext.campus     = c.code;
  appContext.campusName = c.name;
  appContext.logo       = c.logo || appContext.logo;
  const short = (d.name || '').replace(/ Department$/i, '').trim();
  appContext.label = `${short} • ${c.name}`;
  appContext.title = `${short} — ${c.name}`;
  loginErr  = '';
  authStage = 'login';
  render();
}

function backToDepartments() {
  resetContext();
  render();
}

function backToCampusSelect() {
  appContext.campus     = null;
  appContext.campusName = null;
  appContext.label      = appContext.departmentName || '';
  appContext.title      = appContext.departmentName || '';
  loginErr  = '';
  authStage = 'campus';
  render();
}

/** Wipe every trace of the chosen context (logout / failed switch). */
function resetContext() {
  appContext.department     = null;
  appContext.departmentCode = null;
  appContext.departmentName = null;
  appContext.campus         = null;
  appContext.campusName     = null;
  appContext.label          = '';
  appContext.title          = '';
  appContext.logo           = null;
  authStage = 'department';
  loginErr  = '';
}

/** Adopt the server's validated context (login response / GET /api/me). */
function hydrateContext(ctx) {
  if (!ctx) return;
  appContext.department     = ctx.department     || appContext.department;
  appContext.departmentCode = ctx.departmentCode || appContext.departmentCode;
  appContext.departmentName = ctx.departmentName || appContext.departmentName;
  appContext.campus         = ctx.campus     || null;
  appContext.campusName     = ctx.campusName || null;
  appContext.label          = ctx.label || appContext.label || '';
  appContext.title          = ctx.title || appContext.title || '';
  appContext.institution    = ctx.institution || appContext.institution;
  appContext.logo           = ctx.logo || appContext.logo;
}

// ================================================================
// LABEL HELPERS  (used by the shell, dashboard and reports)
// ================================================================
/** "Intermediate • Boys Campus" / "BS Department" / "" */
function contextLabel() {
  if (appContext.label) return appContext.label;
  if (appContext.departmentName) return appContext.departmentName;
  return '';
}

/** "NEXus Solution / Intermediate — Boys Campus" */
function contextTitle() {
  const t = appContext.title || appContext.departmentName || '';
  return t ? `${appContext.institution} / ${t}` : appContext.institution;
}

/** Small elegant header badge (spec §18) — never visually dominant. */
function contextBadge() {
  const lbl = contextLabel();
  if (!lbl) return '';
  return `<span class="ctx-badge" title="Signed in to ${esc(lbl)}">
    <span class="ctx-badge-dot"></span>${esc(lbl)}</span>`;
}

/** Context line shown under the brand in the sidebar (spec §17). */
function contextSidebarLine() {
  const lbl = contextLabel();
  if (!lbl) return '';
  return `<div class="ctx-sidebar" title="${esc(lbl)}">${esc(lbl)}</div>`;
}

/**
 * Credential hint for the login screen, matching the current context so
 * BS keeps its legacy S###/T### IDs while Intermediate shows its own.
 */
function contextIdSample(kind) {
  const boys = appContext.campus === 'BOYS';
  const inter = String(appContext.departmentCode || appContext.department || '')
                  .toUpperCase().startsWith('INT');
  if (!inter) return kind === 'teacher' ? 'T001' : 'S001';
  return kind === 'teacher'
    ? (boys ? 'ITB-001' : 'ITG-001')
    : (boys ? 'INT-B-001' : 'INT-G-001');
}

/**
 * Class codes of the CURRENT institution, for dropdowns, charts and reports.
 *
 * dbClasses is filled from /api/classes/dropdown, which the backend already
 * scopes to the session's department/campus, so this can never surface another
 * campus's classes. The fallback reads the class codes present on the loaded
 * students, which come from /api/students and are scoped the same way.
 *
 * This replaces the old hard-coded CLASSES list in data.js (now an empty array
 * kept only for backward compatibility): a fixed list cannot describe both a BS
 * department and two Intermediate campuses.
 */
function contextClassCodes() {
  const fromDb = (typeof dbClasses !== 'undefined' ? dbClasses : [])
                   .map(c => c.code || c.name).filter(Boolean);
  if (fromDb.length) return [...new Set(fromDb)];
  return [...new Set((typeof students !== 'undefined' ? students : [])
                       .map(s => s.cls).filter(Boolean))].sort();
}

// ================================================================
// LOGO TILE
// ================================================================
/**
 * Logo tile with a graceful fallback: the emoji placeholder is painted
 * first and the real image fades in over it only once it actually loads,
 * so a missing /static/assets/logos/*.png never shows a broken icon.
 */
function institutionLogo(src, fallbackIcon, cls) {
  const icon = fallbackIcon || '🎓';
  const img  = src
    ? `<img src="${esc(src)}" alt="" class="inst-logo-img"
             onload="this.classList.add('ready')" onerror="this.remove()">`
    : '';
  return `<div class="inst-logo ${cls || ''}"><span class="inst-logo-ph">${icon}</span>${img}</div>`;
}

const _DEPT_ICONS   = { BS: '🎓', INTER: '📚' };
const _CAMPUS_ICONS = { BOYS: '👨‍🎓', GIRLS: '👩‍🎓', 'BS-MAIN': '🏛️' };

// ================================================================
// RENDERERS
// ================================================================
/**
 * Pre-login router.  render() in state.js calls this whenever there is no
 * authenticated user: Department Selection → Campus Selection → Login.
 */
function renderAuthFlow() {
  if (_instError)   return renderSelectError();
  if (!_institutions) { loadInstitutions(); return renderSelectLoading(); }
  if (authStage === 'login'  && appContext.departmentCode) return renderLogin();
  if (authStage === 'campus' && appContext.departmentCode) return renderCampusSelect();
  return renderDepartmentSelect();
}

function _selectShell(inner) {
  return `<div class="select-page">
    <div class="select-shell">
      <div class="select-topbar">
        <div class="select-brand">
          <span class="select-brand-mark">🎓</span>
          <span>
            <span class="select-brand-name">${esc(appContext.institution)}</span>
            <span class="select-brand-sub">Campus Management Hub</span>
          </span>
        </div>
        <button type="button" onclick="toggleDarkMode()" class="dark-toggle"
                title="Toggle Dark Mode">${_darkMode ? '☀️' : '🌙'}</button>
      </div>
      ${inner}
      <div class="select-foot">${esc(appContext.institution)} · 2025–26 Academic Year</div>
    </div>
  </div>`;
}

function renderSelectLoading() {
  return _selectShell(`
    <div class="select-head">
      <h1 class="select-title">Loading departments…</h1>
      <p class="select-sub">Fetching the institution list from the server.</p>
    </div>
    <div class="select-grid">
      ${[0, 1].map(() => `<div class="inst-card inst-skel">
        <div class="skel skel-logo"></div>
        <div class="skel skel-line" style="width:55%"></div>
        <div class="skel skel-line" style="width:100%"></div>
        <div class="skel skel-line" style="width:80%"></div>
      </div>`).join('')}
    </div>`);
}

function renderSelectError() {
  return _selectShell(`
    <div class="select-head">
      <h1 class="select-title">Something went wrong</h1>
      <p class="select-sub">${esc(_instError)}</p>
    </div>
    <div class="select-actions">
      <button type="button" class="select-retry" onclick="loadInstitutions(true)">Try again</button>
    </div>`);
}

/** Spec §4 — Department Selection is the new landing screen. */
function renderDepartmentSelect() {
  const cards = _institutions.map(d => `
    <button type="button" class="inst-card card-hover" onclick="selectDepartment('${esc(d.code)}')"
            aria-label="Continue to ${esc(d.name)}">
      ${institutionLogo(d.logo, _DEPT_ICONS[String(d.code).toUpperCase()] || '🎓')}
      <div class="inst-name">${esc(d.name)}</div>
      <div class="inst-desc">${esc(d.description || '')}</div>
      <div class="inst-meta">${d.requiresCampus
        ? `${(d.campuses || []).length} campuses`
        : 'Independent department'}</div>
      <div class="inst-cta">Continue <span class="inst-arrow">→</span></div>
    </button>`).join('');

  return _selectShell(`
    <div class="select-head">
      <h1 class="select-title">Select your department</h1>
      <p class="select-sub">Choose the department you belong to. Records, staff and
         reports stay completely separate for each one.</p>
    </div>
    <div class="select-grid">${cards}</div>`);
}

/** Spec §6 — Campus Selection, shown only for departments that need it. */
function renderCampusSelect() {
  const d = findDepartment(appContext.departmentCode);
  if (!d) { authStage = 'department'; return renderDepartmentSelect(); }

  const cards = (d.campuses || []).map(c => `
    <button type="button" class="inst-card card-hover" onclick="selectCampus('${esc(c.code)}')"
            aria-label="Continue to ${esc(c.name)}">
      ${institutionLogo(c.logo, _CAMPUS_ICONS[String(c.code).toUpperCase()] || '🏫')}
      <div class="inst-name">${esc(c.name)}</div>
      <div class="inst-desc">${esc(c.description || '')}</div>
      <div class="inst-meta">${esc(d.name)}</div>
      <div class="inst-cta">Continue <span class="inst-arrow">→</span></div>
    </button>`).join('');

  return _selectShell(`
    <button type="button" class="select-back" onclick="backToDepartments()">← Departments</button>
    <div class="select-head">
      <h1 class="select-title">Select your campus</h1>
      <p class="select-sub">${esc(d.name)} runs on separate campuses — pick the one
         you are signing in to.</p>
    </div>
    <div class="select-grid">${cards}</div>`);
}

// ================================================================
// SWITCH CONTEXT  (spec §19 — never a client-side toggle)
// ================================================================
/**
 * Ask the backend to move to another department/campus.  The server
 * validates the target, destroys the session and demands a fresh login;
 * this function only follows that instruction on screen.
 */
async function switchContext(deptCode, campusCode) {
  try {
    const res = await fetch('/api/context/switch', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({department: deptCode, campus: campusCode || null}),
    });
    const data = await res.json();
    if (!data.success) { alert(data.error || 'Could not switch context.'); return; }

    // The session is gone — drop every cached record and re-authenticate.
    clearContextCaches();
    currentUser = null;
    resetContext();
    if (data.target) {
      appContext.department     = data.target.department;
      appContext.departmentCode = data.target.departmentCode;
      appContext.departmentName = data.target.departmentName;
      appContext.campus         = data.target.campus;
      appContext.campusName     = data.target.campusName;
      appContext.label          = data.target.label || '';
      appContext.title          = data.target.label || '';
      authStage = 'login';
    }
    render();
  } catch (e) {
    alert('Server error while switching context.');
  }
}

/**
 * Sidebar entry point.  A one-click switch is only offered where it is
 * meaningful: a department that really runs on separate campuses, with
 * exactly one other campus to move to.  (BS reports a single implicit
 * "Main BS Campus", which is not a choice a user should be offered.)
 * Anything else signs out to the Department Selection screen, where the
 * context is picked again.  Either way a fresh login is required, and the
 * switch itself is validated by /api/context/switch on the server.
 */
async function promptSwitchContext() {
  if (!_institutions) await loadInstitutions();
  const d      = findDepartment(appContext.departmentCode);
  const others = ((d && d.requiresCampus && d.campuses) || [])
                   .filter(c => String(c.code).toUpperCase() !== String(appContext.campus || '').toUpperCase());

  if (others.length === 1) {
    if (!confirm(`Switch to ${others[0].name}? You will be signed out and asked to log in again.`)) return;
    await switchContext(d.code, others[0].code);
    return;
  }
  if (!confirm('Switch institution? You will be signed out and asked to log in again.')) return;
  doLogout();
}
