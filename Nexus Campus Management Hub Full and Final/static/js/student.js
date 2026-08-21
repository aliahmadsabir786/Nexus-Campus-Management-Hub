/* ================================================================
   js/student.js  —  NEXus Solution CMS
   ================================================================ */
// ================================================================
// SECTION 27 — STUDENT PAGES
// ----------------------------------------------------------------
// renderStudentPage()      — router + portal-revoked guard.
// renderStudentDash(s)     — welcome banner + attendance/grade summary.
// renderStudentAtt(s)      — view own attendance calendar.
// renderStudentGrades(s)   — view own subject marks & grade.
// renderStudentAssignments(s) — view + submit assignments.
// renderStudentFees(s)     — view fee vouchers and installment status.
// renderStudentTT()        — view class timetable.
// renderStudentExams(s)    — view upcoming exam schedule.
// renderNoticesView()      — shared notice board (teacher+student).
// ================================================================
function renderStudentPage(){
  const s=students.find(x=>x.id===currentUser.id);
  if(!s)return `<div style="text-align:center;padding:60px;color:${T.red}">Student not found.</div>`;
  if(s.portal!=="active")return `<div style="display:flex;height:100%;align-items:center;justify-content:center;padding:40px">${card(`<div style="text-align:center;padding:48px"><div style="font-size:56px;margin-bottom:16px">🔒</div><div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:20px;margin-bottom:10px">Portal Access Revoked</div><div style="color:${T.muted};font-size:14px">Contact the college admin to restore access.</div></div>`)}</div>`;
  switch(currentPage){case "dashboard":return renderStudentDash(s);case "attendance":return renderStudentAtt(s);case "grades":return renderStudentGrades(s);case "assignments":return renderStudentAssignments(s);case "fees":return renderStudentFees(s);case "timetable":return renderStudentTT();case "exams":return renderStudentExams(s);case "notices":return renderNoticesView();default:return renderStudentDash(s);}
}

