/* ================================================================
   js/charts.js  —  Responsive Canvas Charts
   ================================================================
   - Canvas dimensions read from the actual rendered size (offsetWidth)
   - ResizeObserver redraws charts on container resize
   - Chart queue cleared before each render cycle (no infinite growth)

   DARK MODE (spec §29: "charts" must be readable)
   -----------------------------------------------
   A <canvas> paints pixels, so it cannot defer a colour to the CSS cascade:
   `ctx.fillStyle = 'var(--accent)'` is simply ignored. Since theme.js now
   hands out token references, every colour that reaches this file has to be
   resolved to a real value first — that is what _resolve() does, reading the
   live computed value from <html> so it always matches the active theme.

   The chart's own furniture (background, grid, axis and label text) used to
   be hard-coded light greys, which turned into grey-on-black in dark mode.
   It now comes from the same tokens as the rest of the app.
   ================================================================ */

/* ── Chart queue (draw after DOM is ready) ─────────────────────── */
let _chartQueue = [];
let _chartFns   = {};   // id → fn, for redraw on resize / theme change

function scheduleChart(fn, id){
  _chartQueue.push({fn, id: id||('c'+Date.now()+Math.random())});
}

function flushCharts(){
  const q = [..._chartQueue];
  _chartQueue = [];
  setTimeout(()=>{
    q.forEach(({fn, id})=>{
      try {
        fn();
        if(id) _chartFns[id] = fn;
      } catch(e){}
    });
  }, 80);
}

/** Redraw every chart currently on screen — used after a theme switch. */
function redrawCharts(){
  Object.values(_chartFns).forEach(fn=>{ try{ fn(); }catch(e){} });
}

/* ================================================================
   COLOUR RESOLUTION
   ================================================================ */

/**
 * Turn whatever the caller passed into something canvas understands.
 * Accepts 'var(--accent)', 'var(--accent, #059669)', '#059669', 'red'.
 */
function _resolve(c, fallback){
  const fb = fallback || '#059669';
  if(!c) return fb;
  const s = String(c).trim();
  const m = s.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/);
  if(!m) return s;
  const inner = (m[2] || '').trim();
  return cssVar(m[1], inner || fb);
}

