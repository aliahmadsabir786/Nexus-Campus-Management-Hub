/* ================================================================
   js/theme.js  —  Design tokens (T object) + shared helpers
   ================================================================ */

const T = {
  bg:'#f0fdf8', bg2:'#ecfdf5', surface:'#ffffff',
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
  shadow:'0 1px 4px rgba(5,150,105,.08),0 1px 2px rgba(0,0,0,.04)',
};

// ── Grade helpers ──────────────────────────────────────────────
const gradeLabel = t => t>=85?'A+':t>=80?'A':t>=72?'B+':t>=65?'B':t>=55?'C':t>=45?'D':'F';
const gradeColor = t => t>=80?T.green:t>=65?T.accent:t>=45?T.yellow:T.red;

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
  const [fg,bg] = map[status] || [T.muted,'#f1f5f9'];
  const p = size==='sm' ? '2px 10px' : '3px 14px';
  const fs = size==='sm' ? 11 : 12;
  return `<span style="background:${bg};color:${fg};border-radius:20px;padding:${p};font-size:${fs}px;font-weight:700;text-transform:capitalize;white-space:nowrap">${esc(status.replace(/_/g,' '))}</span>`;
}

function pbtn(label, oc, sz='md'){
  const p = sz==='sm'?'6px 14px':sz==='lg'?'13px 28px':'9px 20px';
  const fs = sz==='sm'?12:sz==='lg'?15:13;
  return `<button onclick="${oc}" style="background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(5,150,105,.3);font-family:'Plus Jakarta Sans',sans-serif">${label}</button>`;
}
function obtn(label, oc, sz='md'){
  const p = sz==='sm'?'5px 13px':'8px 18px'; const fs = sz==='sm'?12:13;
  return `<button onclick="${oc}" style="background:#fff;color:${T.accent};border:1.5px solid ${T.accent};border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${label}</button>`;
}
function dbtn(label, oc, sz='md'){
  const p = sz==='sm'?'5px 13px':'8px 18px'; const fs = sz==='sm'?12:13;
  return `<button onclick="${oc}" style="background:${T.redL};color:${T.red};border:1px solid #fca5a5;border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${label}</button>`;
}
function sbtn(label, oc, sz='md'){
  const p = sz==='sm'?'5px 13px':'8px 18px'; const fs = sz==='sm'?12:13;
  return `<button onclick="${oc}" style="background:${T.greenL};color:${T.green};border:1px solid #86efac;border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${label}</button>`;
}
function wbtn(label, oc, sz='md'){
  const p = sz==='sm'?'5px 13px':'8px 18px'; const fs = sz==='sm'?12:13;
  return `<button onclick="${oc}" style="background:${T.yellowL};color:${T.yellow};border:1px solid #fcd34d;border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${label}</button>`;
}
function purpbtn(label, oc, sz='md'){
  const p = sz==='sm'?'5px 13px':'8px 18px'; const fs = sz==='sm'?12:13;
  return `<button onclick="${oc}" style="background:${T.purpleL};color:${T.purple};border:1px solid #c4b5fd;border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${label}</button>`;
}

function card(content, xStyle='', p=22){
  return `<div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:${p}px;box-shadow:${T.shadow};overflow:hidden;min-width:0;${xStyle}">${content}</div>`;
}

function statCard(icon, value, label, color, sub=''){
  return `<div class="card-hover" style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:20px;position:relative;overflow:hidden;box-shadow:${T.shadow}">
    <div style="position:absolute;top:14px;right:14px;width:44px;height:44px;border-radius:12px;background:${color}18;display:flex;align-items:center;justify-content:center;font-size:20px">${icon}</div>
    <div style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:800;color:${color};line-height:1.1">${esc(String(value))}</div>
    <div style="font-size:12px;color:${T.muted};margin-top:5px;font-weight:600;padding-right:50px">${esc(label)}</div>
    ${sub?`<div style="font-size:11px;color:${color};margin-top:3px;font-weight:600;opacity:.8">${esc(sub)}</div>`:''}
  </div>`;
}

function secTitle(t, a=''){
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <h2 style="font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:800;color:${T.text};margin:0">${t}</h2>${a}
  </div>`;
}

function ava(name, size=36, photo=null){
  if(photo) return `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;flex-shrink:0;box-shadow:0 2px 8px rgba(5,150,105,.25);border:2px solid ${T.border2}"><img src="${photo}" style="width:100%;height:100%;object-fit:cover" alt="${(name||'?')[0]}"/></div>`;
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,${T.accent},${T.accentD});display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.38)}px;font-weight:800;color:#fff;flex-shrink:0;box-shadow:0 2px 8px rgba(5,150,105,.25)">${(name||'?')[0].toUpperCase()}</div>`;
}

function pbar(pct, color){
  return `<div style="background:${T.bg};border-radius:99px;height:8px;overflow:hidden"><div style="width:${Math.min(pct,100)}%;height:100%;background:${color};border-radius:99px;transition:width .4s ease"></div></div>`;
}

function tblHtml(headers, rows){
  const ths = headers.map(h=>`<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;background:${T.bg2}">${h}</th>`).join('');
  const trs = rows.map((row,i)=>{
    const tds = row.map(cell=>`<td style="padding:12px 14px;font-size:13px;color:${T.text};vertical-align:middle">${cell}</td>`).join('');
    return `<tr style="border-bottom:1px solid ${T.border};background:${i%2?'#f9fffe':'#fff'}">${tds}</tr>`;
  }).join('');
  return `<div class="table-wrapper"><table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:2px solid ${T.border}">${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

function fld(label, id, value='', type='text', options=null, placeholder=''){
  const st = `width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:14px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif;-webkit-appearance:none`;
  const lbl = `<label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">${label}</label>`;
  if(options){
    const opts = options.map(o=>`<option value="${esc(o)}" ${o===value?'selected':''}>${esc(o)}</option>`).join('');
    return `<div style="margin-bottom:14px">${lbl}<select id="${id}" style="${st}" onchange="setForm('${id}',this.value)">${opts}</select></div>`;
  }
  return `<div style="margin-bottom:14px">${lbl}<input type="${type}" id="${id}" value="${esc(value)}" placeholder="${esc(placeholder)}" style="${st}" oninput="setForm('${id}',this.value)"/></div>`;
}

function getUserPhoto(){
  if(!currentUser) return null;
  if(currentUser.role==='student'){ const s=students.find(x=>x.id===currentUser.id); return s?.photo||null; }
  if(currentUser.role==='teacher'){ const t=teachers.find(x=>x.id===currentUser.id); return t?.photo||null; }
  return null;
}