function renderStudentDash(s){
  const ma=attendance[s.id]||{},allDates=Object.keys(ma).sort();
  const pd=allDates.filter(d=>ma[d]==="present").length,attPct=allDates.length?Math.round(pd/allDates.length*100):0;
  const mg=grades[s.id]||{};
  const studentSubjects=SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||SUBJECT_GROUPS["Computer Science"];
  const tots=studentSubjects.map(sub=>mg[sub]?.total||0).filter(x=>x>0);
  const avg=tots.length?Math.round(tots.reduce((a,b)=>a+b,0)/tots.length):0;
  const myEx=exams.filter(e=>e.cls===s.cls);
  const myAssignA=assignments.filter(a=>a.cls===s.cls);
  const mySubs=submissions.filter(sub=>sub.studentId===s.id);
  const pendingA=myAssignA.filter(a=>!mySubs.some(sub=>sub.assignmentId===a.id));
  // Use weekDays for chart so it always shows latest 5 working days
  const chartDays=weekDays.length?weekDays:(allDates.slice(-5));
  const attData=chartDays.map(d=>ma[d]==="present"?100:ma[d]==="late"?50:0);
  const dayLabels=chartDays.map(d=>new Date(d).toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"}));
  scheduleChart(()=>drawBarChart('sAttChartDash',dayLabels,[{label:'Attendance',data:attData,color:T.accent}],{maxVal:100}),'sAttChartDash');
  return `<div style="background:linear-gradient(135deg,${T.accentD},${T.accent});border-radius:18px;padding:24px 28px;margin-bottom:22px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;box-shadow:0 4px 20px rgba(5,150,105,.3)">
    ${ava(s.name,56,s.photo||null)}<div style="flex:1"><div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:20px;color:#fff">Welcome, ${esc(s.name)}!</div><div style="font-size:13px;color:rgba(255,255,255,.7);margin-top:4px">📚 ${s.cls} · Roll# ${s.rollNo} · ${s.id}</div><div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:3px">🎓 ${s.subjectGroup||"Computer Science"} Group &nbsp;·&nbsp; ${studentSubjects.join(", ")}</div></div>
    <div>${badge(s.feeStatus,"lg")}</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:22px">
    ${statCard("✅",`${attPct}%`,"Attendance",attPct>=75?T.green:T.red,`${pd} days`)}${statCard("📈",avg||"-","Avg Score",gradeColor(avg||0),gradeLabel(avg||0))}${statCard("💳",s.feeStatus,"Fee",s.feeStatus==="paid"?T.green:T.red)}${statCard("📎",pendingA.length,"Pending Tasks",T.blue,"Assignments")}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
    ${card(`${secTitle("📊 My Attendance This Week")}<canvas id="sAttChartDash" width="420" height="160" style="width:100%;height:160px"></canvas>`)}
    ${card(`${secTitle("📝 Upcoming Exams")}<div style="display:grid;gap:10px">${myEx.length===0?`<div style="color:${T.muted};font-size:13px;text-align:center;padding:16px">No exams scheduled</div>`:myEx.map(e=>`<div style="background:${T.bg};border-radius:10px;padding:12px;border-left:3px solid ${T.accent}"><div style="font-weight:700;font-size:13px">${esc(e.title)} — ${e.subject}</div><div style="font-size:11px;color:${T.muted};margin-top:4px">📅 ${e.date} · 🕐 ${e.time} · 🚪 ${e.room}</div></div>`).join("")}</div>`)}
  </div>`;}

function renderStudentAtt(s){
  const ma=attendance[s.id]||{},dates=Object.keys(ma).sort();
  const pd=dates.filter(d=>ma[d]==="present").length,ad=dates.filter(d=>ma[d]==="absent").length,ld=dates.filter(d=>ma[d]==="late").length;
  const pct=dates.length?Math.round(pd/dates.length*100):0;
  // Show all available dates sorted — full history
  const dayLabels=dates.map(d=>new Date(d).toLocaleDateString("en",{month:"short",day:"numeric"}));
  const attBarData=dates.map(d=>ma[d]==="present"?100:ma[d]==="late"?50:0);
  scheduleChart(()=>drawBarChart('sAttTrend',dayLabels,[{label:'Attendance',data:attBarData,color:T.accent}],{maxVal:100}),'sAttTrend');
  return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px">
    ${statCard("📊",`${pct}%`,"Overall",pct>=75?T.green:T.red)}${statCard("✅",pd,"Present",T.green)}${statCard("❌",ad,"Absent",T.red)}${statCard("⏰",ld,"Late",T.yellow)}
  </div>
  ${pct<75?`<div style="background:${T.redL};border:1px solid #fca5a5;border-radius:12px;padding:14px 18px;margin-bottom:18px;display:flex;gap:10px;align-items:center"><span style="font-size:20px">⚠️</span><div><strong style="color:${T.red}">Low Attendance Warning!</strong><span style="font-size:13px;color:${T.red};margin-left:6px">Below 75%.</span></div></div>`:""}
  ${card(`${secTitle("Attendance Trend")}<canvas id="sAttTrend" width="600" height="160" style="width:100%;height:160px"></canvas>`,"margin-bottom:16px")}
  ${card(tblHtml(["Date","Day","Status"],[...dates].reverse().map(d=>[`<span style="font-weight:600">${d}</span>`,new Date(d).toLocaleDateString("en-PK",{weekday:"long"}),badge(ma[d])])),"",0)}`;}

function renderStudentGrades(s){
  const studentSubjects=SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||SUBJECT_GROUPS["Computer Science"];
  const mg=grades[s.id]||{},tots=studentSubjects.map(sub=>mg[sub]?.total||0).filter(x=>x>0);
  const avg=tots.length?Math.round(tots.reduce((a,b)=>a+b,0)/tots.length):0;
  const subLabels=studentSubjects.map(sub=>sub.split(" ")[0]);
  const gradeData=studentSubjects.map(sub=>mg[sub]?.total||0);
  scheduleChart(()=>drawBarChart('sGradesChart',subLabels,[{label:'Total Score (/100)',data:gradeData,color:T.accent}],{maxVal:100}));
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:20px">
    ${statCard("📊",avg||"-","Average",gradeColor(avg||0),gradeLabel(avg||0))}${studentSubjects.map(sub=>{const g=mg[sub];return g?statCard("📚",g.total,sub.split(" ")[0],gradeColor(g.total),gradeLabel(g.total)):"";}).join("")}
  </div>
  ${card(`${secTitle("Grade Distribution")}<canvas id="sGradesChart" width="600" height="180" style="width:100%;height:180px"></canvas>`,"margin-bottom:16px")}
  ${card(tblHtml(["Subject","Midterm","Final","Internal","Total","Grade"],studentSubjects.map(sub=>{const g=mg[sub];return [`<span style="font-weight:700">${esc(sub)}</span>`,g?.midterm||"-",g?.final||"-",g?.internal||"-",`<span style="font-weight:800;color:${g?gradeColor(g.total):T.muted}">${g?.total||"-"}</span>`,g?`<span style="background:${alpha(gradeColor(g.total),13)};color:${gradeColor(g.total)};border-radius:20px;padding:3px 12px;font-weight:800;font-size:12px">${gradeLabel(g.total)}</span>`:"-"];})),"",0)}
  <div style="display:flex;gap:12px;margin-top:18px;flex-wrap:wrap">
    <button onclick="downloadStudentGradesPDF('${s.id}')" style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;border:none;border-radius:12px;padding:11px 22px;font-size:13px;font-weight:700;cursor:pointer">📄 Download Grade Sheet PDF</button>
    <button onclick="downloadMarksSheetExcel()" style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:12px;padding:11px 22px;font-size:13px;font-weight:700;cursor:pointer">📊 Download Excel</button>
  </div>`;}

function renderStudentAssignments(s){
  const myA=assignments.filter(a=>a.cls===s.cls);
  const mySubs=submissions.filter(sub=>sub.studentId===s.id);
  return `${secTitle("My Assignments")}
  ${myA.length===0?card(`<div style="text-align:center;padding:48px;color:${T.muted}"><div style="font-size:48px;margin-bottom:12px">📎</div><div style="font-weight:700">No assignments posted yet</div></div>`):
  `<div style="display:grid;gap:14px">${myA.map(a=>{
    const mySub=mySubs.find(sub=>sub.assignmentId===a.id);
    const isOverdue=new Date(a.dueDate)<new Date()&&!mySub;
    return `<div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:20px;box-shadow:${T.shadow};border-left:4px solid ${mySub?mySub.status==="graded"?T.green:T.blue:isOverdue?T.red:T.yellow}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div><div style="font-weight:700;font-size:15px;margin-bottom:4px">${esc(a.title)}</div><div style="font-size:12px;color:${T.muted};margin-bottom:6px">📚 ${a.subject} · 👨‍🏫 ${esc(a.teacherName)} · 📅 Due: <strong style="color:${isOverdue&&!mySub?T.red:T.text}">${a.dueDate}</strong></div>${a.description?`<div style="font-size:13px;color:${T.text2};line-height:1.6;background:${T.bg};border-radius:8px;padding:10px;margin-top:8px">${esc(a.description)}</div>`:""}</div>
        <div style="flex-shrink:0">${mySub?badge(mySub.status):(isOverdue?`<span style="background:${T.redL};color:${T.red};border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700">Overdue</span>`:`<span style="background:${T.yellowL};color:${T.yellow};border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700">Pending</span>`)}</div>
      </div>
      ${mySub?`<div style="background:${T.bg};border-radius:10px;padding:12px;border:1px solid ${T.border}"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div><div style="font-size:13px;font-weight:600">📎 ${esc(mySub.fileName)}</div><div style="font-size:11px;color:${T.muted}">Submitted: ${mySub.submittedAt}</div></div><div style="display:flex;gap:8px;align-items:center">${mySub.status==="graded"?`<div style="text-align:right"><div style="font-size:20px;font-weight:800;color:${gradeColor(mySub.grade||0)}">${mySub.grade}/100</div><div style="font-size:11px;color:${T.muted}">Grade: ${gradeLabel(mySub.grade||0)}</div></div>`:""}${mySub.feedback?`<div style="background:${T.accentL};border-radius:8px;padding:8px 12px;font-size:12px;color:${T.accent};max-width:200px"><strong>Feedback:</strong> ${esc(mySub.feedback)}</div>`:""}</div></div></div>`:
      (!isOverdue?`<label style="cursor:pointer;display:block"><input type="file" style="display:none" onchange="submitAssignment('${a.id}','${s.id}','${esc(s.name)}','${s.cls}',this)"/><span style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer">📤 Submit Assignment</span></label>`:"")}
    </div>`;}).join("")}</div>`}`;}
