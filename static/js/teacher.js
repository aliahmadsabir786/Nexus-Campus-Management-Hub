/* ================================================================
   js/teacher.js  —  NEXus Solution CMS
   ================================================================ */
// ================================================================
// SECTION 26 — TEACHER PAGES
// ----------------------------------------------------------------
// renderTeacherPage()            — router for teacher nav sections.
// renderTeacherDash(t)           — welcome banner + today's stats.
// renderTeacherSubjectAttendance(t) — mark attendance for own subject.
// renderTeacherSubjectGrades(t)  — enter mid/final/internal marks.
// renderTeacherAssignments(t)    — create assignments, grade submissions.
// renderTeacherComplaints(t)     — send and view own complaints.
// renderTeacherTT()              — view own uploaded timetable.
// renderNoticesView()            — shared notice board (teacher+student).
// ================================================================
function renderTeacherPage(){
  const t=teachers.find(x=>x.id===currentUser.id);
  switch(currentPage){
    case "dashboard":   return renderTeacherDash(t);
    case "bs-my-teaching": return appContext.departmentCode==="BS"?renderBSMyTeaching():renderTeacherDash(t);
    case "attendance":  return renderTeacherSubjectAttendance(t);
    case "grades":      return renderTeacherSubjectGrades(t);
    case "assignments": return renderTeacherAssignments(t);
    case "complaints":  return renderTeacherComplaints(t);
    case "timetable":   return renderTeacherTT();
    case "notices":     return renderNoticesView();
    default:            return renderTeacherDash(t);
  }
}

