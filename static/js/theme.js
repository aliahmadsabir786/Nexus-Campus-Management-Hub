/* ================================================================
   js/theme.js  —  Design tokens (T object) + shared helpers
   ================================================================
   DARK MODE (spec §25–§31)
   ------------------------
   Every helper in this file writes an inline style="…" attribute, and an
   inline style beats any [data-theme="dark"] rule in the cascade. That is
   exactly why dark mode used to fail: the CSS was correct but could never
   reach these elements.

   The fix is to stop writing literal colours here. `T` now holds CSS custom
   property REFERENCES — `var(--surface)` instead of `#ffffff` — which the
   browser resolves per element against whichever :root / [data-theme]
   block is in force. One change, and every card, table, badge, button and
   field in the app follows the theme automatically.

   Three consequences worth knowing:
     1. `${T.green}20` no longer produces a colour (a var() cannot take a
        hex-alpha suffix). Use alpha(T.green, 12) instead — see below.
     2. <canvas> cannot resolve var(): charts.js reads the computed value
        through cssVar() at draw time.
     3. The print / export windows opened by downloads.js never load our
        stylesheet, so they have no custom properties at all. They use the
        literal TLIT palette instead.
   ================================================================ */

/* ── The live palette: references, resolved by the browser ──────── */
const T = {
  bg:'var(--bg)', bg2:'var(--bg2)', surface:'var(--surface)', surface2:'var(--surface2)',
  border:'var(--border)', border2:'var(--border2)',
  text:'var(--text)', text2:'var(--text2)', muted:'var(--muted)',
  accent:'var(--accent)', accentL:'var(--accent-light)', accentD:'var(--accent-dark)',
  sidebar:'var(--sidebar)', sidebarText:'var(--sidebar-text)',
  green:'var(--green)', greenL:'var(--green-light)',
  red:'var(--red)',     redL:'var(--red-light)',
  yellow:'var(--yellow)', yellowL:'var(--yellow-light)',
  orange:'var(--orange)', orangeL:'var(--orange-light)',
  blue:'var(--blue)',     blueL:'var(--blue-light)',
  purple:'var(--purple)', purpleL:'var(--purple-light)',
  elevated:'var(--elevated)', rowAlt:'var(--row-alt)',
  shadow:'var(--shadow)',
};

/* ── The literal palette: ONLY for detached documents ────────────
   window.open() print/export views and any other document that does not
   link styles.css. Values match the light :root block in styles.css. */
const TLIT = {
  bg:'#f0fdf8', bg2:'#ecfdf5', surface:'#ffffff', surface2:'#f8fffe',
  border:'#d1fae5', border2:'#a7f3d0',
  text:'#0d2b23', text2:'#134e38', muted:'#4b7a66',
  accent:'#059669', accentL:'#d1fae5', accentD:'#047857',
  sidebar:'#064e3b', sidebarText:'#a7f3d0',
  green:'#16a34a', greenL:'#dcfce7',
  red:'#dc2626',   redL:'#fee2e2',
  yellow:'#d97706',yellowL:'#fef9c3',
  orange:'#ea580c',orangeL:'#fff7ed',
  blue:'#2563eb',  blueL:'#dbeafe',
  purple:'#7c3aed',purpleL:'#ede9fe',
  elevated:'#ffffff', rowAlt:'#f9fffe',
  shadow:'0 1px 4px rgba(5,150,105,.08),0 1px 2px rgba(0,0,0,.04)',
};

/**
 * Translucent tint of any colour — including a var() reference.
 *
 * Replaces the old `${T.green}20` trick, which silently produced an
 * invalid value once the tokens became var(). color-mix() works with
 * custom properties, named colours and hex alike.
 *
 *   alpha(T.green, 12)  ->  color-mix(in srgb, var(--green) 12%, transparent)
 */
function alpha(color, pct) {
  return `color-mix(in srgb, ${color} ${Math.max(0, Math.min(100, pct))}%, transparent)`;
}

/**
 * Resolve a design token to a real colour string.
 * Needed by <canvas> (charts.js), which paints pixels and therefore cannot
 * defer a var() to the cascade. Reads from <html>, so it always reflects the
 * theme that is active right now.
 */
