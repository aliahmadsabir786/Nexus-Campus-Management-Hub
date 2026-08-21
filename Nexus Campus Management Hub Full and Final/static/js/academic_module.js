/* ================================================================
   academic_module.js  —  NEXus Solution: Unified Academic Module
   ================================================================
   Replaces three separate pages (Classes, Sections, CM-Students)
   with one cohesive Class Management System featuring:
     - Hierarchical tree view: Class → Section → Student
     - Single-page accordion / drill-down navigation
     - Animated transitions & responsive mobile layout
     - Modal-based forms (no page reloads)
     - Full CRUD with cascading delete confirmation

   Public entry point:
     renderAcademicModule()   — renders the unified page
   ================================================================ */

/* ─── Module State ──────────────────────────────────────────────── */
let amHierarchy   = [];        // [{...class, sections:[{...sec, students:[...]}]}]
let amLoading     = true;
let amView        = 'tree';    // 'tree' | 'class' | 'section'
let amActiveClass = null;      // selected class object (drill-down)
let amActiveSec   = null;      // selected section object (drill-down)
let amSearch      = '';
let amFilter      = 'all';     // 'all' | 'active' | 'inactive'
let amExpandedCls = new Set(); // IDs of expanded class cards
let amExpandedSec = new Set(); // IDs of expanded section cards

/* ─── Bootstrap ─────────────────────────────────────────────────── */
async function amInit() {
  amLoading = true;
  _amRender();
  try {
    amHierarchy = await amFetch('/api/classes/hierarchy');
    // Auto-expand all classes on first load
    amHierarchy.forEach(c => amExpandedCls.add(c.id));
  } catch (e) {
    amToast('Failed to load academic data: ' + e.message, 'error');
    amHierarchy = [];
  }
  amLoading = false;
  _amRender();
}

function _amRender() {
  const el = document.getElementById('am-root');
  if (el) el.innerHTML = _amBody();
}