// ─── Teacher: attendance scoped to teacher's own subject ───────────
function renderTeacherSubjectAttendance(t){
  if(!t)return`<div style="padding:40px;text-align:center;color:${T.red}">Teacher not found</div>`;
  const subj=t.subject;

  // Find eligible student groups for this subject
  let eligibleGroups=SUBJECT_TO_GROUPS[subj]||[];
  if(!eligibleGroups.length){
    eligibleGroups=Object.keys(SUBJECT_GROUPS).filter(g=>(SUBJECT_GROUPS[g]||[]).includes(subj));
  }

  // All students who study this subject
  const myStudents=students.filter(s=>eligibleGroups.includes(s.subjectGroup||"Computer Science"));

  // Build class list from actual student data (not hardcoded CLASSES config)
  const classesPresent=[...new Set(myStudents.map(s=>s.cls).filter(Boolean))].sort();

  // _tAttCls==='' means ALL classes shown, a specific value filters to that class
  if(window._tAttCls===undefined) window._tAttCls='';
  // Reset invalid selection
  if(window._tAttCls && !classesPresent.includes(window._tAttCls)) window._tAttCls='';

  const activeCls=window._tAttCls;

  // FIX: empty activeCls shows ALL teacher's students across all their classes
  const visStudents=activeCls ? myStudents.filter(s=>s.cls===activeCls) : myStudents;
  // FIX: ids always reflects current visStudents — works for both "All" and filtered
  const ids=visStudents.map(s=>s.id);

  // Stats
  const presentCount=visStudents.filter(s=>(attendance[s.id]?.[attFilter.date]||"absent")==="present").length;
  const absentCount =visStudents.filter(s=>(attendance[s.id]?.[attFilter.date]||"absent")==="absent").length;
  const lateCount   =visStudents.filter(s=>(attendance[s.id]?.[attFilter.date]||"absent")==="late").length;
  const pct=visStudents.length?Math.round(presentCount/visStudents.length*100):0;

  // FIX: Store current visible student ids in a global so onclick handlers work reliably
  // Avoids JSON.stringify in onclick which can break for large lists or special chars
  window._tAttVisibleIds = ids;

  return `
  <div style="background:linear-gradient(135deg,${T.accent},${T.accentD});border-radius:16px;padding:20px 24px;margin-bottom:20px;color:#fff;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
    <div>
      <div style="font-size:11px;font-weight:700;opacity:.75;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Subject Attendance</div>
      <div style="font-size:20px;font-weight:800;font-family:'Space Grotesk',sans-serif">📚 ${esc(subj)}</div>
      <div style="font-size:12px;opacity:.85;margin-top:3px">${activeCls?('Class: '+activeCls):(classesPresent.length?classesPresent.join(' · '):'No groups mapped — contact admin')}</div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div style="background:rgba(255,255,255,.18);border-radius:12px;padding:10px 16px;text-align:center">
        <div style="font-size:22px;font-weight:800;font-family:'Space Grotesk',sans-serif">${visStudents.length}</div>
        <div style="font-size:10px;opacity:.85;font-weight:600">Visible</div>
      </div>
      <div style="background:rgba(255,255,255,.18);border-radius:12px;padding:10px 16px;text-align:center">
        <div style="font-size:22px;font-weight:800;font-family:'Space Grotesk',sans-serif">${classesPresent.length}</div>
        <div style="font-size:10px;opacity:.85;font-weight:600">Classes</div>
      </div>
    </div>
  </div>

  ${myStudents.length===0?`
  <div style="background:${T.surface};border:2px dashed ${T.border2};border-radius:16px;padding:56px 24px;text-align:center">
    <div style="font-size:48px;margin-bottom:12px">📭</div>
    <div style="font-weight:800;font-size:16px;color:${T.text};margin-bottom:6px">No Students Found for "${esc(subj)}"</div>
    <div style="font-size:13px;color:${T.muted};max-width:340px;margin:0 auto">This subject is not mapped to any student group. Please contact the administrator.</div>
  </div>`:`

  <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:16px 20px;margin-bottom:16px;box-shadow:${T.shadow}">
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">
      <div>
        <label style="font-size:10px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">📅 Date</label>
        <input type="date" value="${attFilter.date}" onchange="attFilter.date=this.value;refreshContent()"
          style="background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif;font-weight:600"/>
      </div>
      <div>
        <label style="font-size:10px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">🏫 Filter by Class</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button onclick="window._tAttCls='';refreshContent()"
            style="background:${activeCls===''?T.accent:'#fff'};color:${activeCls===''?'#fff':T.muted};border:1.5px solid ${activeCls===''?T.accent:T.border};border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">
            All (${myStudents.length})
          </button>
          ${classesPresent.map(c=>`
          <button onclick="window._tAttCls='${c}';refreshContent()"
            style="background:${activeCls===c?T.accent:'#fff'};color:${activeCls===c?'#fff':T.muted};border:1.5px solid ${activeCls===c?T.accent:T.border};border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">
            ${c} (${myStudents.filter(s=>s.cls===c).length})
          </button>`).join("")}
        </div>
      </div>
      <!-- FIX: Use window._tAttVisibleIds — no JSON.stringify in onclick -->
      <div style="margin-left:auto;display:flex;gap:8px;align-items:flex-end">
        ${sbtn("✅ All Present","bulkSubjectAtt('present',window._tAttVisibleIds)")}
        ${dbtn("❌ All Absent","bulkSubjectAtt('absent',window._tAttVisibleIds)")}
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
    ${[["✅ Present",presentCount,T.green,T.greenL],["❌ Absent",absentCount,T.red,T.redL],["⏰ Late",lateCount,T.yellow,T.yellowL],["📊 Rate",pct+"%",pct>=75?T.green:pct>=50?T.yellow:T.red,pct>=75?T.greenL:pct>=50?T.yellowL:T.redL]].map(([l,v,c,bg])=>`
    <div style="background:${bg};border:1px solid ${alpha(c,19)};border-radius:12px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:11px;color:${c};font-weight:700">${l}</div>
      <div style="font-size:20px;font-weight:800;color:${c};font-family:'Space Grotesk',sans-serif">${v}</div>
    </div>`).join("")}
  </div>

  <div style="display:grid;gap:10px">
    ${visStudents.length===0?`
    <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:40px;text-align:center;color:${T.muted}">
      No students found for the selected filter.
    </div>`:
    visStudents.map((s,i)=>{
      const st=attendance[s.id]?.[attFilter.date]||"absent";
      const sc={present:T.green,absent:T.red,late:T.yellow}[st];
      const scL={present:T.greenL,absent:T.redL,late:T.yellowL}[st];
      return `
      <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:14px 20px;box-shadow:${T.shadow};display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;border-left:4px solid ${sc}">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="background:${T.bg};border-radius:10px;padding:6px 10px;font-size:11px;font-weight:800;color:${T.muted};min-width:28px;text-align:center">${i+1}</div>
          ${ava(s.name,40,s.photo||null)}
          <div>
            <div style="font-weight:700;font-size:14px;color:${T.text}">${esc(s.name)}</div>
            <div style="font-size:11px;color:${T.muted};margin-top:2px">
              Roll# ${s.rollNo||"—"} &nbsp;·&nbsp;
              <span style="background:${T.accentL};color:${T.accentD};border-radius:6px;padding:1px 7px;font-weight:700">${s.cls}</span>
              &nbsp;·&nbsp; <span style="color:${T.accent};font-weight:600">${s.subjectGroup||""}</span>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <span style="background:${scL};color:${sc};border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;text-transform:capitalize">${st}</span>
          ${["present","absent","late"].map(opt=>`
          <button onclick="markAtt('${s.id}','${opt}')"
            style="background:${st===opt?sc:"#fff"};color:${st===opt?"#fff":T.muted};border:1.5px solid ${st===opt?sc:T.border};border-radius:8px;padding:6px 14px;cursor:pointer;font-weight:700;font-size:11px;font-family:'Plus Jakarta Sans',sans-serif;text-transform:capitalize;transition:all .15s">
            ${opt==="present"?"✅":opt==="absent"?"❌":"⏰"} ${opt}
          </button>`).join("")}
          ${dbtn("⚠️ Report",`openComplaint('${s.id}')`, "sm")}
        </div>
      </div>`;
    }).join("")}
  </div>`}`;
}
function renderTeacherSubjectGrades(t){
  if(!t)return`<div style="padding:40px;text-align:center;color:${T.red}">Teacher not found</div>`;
  const subj=t.subject;
  const myStudents=students.filter(s=>(SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||[]).includes(subj));
  // Exams for this subject (teacher can pick which exam to grade against)
  const subjExams=exams.filter(e=>e.subject===subj);
  const selExamId=gradesFilter.examId||(subjExams[0]?.id||"");
  const selExam=subjExams.find(e=>e.id===selExamId);
  const maxMarks=selExam?selExam.totalMarks:100;
  return `
  ${secTitle("📈 Enter Grades — "+subj)}
  <div style="background:${T.accentL};border:1px solid ${T.border2};border-radius:10px;padding:10px 16px;margin-bottom:16px;font-size:12px;color:${T.accentD};font-weight:600">
    ✏️ You can only enter grades for <strong>${subj}</strong> · ${myStudents.length} enrolled student(s)
  </div>
  <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end">
    <div>
      <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase">Exam</label>
      <select onchange="gradesFilter.examId=this.value;refreshContent()" style="background:#fff;border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        <option value="">— General (Mid/Final/Internal) —</option>
        ${subjExams.map(e=>`<option value="${e.id}" ${selExamId===e.id?"selected":""}>${e.title} · ${e.date} (/${e.totalMarks})</option>`).join("")}
      </select>
    </div>
    <div>
      <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase">Class Filter</label>
      <select onchange="gradesFilter.cls=this.value;refreshContent()" style="background:#fff;border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        <option value="ALL" ${(gradesFilter.cls||"ALL")==="ALL"?"selected":""}>All Classes</option>
        ${[...new Set(myStudents.map(s=>s.cls).filter(Boolean))].sort().map(cl=>`<option value="${cl}" ${gradesFilter.cls===cl?"selected":""}>${cl}</option>`).join("")}
      </select>
    </div>
  </div>
  ${myStudents.length===0
    ?`<div style="text-align:center;padding:48px;color:${T.muted};background:${T.surface};border:1px solid ${T.border};border-radius:14px">No students enrolled in <strong>${subj}</strong></div>`
    :selExam
      // ── SPECIFIC EXAM MODE: single score column ──
      ?card(`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:420px">
    <thead><tr style="border-bottom:2px solid ${T.border}">
      <th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2}">Student</th>
      <th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2}">Class · Group</th>
      <th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2};border-left:1px solid ${T.border}">${selExam.title} Score (/${maxMarks})</th>
      <th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2}">Grade</th>
    </tr></thead>
    <tbody>${myStudents.filter(s=>(gradesFilter.cls||"ALL")==="ALL"||s.cls===gradesFilter.cls).map((s,i)=>{
      const examScore=grades[s.id]?.[subj]?.["exam_"+selExamId]||"";
      const numScore=examScore?Number(examScore):0;
      const pct=maxMarks?Math.round(numScore/maxMarks*100):0;
      return `<tr style="border-bottom:1px solid ${T.border};background:${i%2?"#f9fffe":"#fff"}">
        <td style="padding:10px 14px;font-weight:700;font-size:13px">${esc(s.name)}</td>
        <td style="padding:10px 14px;font-size:12px;color:${T.muted}">${s.cls} · ${s.subjectGroup||"—"}</td>
        <td style="padding:6px 8px;border-left:1px solid ${T.border};text-align:center">
          <input type="number" value="${examScore}" min="0" max="${maxMarks}"
            onchange="saveExamGrade('${s.id}','${subj}','${selExamId}',this.value)"
            style="width:60px;background:${T.bg};border:1.5px solid ${T.border};border-radius:6px;padding:5px;font-size:12px;text-align:center;outline:none;font-family:'Plus Jakarta Sans',sans-serif"/>
        </td>
        <td style="padding:10px 14px;text-align:center">
          ${examScore?`<span style="background:${alpha(gradeColor(pct),13)};color:${gradeColor(pct)};border-radius:20px;padding:3px 12px;font-weight:800;font-size:12px">${gradeLabel(pct)}</span>`:"—"}
        </td>
      </tr>`;}).join("")}</tbody>
  </table></div>`, "", 0)
      // ── GENERAL MODE: Mid / Final / Internal columns ──
      :card(`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:560px">
    <thead>
      <tr style="border-bottom:2px solid ${T.border}">
        <th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2}">Student</th>
        <th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2}">Class · Group</th>
        <th colspan="3" style="padding:11px 8px;text-align:center;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;border-left:1px solid ${T.border};background:${T.bg2}">${subj} Marks</th>
        <th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2}">Total / Grade</th>
      </tr>
      <tr style="border-bottom:1px solid ${T.border}">
        <th style="background:${T.bg2}"></th><th style="background:${T.bg2}"></th>
        ${["Midterm (30)","Final (50)","Internal (20)"].map((h,i)=>`<th style="padding:6px;font-size:10px;color:${T.muted};text-align:center;font-weight:700;border-left:${i===0?`1px solid ${T.border}`:"none"};background:${T.bg2}">${h}</th>`).join("")}
        <th style="background:${T.bg2}"></th>
      </tr>
    </thead>
    <tbody>${myStudents.filter(s=>(gradesFilter.cls||"ALL")==="ALL"||s.cls===gradesFilter.cls).map((s,i)=>{
      const g=grades[s.id]?.[subj]||{};
      const tot=(g.midterm||0)+(g.final||0)+(g.internal||0);
      return `<tr style="border-bottom:1px solid ${T.border};background:${i%2?"#f9fffe":"#fff"}">
        <td style="padding:10px 14px;font-weight:700;font-size:13px">${esc(s.name)}</td>
        <td style="padding:10px 14px;font-size:12px;color:${T.muted}">${s.cls} · ${s.subjectGroup||"—"}</td>
        ${[["midterm",30],["final",50],["internal",20]].map(([field,max],fi)=>`
        <td style="padding:6px 4px;border-left:${fi===0?`1px solid ${T.border}`:"none"}">
          <input type="number" value="${g[field]||""}" onchange="updateGrade('${s.id}','${subj}','${field}',this.value)" min="0" max="${max}" placeholder="0"
            style="width:48px;background:${T.bg};border:1.5px solid ${T.border};border-radius:6px;padding:4px;font-size:11px;text-align:center;outline:none;display:block;margin:auto;font-family:'Plus Jakarta Sans',sans-serif"/>
        </td>`).join("")}
        <td style="padding:10px 14px;text-align:center">
          <span id="grade-total-${s.id}-${subj.replace(/\s/g,'_')}" style="background:${alpha(gradeColor(tot),13)};color:${gradeColor(tot)};border-radius:20px;padding:3px 12px;font-weight:800;font-size:12px">${tot||0} · ${gradeLabel(tot)}</span>
        </td>
      </tr>`;}).join("")}</tbody>
  </table></div>`, "", 0)}`;
}


