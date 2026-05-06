/* ================================================================
   js/charts.js  —  Responsive Canvas Charts (No loop bug)
   
   KEY FIXES vs old version:
   - Canvas dimensions read from actual rendered size (offsetWidth)
   - ResizeObserver redraws charts on container resize
   - Chart queue cleared before each render cycle
   - No infinite growth / loop possible
   ================================================================ */

/* ── Chart queue (draw after DOM is ready) ─────────────────────── */
let _chartQueue = [];
let _chartFns   = {};   // id → fn, for redraw on resize

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
  const pad = {top:28, right:16, bottom:44, left:42};
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;
  const maxVal = options.maxVal || 100;
  const gridLines = 5;

  // Background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  for(let i=0; i<=gridLines; i++){
    const y = pad.top + cH - (i/gridLines)*cH;
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left+cW, y); ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = `10px Plus Jakarta Sans, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(Math.round((i/gridLines)*maxVal), pad.left-6, y+4);
  }

  if(!labels.length) return;
  const groupW = cW / labels.length;
  const barW   = Math.min(groupW * 0.65 / Math.max(datasets.length,1), 32);
  const totalBarW = barW * datasets.length + (datasets.length-1) * 3;

  datasets.forEach((ds, di)=>{
    labels.forEach((lbl, li)=>{
      const val  = ds.data[li] || 0;
      const barH = (val/maxVal) * cH;
      const x    = pad.left + groupW*li + (groupW-totalBarW)/2 + di*(barW+3);
      const y    = pad.top + cH - barH;
      ctx.fillStyle = ds.color;
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
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Plus Jakarta Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(val, x+barW/2, y+13);
      }
    });
  });

  // X labels
  labels.forEach((lbl, li)=>{
    ctx.fillStyle = '#374151';
    ctx.font = `11px Plus Jakarta Sans, sans-serif`;
    ctx.textAlign = 'center';
    const x = pad.left + groupW*li + groupW/2;
    ctx.fillText(lbl, x, pad.top+cH+18);
  });

  // Legend
  datasets.forEach((ds, di)=>{
    const lx = pad.left + di*120;
    const ly = H - 6;
    ctx.fillStyle = ds.color;
    ctx.fillRect(lx, ly-8, 12, 8);
    ctx.fillStyle = '#374151';
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
  const pad = {top:28, right:16, bottom:40, left:44};
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top  - pad.bottom;
  const maxVal = 100;
  const gridLines = 5;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  for(let i=0; i<=gridLines; i++){
    const y = pad.top + cH - (i/gridLines)*cH;
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left+cW, y); ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round((i/gridLines)*maxVal)+'%', pad.left-4, y+4);
  }

  if(!labels.length || !datasets.length) return;
  const xStep = labels.length > 1 ? cW/(labels.length-1) : cW;

  datasets.forEach(ds=>{
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
    ctx.fillStyle = ds.color + '22';
    ctx.fill();

    // Line
    ctx.beginPath();
    pts.forEach((p,i)=> i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
    ctx.strokeStyle = ds.color;
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    // Dots
    pts.forEach(p=>{
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
      ctx.fillStyle   = ds.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 2;
      ctx.stroke();

      // Value tooltip
      ctx.fillStyle = ds.color;
      ctx.font = 'bold 9px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(ds.data[pts.indexOf(p)])+'%', p.x, p.y-8);
    });
  });

  // X labels
  labels.forEach((lbl, li)=>{
    ctx.fillStyle = '#374151';
    ctx.font = '11px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lbl, pad.left+li*xStep, pad.top+cH+16);
  });

  // Legend
  datasets.forEach((ds, di)=>{
    const lx = pad.left + di*140;
    const ly = H - 5;
    ctx.fillStyle   = ds.color;
    ctx.strokeStyle = ds.color;
    ctx.lineWidth   = 2.5;
    ctx.beginPath(); ctx.moveTo(lx,ly-5); ctx.lineTo(lx+18,ly-5); ctx.stroke();
    ctx.beginPath(); ctx.arc(lx+9, ly-5, 3.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#374151';
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
  ctx.fillStyle = '#fff';
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
    ctx.fillStyle = seg.color;
    ctx.fill();
    startAngle += slice;
  });

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, ri, 0, Math.PI*2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Center text
  ctx.fillStyle = '#0d2b23';
  ctx.font = `bold 14px Space Grotesk, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(total, cx, cy+4);
  ctx.fillStyle = '#4b7a66';
  ctx.font = '10px Plus Jakarta Sans, sans-serif';
  ctx.fillText('Total', cx, cy+18);

  // Legend bottom
  const lW = segments.length * 80;
  let lx   = cx - lW/2;
  const ly = H - 8;
  segments.forEach(seg=>{
    ctx.fillStyle = seg.color;
    ctx.fillRect(lx, ly-8, 10, 8);
    ctx.fillStyle = '#374151';
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
    _resizeTimer = setTimeout(()=>{
      Object.values(_chartFns).forEach(fn=>{ try{ fn(); }catch(e){} });
    }, 150);
  });
  // Observe #main-content when it appears
  const watch = ()=>{
    const el = document.getElementById('main-content');
    if(el){ observer.observe(el); }
    else { setTimeout(watch, 500); }
  };
  watch();
})();
