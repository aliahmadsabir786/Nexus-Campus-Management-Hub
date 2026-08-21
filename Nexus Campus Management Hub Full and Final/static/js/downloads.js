/* ================================================================
   js/downloads.js  —  NEXus Solution CMS
   ================================================================ */

/* ----------------------------------------------------------------
   Institution lines for printed documents (spec §16).
   Printed output must name the institution it belongs to — a Boys Campus
   voucher must not read like a whole-institution one. These return plain
   text/HTML instead of using CSS variables, because the print window never
   loads styles.css.
     printInstitution() -> "NEXus Solution / Intermediate — Boys Campus"
     printContext()     -> " · Intermediate • Boys Campus"  ("" when unset)
   ---------------------------------------------------------------- */
function printInstitution(){ return esc(contextTitle()); }
function printContext(){ const l=contextLabel(); return l?' &middot; '+esc(l):''; }

function downloadReportPDF(){
  const reportEl=document.getElementById("report-content");
  if(!reportEl){showToast('warning','Open a report first, then download it.');return;}
  const w=window.open("","_blank","width=900,height=700");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Report</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet"/><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',sans-serif;color:#0d2b23;background:#fff;padding:28px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:8px 10px;border:1px solid #d1fae5}th{background:#ecfdf5;font-weight:700;text-align:left}.footer{margin-top:24px;text-align:center;font-size:11px;color:#4b7a66;border-top:1px solid #d1fae5;padding-top:12px}@media print{.no-print{display:none}}</style></head><body>
  <div class="no-print" style="text-align:center;margin-bottom:16px"><button onclick="window.print()" style="background:#059669;color:#fff;border:none;padding:10px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Print / Save as PDF</button></div>
  ${reportEl.innerHTML}
  <div class="footer">${printInstitution()} · Generated: ${new Date().toLocaleString()}</div></body></html>`);
  w.document.close();
}

function downloadReportExcel(){
  var csv="",filename="report.csv";
  var cls=reportFilter.cls||"CS-A";
  var rStudents=cls==="ALL"?students:students.filter(function(s){return s.cls===cls;});
  if(!students||!students.length){showToast('info','Still loading records — try again in a moment.');return;}

  if(reportFilter.type==="attendance"){
    var monthName=reportFilter.month.split(" ")[0];
    var monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"];
    var mNum=String(monthNames.indexOf(monthName)+1).padStart(2,"0");
    var yearNum=reportFilter.month.split(" ")[1]||new Date().getFullYear();
    var monthPrefix=yearNum+"-"+mNum;
    var allDatesSet={};
    rStudents.forEach(function(s){Object.keys(attendance[s.id]||{}).forEach(function(d){allDatesSet[d]=1;});});
    var dates=Object.keys(allDatesSet).filter(function(d){return d.startsWith(monthPrefix);}).sort();
    if(!dates.length)dates=[].concat(weekDays).sort();
    filename="Attendance_"+cls.replace(/\s/g,"_")+"_"+reportFilter.month.replace(" ","_")+".csv";
    csv="Roll#,Student Name,Class,"+dates.map(function(d){return d.slice(5);}).join(",")+",Present,Absent,Late,Total Days,Attendance%,Status\n";
    rStudents.forEach(function(s){
      var myA=attendance[s.id]||{};
      var pres=dates.filter(function(d){return myA[d]==="present";}).length;
      var abs=dates.filter(function(d){return myA[d]==="absent";}).length;
      var late=dates.filter(function(d){return myA[d]==="late";}).length;
      var total=dates.length;
      var pct=total?Math.round((pres+late*0.5)/total*100):0;
      csv+='"'+s.rollNo+'","'+s.name+'","'+s.cls+'",'+
        dates.map(function(d){var st=myA[d]||"";return st==="present"?"P":st==="late"?"L":st==="absent"?"A":"-";}).join(",")+
        ","+pres+","+abs+","+late+","+total+","+pct+'%,"'+(pct>=75?"Regular":"Short")+'"\n';
    });

  } else if(reportFilter.type==="grades"){
    filename="GradeSheet_"+cls.replace(/\s/g,"_")+"_2025-26.csv";
    var allSubsSet={};
    rStudents.forEach(function(s){(SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||[]).forEach(function(sub){allSubsSet[sub]=1;});});
    var allSubs=Object.keys(allSubsSet);
    csv="Roll#,Name,Class,Subject Group,"+allSubs.join(",")+",Total,Average,Grade,Result\n";
    rStudents.forEach(function(s){
      var sg=grades[s.id]||{};
      var mySubs=SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||[];
      var tots=mySubs.map(function(sub){return sg[sub]?sg[sub].total||0:0;});
      var total=tots.reduce(function(a,b){return a+b;},0);
      var avg=tots.length?Math.round(total/tots.length):0;
      var allCols=allSubs.map(function(sub){return mySubs.indexOf(sub)>=0?(sg[sub]?sg[sub].total||0:0):"N/A";});
      csv+='"'+s.rollNo+'","'+s.name+'","'+s.cls+'","'+(s.subjectGroup||"Computer Science")+'",'+
        allCols.join(",")+","+total+","+avg+',"'+gradeLabel(avg)+'","'+(avg>=45?"Pass":"Fail")+'"\n';
    });

  } else if(reportFilter.type==="fees"){
    filename="FeeReport_"+reportFilter.month.replace(" ","_")+".csv";
    csv="Name,ID,Class,Voucher No,Amount,Due Date,Paid Date,Status\n";
    var feeStudents=cls==="ALL"?students:rStudents;
    feeStudents.forEach(function(s){
      var v=(feeVouchers[s.id]||[])[0];
      csv+='"'+s.name+'","'+s.id+'","'+s.cls+'","'+(v&&v.voucherNo?v.voucherNo:"N/A")+'",15000,"'+(v&&v.dueDate?v.dueDate:"N/A")+'","'+(v&&v.paidDate?v.paidDate:"N/A")+'","'+s.feeStatus+'"\n';
    });

  } else if(reportFilter.type==="exams"){
    filename="ExamSchedule_"+cls.replace(/\s/g,"_")+"_2025-26.csv";
    var clsExams=cls==="ALL"?exams:exams.filter(function(e){return e.cls===cls;});
    if(!clsExams||!clsExams.length){showToast('info','No exams scheduled for the selected class.');return;}
    csv="#,Exam,Subject,Class,Date,Time,Duration,Room,Total Marks\n";
    clsExams.forEach(function(e,i){csv+=(i+1)+',"'+e.title+'","'+e.subject+'","'+e.cls+'","'+e.date+'","'+e.time+'","'+e.duration+'","'+e.room+'",'+e.totalMarks+"\n";});

  } else if(reportFilter.type==="performance"){
    filename="ClassPerformance_2025-26.csv";
    csv="Class,Total Students,Passed,Failed,Pass%,Fail%,Avg Score,Avg Attendance%\n";
    contextClassCodes().forEach(function(cl){
      var cs=students.filter(function(s){return s.cls===cl;});
      if(!cs.length)return;
      var results=cs.map(function(s){
        var subs=SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||[];
        var sg=grades[s.id]||{};
        var tots=subs.map(function(sub){return sg[sub]?sg[sub].total||0:0;});
        var avg=tots.length?Math.round(tots.reduce(function(a,b){return a+b;},0)/tots.length):0;
        var myAtt=attendance[s.id]||{};
        var attVals=Object.values(myAtt);
        var pres=attVals.filter(function(v){return v==="present";}).length;
        var attPct=attVals.length?Math.round(pres/attVals.length*100):0;
        return {avg:avg,passed:avg>=45,attPct:attPct};
      });
      var passed=results.filter(function(r){return r.passed;}).length;
      var avgScore=Math.round(results.reduce(function(a,r){return a+r.avg;},0)/results.length);
      var avgAtt=Math.round(results.reduce(function(a,r){return a+r.attPct;},0)/results.length);
      csv+='"'+cl+'",'+cs.length+","+passed+","+(cs.length-passed)+","+Math.round(passed/cs.length*100)+"%,"+Math.round((cs.length-passed)/cs.length*100)+"%,"+avgScore+","+avgAtt+"%\n";
    });
  }

  if(!csv||csv.split("\n").length<=2){showToast('info','Nothing to export for this report yet.');return;}
  var bom="\uFEFF";
  var blob=new Blob([bom+csv],{type:"text/csv;charset=utf-8;"});
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}


function downloadPerformanceReport(){
  const classStats=contextClassCodes().map(cl=>{
    const cs=students.filter(s=>s.cls===cl);
    if(!cs.length)return null;
    const results=cs.map(s=>{
      const subs=SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||[];
      const sg=grades[s.id]||{};
      const tots=subs.map(sub=>sg[sub]?.total||0);
      const avg=tots.length?Math.round(tots.reduce((a,b)=>a+b,0)/tots.length):0;
      const ma=attendance[s.id]||{};
      const attP=weekDays.filter(d=>ma[d]==="present").length;
      const attPct=weekDays.length?Math.round(attP/weekDays.length*100):0;
      return {s,avg,passed:avg>=45,attPct};
    });
    const passed=results.filter(r=>r.passed).length;
    const failed=results.filter(r=>!r.passed).length;
    const passPct=Math.round(passed/cs.length*100);
    const avgScore=Math.round(results.reduce((a,r)=>a+r.avg,0)/results.length);
    const avgAtt=Math.round(results.reduce((a,r)=>a+r.attPct,0)/results.length);
    const gradeDistrib={A:0,B:0,C:0,D:0,F:0};
    results.forEach(r=>{
      const g=gradeLabel(r.avg);
      if(g==="A+"||g==="A")gradeDistrib.A++;
      else if(g==="B+"||g==="B")gradeDistrib.B++;
      else if(g==="C")gradeDistrib.C++;
      else if(g==="D")gradeDistrib.D++;
      else gradeDistrib.F++;
    });
    return {cl,total:cs.length,passed,failed,passPct,failPct:100-passPct,avgScore,avgAtt,gradeDistrib,results};
  }).filter(Boolean);

  const grandTotal=students.length;
  const grandPassed=classStats.reduce((a,c)=>a+c.passed,0);
  const grandFailed=classStats.reduce((a,c)=>a+c.failed,0);
  const grandPassPct=grandTotal?Math.round(grandPassed/grandTotal*100):0;
  const grandAvg=classStats.length?Math.round(classStats.reduce((a,c)=>a+c.avgScore,0)/classStats.length):0;
  const grandAtt=classStats.length?Math.round(classStats.reduce((a,c)=>a+c.avgAtt,0)/classStats.length):0;

  // Build summary rows HTML
  const summaryRows=classStats.map(c=>{
    const gc=c.passPct>=50?"#16a34a":"#dc2626";
    const fc=c.failPct>=50?"#dc2626":"#d97706";
    const ac=c.avgAtt>=75?"#16a34a":"#dc2626";
    const distrib=Object.entries(c.gradeDistrib).map(([g,n])=>{
      const bg=g==="A"?"#dcfce7":g==="B"?"#d1fae5":g==="C"?"#dbeafe":g==="D"?"#fef9c3":"#fee2e2";
      return '<span style="background:'+bg+';border-radius:20px;padding:1px 7px;margin:1px;font-weight:700;display:inline-block">'+g+':'+n+'</span>';
    }).join("");
    return '<tr>'
      +'<td style="padding:10px 14px;border:1px solid #d1fae5;font-weight:800;font-size:14px">'+c.cl+'</td>'
      +'<td style="padding:10px 14px;border:1px solid #d1fae5;text-align:center;font-weight:700">'+c.total+'</td>'
      +'<td style="padding:10px 14px;border:1px solid #d1fae5;text-align:center;font-weight:800;color:#16a34a">'+c.passed+'</td>'
      +'<td style="padding:10px 14px;border:1px solid #d1fae5;text-align:center;font-weight:800;color:#dc2626">'+c.failed+'</td>'
      +'<td style="padding:10px 14px;border:1px solid #d1fae5;text-align:center;font-weight:800;color:'+gc+'">'+c.passPct+'%</td>'
      +'<td style="padding:10px 14px;border:1px solid #d1fae5;text-align:center;font-weight:800;color:'+fc+'">'+c.failPct+'%</td>'
      +'<td style="padding:10px 14px;border:1px solid #d1fae5;text-align:center;font-weight:700;color:#7c3aed">'+c.avgScore+'</td>'
      +'<td style="padding:10px 14px;border:1px solid #d1fae5;text-align:center;font-weight:700;color:'+ac+'">'+c.avgAtt+'%</td>'
      +'<td style="padding:10px 14px;border:1px solid #d1fae5;font-size:11px">'+distrib+'</td>'
      +'</tr>';
  }).join("");

  // Build student rows HTML
  const studentRows=classStats.flatMap((c,ci)=>c.results.map((r,i)=>{
    const gc=gradeColorLit(r.avg);
    const ac=r.attPct>=75?"#16a34a":"#dc2626";
    const rc=r.passed?"#dcfce7":"#fee2e2";
    const rtc=r.passed?"#16a34a":"#dc2626";
    return '<tr style="background:'+(i%2?"#f9fffe":"#fff")+'">'
      +'<td style="padding:8px 12px;border:1px solid #d1fae5;font-weight:600;color:#4b7a66">'+r.s.rollNo+'</td>'
      +'<td style="padding:8px 12px;border:1px solid #d1fae5;font-weight:700">'+r.s.name+'</td>'
      +'<td style="padding:8px 12px;border:1px solid #d1fae5"><span style="background:#d1fae5;color:#047857;border-radius:12px;padding:2px 10px;font-weight:700">'+r.s.cls+'</span></td>'
      +'<td style="padding:8px 12px;border:1px solid #d1fae5;font-size:11px;color:#4b7a66">'+(r.s.subjectGroup||"—")+'</td>'
      +'<td style="padding:8px;text-align:center;border:1px solid #d1fae5;font-weight:800;color:'+gc+'">'+r.avg+'</td>'
      +'<td style="padding:8px;text-align:center;border:1px solid #d1fae5"><span style="background:'+gc+'20;color:'+gc+';border-radius:20px;padding:2px 10px;font-weight:800;font-size:11px">'+gradeLabel(r.avg)+'</span></td>'
      +'<td style="padding:8px;text-align:center;border:1px solid #d1fae5;font-weight:700;color:'+ac+'">'+r.attPct+'%</td>'
      +'<td style="padding:8px;text-align:center;border:1px solid #d1fae5"><span style="background:'+rc+';color:'+rtc+';border-radius:20px;padding:2px 10px;font-weight:800;font-size:11px">'+(r.passed?"Pass":"Fail")+'</span></td>'
      +'</tr>';
  })).join("");

  // Build CSV data
  let csvContent="Class,Total,Passed,Failed,Pass%,Fail%,AvgScore,AvgAttendance%\n";
  classStats.forEach(c=>{csvContent+=c.cl+","+c.total+","+c.passed+","+c.failed+","+c.passPct+"%,"+c.failPct+"%,"+c.avgScore+","+c.avgAtt+"%\n";});
  csvContent+="\nRoll#,Student,Class,Group,AvgScore,Grade,Attendance%,Result\n";
  classStats.forEach(c=>c.results.forEach(r=>{csvContent+='"'+r.s.rollNo+'","'+r.s.name+'","'+r.s.cls+'","'+(r.s.subjectGroup||'')+'",'+r.avg+',"'+gradeLabel(r.avg)+'",'+r.attPct+'%,"'+(r.passed?"Pass":"Fail")+'"\n';}));
  const csvB64=btoa(unescape(encodeURIComponent(csvContent)));

  const gpC=grandPassPct>=50?"#16a34a":"#dc2626";
  const gaC=grandAtt>=75?"#16a34a":"#dc2626";

  const w=window.open("","_blank","width=1050,height=820");
  const html=
    '<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Class Performance Report</title>'
    +'<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet"/>'
    +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Plus Jakarta Sans",sans-serif;color:#0d2b23;background:#fff;padding:32px}'
    +'.hdr{background:linear-gradient(135deg,#064e3b,#059669);color:#fff;border-radius:16px;padding:24px 28px;margin-bottom:28px;text-align:center}'
    +'.logo{font-family:"Space Grotesk",sans-serif;font-size:22px;font-weight:800}'
    +'.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:28px}'
    +'.kpi{border:1px solid #d1fae5;border-radius:12px;padding:16px;text-align:center;border-top-width:3px;border-top-style:solid}'
    +'.kv{font-family:"Space Grotesk",sans-serif;font-size:26px;font-weight:800;line-height:1}'
    +'.kl{font-size:10px;color:#4b7a66;font-weight:700;text-transform:uppercase;margin-top:5px}'
    +'.sec{font-family:"Space Grotesk",sans-serif;font-size:15px;font-weight:800;margin:0 0 12px;padding-bottom:6px;border-bottom:2px solid #d1fae5}'
    +'table{border-collapse:collapse;width:100%;font-size:12px;margin-bottom:24px}'
    +'th{background:#ecfdf5;padding:10px 12px;font-weight:700;text-align:left;border:1px solid #d1fae5;font-size:11px;text-transform:uppercase;letter-spacing:.04em}'
    +'.footer{margin-top:24px;text-align:center;font-size:11px;color:#4b7a66;border-top:1px solid #d1fae5;padding-top:12px}'
    +'@media print{.np{display:none}}'
    +'</style></head><body>'
    +'<div class="np" style="text-align:center;margin-bottom:20px">'
    +'<button onclick="window.print()" style="background:#059669;color:#fff;border:none;padding:11px 30px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Print / Save PDF</button>'
    +'<button onclick="dlCSV()" style="background:#7c3aed;color:#fff;border:none;padding:11px 30px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-left:10px">⬇️ Download CSV</button>'
    +'</div>'
    +'<div class="hdr"><div class="logo">'+printInstitution()+' — Class Performance Report</div>'
    +'<div style="font-size:13px;opacity:.75;margin-top:6px">Academic Year 2025–26 · All Classes · Generated: '+new Date().toLocaleString()+'</div></div>'
    +'<div class="kpis">'
    +'<div class="kpi" style="border-top-color:#059669"><div class="kv" style="color:#059669">'+grandTotal+'</div><div class="kl">Total Students</div></div>'
    +'<div class="kpi" style="border-top-color:#16a34a"><div class="kv" style="color:#16a34a">'+grandPassed+'</div><div class="kl">Total Passed</div></div>'
    +'<div class="kpi" style="border-top-color:#dc2626"><div class="kv" style="color:#dc2626">'+grandFailed+'</div><div class="kl">Total Failed</div></div>'
    +'<div class="kpi" style="border-top-color:'+gpC+'"><div class="kv" style="color:'+gpC+'">'+grandPassPct+'%</div><div class="kl">Overall Pass %</div></div>'
    +'<div class="kpi" style="border-top-color:#7c3aed"><div class="kv" style="color:#7c3aed">'+grandAvg+'</div><div class="kl">Overall Avg Score</div></div>'
    +'<div class="kpi" style="border-top-color:'+gaC+'"><div class="kv" style="color:'+gaC+'">'+grandAtt+'%</div><div class="kl">Avg Attendance</div></div>'
    +'</div>'
    +'<div class="sec">📋 Class-wise Summary</div>'
    +'<table><thead><tr>'
    +'<th>Class</th><th style="text-align:center">Total</th>'
    +'<th style="text-align:center;color:#16a34a">Passed</th>'
    +'<th style="text-align:center;color:#dc2626">Failed</th>'
    +'<th style="text-align:center">Pass %</th><th style="text-align:center">Fail %</th>'
    +'<th style="text-align:center">Avg Score</th><th style="text-align:center">Avg Att.</th>'
    +'<th style="text-align:center">Grade Distribution</th>'
    +'</tr></thead><tbody>'+summaryRows+'</tbody>'
    +'<tfoot><tr style="background:#ecfdf5;font-weight:800">'
    +'<td style="padding:10px 14px;border:1px solid #d1fae5">TOTAL / AVG</td>'
    +'<td style="padding:10px 14px;border:1px solid #d1fae5;text-align:center">'+grandTotal+'</td>'
    +'<td style="padding:10px 14px;border:1px solid #d1fae5;text-align:center;color:#16a34a">'+grandPassed+'</td>'
    +'<td style="padding:10px 14px;border:1px solid #d1fae5;text-align:center;color:#dc2626">'+grandFailed+'</td>'
    +'<td style="padding:10px 14px;border:1px solid #d1fae5;text-align:center;color:'+gpC+'">'+grandPassPct+'%</td>'
    +'<td style="padding:10px 14px;border:1px solid #d1fae5;text-align:center">'+(100-grandPassPct)+'%</td>'
    +'<td style="padding:10px 14px;border:1px solid #d1fae5;text-align:center;color:#7c3aed">'+grandAvg+'</td>'
    +'<td style="padding:10px 14px;border:1px solid #d1fae5;text-align:center;color:'+gaC+'">'+grandAtt+'%</td>'
    +'<td style="padding:10px 14px;border:1px solid #d1fae5"></td>'
    +'</tr></tfoot></table>'
    +'<div class="sec" style="margin-top:20px">👨‍🎓 Student-Level Results</div>'
    +'<table><thead><tr>'
    +'<th>Roll#</th><th>Student</th><th>Class</th><th>Group</th>'
    +'<th style="text-align:center">Avg Score</th><th style="text-align:center">Grade</th>'
    +'<th style="text-align:center">Attendance</th><th style="text-align:center">Result</th>'
    +'</tr></thead><tbody>'+studentRows+'</tbody></table>'
    +'<div class="footer">'+printInstitution()+' · Class Performance Report · Academic Year 2025-26 · '+new Date().toLocaleString()+'</div>'
    +'<script>function dlCSV(){const d=atob("'+csvB64+'");const b=new Blob([d],{type:"text/csv"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download="ClassPerformanceReport_2025-26.csv";a.click();}<'+'/script>'
    +'</body></html>';
  w.document.write(html);
  w.document.close();
}


function downloadStudentGradesPDF(sid){
  const s=students.find(x=>x.id===sid)||students.find(x=>x.id===currentUser?.id);if(!s){showToast('error','That student is not in this institution.');return;}
  const sg=grades[s.id]||{};const subs=SUBJECTS.slice(0,5);
  const rows=subs.map(sub=>{const g=sg[sub]||{midterm:0,final:0,internal:0,total:0};const gl=gradeLabel(g.total);const col=gradeColorLit(g.total);return `<tr><td>${sub}</td><td style="text-align:center">${g.midterm||0}/30</td><td style="text-align:center">${g.internal||0}/20</td><td style="text-align:center">${g.final||0}/50</td><td style="text-align:center;font-weight:800;color:${col}">${g.total||0}/100</td><td style="text-align:center"><span style="background:${col}20;color:${col};border-radius:20px;padding:2px 8px;font-weight:800">${gl}</span></td><td style="text-align:center;color:${g.total>=45?"#16a34a":"#dc2626"};font-weight:700">${g.total>=45?"Pass":"Fail"}</td></tr>`;}).join("");
  const tots=subs.map(sub=>sg[sub]?.total||0);const total=tots.reduce((a,b)=>a+b,0);const avg=tots.length?Math.round(total/tots.length):0;const overallGrade=gradeLabel(avg);const overallCol=gradeColorLit(avg);
  const photoHTML=s.photo?`<img src="${s.photo}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid #d1fae5"/>`:
    `<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#059669,#047857);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff">${(s.name||"?")[0].toUpperCase()}</div>`;
  const w=window.open("","_blank","width=800,height=700");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Grade Sheet - ${s.name}</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet"/><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',sans-serif;color:#0d2b23;background:#fff;padding:32px}.header{background:linear-gradient(135deg,#064e3b,#059669);color:#fff;border-radius:16px;padding:24px 28px;margin-bottom:24px;display:flex;align-items:center;gap:20px}.logo{font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:800}table{border-collapse:collapse;width:100%;font-size:13px;margin-bottom:20px}th{background:#ecfdf5;padding:10px 14px;font-weight:700;text-align:left;border:1px solid #d1fae5}td{padding:10px 14px;border:1px solid #d1fae5}.summary{background:#f0fdf8;border:2px solid #a7f3d0;border-radius:14px;padding:20px;margin-bottom:20px;display:flex;justify-content:space-around;align-items:center;text-align:center}.footer{text-align:center;font-size:11px;color:#4b7a66;border-top:1px solid #d1fae5;padding-top:14px;margin-top:20px}@media print{.no-print{display:none}}</style></head><body>
  <div class="no-print" style="text-align:center;margin-bottom:16px"><button onclick="window.print()" style="background:#059669;color:#fff;border:none;padding:10px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Print / Save PDF</button></div>
  <div class="header"><div style="text-align:center">${photoHTML}</div><div style="flex:1"><div class="logo">${printInstitution()} · Grade Sheet</div><div style="font-size:13px;opacity:.75;margin-top:4px">Academic Year 2025–26</div><div style="margin-top:12px;display:grid;grid-template-columns:repeat(3,auto);gap:12px 24px;font-size:12px"><div><div style="opacity:.6">Student</div><div style="font-weight:700">${s.name}</div></div><div><div style="opacity:.6">ID</div><div style="font-weight:700">${s.id}</div></div><div><div style="opacity:.6">Class</div><div style="font-weight:700">${s.cls}</div></div></div></div></div>
  <table><thead><tr><th>Subject</th><th style="text-align:center">Mid/30</th><th style="text-align:center">Int/20</th><th style="text-align:center">Final/50</th><th style="text-align:center">Total/100</th><th style="text-align:center">Grade</th><th style="text-align:center">Result</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="summary"><div><div style="font-size:11px;color:#4b7a66;font-weight:700;text-transform:uppercase">Total</div><div style="font-size:28px;font-weight:800;color:#059669;font-family:'Space Grotesk',sans-serif">${total}/${subs.length*100}</div></div><div><div style="font-size:11px;color:#4b7a66;font-weight:700;text-transform:uppercase">Average</div><div style="font-size:28px;font-weight:800;color:${overallCol};font-family:'Space Grotesk',sans-serif">${avg}%</div></div><div><div style="font-size:11px;color:#4b7a66;font-weight:700;text-transform:uppercase">Grade</div><div style="font-size:28px;font-weight:800;color:${overallCol};font-family:'Space Grotesk',sans-serif">${overallGrade}</div></div><div><div style="font-size:11px;color:#4b7a66;font-weight:700;text-transform:uppercase">Result</div><div style="font-size:28px;font-weight:800;color:${avg>=45?"#16a34a":"#dc2626"};font-family:'Space Grotesk',sans-serif">${avg>=45?"PASS":"FAIL"}</div></div></div>
  <div class="footer">${printInstitution()} · Generated: ${new Date().toLocaleString()}</div></body></html>`);
  w.document.close();
}

function downloadMarksSheetExcel(){
  const sid=currentUser?.role==="student"?currentUser.id:null;
  const targetStudents=sid?[students.find(x=>x.id===sid)].filter(Boolean):students;
  const subs=SUBJECTS.slice(0,5);
  let csv="ID,Name,Class,Roll#,"+subs.map(s=>s+" Mid,"+s+" Int,"+s+" Final,"+s+" Total").join(",")+",Grand Total,Avg,Grade,Result\n";
  targetStudents.forEach(s=>{const sg=grades[s.id]||{};const subData=subs.map(sub=>{const g=sg[sub]||{};return `${g.midterm||0},${g.internal||0},${g.final||0},${g.total||0}`;}).join(",");const tots=subs.map(sub=>sg[sub]?.total||0);const total=tots.reduce((a,b)=>a+b,0);const avg=tots.length?Math.round(total/tots.length):0;csv+=`"${s.id}","${s.name}","${s.cls}","${s.rollNo}",${subData},${total},${avg}%,"${gradeLabel(avg)}","${avg>=45?"Pass":"Fail"}"
`;});
  const fname=sid?`MarksSheet_${sid}_2025-26.csv`:"MarksSheet_All_2025-26.csv";
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=fname;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

function downloadFeeReceipt(sid){
  const s=students.find(x=>x.id===sid)||students.find(x=>x.id===currentUser?.id);if(!s){showToast('error','That student is not in this institution.');return;}
  const vouchers=feeVouchers[s.id]||[];
  const photoHTML=s.photo?`<img src="${s.photo}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid #d1fae5"/>`:
    `<div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#059669,#047857);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff">${(s.name||"?")[0].toUpperCase()}</div>`;
  const voucherRows=vouchers.map((v,i)=>{const col={paid:"#16a34a",pending:"#d97706",overdue:"#dc2626"}[v.status]||"#4b7a66";return `<tr><td>${i+1}</td><td>${v.voucherNo||"—"}</td><td>${v.month}</td><td style="text-align:center;font-weight:700">PKR ${(v.amount||15000).toLocaleString()}</td><td style="text-align:center">${v.dueDate||"—"}</td><td style="text-align:center;color:${col};font-weight:600">${v.paidDate||"—"}</td><td style="text-align:center"><span style="background:${col}20;color:${col};border-radius:20px;padding:2px 10px;font-weight:700;font-size:11px;text-transform:capitalize">${v.status}</span></td></tr>`;}).join("");
  const w=window.open("","_blank","width=800,height=600");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Fee Receipt - ${s.name}</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet"/><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',sans-serif;color:#0d2b23;background:#fff;padding:32px}.header{background:linear-gradient(135deg,#064e3b,#059669);color:#fff;border-radius:16px;padding:24px;margin-bottom:24px;display:flex;align-items:center;gap:20px}table{border-collapse:collapse;width:100%;font-size:13px}th{background:#ecfdf5;padding:10px 14px;font-weight:700;border:1px solid #d1fae5;text-align:left}td{padding:10px 14px;border:1px solid #d1fae5}.footer{text-align:center;font-size:11px;color:#4b7a66;border-top:1px solid #d1fae5;padding-top:12px;margin-top:24px}@media print{.no-print{display:none}}</style></head><body>
  <div class="no-print" style="text-align:center;margin-bottom:16px"><button onclick="window.print()" style="background:#059669;color:#fff;border:none;padding:10px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Print / Save PDF</button></div>
  <div class="header"><div>${photoHTML}</div><div style="flex:1"><div style="font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:800">${printInstitution()} · Fee Record</div><div style="opacity:.75;font-size:12px;margin-top:4px">Academic Year 2025–26</div><div style="margin-top:12px;display:flex;gap:24px;font-size:12px"><div><span style="opacity:.65">Name: </span><strong>${s.name}</strong></div><div><span style="opacity:.65">ID: </span><strong>${s.id}</strong></div><div><span style="opacity:.65">Class: </span><strong>${s.cls}</strong></div></div></div></div>
  <table><thead><tr><th>#</th><th>Voucher No</th><th>Month</th><th style="text-align:center">Amount</th><th style="text-align:center">Due Date</th><th style="text-align:center">Paid Date</th><th style="text-align:center">Status</th></tr></thead><tbody>${voucherRows||`<tr><td colspan="7" style="text-align:center;padding:20px;color:#4b7a66">No fee records</td></tr>`}</tbody></table>
  <div class="footer">${printInstitution()} · Generated: ${new Date().toLocaleString()}</div></body></html>`);
  w.document.close();
}


// ═══════════════════════════════════════════════
// FEE INSTALLMENT MODULE
// ═══════════════════════════════════════════════

function feeInstallPreview(tf){
  const total=Number(tf)||0;
  if(!total)return "Enter a valid amount";
  const each=Math.floor(total/3),last=total-(each*2);
  return `<div style="display:flex;gap:10px;justify-content:center">${[each,each,last].map((a,i)=>`<div style="background:#fff;border:1px solid ${T.border};border-radius:8px;padding:8px 14px;text-align:center"><div style="font-size:10px;color:${T.muted};font-weight:700">INST ${i+1}</div><div style="font-size:14px;font-weight:800;color:${T.accent}">PKR ${a.toLocaleString()}</div></div>`).join("")}</div>`;
}

function openCreateFeePlan(sid){
  formData={_sid:sid,totalFee:"",session:"2025-26",due1:"",due2:"",due3:""};
  modalState="createFeePlan";render();
}
function openEditFeePlan(sid){
  const plan=feeInstallments[sid];if(!plan)return;
  formData={_sid:sid,totalFee:String(plan.totalFee),session:plan.session||"2025-26",due1:plan.installments[0]?.dueDate||"",due2:plan.installments[1]?.dueDate||"",due3:plan.installments[2]?.dueDate||""};
  modalState="editFeePlan";render();
}
function submitCreateFeePlan(sid){
  const tf=Number(document.getElementById("f-totalFee")?.value||formData.totalFee||0);
  const sess=(document.getElementById("f-session")?.value||formData.session||"2025-26").trim();
  const d1=(document.getElementById("f-due1")?.value||formData.due1||"").trim();
  const d2=(document.getElementById("f-due2")?.value||formData.due2||"").trim();
  const d3=(document.getElementById("f-due3")?.value||formData.due3||"").trim();
  if(!tf||tf<1){showToast('warning','Enter a valid total fee.');return;}
  if(!d1||!d2||!d3){showToast('warning','Fill all three due dates.');return;}
  const each=Math.floor(tf/3),last=tf-(each*2);
  feeInstallments[sid]={totalFee:tf,session:sess,installments:[
    {no:1,amount:each,dueDate:d1,status:"pending",voucherNo:`VCH-${sid}-1`,paidDate:null,receiptNo:null},
    {no:2,amount:each,dueDate:d2,status:"pending",voucherNo:`VCH-${sid}-2`,paidDate:null,receiptNo:null},
    {no:3,amount:last,dueDate:d3,status:"pending",voucherNo:`VCH-${sid}-3`,paidDate:null,receiptNo:null},
  ]};
  const s=students.find(x=>x.id===sid);if(s)s.feeStatus="pending";
  closeModal();refreshContent();
  showToast('success','Fee plan created — 3 installment vouchers are ready to print.');
}
async function submitEditFeePlan(sid){
  const plan=feeInstallments[sid];if(!plan)return;
  const tf=Number(document.getElementById('f-totalFee')?.value||formData.totalFee||0);
  const sess=(document.getElementById('f-session')?.value||formData.session||'2025-26').trim();
  const d1=(document.getElementById('f-due1')?.value||formData.due1||'').trim();
  const d2=(document.getElementById('f-due2')?.value||formData.due2||'').trim();
  const d3=(document.getElementById('f-due3')?.value||formData.due3||'').trim();
  if(!tf||tf<1){showToast('warning','Enter a valid total fee.');return;}
  if(!d1||!d2||!d3){showToast('warning','Fill all three due dates.');return;}
  const each=Math.floor(tf/3),last=tf-(each*2);
  // Update local state
  plan.totalFee=tf;plan.session=sess;
  plan.installments[0].amount=each;plan.installments[0].dueDate=d1;
  plan.installments[1].amount=each;plan.installments[1].dueDate=d2;
  plan.installments[2].amount=last;plan.installments[2].dueDate=d3;
  // Sync to backend (recreate plan)
  try {
    await fetch(`/api/fees/${sid}/plan`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({totalFee:tf,session:sess,due1:d1,due2:d2,due3:d3})});
  } catch(e){console.error('Edit plan error:',e);}
  closeModal();refreshContent();
  showToast('success','Fee plan updated.');
  await loadAllDataFromDB();
}
async function removeFeePlan(sid){
  if(!await confirmAction({
    title:'Remove fee plan',
    message:'Remove this fee plan?',
    note:'The installment schedule and its vouchers are discarded. This cannot be undone.',
    confirmLabel:'Remove plan',
  }))return;
  delete feeInstallments[sid];
  const s=students.find(x=>x.id===sid);if(s)s.feeStatus="pending";
  refreshContent();
  showToast('success','Fee plan removed.');
}
function markInstallmentPaid(sid,no){
  const plan=feeInstallments[sid];if(!plan)return;
  const inst=plan.installments.find(i=>i.no===no);if(!inst)return;
  inst.status="paid";inst.paidDate=today;
  inst.receiptNo="RCP-"+sid+"-"+no+"-"+Date.now().toString().slice(-4);
  _updateStudentFeeStatus(sid);refreshContent();
  setTimeout(()=>printInstallmentReceipt(sid,no),300);
}
async function setInstallmentOverdue(sid,no){
  const plan=feeInstallments[sid];if(!plan)return;
  const inst=plan.installments.find(i=>i.no===no);if(!inst)return;
  inst.status='overdue';_updateStudentFeeStatus(sid);refreshContent();
  try {
    await fetch(`/api/fees/${sid}/installment/${no}/revert`,{method:'POST'});
    // Mark as overdue by reverting then setting status (backend doesn't have separate overdue endpoint)
  } catch(e){console.error('Overdue error:',e);}
}
async function revertInstallmentPaid(sid,no){
  if(!await confirmAction({
    title:'Revert installment',
    tone:'warning',
    icon:'↺',
    message:`Mark installment ${no} as pending again?`,
    note:'The payment date and receipt number are cleared.',
    confirmLabel:'Revert to pending',
  }))return;
  const plan=feeInstallments[sid];if(!plan)return;
  const inst=plan.installments.find(i=>i.no===no);if(!inst)return;
  inst.status="pending";inst.paidDate=null;inst.receiptNo=null;
  _updateStudentFeeStatus(sid);refreshContent();
  showToast('success',`Installment ${no} reverted to pending.`);
}
function _updateStudentFeeStatus(sid){
  const s=students.find(x=>x.id===sid);if(!s)return;
  const plan=feeInstallments[sid];if(!plan)return;
  const all=plan.installments||[];
  const pc=all.filter(i=>i.status==="paid").length;
  s.feeStatus=pc===3?"paid":pc>0?"partial":all.some(i=>i.status==="overdue")?"overdue":"pending";
}

function printFeeVoucher(sid,no){
  const plan=feeInstallments[sid];
  const inst=plan&&plan.installments&&plan.installments.find(function(i){return i.no===no;});
  const s=students.find(function(x){return x.id===sid;});
  if(!inst||!s){showToast('error','That voucher is not available.');return;}
  const pHTML=s.photo?'<img src="'+s.photo+'" style="width:66px;height:66px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.4)"/>'
    :'<div style="width:66px;height:66px;border-radius:50%;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#fff">'+(s.name||"?")[0].toUpperCase()+'</div>';
  const bars=Array.from({length:32},function(){return '<div style="background:#fff;border-radius:2px;width:3px;height:'+Math.floor(Math.random()*26+14)+'px"></div>';}).join("");
  const iCol=inst.status==="paid"?"#16a34a":inst.status==="overdue"?"#dc2626":"#d97706";
  const w=window.open("","_blank","width=700,height=640");
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Fee Voucher - '+s.name+'</title>'
  +'<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet"/>'
  +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Plus Jakarta Sans",sans-serif;background:#f0fdf8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}'
  +'.v{background:#fff;border-radius:20px;max-width:580px;width:100%;overflow:hidden;box-shadow:0 12px 40px rgba(5,150,105,.18)}'
  +'.vh{background:linear-gradient(135deg,#064e3b,#059669);padding:24px 28px;display:flex;align-items:center;gap:16px}'
  +'.vb{padding:24px 28px}'
  +'.g2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}'
  +'.c{background:#f0fdf8;border:1px solid #d1fae5;border-radius:10px;padding:10px 14px}'
  +'.cl{font-size:9px;color:#4b7a66;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}'
  +'.cv{font-size:13px;font-weight:700;color:#0d2b23}'
  +'@media print{.np{display:none}}</style></head><body>'
  +'<div class="v">'
  +'<div class="vh">'
  +'<div style="width:48px;height:48px;background:rgba(255,255,255,.15);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">&#127891;</div>'
  +'<div style="flex:1"><div style="font-family:\'Space Grotesk\',sans-serif;font-size:19px;font-weight:800;color:#fff">'+esc(appContext.institution)+'</div>'
  +'<div style="font-size:11px;color:rgba(255,255,255,.6)">Fee Payment Voucher &middot; '+plan.session+printContext()+'</div>'
  +'<div style="margin-top:8px;background:rgba(255,255,255,.15);border-radius:8px;padding:4px 12px;display:inline-block;font-size:11px;font-weight:700;color:#fff">INSTALLMENT '+inst.no+' OF 3</div></div>'
  +pHTML+'</div>'
  +'<div class="vb">'
  +'<div class="np" style="text-align:center;margin-bottom:16px"><button onclick="window.print()" style="background:#059669;color:#fff;border:none;padding:10px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">&#128424;&#65039; Print Voucher</button></div>'
  +'<div class="g2">'
  +'<div class="c"><div class="cl">Voucher No</div><div class="cv" style="color:#059669;font-family:\'Space Grotesk\',sans-serif">'+inst.voucherNo+'</div></div>'
  +'<div class="c"><div class="cl">Status</div><div class="cv" style="color:'+iCol+';text-transform:capitalize">'+inst.status+'</div></div>'
  +'<div class="c"><div class="cl">Student Name</div><div class="cv">'+s.name+'</div></div>'
  +'<div class="c"><div class="cl">Student ID</div><div class="cv">'+s.id+'</div></div>'
  +'<div class="c"><div class="cl">Class</div><div class="cv">'+s.cls+'</div></div>'
  +'<div class="c"><div class="cl">Due Date</div><div class="cv" style="color:#dc2626">'+inst.dueDate+'</div></div>'
  +'</div>'
  +'<div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:2px solid #a7f3d0;border-radius:14px;padding:18px;text-align:center;margin-bottom:16px">'
  +'<div style="font-size:10px;color:#4b7a66;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Amount Due</div>'
  +'<div style="font-size:36px;font-weight:800;color:#059669;font-family:\'Space Grotesk\',sans-serif">PKR '+inst.amount.toLocaleString()+'</div>'
  +'<div style="font-size:11px;color:#4b7a66;margin-top:4px">Total Fee: PKR '+plan.totalFee.toLocaleString()+' &middot; Installment '+inst.no+'/3</div>'
  +'</div>'
  +'<div style="background:#064e3b;border-radius:8px;padding:10px 14px;display:flex;gap:2px;align-items:flex-end;height:52px">'+bars+'</div>'
  +'<div style="text-align:center;font-size:9px;color:#4b7a66;margin:6px 0 12px;letter-spacing:.1em">'+inst.voucherNo+' &middot; '+printInstitution()+'</div>'
  +'<div style="text-align:center;font-size:10px;color:#4b7a66;border-top:1px solid #d1fae5;padding-top:10px">Please pay by <strong>'+inst.dueDate+'</strong> to avoid overdue charges &middot; Generated: '+new Date().toLocaleString()+'</div>'
  +'</div></div>'
  +'</body></html>');
  w.document.close();
}

function printInstallmentReceipt(sid,no){
  const plan=feeInstallments[sid];
  const inst=plan&&plan.installments&&plan.installments.find(function(i){return i.no===no;});
  const s=students.find(function(x){return x.id===sid;});
  if(!inst||!s||inst.status!=="paid"){showToast('info','A receipt is only available once the installment is paid.');return;}
  const allPaid=plan.installments.every(function(i){return i.status==="paid";});
  const paidCount=plan.installments.filter(function(i){return i.status==="paid";}).length;
  const pHTML=s.photo?'<img src="'+s.photo+'" style="width:54px;height:54px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.4)"/>'
    :'<div style="width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff">'+(s.name||"?")[0].toUpperCase()+'</div>';
  const instRows=plan.installments.map(function(i){
    const ic=i.status==="paid"?"#16a34a":i.status==="overdue"?"#dc2626":"#d97706";
    const bg=i.no===no?"#ecfdf5":i.status==="paid"?"#f0fdf8":"#fff";
    const bord=i.no===no?"2px solid #059669":"1px solid #e5e7eb";
    return '<div style="display:grid;grid-template-columns:24px 1fr auto auto;gap:10px;align-items:center;padding:8px 12px;border-radius:10px;margin-bottom:5px;font-size:11px;background:'+bg+';border:'+bord+'">'
      +'<span style="font-weight:800;color:#4b7a66">'+i.no+'</span>'
      +'<span style="font-weight:700">'+i.voucherNo+'</span>'
      +'<span style="font-weight:800;color:#059669">PKR '+i.amount.toLocaleString()+'</span>'
      +'<span style="background:'+ic+'15;color:'+ic+';border-radius:20px;padding:2px 8px;font-size:9px;font-weight:700;text-transform:capitalize">'+i.status+'</span>'
      +'</div>';
  }).join("");
  const w=window.open("","_blank","width=680,height=660");
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Receipt - '+s.name+'</title>'
  +'<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet"/>'
  +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Plus Jakarta Sans",sans-serif;background:#f0fdf8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}'
  +'.r{background:#fff;border-radius:20px;max-width:530px;width:100%;overflow:hidden;box-shadow:0 12px 40px rgba(5,150,105,.18)}'
  +'.rh{background:linear-gradient(135deg,#064e3b,#059669);padding:20px 24px;display:flex;align-items:center;gap:14px}'
  +'.rb{padding:20px 24px}'
  +'.dr{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0fdf8;font-size:13px}'
  +'@media print{.np{display:none}}</style></head><body>'
  +'<div class="r">'
  +'<div class="rh">'
  +'<div style="width:40px;height:40px;background:rgba(255,255,255,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">&#127891;</div>'
  +'<div style="flex:1"><div style="font-family:\'Space Grotesk\',sans-serif;font-size:17px;font-weight:800;color:#fff">NEXus Solution</div><div style="font-size:10px;color:rgba(255,255,255,.6)">Fee Payment Receipt &middot; '+plan.session+printContext()+'</div></div>'
  +pHTML+'</div>'
  +'<div class="rb">'
  +'<div class="np" style="text-align:center;margin-bottom:12px"><button onclick="window.print()" style="background:#059669;color:#fff;border:none;padding:9px 26px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">&#128424;&#65039; Print Receipt</button></div>'
  +(allPaid?'<div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:2px solid #a7f3d0;border-radius:12px;padding:10px 14px;text-align:center;margin-bottom:12px"><div style="font-size:14px">&#127881;</div><div style="font-size:14px;font-weight:800;color:#059669;font-family:\'Space Grotesk\',sans-serif">ALL INSTALLMENTS PAID &mdash; FEE CLEARED</div></div>':"")
  +'<div style="background:#f0fdf8;border-radius:12px;padding:12px 14px;margin-bottom:12px">'
  +'<div class="dr"><span style="color:#4b7a66;font-weight:600">Student</span><span style="font-weight:700">'+s.name+'</span></div>'
  +'<div class="dr"><span style="color:#4b7a66;font-weight:600">ID / Class</span><span style="font-weight:700">'+s.id+' &middot; '+s.cls+'</span></div>'
  +'<div class="dr"><span style="color:#4b7a66;font-weight:600">Receipt No</span><span style="font-weight:700;color:#059669">'+inst.receiptNo+'</span></div>'
  +'<div class="dr"><span style="color:#4b7a66;font-weight:600">Voucher No</span><span style="font-weight:700">'+inst.voucherNo+'</span></div>'
  +'<div class="dr"><span style="color:#4b7a66;font-weight:600">Installment</span><span style="font-weight:700">'+inst.no+' of 3</span></div>'
  +'<div class="dr"><span style="color:#4b7a66;font-weight:600">Paid Date</span><span style="font-weight:700">'+inst.paidDate+'</span></div>'
  +'<div class="dr" style="border-bottom:none"><span style="color:#4b7a66;font-weight:600">Amount Paid</span><span style="font-size:15px;font-weight:800;color:#059669;font-family:\'Space Grotesk\',sans-serif">PKR '+inst.amount.toLocaleString()+'</span></div>'
  +'</div>'
  +'<div style="font-size:10px;color:#4b7a66;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Installment Summary</div>'
  +instRows
  +'<div style="background:#ecfdf5;border-radius:10px;padding:9px 12px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;gap:10px">'
  +'<span style="font-size:10px;font-weight:700;color:#4b7a66">'+paidCount+'/3 Paid</span>'
  +'<div style="flex:1;background:#d1fae5;border-radius:99px;height:7px;overflow:hidden"><div style="width:'+Math.round(paidCount/3*100)+'%;height:100%;background:#059669;border-radius:99px"></div></div>'
  +'<span style="font-weight:800;color:#059669;font-size:12px">'+Math.round(paidCount/3*100)+'%</span>'
  +'</div>'
  +'<div style="text-align:center;font-size:9px;color:#4b7a66;margin-top:10px;padding-top:8px;border-top:1px solid #d1fae5">Computer generated receipt &middot; '+printInstitution()+' &middot; '+new Date().toLocaleString()+'</div>'
  +'</div></div>'
  +'</body></html>');
  w.document.close();
}

// ================================================================
// API BRIDGE — Database se connect karne wale functions
// Yeh functions existing JS array functions ko override karte hain
// aur Flask backend se real data fetch/save karte hain
// ================================================================

// ── Startup: DB se data load karo ──