/** Translucent version of a colour, as a literal rgba() canvas can paint. */
function _fade(c, a){
  const col = _resolve(c);
  let m = col.match(/^#([0-9a-f]{3})$/i);
  if(m){
    const h = m[1];
    return `rgba(${parseInt(h[0]+h[0],16)},${parseInt(h[1]+h[1],16)},${parseInt(h[2]+h[2],16)},${a})`;
  }
  m = col.match(/^#([0-9a-f]{6})$/i);
  if(m){
    const h = m[1];
    return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`;
  }
  m = col.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if(m) return `rgba(${m[1]},${m[2]},${m[3]},${a})`;
  return col;   // named colour: opaque is better than invisible
}

/** The chart furniture, pulled from the live theme on every draw. */
function _chartTheme(){
  const dark = typeof isDark === 'function' && isDark();
  return {
    bg:    cssVar('--surface', '#ffffff'),
    grid:  cssVar('--border',  dark ? '#25483d' : '#e5e7eb'),
    axis:  cssVar('--muted',   dark ? '#a2c0b4' : '#9ca3af'),
    label: cssVar('--text2',   dark ? '#c6ddd4' : '#374151'),
    title: cssVar('--text',    dark ? '#f1fdf8' : '#0d2b23'),
    // Text painted ON TOP of a filled bar. The accent is dark in light mode
    // and pastel in dark mode, so the readable ink flips with it.
    onFill: dark ? '#0b1412' : '#ffffff',
  };
}

/* ── Responsive canvas sizing helper ───────────────────────────── */
function _prepCanvas(canvasId, fixedH){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return null;
  const parent = canvas.parentElement;
  const W = parent ? parent.offsetWidth || 400 : 400;
  const H = fixedH || Math.round(W * 0.45);
  // Set actual pixel dimensions (prevents blurry rendering)
  canvas.width  = W;
  canvas.height = H;
  canvas.style.width  = '100%';
  canvas.style.height = H + 'px';
  canvas.style.maxHeight = '220px';
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  return {canvas, ctx, W, H};
}

/* ================================================================
   drawBarChart(canvasId, labels, datasets, options)
   ================================================================ */
function drawBarChart(canvasId, labels, datasets, options={}){
  const c = _prepCanvas(canvasId, options.height||190);
  if(!c) return;
  const {ctx, W, H} = c;
  const th  = _chartTheme();
  const pad = {top:28, right:16, bottom:44, left:42};
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;
  const maxVal = options.maxVal || 100;
  const gridLines = 5;

  // Background
  ctx.fillStyle = th.bg;
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  for(let i=0; i<=gridLines; i++){
    const y = pad.top + cH - (i/gridLines)*cH;
    ctx.strokeStyle = th.grid;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left+cW, y); ctx.stroke();
    ctx.fillStyle = th.axis;
    ctx.font = `10px Plus Jakarta Sans, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(Math.round((i/gridLines)*maxVal), pad.left-6, y+4);
  }

  if(!labels.length) return;
  const groupW = cW / labels.length;
  const barW   = Math.min(groupW * 0.65 / Math.max(datasets.length,1), 32);
  const totalBarW = barW * datasets.length + (datasets.length-1) * 3;

  datasets.forEach((ds, di)=>{
    const col = _resolve(ds.color);
    labels.forEach((lbl, li)=>{
      const val  = ds.data[li] || 0;
      const barH = (val/maxVal) * cH;
      const x    = pad.left + groupW*li + (groupW-totalBarW)/2 + di*(barW+3);
      const y    = pad.top + cH - barH;
      ctx.fillStyle = col;
      ctx.beginPath();
      const r = Math.min(4, barH/2);
      ctx.moveTo(x+r, y);
      ctx.lineTo(x+barW-r, y);
      ctx.arcTo(x+barW, y, x+barW, y+r, r);
      ctx.lineTo(x+barW, pad.top+cH);
      ctx.lineTo(x, pad.top+cH);
      ctx.lineTo(x, y+r);
      ctx.arcTo(x, y, x+r, y, r);
      ctx.closePath();
      ctx.fill();
      if(barH > 16){
        ctx.fillStyle = th.onFill;
        ctx.font = 'bold 9px Plus Jakarta Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(val, x+barW/2, y+13);
      }
    });
  });

  // X labels
  labels.forEach((lbl, li)=>{
    ctx.fillStyle = th.label;
    ctx.font = `11px Plus Jakarta Sans, sans-serif`;
    ctx.textAlign = 'center';
    const x = pad.left + groupW*li + groupW/2;
    ctx.fillText(lbl, x, pad.top+cH+18);
  });

  // Legend
  datasets.forEach((ds, di)=>{
    const lx = pad.left + di*120;
    const ly = H - 6;
    ctx.fillStyle = _resolve(ds.color);
    ctx.fillRect(lx, ly-8, 12, 8);
    ctx.fillStyle = th.label;
    ctx.font = '10px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(ds.label, lx+16, ly);
  });
}

/* ================================================================
   drawLineChart(canvasId, labels, datasets)
   ================================================================ */
function drawLineChart(canvasId, labels, datasets){
  const c = _prepCanvas(canvasId, 190);
  if(!c) return;
  const {ctx, W, H} = c;
  const th  = _chartTheme();
  const pad = {top:28, right:16, bottom:40, left:44};
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top  - pad.bottom;
  const maxVal = 100;
  const gridLines = 5;

  ctx.fillStyle = th.bg;
  ctx.fillRect(0, 0, W, H);

  for(let i=0; i<=gridLines; i++){
    const y = pad.top + cH - (i/gridLines)*cH;
    ctx.strokeStyle = th.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left+cW, y); ctx.stroke();
    ctx.fillStyle = th.axis;
    ctx.font = '10px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round((i/gridLines)*maxVal)+'%', pad.left-4, y+4);
  }

  if(!labels.length || !datasets.length) return;
  const xStep = labels.length > 1 ? cW/(labels.length-1) : cW;

  datasets.forEach(ds=>{
    const col = _resolve(ds.color);
    const pts = ds.data.map((v,i)=>({
      x: pad.left + i*xStep,
      y: pad.top  + cH - (v/maxVal)*cH
    }));
    if(!pts.length) return;

    // Fill area
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pad.top+cH);
    pts.forEach(p=> ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length-1].x, pad.top+cH);
    ctx.closePath();
    ctx.fillStyle = _fade(col, 0.13);
    ctx.fill();

    // Line
    ctx.beginPath();
    pts.forEach((p,i)=> i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
    ctx.strokeStyle = col;
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    // Dots
    pts.forEach(p=>{
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
      ctx.fillStyle   = col;
      ctx.fill();
      ctx.strokeStyle = th.bg;        // ring matches the card, not always white
      ctx.lineWidth   = 2;
      ctx.stroke();

      // Value tooltip
      ctx.fillStyle = col;
      ctx.font = 'bold 9px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(ds.data[pts.indexOf(p)])+'%', p.x, p.y-8);
    });
  });

  // X labels
  labels.forEach((lbl, li)=>{
    ctx.fillStyle = th.label;
    ctx.font = '11px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lbl, pad.left+li*xStep, pad.top+cH+16);
  });

  // Legend
  datasets.forEach((ds, di)=>{
    const col = _resolve(ds.color);
    const lx = pad.left + di*140;
    const ly = H - 5;
    ctx.fillStyle   = col;
    ctx.strokeStyle = col;
    ctx.lineWidth   = 2.5;
    ctx.beginPath(); ctx.moveTo(lx,ly-5); ctx.lineTo(lx+18,ly-5); ctx.stroke();
    ctx.beginPath(); ctx.arc(lx+9, ly-5, 3.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = th.label;
    ctx.font = '10px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(ds.label, lx+24, ly);
  });
}

/* ================================================================
   drawDonutChart(canvasId, segments)
   segments = [{label, value, color}]
   ================================================================ */
function drawDonutChart(canvasId, segments){
  const c = _prepCanvas(canvasId, 190);
  if(!c) return;
  const {ctx, W, H} = c;
  const th = _chartTheme();
  ctx.fillStyle = th.bg;
  ctx.fillRect(0,0,W,H);

  const total = segments.reduce((a,s)=>a+s.value, 0);
  if(!total) return;

  const cx = W/2, cy = H/2 - 10;
  const r  = Math.min(cx, cy) - 20;
  const ri = r * 0.55;

  let startAngle = -Math.PI/2;
  segments.forEach(seg=>{
    const slice = (seg.value/total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle+slice);
    ctx.closePath();
    ctx.fillStyle = _resolve(seg.color);
    ctx.fill();
    startAngle += slice;
  });

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, ri, 0, Math.PI*2);
  ctx.fillStyle = th.bg;
  ctx.fill();

  // Center text
  ctx.fillStyle = th.title;
  ctx.font = `bold 14px Space Grotesk, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(total, cx, cy+4);
  ctx.fillStyle = th.axis;
  ctx.font = '10px Plus Jakarta Sans, sans-serif';
  ctx.fillText('Total', cx, cy+18);

  // Legend bottom
  const lW = segments.length * 80;
  let lx   = cx - lW/2;
  const ly = H - 8;
  segments.forEach(seg=>{
    ctx.fillStyle = _resolve(seg.color);
    ctx.fillRect(lx, ly-8, 10, 8);
    ctx.fillStyle = th.label;
    ctx.font = '9px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${seg.label} (${seg.value})`, lx+14, ly);
    lx += 80;
  });
}

/* ================================================================
   ResizeObserver — redraws charts when container size changes
   Prevents the "chart keeps growing" loop bug
   ================================================================ */
(function initChartResizeWatcher(){
  if(typeof ResizeObserver === 'undefined') return;
  let _resizeTimer = null;
  const observer = new ResizeObserver(()=>{
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(redrawCharts, 150);
  });
  // Observe #main-content when it appears
  const watch = ()=>{
    const el = document.getElementById('main-content');
    if(el){ observer.observe(el); }
    else { setTimeout(watch, 500); }
  };
  watch();
})();

/* Repaint on theme switch: the canvas keeps the pixels it was given, so a
   light-mode chart would otherwise stay light after toggling to dark. */
(function initChartThemeWatcher(){
  if(typeof MutationObserver === 'undefined') return;
  new MutationObserver(()=> setTimeout(redrawCharts, 30))
    .observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
})();