function renderTeacherDash(t){
  const subj=t?.subject||'';
  const eligGrps=SUBJECT_TO_GROUPS[subj]||Object.keys(SUBJECT_GROUPS).filter(g=>(SUBJECT_GROUPS[g]||[]).includes(subj));
  const myStudents=students.filter(s=>eligGrps.includes(s.subjectGroup||'Computer Science'));

  // Classes of the CURRENT institution only — the backend already scoped
  // /api/classes and /api/students to this session's department/campus
  // (see contextClassCodes in context.js).
  const dashClasses=contextClassCodes();

  // Today's present count (this institution only)
  const tp=Object.values(attendance).filter(r=>r[today]==='present').length;
  // My subject students present today
  const myPresentToday=myStudents.filter(s=>attendance[s.id]?.[today]==='present').length;

  const myAssignments=assignments.filter(a=>a.teacherId===t?.id);
  const pendingSubs=submissions.filter(s=>myAssignments.some(a=>a.id===s.assignmentId)&&s.status==='submitted').length;

  // Per-class attendance (teacher's subject students only)
  const classAttData=dashClasses.map(cls=>{const cs=myStudents.filter(s=>s.cls===cls);const pres=cs.filter(s=>attendance[s.id]?.[today]==='present').length;return cs.length?Math.round(pres/cs.length*100):0;});

  // Week trend — teacher's subject students attendance per day
  const weekLabels=weekDays.map(d=>new Date(d).toLocaleDateString('en',{weekday:'short'}));
  const weekAttData=weekDays.map(d=>{const pres=myStudents.filter(s=>attendance[s.id]?.[d]==='present').length;return myStudents.length?Math.round(pres/myStudents.length*100):0;});

  scheduleChart(()=>drawBarChart('tAttChart',dashClasses,[{label:'Attendance %',data:classAttData,color:T.accent}],{maxVal:100}),'tAttChart');
  scheduleChart(()=>drawLineChart('tWeekChart',weekLabels,[{label:'This Week Attendance %',data:weekAttData,color:T.purple}]),'tWeekChart');

  return `<div style="background:linear-gradient(135deg,${T.accentD},${T.accent});border-radius:18px;padding:24px 28px;margin-bottom:22px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;box-shadow:0 4px 20px rgba(5,150,105,.3)">
    ${ava(t?.name||'T',56,t?.photo||null)}<div><div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:20px;color:#fff">Welcome, ${esc(t?.name)}!</div><div style="font-size:13px;color:rgba(255,255,255,.7);margin-top:3px">📚 ${t?.subject} · 🏛️ ${t?.dept}</div></div>
    <div style="margin-left:auto;background:rgba(255,255,255,.15);border-radius:12px;padding:10px 18px;text-align:center"><div style="font-size:22px;font-weight:800;color:#fff;font-family:'Space Grotesk',sans-serif">${t?.id}</div><div style="font-size:10px;color:rgba(255,255,255,.6)">Teacher ID</div></div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:22px">
    ${statCard('🎓',myStudents.length,'My Students',T.accent,eligGrps.join(', ').slice(0,30))}
    ${statCard('✅',myPresentToday,'Present Today',T.green,`${myStudents.length-myPresentToday} absent`)}
    ${statCard('📎',myAssignments.length,'My Assignments',T.blue,`${pendingSubs} to grade`)}
    ${statCard('⚠️',complaints.filter(c=>c.teacherName===t?.name).length,'Complaints',T.red)}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px">
    ${card(`${secTitle('🏫 Class Attendance Today')}<canvas id="tAttChart" width="420" height="180" style="width:100%;height:180px"></canvas>`)}
    ${card(`${secTitle('📈 This Week Attendance Trend')}<canvas id="tWeekChart" width="420" height="180" style="width:100%;height:180px"></canvas>`)}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
    ${card(`${secTitle('📎 My Assignments')}<div style="display:grid;gap:8px">${myAssignments.length===0?`<div style="text-align:center;padding:20px;color:${T.muted};font-size:13px">No assignments yet</div>`:myAssignments.map(a=>{const subs=submissions.filter(s=>s.assignmentId===a.id);const pend=subs.filter(s=>s.status==='submitted').length;return `<div style="background:${T.bg};border-radius:10px;padding:12px;display:flex;justify-content:space-between;align-items:center;border-left:3px solid ${pend>0?T.yellow:T.green}"><div><div style="font-weight:700;font-size:13px">${esc(a.title)}</div><div style="font-size:11px;color:${T.muted}">${a.cls} · Due ${a.dueDate}</div></div><span style="background:${pend>0?T.yellowL:T.greenL};color:${pend>0?T.yellow:T.green};border-radius:20px;padding:2px 10px;font-weight:700;font-size:12px">${pend>0?pend+' pending':'All graded'}</span></div>`;}).join('')}</div>`)}
    ${card(`${secTitle('📊 Subject Coverage')}<div style="display:grid;gap:10px;margin-top:4px">${dashClasses.length===0?dashEmpty('No classes in this institution yet'):dashClasses.map((cls,i)=>{const cs=myStudents.filter(s=>s.cls===cls);const pres=cs.filter(s=>attendance[s.id]?.[today]==='present').length;const pct=cs.length?Math.round(pres/cs.length*100):0;const col=pct>=80?T.green:pct>=60?T.yellow:cs.length?T.red:T.muted;return `<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span style="font-weight:700">${cls}</span><span style="color:${T.muted};font-size:11px">${cs.length} students</span><span style="color:${col};font-weight:700">${cs.length?pct+'%':'—'}</span></div>${cs.length?pbar(pct,col):`<div style="height:8px;background:${T.bg};border-radius:99px"></div>`}</div>`;}).join('')}</div>`)}
  </div>`;
}