/* ─── API helper ─────────────────────────────────────────────────── */
async function amFetch(url, opts = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

/* ─── Toast ──────────────────────────────────────────────────────── */
/**
 * Thin alias kept only so the existing amToast(msg, type) call sites keep
 * reading naturally. There is exactly ONE notification system (spec §14/§51)
 * — notifications.js — and this forwards straight into it.
 */
function amToast(msg, type = 'success') {
  showToast(type, msg);
}

/* ================================================================
   MAIN PAGE RENDERER
   ================================================================ */
function renderAcademicModule() {
  amInit();
  return `
  <!-- ── Inject CSS animations once ──────────────────────────── -->
  <style id="am-styles-tag">
    @keyframes amFadeIn  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes amPopupIn { from{opacity:0;transform:translateY(-6px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes amSpin    { to{transform:rotate(360deg)} }
    .am-card:hover       { transform:translateY(-2px); box-shadow:0 10px 30px rgba(5,150,105,.15) !important; }
    .am-cls-card         { transition:transform .2s,box-shadow .2s; animation:amFadeIn .3s ease both; }
    .am-cls-card:nth-child(1) { animation-delay:.04s }
    .am-cls-card:nth-child(2) { animation-delay:.08s }
    .am-cls-card:nth-child(3) { animation-delay:.12s }
    .am-cls-card:nth-child(4) { animation-delay:.16s }
    .am-cls-card:nth-child(5) { animation-delay:.20s }
    .am-sec-card         { transition:transform .18s,box-shadow .18s; animation:amFadeIn .25s ease both; }
    .am-student-row      { transition:background .12s; }
    .am-student-row:hover{ background:var(--am-bg,#f0fdf8) !important; }
    .am-toggle-icon      { transition:transform .22s cubic-bezier(.34,1.56,.64,1); display:inline-block; }
    .am-toggle-icon.open { transform:rotate(90deg); }
    .am-section-body     { overflow:hidden; transition:max-height .3s ease, opacity .25s ease; }
    .am-class-body       { overflow:hidden; transition:max-height .38s ease, opacity .28s ease; }
    .am-tab-btn          { transition:all .15s; }
    .am-tab-btn.active   { background:var(--am-accent,#059669)!important;color:#fff!important;border-color:var(--am-accent,#059669)!important; }
    .am-search-input     { transition:border-color .15s,box-shadow .15s; }
    .am-search-input:focus{ border-color:var(--am-accent,#059669)!important;box-shadow:0 0 0 3px rgba(5,150,105,.15); outline:none; }
    @media(max-width:768px){
      .am-hide-mobile { display:none!important; }
      .am-full-mobile { width:100%!important; }
    }
  </style>

  <div id="am-root">${_amBody()}</div>`;
}

function _amBody() {
  if (amLoading) return _amLoader();
  return `
  <!-- ── Page Header ─────────────────────────────────────────── -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;
    margin-bottom:22px;flex-wrap:wrap;gap:12px">
    <div>
      <h1 style="font-size:22px;font-weight:800;color:${T.text};margin:0;display:flex;align-items:center;gap:10px">
        🏫 Academic Management
      </h1>
      <p style="font-size:13px;color:${T.muted};margin:5px 0 0">
        Manage Classes and Sections
      </p>
    </div>
    <button onclick="amOpenAddClass(event)"
      style="${_amPbtn()};display:flex;align-items:center;gap:6px">
      + Add Class
    </button>
  </div>

  <!-- ── Stats Bar ────────────────────────────────────────────── -->
  ${_amStatsBar()}

  <!-- ── Toolbar ──────────────────────────────────────────────── -->
  ${_amToolbar()}

  <!-- ── Content ──────────────────────────────────────────────── -->
  <div id="am-content" style="animation:amFadeIn .3s ease">
    ${_amContent()}
  </div>

  <!-- ── Modal ────────────────────────────────────────────────── -->
  <div id="am-modal"></div>`;
}

function _amLoader() {
  return `<div style="display:flex;flex-direction:column;align-items:center;
    justify-content:center;padding:80px;gap:16px;color:${T.muted}">
    <div style="font-size:36px;animation:amSpin 1s linear infinite">⟳</div>
    <div style="font-size:14px;font-weight:600">Loading academic data…</div>
  </div>`;
}

/* ── Stats Bar ─────────────────────────────────────────────────── */
function _amStatsBar() {
  const totalClasses  = amHierarchy.length;
  const totalSections = amHierarchy.reduce((n, c) => n + (c.sections?.length || 0), 0);
  const totalStudents = amHierarchy.reduce((n, c) => n + (c.studentCount || 0), 0);
  const activeClasses = amHierarchy.filter(c => c.status === 'active').length;

  const stat = (icon, val, label, color) => `
    <div style="flex:1;min-width:120px;background:#fff;border:1px solid ${T.border};
      border-radius:14px;padding:16px;text-align:center;border-top:3px solid ${color}">
      <div style="font-size:22px;margin-bottom:4px">${icon}</div>
      <div style="font-size:22px;font-weight:800;color:${color}">${val}</div>
      <div style="font-size:11px;color:${T.muted};font-weight:600;margin-top:2px">${label}</div>
    </div>`;

  return `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
    ${stat('🏫', totalClasses,  'Total Classes',   T.accent)}
    ${stat('📚', totalSections, 'Total Sections',  T.blue  || '#3b82f6')}
    ${stat('✅', activeClasses, 'Active Classes',  T.green || '#10b981')}
  </div>`;
}

/* ── Toolbar ───────────────────────────────────────────────────── */
function _amToolbar() {
  const isMobile = window.innerWidth <= 768;
  return `
  <div style="background:#fff;border:1px solid ${T.border};border-radius:14px;
    padding:14px 16px;margin-bottom:18px;box-shadow:${T.shadow}">
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">

      <!-- Search -->
      <div style="flex:1;min-width:180px;position:relative">
        <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);
          font-size:14px;color:${T.muted};pointer-events:none">🔍</span>
        <input class="am-search-input" type="text" placeholder="Search classes or sections…"
          value="${esc(amSearch)}" oninput="amDoSearch(this.value)"
          style="width:100%;padding:8px 12px 8px 36px;border:1.5px solid ${T.border2};
          border-radius:9px;font-size:13px;font-family:inherit;color:${T.text};
          box-sizing:border-box">
      </div>

      <!-- Filter -->
      <select onchange="amSetFilter(this.value)"
        style="${_amSelectStyle()};width:auto;min-width:120px">
        <option value="all"      ${amFilter==='all'     ?'selected':''}>All Classes</option>
        <option value="active"   ${amFilter==='active'  ?'selected':''}>Active Only</option>
        <option value="inactive" ${amFilter==='inactive'?'selected':''}>Inactive Only</option>
      </select>

      <!-- Expand/Collapse All -->
      <button onclick="amExpandAll()"
        style="${_amObtn()};padding:8px 14px;font-size:12px">▼ Expand All</button>
      <button onclick="amCollapseAll()"
        style="${_amObtn()};padding:8px 14px;font-size:12px">▲ Collapse All</button>
    </div>
  </div>`;
}

let _amSearchTimer = null;
function amDoSearch(val) {
  amSearch = val;
  // Debounce: wait 120ms after user stops typing before re-rendering
  clearTimeout(_amSearchTimer);
  _amSearchTimer = setTimeout(() => {
    document.getElementById('am-content').innerHTML = _amContent();
  }, 120);
}
function amSetFilter(val) {
  amFilter = val;
  document.getElementById('am-content').innerHTML = _amContent();
}
function amExpandAll() {
  amHierarchy.forEach(c => {
    amExpandedCls.add(c.id);
    c.sections?.forEach(s => amExpandedSec.add(s.id));
  });
  document.getElementById('am-content').innerHTML = _amContent();
}
function amCollapseAll() {
  amExpandedCls.clear();
  amExpandedSec.clear();
  document.getElementById('am-content').innerHTML = _amContent();
}

/* ── Content: Hierarchical Tree ────────────────────────────────── */
function _amContent() {
  let classes = amHierarchy;

  // Apply filter
  if (amFilter !== 'all') classes = classes.filter(c => c.status === amFilter);

  // Apply search
  const q = amSearch.toLowerCase().trim();
  if (q) {
    classes = classes.map(c => {
      // Filter students & sections matching search
      const matchedSections = (c.sections || []).map(sec => {
        if (sec.name.toLowerCase().includes(q))
          return { ...sec, _matched: true };
        return null;
      }).filter(Boolean);

      if (c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || matchedSections.length > 0)
        return { ...c, sections: matchedSections.length ? matchedSections : c.sections };
      return null;
    }).filter(Boolean);
  }

  if (classes.length === 0) return _amEmpty(q);

  return `<div style="display:flex;flex-direction:column;gap:16px">
    ${classes.map((cls, i) => _amClassCard(cls, i)).join('')}
  </div>`;
}

function _amEmpty(search) {
  return `<div style="background:#fff;border:1px solid ${T.border};border-radius:16px;
    padding:64px;text-align:center">
    <div style="font-size:56px;margin-bottom:16px">${search ? '🔍' : '🏫'}</div>
    <div style="font-size:18px;font-weight:800;color:${T.text};margin-bottom:8px">
      ${search ? `No results for "${esc(search)}"` : 'No Classes Yet'}
    </div>
    <p style="color:${T.muted};font-size:13px;margin-bottom:20px">
      ${search ? 'Try a different search term or clear the filter.' : 'Start by adding your first class.'}
    </p>
    ${!search ? `<button onclick="amOpenAddClass(event)" style="${_amPbtn()}">+ Add First Class</button>` : ''}
  </div>`;
}

/* ── Class Card ─────────────────────────────────────────────────── */
function _amClassCard(cls, idx) {
  const isActive  = cls.status === 'active';
  const isExpanded = amExpandedCls.has(cls.id);
  const secCount  = cls.sections?.length || 0;
  const stuCount  = cls.studentCount || 0;
  const animDelay = Math.min(idx * 50, 300);

  return `
  <div class="am-cls-card" style="background:#fff;border:1px solid ${T.border};
    border-radius:18px;overflow:hidden;box-shadow:${T.shadow};
    border-left:5px solid ${isActive ? T.accent : '#94a3b8'};
    animation-delay:${animDelay}ms">

    <!-- Class Header (clickable to expand/collapse) -->
    <div onclick="amToggleClass(${cls.id})"
      style="padding:18px 20px;cursor:pointer;display:flex;align-items:center;gap:14px;
      background:${isExpanded ? '#fafffe' : '#fff'};
      border-bottom:${isExpanded ? `1px solid ${T.border}` : 'none'};
      transition:background .15s;user-select:none"
      onmouseover="this.style.background='#f0fdf8'" onmouseout="this.style.background='${isExpanded?'#fafffe':'#fff'}'">

      <!-- Toggle icon -->
      <span class="am-toggle-icon ${isExpanded ? 'open' : ''}"
        style="font-size:13px;color:${T.muted};flex-shrink:0">▶</span>

      <!-- Class icon -->
      <div style="width:46px;height:46px;border-radius:14px;flex-shrink:0;
        background:${isActive ? T.accentL : '#f1f5f9'};
        display:flex;align-items:center;justify-content:center;font-size:22px">🎓</div>

      <!-- Class info -->
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:800;font-size:16px;color:${T.text}">${esc(cls.name)}</span>
          <span style="background:${T.accentL};color:${T.accentD};border-radius:6px;
            padding:2px 8px;font-size:11px;font-weight:700">${esc(cls.code)}</span>
          <span style="background:${isActive ? T.greenL || '#d1fae5' : '#f1f5f9'};
            color:${isActive ? T.green || '#059669' : T.muted};
            border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700">
            ${isActive ? '● Active' : '○ Inactive'}
          </span>
        </div>
        ${cls.description ? `<div style="font-size:12px;color:${T.muted};margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(cls.description)}</div>` : ''}
        <div style="display:flex;gap:16px;margin-top:6px">
          <span style="font-size:12px;color:${T.blue||'#3b82f6'};font-weight:600">📚 ${secCount} section${secCount!==1?'s':''}</span>
        </div>
      </div>

      <!-- Actions — single row, 4 buttons: +Section, Disable/Enable, Edit, Delete -->
      <div onclick="event.stopPropagation()" style="display:flex;gap:6px;flex-shrink:0;align-items:center">
        <button onclick="amOpenAddSection(event,${cls.id},'${esc(cls.name)}')"
          style="${_amSbtn('sm')}">+ Section</button>
        <button onclick="amToggleClassStatus(${cls.id})"
          style="${isActive ? _amWarnBtn('sm') : _amGreenBtn('sm')}">
          ${isActive ? '🔒 Disable' : '✅ Enable'}</button>
        <button onclick="amOpenEditClass(${cls.id})"
          style="${_amObtn('sm')}">✏️ Edit</button>
        <button onclick="amDeleteClass(${cls.id},'${esc(cls.name)}')"
          style="${_amDbtn('sm')}">🗑️ Delete</button>
      </div>
    </div>

    <!-- Class Body (sections accordion) -->
    <div class="am-class-body" style="max-height:${isExpanded ? '9999px' : '0'};
      opacity:${isExpanded ? '1' : '0'}">
      ${isExpanded ? _amSectionsArea(cls) : ''}
    </div>
  </div>`;
}

function amToggleClass(classId) {
  if (amExpandedCls.has(classId)) amExpandedCls.delete(classId);
  else amExpandedCls.add(classId);
  document.getElementById('am-content').innerHTML = _amContent();
}

/* ── Sections Area ──────────────────────────────────────────────── */
function _amSectionsArea(cls) {
  const sections = cls.sections || [];

  return `
  <div style="padding:16px 20px;background:#fafffe">
    <!-- Section header row -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:${T.muted};text-transform:uppercase;
        letter-spacing:.06em">📚 Sections</div>
      <button onclick="amOpenAddSection(event,${cls.id},'${esc(cls.name)}')"
        style="${_amPbtn('sm')}">+ Add Section</button>
    </div>

    ${sections.length === 0 ? `
      <div style="background:#fff;border:2px dashed ${T.border};border-radius:12px;
        padding:32px;text-align:center;color:${T.muted}">
        <div style="font-size:32px;margin-bottom:8px">📁</div>
        <div style="font-size:13px;font-weight:600">No sections yet</div>
        <button onclick="amOpenAddSection(event,${cls.id},'${esc(cls.name)}')"
          style="${_amPbtn('sm')};margin-top:12px">Add First Section</button>
      </div>` : `
      <div style="display:flex;flex-direction:column;gap:12px">
        ${sections.map((sec, i) => _amSectionCard(sec, cls, i)).join('')}
      </div>`}
  </div>`;
}

/* ── Section Card ───────────────────────────────────────────────── */
function _amSectionCard(sec, cls, idx) {
  const isExpanded = amExpandedSec.has(sec.id);
  const stuCount   = sec.students?.length || 0;
  const fillPct    = Math.round((stuCount / (sec.capacity || 40)) * 100);
  const fillColor  = fillPct >= 90 ? T.red || '#dc2626' : fillPct >= 70 ? '#f59e0b' : T.green || '#059669';

  return `
  <div class="am-sec-card" style="background:#fff;border:1px solid ${T.border};
    border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)">

    <!-- Section Header -->
    <div onclick="amToggleSection(${sec.id})"
      style="padding:14px 16px;cursor:pointer;display:flex;align-items:center;gap:12px;
      border-bottom:${isExpanded ? `1px solid ${T.border}` : 'none'};
      transition:background .12s;user-select:none"
      onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">

      <span class="am-toggle-icon ${isExpanded ? 'open' : ''}"
        style="font-size:11px;color:${T.muted}">▶</span>

      <div style="width:36px;height:36px;border-radius:10px;background:${T.accentL};
        display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">📂</div>

      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:700;font-size:14px;color:${T.text}">${esc(sec.name)}</span>
          ${sec.room ? `<span style="font-size:11px;color:${T.muted}">📍 ${esc(sec.room)}</span>` : ''}
        </div>
        <!-- Capacity bar -->
        <div style="display:flex;align-items:center;gap:8px;margin-top:5px">
          <div style="flex:1;height:5px;background:${T.border};border-radius:4px;max-width:120px;overflow:hidden">
            <div style="height:100%;width:${Math.min(fillPct,100)}%;background:${fillColor};border-radius:4px;transition:width .4s"></div>
          </div>
          <span style="font-size:11px;color:${T.muted};font-weight:600">
            ${stuCount}/${sec.capacity} seats
          </span>
        </div>
      </div>

      <div onclick="event.stopPropagation()" style="display:flex;gap:6px;flex-shrink:0">
        <!-- Section actions: edit/delete removed from admin view -->
      </div>
    </div>

    <!-- Enrolled student count info (read-only — students managed in Student Module) -->
    <div class="am-section-body" style="max-height:${isExpanded ? '9999px' : '0'};
      opacity:${isExpanded ? '1' : '0'}">
      ${isExpanded ? `<div style="padding:14px 16px;background:#f8fafc;border-top:1px solid ${T.border}">
        <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:${T.muted}">
          <span style="font-size:20px">👨‍🎓</span>
          <div>
            <span style="font-weight:700;color:${T.text}">${stuCount}</span> student${stuCount!==1?'s':''} enrolled in this section.
            <span style="margin-left:6px;font-size:12px">To manage students, go to the <strong>Student Module</strong>.</span>
          </div>
        </div>
      </div>` : ''}
    </div>
  </div>`;
}

function amToggleSection(secId) {
  if (amExpandedSec.has(secId)) amExpandedSec.delete(secId);
  else amExpandedSec.add(secId);
  document.getElementById('am-content').innerHTML = _amContent();
}

/* ================================================================
   MODAL SYSTEM
   ================================================================ */
function amShowModal(html) {
  let el = document.getElementById('am-modal');
  if (!el) { el = document.createElement('div'); el.id = 'am-modal'; document.body.appendChild(el); }
  el.innerHTML = `
  <div onclick="amCloseModal(event,this)"
    style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:3000;
    display:flex;align-items:center;justify-content:center;padding:16px;
    animation:amFadeIn .2s ease">
    <div onclick="event.stopPropagation()"
      style="background:#fff;border-radius:20px;padding:28px;width:100%;
      max-width:480px;max-height:90vh;overflow-y:auto;
      box-shadow:0 20px 60px rgba(0,0,0,.25);animation:amFadeIn .22s ease">
      ${html}
    </div>
  </div>`;
}

function amCloseModal(e, overlay) { if (e.target === overlay) amHideModal(); }
function amHideModal() {
  const el = document.getElementById('am-modal');
  if (el) el.innerHTML = '';
}

/* ================================================================
   CONTEXT-AWARE POPUP SYSTEM
   Appears near the clicked button instead of screen center.
   Uses getBoundingClientRect() + window.scrollY for dynamic placement.
   ================================================================ */
function amShowPopup(triggerEvent, html, width = 320) {
  amHidePopup(); // close any existing popup

  const popup = document.createElement('div');
  popup.id = 'am-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');

  // Style the popup card
  popup.style.cssText = `
    position: absolute;
    z-index: 4000;
    background: #fff;
    border-radius: 16px;
    padding: 22px;
    width: ${width}px;
    max-width: calc(100vw - 32px);
    box-shadow: 0 8px 40px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08);
    border: 1px solid rgba(5,150,105,.15);
    animation: amPopupIn .18s cubic-bezier(.34,1.56,.64,1) both;
  `;
  popup.innerHTML = html;
  document.body.appendChild(popup);

  // ── Dynamic positioning using getBoundingClientRect + scrollY ──
  const btn    = triggerEvent.currentTarget;
  const rect   = btn.getBoundingClientRect();
  const MARGIN = 8;
  const POP_W  = width;
  const POP_H  = popup.offsetHeight || 280; // measure after paint

  // Preferred: below the button, left-aligned with it
  let top  = rect.bottom + window.scrollY + MARGIN;
  let left = rect.left   + window.scrollX;

  // If popup would overflow the right edge, push it left
  if (left + POP_W > window.innerWidth - MARGIN) {
    left = window.innerWidth - POP_W - MARGIN;
  }
  // Ensure left is never off-screen
  if (left < MARGIN) left = MARGIN;

  // If popup would overflow the bottom, flip it above the button
  if (rect.bottom + POP_H + MARGIN > window.innerHeight) {
    top = rect.top + window.scrollY - POP_H - MARGIN;
  }
  // If it still goes above the viewport, reset to just below btn
  if (top < window.scrollY + MARGIN) {
    top = rect.bottom + window.scrollY + MARGIN;
  }

  popup.style.top  = top  + 'px';
  popup.style.left = left + 'px';

  // Close on outside click (next tick so this click doesn't self-close)
  setTimeout(() => {
    document._amPopupHandler = (e) => {
      if (!popup.contains(e.target)) amHidePopup();
    };
    document.addEventListener('mousedown', document._amPopupHandler);
    document.addEventListener('touchstart', document._amPopupHandler);
  }, 0);
}

function amHidePopup() {
  const existing = document.getElementById('am-popup');
  if (existing) existing.remove();
  if (document._amPopupHandler) {
    document.removeEventListener('mousedown', document._amPopupHandler);
    document.removeEventListener('touchstart', document._amPopupHandler);
    delete document._amPopupHandler;
  }
}

function _amModalHeader(title) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <h2 style="font-size:17px;font-weight:800;color:${T.text};margin:0">${title}</h2>
    <button onclick="amHideModal()"
      style="background:none;border:none;font-size:20px;cursor:pointer;
      color:${T.muted};padding:4px;border-radius:8px;transition:background .15s"
      onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">✕</button>
  </div>`;
}