function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement)
                .getPropertyValue(name.startsWith('--') ? name : '--' + name);
    if (v && v.trim()) return v.trim();
  } catch (_) { /* detached document */ }
  return fallback || '#000';
}

/** True when the dark palette is active — for the few places that must ask. */
function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

// ── Grade helpers ──────────────────────────────────────────────
const gradeLabel = t => t>=85?'A+':t>=80?'A':t>=72?'B+':t>=65?'B':t>=55?'C':t>=45?'D':'F';
const gradeColor = t => t>=80?T.green:t>=65?T.accent:t>=45?T.yellow:T.red;
/* Literal-hex twin of gradeColor(), for the print/export windows that
   downloads.js opens: those documents link no stylesheet, so a var()
   reference there would resolve to nothing at all. */
const gradeColorLit = t => t>=80?TLIT.green:t>=65?TLIT.accent:t>=45?TLIT.yellow:TLIT.red;

// ── HTML escape (XSS protection) ──────────────────────────────
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── UI component helpers ───────────────────────────────────────
function badge(status, size='sm'){
  const map={
    paid:[T.green,T.greenL], partial:[T.orange,T.orangeL], pending:[T.yellow,T.yellowL],
    overdue:[T.red,T.redL], present:[T.green,T.greenL], absent:[T.red,T.redL],
    late:[T.yellow,T.yellowL], active:[T.accent,T.accentL], inactive:[T.red,T.redL],
    holiday:[T.orange,T.orangeL], academic:[T.blue,T.blueL], event:[T.green,T.greenL],
    fee:[T.yellow,T.yellowL], submitted:[T.blue,T.blueL], graded:[T.green,T.greenL],
  };
  const [fg,bg] = map[status] || [T.muted,T.bg2];
  const p = size==='sm' ? '2px 10px' : '3px 14px';
  const fs = size==='sm' ? 11 : 12;
  return `<span class="badge" style="background:${bg};color:${fg};border-radius:20px;padding:${p};font-size:${fs}px;font-weight:700;text-transform:capitalize;white-space:nowrap">${esc(status.replace(/_/g,' '))}</span>`;
}

function pbtn(label, oc, sz='md'){
  const p = sz==='sm'?'6px 14px':sz==='lg'?'13px 28px':'9px 20px';
  const fs = sz==='sm'?12:sz==='lg'?15:13;
  return `<button type="button" onclick="${oc}" style="background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(5,150,105,.3);font-family:'Plus Jakarta Sans',sans-serif">${label}</button>`;
}
function obtn(label, oc, sz='md'){
  const p = sz==='sm'?'5px 13px':'8px 18px'; const fs = sz==='sm'?12:13;
  return `<button type="button" onclick="${oc}" style="background:${T.surface};color:${T.accent};border:1.5px solid ${T.accent};border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${label}</button>`;
}
function dbtn(label, oc, sz='md'){
  const p = sz==='sm'?'5px 13px':'8px 18px'; const fs = sz==='sm'?12:13;
  return `<button type="button" onclick="${oc}" style="background:${T.redL};color:${T.red};border:1px solid ${T.red};border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${label}</button>`;
}
function sbtn(label, oc, sz='md'){
  const p = sz==='sm'?'5px 13px':'8px 18px'; const fs = sz==='sm'?12:13;
  return `<button type="button" onclick="${oc}" style="background:${T.greenL};color:${T.green};border:1px solid ${T.green};border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${label}</button>`;
}
function wbtn(label, oc, sz='md'){
  const p = sz==='sm'?'5px 13px':'8px 18px'; const fs = sz==='sm'?12:13;
  return `<button type="button" onclick="${oc}" style="background:${T.yellowL};color:${T.yellow};border:1px solid ${T.yellow};border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${label}</button>`;
}
function purpbtn(label, oc, sz='md'){
  const p = sz==='sm'?'5px 13px':'8px 18px'; const fs = sz==='sm'?12:13;
  return `<button type="button" onclick="${oc}" style="background:${T.purpleL};color:${T.purple};border:1px solid ${T.purple};border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${label}</button>`;
}

/* min-width:0 lets the card shrink inside a flex/grid parent instead of
   forcing the page wider than the viewport (spec §33). */
function card(content, xStyle='', p=22){
  return `<div class="card" style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:${p}px;box-shadow:${T.shadow};min-width:0;max-width:100%;${xStyle}">${content}</div>`;
}