function renderTeacherAssignments(t){
  const myA=assignments.filter(a=>a.teacherId===t?.id);
  const allMySubs=submissions.filter(s=>myA.some(a=>a.id===s.assignmentId));
  const pendingCount=allMySubs.filter(s=>s.status==="submitted").length;
  const gradedCount=allMySubs.filter(s=>s.status==="graded").length;
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
    ${secTitle("My Assignments")}${pbtn("+ Create Assignment","openModal('createAssignment')")}
  </div>
  ${myA.length>0?`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px">
    <div style="background:${T.blueL};border:1px solid #bfdbfe;border-radius:12px;padding:16px;text-align:center"><div style="font-size:26px;font-weight:800;color:${T.blue};font-family:'Space Grotesk',sans-serif">${myA.length}</div><div style="font-size:12px;color:${T.blue};font-weight:600;margin-top:3px">Created</div></div>
    <div style="background:${T.yellowL};border:1px solid #fcd34d;border-radius:12px;padding:16px;text-align:center"><div style="font-size:26px;font-weight:800;color:${T.yellow};font-family:'Space Grotesk',sans-serif">${pendingCount}</div><div style="font-size:12px;color:${T.yellow};font-weight:600;margin-top:3px">Pending to Grade</div></div>
    <div style="background:${T.greenL};border:1px solid #86efac;border-radius:12px;padding:16px;text-align:center"><div style="font-size:26px;font-weight:800;color:${T.green};font-family:'Space Grotesk',sans-serif">${gradedCount}</div><div style="font-size:12px;color:${T.green};font-weight:600;margin-top:3px">Graded</div></div>
  </div>`:""}
  ${myA.length===0?card(`<div style="text-align:center;padding:56px;color:${T.muted}"><div style="font-size:56px;margin-bottom:14px">📎</div><div style="font-weight:700;font-size:16px">No assignments created yet</div></div>`):
  `<div style="display:grid;gap:20px">${myA.map(a=>{
    const subs=submissions.filter(s=>s.assignmentId===a.id);
    const ungraded=subs.filter(s=>s.status==="submitted");
    const graded=subs.filter(s=>s.status==="graded");
    const classStudents=students.filter(s=>s.cls===a.cls);
    const notSubmitted=classStudents.filter(cs=>!subs.some(sub=>sub.studentId===cs.id));
    const borderCol=ungraded.length>0?T.yellow:subs.length>0?T.green:T.blue;
    return `<div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow};border-left:4px solid ${borderCol}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:${subs.length>0||notSubmitted.length>0?"18px":"0"}">
        <div style="flex:1"><div style="font-weight:800;font-size:16px;margin-bottom:6px">${esc(a.title)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><span style="background:${T.accentL};color:${T.accentD};border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700">📚 ${esc(a.subject)}</span><span style="background:${T.blueL};color:${T.blue};border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700">🏫 ${a.cls}</span><span style="font-size:12px;color:${new Date(a.dueDate)<new Date()?T.red:T.muted}">📅 Due: <strong>${a.dueDate}</strong></span></div>
        ${a.description?`<div style="font-size:13px;color:${T.text2};line-height:1.6;background:${T.bg};border-radius:8px;padding:10px 12px;border-left:3px solid ${T.accent}">${esc(a.description)}</div>`:""}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0"><span style="background:${T.blueL};color:${T.blue};border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700">${subs.length}/${classStudents.length} submitted</span>${ungraded.length>0?`<span style="background:${T.yellowL};color:${T.yellow};border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700">⏳ ${ungraded.length} to grade</span>`:""}${graded.length>0&&ungraded.length===0?`<span style="background:${T.greenL};color:${T.green};border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700">✅ All graded</span>`:""}</div>
      </div>
      ${subs.length>0?`<div style="border-top:2px dashed ${T.border};padding-top:16px;margin-bottom:${notSubmitted.length>0?"16px":"0"}"><div style="font-size:11px;font-weight:800;color:${T.muted};text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">📬 Submitted (${subs.length})</div>
      <div style="display:grid;gap:10px">${subs.map(sub=>{const isGraded=sub.status==="graded";return `<div style="background:${isGraded?"#f0fdf8":"#fffbeb"};border:1.5px solid ${isGraded?T.green+"40":T.yellow+"40"};border-radius:12px;padding:14px 16px;border-left:4px solid ${isGraded?T.green:T.yellow}">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div style="display:flex;align-items:center;gap:10px;min-width:180px">${ava(sub.studentName,36)}<div><div style="font-weight:700;font-size:14px">${esc(sub.studentName)}</div><div style="font-size:11px;color:${T.muted}">📎 ${esc(sub.fileName)} · 🕐 ${sub.submittedAt}</div></div></div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${badge(sub.status)}${isGraded?`<div style="background:#fff;border:1.5px solid ${gradeColor(sub.grade||0)};border-radius:10px;padding:5px 14px;text-align:center"><div style="font-size:16px;font-weight:800;color:${gradeColor(sub.grade||0)}">${sub.grade}/100</div></div>`:""}
          <button onclick="openGradeSubmission('${sub.id}')" style="background:${isGraded?T.yellowL:"linear-gradient(135deg,"+T.accent+","+T.accentD+")"};color:${isGraded?T.yellow:"#fff"};border:${isGraded?"1.5px solid #fcd34d":"none"};border-radius:9px;padding:7px 16px;font-size:12px;font-weight:700;cursor:pointer">✏️ ${isGraded?"Edit Grade":"Grade"}</button></div>
        </div>${isGraded&&sub.feedback?`<div style="margin-top:10px;background:#fff;border:1px solid ${T.border2};border-radius:8px;padding:10px 14px;border-left:3px solid ${T.accent}"><span style="font-size:11px;font-weight:700;color:${T.accent}">📝 Remarks: </span><span style="font-size:13px">${esc(sub.feedback)}</span></div>`:""}
      </div>`;}).join("")}</div></div>`:""}
      ${notSubmitted.length>0?`<div style="border-top:1px solid ${T.border};padding-top:14px"><div style="font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;margin-bottom:10px">⏳ Not Submitted (${notSubmitted.length})</div><div style="display:flex;flex-wrap:wrap;gap:8px">${notSubmitted.map(cs=>`<div style="display:flex;align-items:center;gap:6px;background:${T.bg};border:1px solid ${T.border};border-radius:8px;padding:5px 10px">${ava(cs.name,22)}<span style="font-size:12px;font-weight:600;color:${T.muted}">${esc(cs.name)}</span></div>`).join("")}</div></div>`:""}
    </div>`;}).join("")}</div>`}`;}

function renderTeacherComplaints(t){
  const mc=complaints.filter(c=>c.teacherName===t?.name);
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
    ${secTitle("Student Complaints")}${pbtn("+ New Complaint","openModal('addComplaint')")}
  </div>
  ${mc.length===0?card(`<div style="text-align:center;padding:48px;color:${T.muted}"><div style="font-size:48px;margin-bottom:12px">📭</div><div style="font-weight:700">No complaints sent yet</div></div>`):
  `<div style="display:grid;gap:12px">${mc.map(c=>`<div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:20px;box-shadow:${T.shadow};border-left:4px solid ${T.red}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
      <div style="flex:1"><div style="font-weight:700;font-size:14px;margin-bottom:4px">${esc(c.studentName)}</div><div style="font-size:13px;line-height:1.6;margin-bottom:8px">${esc(c.message)}</div><div style="font-size:12px;color:${T.muted}">📅 ${c.date} · 📱 ${c.guardianPhone}</div></div>
      <a href="sms:${c.guardianPhone}?body=${encodeURIComponent(`Dear Guardian, regarding ${c.studentName}: ${c.message} - ${t?.name}`)}" style="display:inline-flex;align-items:center;gap:6px;background:${T.greenL};color:${T.green};border:1px solid #86efac;border-radius:10px;padding:8px 16px;font-size:12px;font-weight:700">💬 SMS</a>
    </div>
  </div>`).join("")}</div>`}`;}