function _amFormErr() {
  return `<div id="am-form-err" style="margin-top:10px;font-size:13px;color:${T.red||'#dc2626'};
    text-align:center;font-weight:600;min-height:20px"></div>`;
}

function _amSetErr(msg) {
  const el = document.getElementById('am-form-err');
  if (el) el.textContent = msg;
}

function _amField(label, id, val = '', type = 'text', placeholder = '', isArea = false) {
  return `<div>
    <label for="${id}" style="display:block;font-size:11px;font-weight:700;color:${T.muted};
      margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">${label}</label>
    ${isArea
      ? `<textarea id="${id}" placeholder="${placeholder}" rows="2"
          style="width:100%;padding:9px 12px;border:1.5px solid ${T.border2};border-radius:8px;
          font-size:13px;font-family:inherit;color:${T.text};resize:vertical;box-sizing:border-box">${esc(String(val))}</textarea>`
      : `<input id="${id}" type="${type}" value="${esc(String(val))}" placeholder="${placeholder}"
          style="width:100%;padding:9px 12px;border:1.5px solid ${T.border2};border-radius:8px;
          font-size:13px;font-family:inherit;color:${T.text};box-sizing:border-box">`
    }
  </div>`;
}

/* ── Class Modal ────────────────────────────────────────────────── */
function amOpenAddClass(event) {
  event.stopPropagation();
  amShowPopup(event, `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:15px;font-weight:800;color:${T.text};margin:0">🏫 Add New Class</h3>
      <button onclick="amHidePopup()" style="background:none;border:none;cursor:pointer;
        font-size:18px;color:${T.muted};line-height:1;padding:2px 6px;border-radius:6px"
        onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">×</button>
    </div>
    <div style="display:grid;gap:12px">
      ${_amField('Class Name *', 'am-cls-name', '', 'text', 'e.g. Computer Science')}
      ${_amField('Class Code *', 'am-cls-code', '', 'text', 'e.g. CS')}
      ${_amField('Description', 'am-cls-desc', '', 'text', 'Optional description', true)}
      <div>
        <label style="display:block;font-size:11px;font-weight:700;color:${T.muted};
          margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Status</label>
        <select id="am-cls-status" style="${_amSelectStyle()}">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button onclick="amHidePopup()" style="${_amObtn()}">Cancel</button>
      <button onclick="amSaveClass()" style="${_amPbtn()};flex:1">Save Class</button>
    </div>
    ${_amFormErr()}`, 360);
}

function amOpenEditClass(classId) {
  const cls = amHierarchy.find(c => c.id === classId);
  if (!cls) return;
  amShowModal(`
    ${_amModalHeader('✏️ Edit Class')}
    <div style="display:grid;gap:14px">
      ${_amField('Class Name *', 'am-cls-name', cls.name, 'text')}
      ${_amField('Class Code *', 'am-cls-code', cls.code, 'text')}
      ${_amField('Description', 'am-cls-desc', cls.description || '', 'text', '', true)}
      <div>
        <label style="display:block;font-size:11px;font-weight:700;color:${T.muted};
          margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Status</label>
        <select id="am-cls-status" style="${_amSelectStyle()}">
          <option value="active"   ${cls.status==='active'?'selected':''}>Active</option>
          <option value="inactive" ${cls.status==='inactive'?'selected':''}>Inactive</option>
        </select>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:20px">
      <button onclick="amHideModal()" style="${_amObtn()}">Cancel</button>
      <button onclick="amUpdateClass(${classId})" style="${_amPbtn()};flex:1">Update Class</button>
    </div>
    ${_amFormErr()}`);
}

async function amSaveClass() {
  const name   = document.getElementById('am-cls-name')?.value.trim();
  const code   = document.getElementById('am-cls-code')?.value.trim();
  const desc   = document.getElementById('am-cls-desc')?.value.trim();
  const status = document.getElementById('am-cls-status')?.value;
  if (!name) { _amSetErr('Class name is required.'); return; }
  if (!code) { _amSetErr('Class code is required.'); return; }
  try {
    const r = await amFetch('/api/classes', {
      method: 'POST', body: JSON.stringify({ name, code, description: desc, status })
    });
    amHierarchy.push({ ...r.class, sections: [], studentCount: 0 });
    amExpandedCls.add(r.class.id);
    amHidePopup();
    amToast('Class created!');
    _amRender();
  } catch (e) { _amSetErr(e.message); }
}

async function amUpdateClass(classId) {
  const name   = document.getElementById('am-cls-name')?.value.trim();
  const code   = document.getElementById('am-cls-code')?.value.trim();
  const desc   = document.getElementById('am-cls-desc')?.value.trim();
  const status = document.getElementById('am-cls-status')?.value;
  if (!name) { _amSetErr('Class name is required.'); return; }
  try {
    const r = await amFetch(`/api/classes/${classId}`, {
      method: 'PUT', body: JSON.stringify({ name, code, description: desc, status })
    });
    const idx = amHierarchy.findIndex(c => c.id === classId);
    if (idx >= 0) Object.assign(amHierarchy[idx], r.class);
    amHideModal();
    amToast('Class updated!');
    _amRender();
  } catch (e) { _amSetErr(e.message); }
}

async function amToggleClassStatus(classId) {
  try {
    const r = await amFetch(`/api/classes/${classId}/status`, { method: 'PATCH' });
    const cls = amHierarchy.find(c => c.id === classId);
    if (cls) cls.status = r.status;
    amToast(`Class ${r.status === 'active' ? 'activated' : 'deactivated'}`);
    document.getElementById('am-content').innerHTML = _amContent();
  } catch (e) { amToast(e.message, 'error'); }
}

async function amDeleteClass(classId, name) {
  const cls = amHierarchy.find(c => c.id === classId);
  const secCount = cls?.sections?.length || 0;
  const warn = secCount > 0
    ? `This also deletes ${secCount} section(s) inside this class. This action cannot be undone.`
    : 'This action cannot be undone.';
  if (!await confirmAction({
    title:'Delete class', message:`Delete class "${name}"?`,
    note:warn, confirmLabel:'Delete class',
  })) return;
  try {
    await amFetch(`/api/classes/${classId}`, { method: 'DELETE' });
    amHierarchy = amHierarchy.filter(c => c.id !== classId);
    amExpandedCls.delete(classId);
    amToast('Class deleted');
    _amRender();
  } catch (e) { amToast(e.message, 'error'); }
}

/* ── Section Popup (context-aware) ──────────────────────────────── */
function amOpenAddSection(event, classId, className) {
  event.stopPropagation(); // don't bubble to outside-click handler
  amShowPopup(event, `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:15px;font-weight:800;color:${T.text};margin:0">📚 Add Section</h3>
      <button onclick="amHidePopup()" style="background:none;border:none;cursor:pointer;
        font-size:18px;color:${T.muted};line-height:1;padding:2px 6px;border-radius:6px"
        onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">×</button>
    </div>
    <div style="font-size:11px;color:${T.muted};margin-bottom:14px;font-weight:600">
      ${esc(className)}
    </div>
    <div style="display:grid;gap:12px">
      ${_amField('Section Name *', 'am-sec-name', '', 'text', 'e.g. Section A')}
      ${_amField('Room', 'am-sec-room', '', 'text', 'e.g. Room 101')}
      ${_amField('Capacity', 'am-sec-capacity', '40', 'number', '40')}
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button onclick="amHidePopup()" style="${_amObtn()}">Cancel</button>
      <button onclick="amSaveSection(${classId})" style="${_amPbtn()};flex:1">Add Section</button>
    </div>
    ${_amFormErr()}`);
}

function amOpenEditSection(secId) {
  let sec = null;
  for (const cls of amHierarchy) {
    sec = cls.sections?.find(s => s.id === secId);
    if (sec) break;
  }
  if (!sec) return;
  amShowModal(`
    ${_amModalHeader('✏️ Edit Section')}
    <div style="display:grid;gap:14px">
      ${_amField('Section Name *', 'am-sec-name', sec.name, 'text')}
      ${_amField('Room', 'am-sec-room', sec.room || '', 'text')}
      ${_amField('Capacity', 'am-sec-capacity', sec.capacity || 40, 'number')}
    </div>
    <div style="display:flex;gap:10px;margin-top:20px">
      <button onclick="amHideModal()" style="${_amObtn()}">Cancel</button>
      <button onclick="amUpdateSection(${secId})" style="${_amPbtn()};flex:1">Update Section</button>
    </div>
    ${_amFormErr()}`);
}

async function amSaveSection(classId) {
  const name     = document.getElementById('am-sec-name')?.value.trim();
  const room     = document.getElementById('am-sec-room')?.value.trim();
  const capacity = parseInt(document.getElementById('am-sec-capacity')?.value || '40');
  if (!name) { _amSetErr('Section name is required.'); return; }
  try {
    const r = await amFetch(`/api/classes/${classId}/sections`, {
      method: 'POST', body: JSON.stringify({ name, room, capacity })
    });
    const cls = amHierarchy.find(c => c.id === classId);
    if (cls) {
      cls.sections = cls.sections || [];
      cls.sections.push({ ...r.section, students: [], studentCount: 0 });
      amExpandedCls.add(classId);
      amExpandedSec.add(r.section.id);
    }
    amHidePopup();
    amToast('Section added!');
    _amRender();
  } catch (e) { _amSetErr(e.message); }
}

async function amUpdateSection(secId) {
  const name     = document.getElementById('am-sec-name')?.value.trim();
  const room     = document.getElementById('am-sec-room')?.value.trim();
  const capacity = parseInt(document.getElementById('am-sec-capacity')?.value || '40');
  if (!name) { _amSetErr('Section name is required.'); return; }
  try {
    const r = await amFetch(`/api/sections/${secId}`, {
      method: 'PUT', body: JSON.stringify({ name, room, capacity })
    });
    for (const cls of amHierarchy) {
      const idx = cls.sections?.findIndex(s => s.id === secId);
      if (idx >= 0) Object.assign(cls.sections[idx], r.section);
    }
    amHideModal();
    amToast('Section updated!');
    document.getElementById('am-content').innerHTML = _amContent();
  } catch (e) { _amSetErr(e.message); }
}

async function amDeleteSection(secId, name) {
  // Note: students linked via this section (in Student Module) will have their section unlinked.
  const warn = `Students assigned to this section will have their section cleared.`;
  if (!await confirmAction({
    title:'Delete section', message:`Delete section "${name}"?`,
    note:warn, confirmLabel:'Delete section',
  })) return;
  try {
    await amFetch(`/api/sections/${secId}`, { method: 'DELETE' });
    for (const cls of amHierarchy) {
      cls.sections = (cls.sections || []).filter(s => s.id !== secId);
      cls.studentCount = cls.sections.reduce((n, s) => n + (s.students?.length || 0), 0);
    }
    amExpandedSec.delete(secId);
    amToast('Section deleted');
    _amRender();
  } catch (e) { amToast(e.message, 'error'); }
}

/* ================================================================
   STYLE HELPERS
   ================================================================ */
function _amPbtn(size = '') {
  const p = size === 'sm' ? '6px 14px' : size === 'xs' ? '4px 10px' : '10px 20px';
  const fs = size === 'xs' ? '11px' : '13px';
  return `padding:${p};background:linear-gradient(135deg,${T.accent},${T.accentD||T.accent});
    color:#fff;border:none;border-radius:9px;font-size:${fs};font-weight:700;
    cursor:pointer;box-shadow:0 2px 8px rgba(5,150,105,.25);transition:all .15s;
    font-family:inherit;white-space:nowrap`;
}
function _amSbtn(size = '') {
  const p = size === 'sm' ? '6px 12px' : size === 'xs' ? '4px 9px' : '9px 18px';
  const fs = size === 'xs' ? '11px' : '12px';
  return `padding:${p};background:${T.accentL};color:${T.accentD||T.accent};
    border:1px solid ${T.border2};border-radius:8px;font-size:${fs};
    font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit`;
}
function _amObtn(size = '') {
  const p = size === 'sm' ? '6px 12px' : size === 'xs' ? '4px 9px' : '9px 18px';
  const fs = size === 'xs' ? '11px' : '12px';
  return `padding:${p};background:#fff;color:${T.text};
    border:1.5px solid ${T.border2};border-radius:8px;font-size:${fs};
    font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit`;
}
function _amDbtn(size = '') {
  const p = size === 'sm' ? '6px 12px' : size === 'xs' ? '4px 9px' : '9px 18px';
  const fs = size === 'xs' ? '11px' : '12px';
  return `padding:${p};background:${T.redL||'#fee2e2'};color:${T.red||'#dc2626'};
    border:1px solid ${alpha(T.red,20)};border-radius:8px;font-size:${fs};
    font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit`;
}
function _amWarnBtn(size = '') {
  const p = size === 'sm' ? '6px 12px' : size === 'xs' ? '4px 9px' : '9px 18px';
  return `padding:${p};background:#fff7ed;color:#d97706;
    border:1px solid #fbbf24;border-radius:8px;font-size:11px;
    font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit`;
}
function _amGreenBtn(size = '') {
  const p = size === 'sm' ? '6px 12px' : size === 'xs' ? '4px 9px' : '9px 18px';
  return `padding:${p};background:${T.greenL||'#d1fae5'};color:${T.green||'#059669'};
    border:1px solid ${alpha(T.green,20)};border-radius:8px;font-size:11px;
    font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit`;
}
function _amSelectStyle() {
  return `width:100%;padding:9px 12px;border:1.5px solid ${T.border2};border-radius:8px;
    font-size:13px;font-family:inherit;color:${T.text};background:#fff;cursor:pointer`;
}
function _thS() {
  return `padding:10px 14px;text-align:left;font-size:10px;font-weight:700;
    color:${T.muted};text-transform:uppercase;letter-spacing:.06em;white-space:nowrap`;
}
function _tdS() {
  return `padding:10px 14px;font-size:13px;color:${T.text}`;
}