function statCard(icon, value, label, color, sub=''){
  return `<div class="card-hover stat-card" style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:20px;position:relative;overflow:hidden;box-shadow:${T.shadow};min-width:0">
    <div style="position:absolute;top:14px;right:14px;width:44px;height:44px;border-radius:12px;background:${alpha(color,14)};display:flex;align-items:center;justify-content:center;font-size:20px" aria-hidden="true">${icon}</div>
    <div class="stat-value" style="font-family:'Space Grotesk',sans-serif;font-size:clamp(22px,2.4vw,28px);font-weight:800;color:${color};line-height:1.1;padding-right:52px">${esc(String(value))}</div>
    <div style="font-size:12px;color:${T.muted};margin-top:5px;font-weight:600;padding-right:50px">${esc(label)}</div>
    ${sub?`<div style="font-size:11px;color:${color};margin-top:3px;font-weight:600;opacity:.85;padding-right:50px">${esc(sub)}</div>`:''}
  </div>`;
}

function secTitle(t, a=''){
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;min-width:0">
    <h2 style="font-family:'Space Grotesk',sans-serif;font-size:clamp(14px,1.6vw,16px);font-weight:800;color:${T.text};margin:0;min-width:0">${t}</h2>${a}
  </div>`;
}

function ava(name, size=36, photo=null){
  if(photo) return `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;flex-shrink:0;box-shadow:0 2px 8px rgba(5,150,105,.25);border:2px solid ${T.border2}"><img src="${photo}" style="width:100%;height:100%;object-fit:cover" alt="${esc((name||'?')[0])}"/></div>`;
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,${T.accent},${T.accentD});display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.38)}px;font-weight:800;color:#fff;flex-shrink:0;box-shadow:0 2px 8px rgba(5,150,105,.25)" aria-hidden="true">${esc((name||'?')[0].toUpperCase())}</div>`;
}

function pbar(pct, color){
  const v = Math.max(0, Math.min(pct, 100));
  return `<div role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100" style="background:${T.bg2};border:1px solid ${T.border};border-radius:99px;height:8px;overflow:hidden"><div style="width:${v}%;height:100%;background:${color};border-radius:99px;transition:width .4s ease"></div></div>`;
}

/* The wrapper scrolls sideways when the table is wider than the screen; the
   page itself never does (spec §38). Sizing lives in ui.css. */
function tblHtml(headers, rows){
  const ths = headers.map(h=>`<th scope="col" style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;background:${T.bg2}">${h}</th>`).join('');
  const trs = rows.map((row,i)=>{
    const tds = row.map(cell=>`<td style="padding:12px 14px;font-size:13px;color:${T.text};vertical-align:middle">${cell}</td>`).join('');
    return `<tr style="border-bottom:1px solid ${T.border};background:${i%2?T.rowAlt:T.surface}">${tds}</tr>`;
  }).join('');
  return `<div class="table-wrapper" tabindex="0"><table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:2px solid ${T.border}">${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

/* <label for> is a real association, so clicking the label focuses the field
   and screen readers announce it (spec §45). */
function fld(label, id, value='', type='text', options=null, placeholder=''){
  const st = `width:100%;background:${T.surface2};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:14px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif;-webkit-appearance:none`;
  const lbl = `<label for="${esc(id)}" style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">${label}</label>`;
  if(options){
    const opts = options.map(o=>`<option value="${esc(o)}" ${o===value?'selected':''}>${esc(o)}</option>`).join('');
    return `<div style="margin-bottom:14px;min-width:0">${lbl}<select id="${id}" style="${st}" onchange="setForm('${id}',this.value)">${opts}</select></div>`;
  }
  return `<div style="margin-bottom:14px;min-width:0">${lbl}<input type="${type}" id="${id}" value="${esc(value)}" placeholder="${esc(placeholder)}" style="${st}" oninput="setForm('${id}',this.value)"/></div>`;
}

function getUserPhoto(){
  if(!currentUser) return null;
  if(currentUser.role==='student'){ const s=students.find(x=>x.id===currentUser.id); return s?.photo||null; }
  if(currentUser.role==='teacher'){ const t=teachers.find(x=>x.id===currentUser.id); return t?.photo||null; }
  return null;
}