function renderTeacherTT(){
  const tt=timetables[currentUser.id];
  return `${secTitle("My Timetable")}${tt?card(`<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px"><div style="width:52px;height:52px;background:${T.accentL};border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px">📅</div><div><div style="font-weight:700;font-size:15px">${esc(tt.name)}</div><div style="font-size:12px;color:${T.muted};margin-top:2px">Uploaded · ${tt.uploadedAt}</div></div></div>${tt.data.startsWith("data:image")?`<img src="${tt.data}" alt="timetable" style="width:100%;border-radius:12px;border:1px solid ${T.border}"/>`:pbtn("📎 Open / Download","window.open(timetables['"+currentUser.id+"'].data)")}`)
  :card(`<div style="text-align:center;padding:56px;color:${T.muted}"><div style="font-size:56px;margin-bottom:14px">📭</div><div style="font-weight:700;font-size:16px">No timetable uploaded yet</div></div>`)}`;}

function renderNoticesView(){
  const cmap={holiday:T.orange,academic:T.blue,event:T.green,fee:T.yellow};
  return `${secTitle("College Notices")}<div style="display:grid;gap:12px">${notices.map(n=>`<div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:18px 22px;box-shadow:${T.shadow};border-left:4px solid ${cmap[n.type]||T.accent}"><div style="font-weight:700;font-size:14px;margin-bottom:8px">${esc(n.title)}</div><div style="display:flex;gap:8px;align-items:center">${badge(n.type)}<span style="font-size:11px;color:${T.muted}">By ${esc(n.author)} · ${n.date}</span></div></div>`).join("")}</div>`;}