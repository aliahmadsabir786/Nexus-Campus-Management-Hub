/* ================================================================
   NEXus Solution — College Management System
   app.js  |  All application logic, state, and render functions
   ================================================================

   TABLE OF CONTENTS
   -----------------
    1.  THEME             Design token object (colours, shadow)
    2.  DATA              Students, teachers, exams, notices, etc.
    3.  STATE             Reactive variables (currentUser, page, filters…)
    4.  HELPERS           Utility functions: esc, badge, btn, card, ava…
    5.  CHART UTILITIES   drawBarChart, drawLineChart, scheduleChart
    6.  RENDER ENGINE     render(), refreshContent()
    7.  LOGIN             renderLogin(), doLogin(), switchLoginRole()
    8.  PERMISSION CHECK  canAccess() for sub-admin gates
    9.  SHELL             renderShell(), getNav()
   10.  ADMIN PAGES       renderAdminPage() + all sub-pages
   11.  ADMIN DASH        renderAdminDash()
   12.  STUDENTS PAGE     renderAdminStudents(), student CRUD
   13.  TEACHERS PAGE     renderAdminTeachers(), teacher CRUD
   14.  ATTENDANCE        renderAttPage(), mark/bulk attendance
   15.  EXAMS             renderAdminExams(), add/delete exams
   16.  GRADES            renderGrades(), teacher grade entry
   17.  FEES              renderAdminFees(), installments, vouchers
   18.  ASSIGNMENTS       renderAdminAssignments(), create/grade
   19.  TIMETABLE         renderAdminTT(), upload timetables
   20.  NOTICES           renderAdminNotices(), post/delete
   21.  COMPLAINTS        renderAdminComplaints()
   22.  REPORTS           renderReports(), generateReport()
   23.  PORTALS           renderAdminPortals(), portal access toggle
   24.  SUB-ADMINS        renderSubAdmins(), add/edit/delete
   25.  SETTINGS          renderAdminSettings(), admin password
   26.  TEACHER PAGES     renderTeacherPage() + all sub-pages
   27.  STUDENT PAGES     renderStudentPage() + all sub-pages
   28.  MODALS            renderModal() — all modal dialogs
   29.  ACTIONS           Event handlers: navTo, doLogout, CRUD ops
   30.  PDF / EXCEL       Download helpers for reports & vouchers
   ================================================================ */

// ================================================================
// SECTION 1 — THEME
// ----------------------------------------------------------------
// A single object (T) holding every colour used in the app.
// Render functions reference T.accent, T.red, etc. so you can
// re-theme the whole app by changing values here.
// ================================================================
const T={
  bg:'#f0fdf8',bg2:'#ecfdf5',surface:'#ffffff',
  border:'#d1fae5',border2:'#a7f3d0',
  text:'#0d2b23',text2:'#134e38',muted:'#4b7a66',
  accent:'#059669',accentL:'#d1fae5',accentD:'#047857',
  sidebar:'#064e3b',sidebarText:'#a7f3d0',
  green:'#16a34a',greenL:'#dcfce7',
  red:'#dc2626',redL:'#fee2e2',
  yellow:'#d97706',yellowL:'#fef9c3',
  orange:'#ea580c',orangeL:'#fff7ed',
  blue:'#2563eb',blueL:'#dbeafe',
  purple:'#7c3aed',purpleL:'#ede9fe',
  shadow:'0 1px 4px rgba(5,150,105,.08),0 1px 2px rgba(0,0,0,.04)',
};

// ================================================================
// SECTION 2 — DATA
// ----------------------------------------------------------------
// Seed data arrays for students, teachers, exams, notices,
// complaints, fee vouchers, and assignments.
// In a real app these would come from a database / REST API.
// ================================================================
let students=[
  {id:"S001",name:"Ayesha Khan",     cls:"CS-A", rollNo:"01",phone:"03001234567",guardianPhone:"03009876543",email:"ayesha@cms.edu", feeStatus:"paid",   dob:"2003-04-12",password:"1234",portal:"active",subjectGroup:"Computer Science"},
  {id:"S002",name:"Hassan Raza",     cls:"CS-A", rollNo:"02",phone:"03119876543",guardianPhone:"03118765432",email:"hassan@cms.edu", feeStatus:"pending",dob:"2003-07-22",password:"1234",portal:"active",subjectGroup:"Computer Science"},
  {id:"S003",name:"Zara Ahmed",      cls:"CS-B", rollNo:"01",phone:"03335551234",guardianPhone:"03334441234",email:"zara@cms.edu",   feeStatus:"paid",   dob:"2004-01-09",password:"1234",portal:"active",subjectGroup:"Medical"},
  {id:"S004",name:"Ali Hamza",       cls:"CS-B", rollNo:"02",phone:"03217774321",guardianPhone:"03216664321",email:"ali@cms.edu",    feeStatus:"paid",   dob:"2003-11-30",password:"1234",portal:"active",subjectGroup:"Non-Medical"},
  {id:"S005",name:"Sara Malik",      cls:"BBA-A",rollNo:"01",phone:"03452223344",guardianPhone:"03453334455",email:"sara@cms.edu",   feeStatus:"overdue",dob:"2004-03-15",password:"1234",portal:"active",subjectGroup:"Business"},
  {id:"S006",name:"Usman Tariq",     cls:"BBA-A",rollNo:"02",phone:"03128889900",guardianPhone:"03127779900",email:"usman@cms.edu",  feeStatus:"paid",   dob:"2003-08-05",password:"1234",portal:"active",subjectGroup:"Business"},
  {id:"S007",name:"Hina Butt",       cls:"BBA-B",rollNo:"01",phone:"03231112233",guardianPhone:"03232223344",email:"hina@cms.edu",   feeStatus:"pending",dob:"2004-06-18",password:"1234",portal:"active",subjectGroup:"Medical"},
  {id:"S008",name:"Farhan Siddiqui", cls:"CS-A", rollNo:"03",phone:"03014445566",guardianPhone:"03015556677",email:"farhan@cms.edu", feeStatus:"paid",   dob:"2003-12-01",password:"1234",portal:"active",subjectGroup:"Computer Science"},
  {id:"S009",name:"Bilal Ahmed",     cls:"CS-B", rollNo:"03",phone:"03321112233",guardianPhone:"03322223344",email:"bilal@cms.edu",  feeStatus:"paid",   dob:"2004-02-10",password:"1234",portal:"active",subjectGroup:"Computer Science"},
];
let teachers=[
  {id:"T001",name:"Dr. Khalid Mehmood", subject:"Data Structures",   dept:"Computer Science",phone:"03001111111",email:"khalid@cms.edu",joinDate:"2015-03-01",qualification:"PhD CS",     password:"teach1",portal:"active"},
  {id:"T002",name:"Prof. Amina Syed",   subject:"Calculus",          dept:"Mathematics",     phone:"03112222222",email:"amina@cms.edu", joinDate:"2018-08-15",qualification:"MPhil Math", password:"teach2",portal:"active"},
  {id:"T003",name:"Mr. Tariq Javed",    subject:"English Literature",dept:"English",         phone:"03333333333",email:"tariq@cms.edu", joinDate:"2020-01-10",qualification:"MA English", password:"teach3",portal:"active"},
  {id:"T004",name:"Ms. Rabia Nawaz",    subject:"Microeconomics",    dept:"Business Admin",  phone:"03214444444",email:"rabia@cms.edu", joinDate:"2019-06-20",qualification:"MBA",        password:"teach4",portal:"active"},
  {id:"T005",name:"Dr. Imran Sheikh",   subject:"Physics",           dept:"Sciences",        phone:"03455555555",email:"imran@cms.edu", joinDate:"2012-09-01",qualification:"PhD Physics",password:"teach5",portal:"active"},
];
// CLASSES is now dynamically loaded from the database via /api/classes/dropdown.
// It is kept as a mutable let so that loadAllDataFromDB() can update it after login.
// Fallback values are only used before the first successful DB fetch.
let CLASSES=["CS-A","CS-B","BBA-A","BBA-B"];   // legacy cls-string list (for backward compat)
let dbClasses=[];   // [{id, name, code}] — from /api/classes/dropdown
let dbSections=[];  // [{id, name, classId, className}] — from /api/sections/dropdown
const SUBJECTS=["English","Urdu","Islamiyat","Biology","Physics","Chemistry","Mathematics","Computer Science","Data Structures","Calculus","Statistics","OOP"];
// Subject groups — each maps to the subjects a student in that program takes
const SUBJECT_GROUPS={
  "Medical":          ["English","Urdu","Islamiyat","Biology","Physics","Chemistry"],
  "Non-Medical":      ["English","Urdu","Islamiyat","Mathematics","Physics","Chemistry"],
  "Computer Science": ["English","Urdu","Islamiyat","Mathematics","Physics","Computer Science","Data Structures","OOP","Statistics"],
  "General Science":  ["English","Urdu","Islamiyat","Biology","Mathematics","Chemistry","Statistics"],
  "Business":         ["English","Urdu","Islamiyat","Mathematics","Microeconomics","Statistics","Calculus"],
};
// Master subject → which groups study it (for teacher attendance matching)
const SUBJECT_TO_GROUPS={
  "English":           ["Medical","Non-Medical","Computer Science","General Science","Business"],
  "Urdu":              ["Medical","Non-Medical","Computer Science","General Science","Business"],
  "Islamiyat":         ["Medical","Non-Medical","Computer Science","General Science","Business"],
  "Biology":           ["Medical","General Science"],
  "Physics":           ["Medical","Non-Medical","Computer Science"],
  "Chemistry":         ["Medical","Non-Medical","General Science"],
  "Mathematics":       ["Non-Medical","Computer Science","General Science","Business"],
  "Computer Science":  ["Computer Science"],
  "Data Structures":   ["Computer Science"],
  "OOP":               ["Computer Science"],
  "Statistics":        ["Computer Science","General Science","Business"],
  "Calculus":          ["Non-Medical","Computer Science","Business"],
  "Microeconomics":    ["Business"],
  "English Literature":["Medical","Non-Medical","Computer Science","General Science","Business"],
};
// All subject group names for dropdowns
const ALL_GROUPS=["Medical","Non-Medical","Computer Science","General Science"];
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const today=new Date().toISOString().split("T")[0];
const curMonth=MONTHS[new Date().getMonth()]+" "+new Date().getFullYear();

// SUB-ADMINS & AUTH
let subAdmins=[];
let adminPassword="admin123";
const SUB_ADMIN_PERMS=[
  {key:"students",   label:"👨‍🎓 Students",    desc:"View & manage students"},
  {key:"teachers",   label:"👨‍🏫 Teachers",    desc:"View & manage teachers"},
  {key:"attendance", label:"📋 Attendance",   desc:"Mark & view attendance"},
  {key:"grades",     label:"📈 Grades",       desc:"View & enter grades"},
  {key:"fees",       label:"💳 Fees",         desc:"Manage fee status"},
  {key:"exams",      label:"📝 Exams",        desc:"Schedule exams"},
  {key:"notices",    label:"📢 Notices",      desc:"Post notices"},
  {key:"complaints", label:"⚠️ Complaints",   desc:"View complaints"},
  {key:"reports",    label:"📋 Reports",      desc:"Generate reports"},
  {key:"timetable",  label:"🕐 Timetable",    desc:"Upload timetables"},
];

const weekDays=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d.toISOString().split("T")[0];}).filter(d=>![0,6].includes(new Date(d).getDay()));

let attendance=(()=>{const r={};students.forEach(s=>{r[s.id]={};weekDays.forEach(d=>{r[s.id][d]=Math.random()>.15?"present":Math.random()>.5?"absent":"late";});});return r;})();
let grades=(()=>{const g={};students.forEach(s=>{g[s.id]={};const subs=SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||[];subs.forEach(sub=>{const mid=Math.floor(Math.random()*22)+18,fin=Math.floor(Math.random()*40)+38,intern=Math.floor(Math.random()*12)+10;g[s.id][sub]={midterm:mid,final:fin,internal:intern,total:mid+fin+intern};});});return g;})();

let feeVouchers={
  S001:[{month:"January 2025",amount:15000,dueDate:"2025-01-15",status:"paid",voucherNo:"V001-S001",paidDate:"2025-01-10"}],
  S002:[{month:"January 2025",amount:15000,dueDate:"2025-01-15",status:"pending",voucherNo:"V001-S002",paidDate:null}],
  S003:[{month:"January 2025",amount:15000,dueDate:"2025-01-15",status:"paid",voucherNo:"V001-S003",paidDate:"2025-01-12"}],
  S004:[{month:"February 2025",amount:15000,dueDate:"2025-02-15",status:"paid",voucherNo:"V002-S004",paidDate:"2025-02-10"}],
  S005:[{month:"December 2024",amount:15000,dueDate:"2024-12-15",status:"overdue",voucherNo:"V012-S005",paidDate:null}],
  S006:[{month:"February 2025",amount:15000,dueDate:"2025-02-15",status:"paid",voucherNo:"V002-S006",paidDate:"2025-02-08"}],
  S007:[{month:"January 2025",amount:15000,dueDate:"2025-01-15",status:"pending",voucherNo:"V001-S007",paidDate:null}],
  S008:[{month:"February 2025",amount:15000,dueDate:"2025-02-15",status:"paid",voucherNo:"V002-S008",paidDate:"2025-02-14"}],
};
// Installment plans: { [studentId]: { totalFee, session, installments:[{no,amount,dueDate,status,voucherNo,paidDate,receiptNo}] } }
let feeInstallments={};

let notices=[
  {id:1,title:"College closed Friday for Juma Prayer",      date:"2025-02-21",type:"holiday", author:"Principal"},
  {id:2,title:"Mid-Term result cards distributed Monday",   date:"2025-02-24",type:"academic",author:"Controller of Exams"},
  {id:3,title:"Annual Sports Week starting March 3",        date:"2025-02-25",type:"event",   author:"Sports Dept"},
  {id:4,title:"Fee submission deadline extended to Feb 28", date:"2025-02-26",type:"fee",     author:"Accounts Dept"},
];
let exams=[
  {id:"E001",title:"Mid-Term",subject:"Data Structures",cls:"CS-A",date:"2025-03-10",time:"09:00 AM",duration:"3 hours",room:"Hall-A",totalMarks:50},
  {id:"E002",title:"Mid-Term",subject:"Calculus",       cls:"CS-B",date:"2025-03-11",time:"09:00 AM",duration:"3 hours",room:"Hall-B",totalMarks:50},
  {id:"E003",title:"Final",   subject:"Physics",        cls:"CS-A",date:"2025-05-15",time:"10:00 AM",duration:"3 hours",room:"Hall-C",totalMarks:100},
];
let complaints=[],timetables={};
let assignments=[];
let submissions=[];

// ================================================================
// SECTION 3 — STATE
// ----------------------------------------------------------------
// All mutable application state lives here.
// Changing any of these variables and calling render() or
// refreshContent() will update the UI automatically.
//
//   currentUser   — logged-in user object (null when logged out)
//   currentPage   — which nav section to display
//   attFilter     — class + date for attendance view
//   gradesFilter  — class for grades view
//   reportFilter  — type / class / month for reports
//   feeFilter     — search / class / status for fee management
//   modalState    — which modal (if any) is open
//   formData      — live form field values inside open modal
//   loginRole     — selected tab on login page
//   loginErr      — error message shown on login page
// ================================================================
let currentUser=null,currentPage="dashboard",sidebarCollapsed=window.innerWidth<=768,searchQuery="";
// attFilter: cls (legacy string) + class_id + section_id for proper DB-backed filtering
let attFilter={cls:"CS-A", class_id:null, section_id:null, date:today};
let gradesFilter={cls:"CS-A", class_id:null, section_id:null};
let modalState=null,formData={},loginRole="admin",loginErr="";
// reportFilter: same — cls kept for legacy report display, class_id for API calls
let reportFilter={type:"attendance",month:curMonth,cls:"CS-A",class_id:null,section_id:null};
let subAdminPermsSelected=[];
let feeFilter={cls:"ALL",status:"ALL",search:""};

// ================================================================
// SECTION 4 — HELPERS
// ----------------------------------------------------------------
// Pure utility functions that return HTML strings or small values.
// None of these functions touch the DOM directly — they just
// return strings that get injected by the render functions.
//
//   esc(s)            — HTML-escape a string (XSS safety)
//   badge(status)     — coloured status pill  <span>
//   pbtn / obtn / dbtn / sbtn / wbtn / purpbtn
//                     — primary / outline / danger / success /
//                        warning / purple button HTML strings
//   card(content)     — wraps content in a white rounded card
//   statCard(...)     — KPI stat tile for dashboards
//   secTitle(t)       — section heading row with optional action
//   ava(name, size)   — avatar circle (photo or initials)
//   getUserPhoto()    — returns photo URL for logged-in user
//   tblHtml(h, rows)  — quick helper to build a <table>
//   pbar(pct, color)  — progress bar HTML
//   fld(label, id)    — labelled form input / select HTML
// ================================================================
const gradeLabel=t=>t>=85?"A+":t>=80?"A":t>=72?"B+":t>=65?"B":t>=55?"C":t>=45?"D":"F";
const gradeColor=t=>t>=80?T.green:t>=65?T.accent:t>=45?T.yellow:T.red;
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

function badge(status,size="sm"){
  const map={paid:[T.green,T.greenL],partial:[T.orange,T.orangeL],pending:[T.yellow,T.yellowL],overdue:[T.red,T.redL],present:[T.green,T.greenL],absent:[T.red,T.redL],late:[T.yellow,T.yellowL],active:[T.accent,T.accentL],inactive:[T.red,T.redL],holiday:[T.orange,T.orangeL],academic:[T.blue,T.blueL],event:[T.green,T.greenL],fee:[T.yellow,T.yellowL],submitted:[T.blue,T.blueL],graded:[T.green,T.greenL],pending_review:[T.yellow,T.yellowL]};
  const[fg,bg]=map[status]||[T.muted,"#f1f5f9"];
  return `<span style="background:${bg};color:${fg};border-radius:20px;padding:${size==="sm"?"2px 10px":"3px 14px"};font-size:${size==="sm"?11:12}px;font-weight:700;text-transform:capitalize;white-space:nowrap">${esc(status.replace(/_/g," "))}</span>`;
}
function pbtn(label,oc,sz="md"){const p=sz==="sm"?"6px 14px":sz==="lg"?"13px 28px":"9px 20px";const fs=sz==="sm"?12:sz==="lg"?15:13;return `<button onclick="${oc}" style="background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(5,150,105,.3)">${label}</button>`;}
function obtn(label,oc,sz="md"){const p=sz==="sm"?"5px 13px":"8px 18px";const fs=sz==="sm"?12:13;return `<button onclick="${oc}" style="background:#fff;color:${T.accent};border:1.5px solid ${T.accent};border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer">${label}</button>`;}
function dbtn(label,oc,sz="md"){const p=sz==="sm"?"5px 13px":"8px 18px";const fs=sz==="sm"?12:13;return `<button onclick="${oc}" style="background:${T.redL};color:${T.red};border:1px solid #fca5a5;border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer">${label}</button>`;}
function sbtn(label,oc,sz="md"){const p=sz==="sm"?"5px 13px":"8px 18px";const fs=sz==="sm"?12:13;return `<button onclick="${oc}" style="background:${T.greenL};color:${T.green};border:1px solid #86efac;border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer">${label}</button>`;}
function wbtn(label,oc,sz="md"){const p=sz==="sm"?"5px 13px":"8px 18px";const fs=sz==="sm"?12:13;return `<button onclick="${oc}" style="background:${T.yellowL};color:${T.yellow};border:1px solid #fcd34d;border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer">${label}</button>`;}
function purpbtn(label,oc,sz="md"){const p=sz==="sm"?"5px 13px":"8px 18px";const fs=sz==="sm"?12:13;return `<button onclick="${oc}" style="background:${T.purpleL};color:${T.purple};border:1px solid #c4b5fd;border-radius:10px;padding:${p};font-size:${fs}px;font-weight:700;cursor:pointer">${label}</button>`;}

function card(content,xStyle="",p=22){return `<div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:${p}px;box-shadow:${T.shadow};${xStyle}">${content}</div>`;}
function statCard(icon,value,label,color,sub=""){return `<div class="card-hover" style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px 20px;position:relative;overflow:hidden;box-shadow:${T.shadow}"><div style="position:absolute;top:14px;right:14px;width:46px;height:46px;border-radius:12px;background:${color}18;display:flex;align-items:center;justify-content:center;font-size:20px">${icon}</div><div style="font-size:30px;font-weight:800;color:${color};font-family:'Space Grotesk',sans-serif;line-height:1.1">${esc(String(value))}</div><div style="font-size:13px;color:${T.muted};margin-top:6px;font-weight:600">${esc(label)}</div>${sub?`<div style="font-size:11px;color:${color};margin-top:3px;font-weight:600;opacity:.8">${esc(sub)}</div>`:""}</div>`;}
function secTitle(t,a=""){return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:800;color:${T.text};margin:0">${t}</h2>${a}</div>`;}
function ava(name,size=36,photo=null){
  if(photo)return `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;flex-shrink:0;box-shadow:0 2px 8px rgba(5,150,105,.25);border:2px solid ${T.border2}"><img src="${photo}" style="width:100%;height:100%;object-fit:cover" alt="${(name||"?")[0]}"/></div>`;
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,${T.accent},${T.accentD});display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.38)}px;font-weight:800;color:#fff;flex-shrink:0;box-shadow:0 2px 8px rgba(5,150,105,.25)">${(name||"?")[0].toUpperCase()}</div>`;
}
function getUserPhoto(){
  if(!currentUser)return null;
  if(currentUser.role==="student"){const s=students.find(x=>x.id===currentUser.id);return s?.photo||null;}
  if(currentUser.role==="teacher"){const t=teachers.find(x=>x.id===currentUser.id);return t?.photo||null;}
  return null;
}
function tblHtml(headers,rows){
  const ths=headers.map(h=>`<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;background:${T.bg2}">${h}</th>`).join("");
  const trs=rows.map((row,i)=>{const tds=row.map(cell=>`<td style="padding:12px 14px;font-size:13px;color:${T.text};vertical-align:middle">${cell}</td>`).join("");return `<tr style="border-bottom:1px solid ${T.border};background:${i%2?"#f9fffe":"#fff"}">${tds}</tr>`;}).join("");
  return `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:400px"><thead><tr style="border-bottom:2px solid ${T.border}">${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;}
function pbar(pct,color){return `<div style="background:${T.bg};border-radius:99px;height:8px;overflow:hidden"><div style="width:${Math.min(pct,100)}%;height:100%;background:${color};border-radius:99px"></div></div>`;}
function fld(label,id,value="",type="text",options=null,placeholder=""){
  const st=`width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif`;
  const lbl=`<label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">${label}</label>`;
  if(options){const opts=options.map(o=>`<option value="${esc(o)}" ${o===value?"selected":""}>${esc(o)}</option>`).join("");return `<div style="margin-bottom:14px">${lbl}<select id="${id}" style="${st}" onchange="setForm('${id}',this.value)">${opts}</select></div>`;}
  return `<div style="margin-bottom:14px">${lbl}<input type="${type}" id="${id}" value="${esc(value)}" placeholder="${esc(placeholder)}" style="${st}" oninput="setForm('${id}',this.value)"/></div>`;}

// ================================================================
// SECTION 5 — CHART UTILITIES
// ----------------------------------------------------------------
// Canvas-based chart renderers — no external chart library needed.
//
//   drawBarChart(canvasId, labels, datasets, options)
//     Draws grouped vertical bar chart on an HTML canvas element.
//
//   drawLineChart(canvasId, labels, datasets)
//     Draws a filled area line chart on an HTML canvas element.
//
//   scheduleChart(fn)   — queue a chart-draw function
//   flushCharts()       — execute all queued chart functions
//
// Charts are queued (not drawn immediately) because the canvas
// elements don't exist in the DOM until after innerHTML is set.
// flushCharts() is called right after every render/refreshContent.
// ================================================================
function drawBarChart(canvasId,labels,datasets,options={}){
  setTimeout(()=>{
    const canvas=document.getElementById(canvasId);if(!canvas)return;
    const ctx=canvas.getContext("2d");const W=canvas.width,H=canvas.height;
    const pad={top:24,right:20,bottom:44,left:44};
    const chartW=W-pad.left-pad.right,chartH=H-pad.top-pad.bottom;
    ctx.clearRect(0,0,W,H);ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
    const maxVal=options.maxVal||100;const gridLines=5;
    for(let i=0;i<=gridLines;i++){const y=pad.top+chartH-(i/gridLines)*chartH;ctx.strokeStyle="#e5e7eb";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(pad.left+chartW,y);ctx.stroke();ctx.fillStyle="#9ca3af";ctx.font="10px Plus Jakarta Sans,sans-serif";ctx.textAlign="right";ctx.fillText(Math.round((i/gridLines)*maxVal),pad.left-6,y+4);}
    const groupW=chartW/labels.length;const barW=Math.min(groupW*0.7/datasets.length,28);const totalBarW=barW*datasets.length+(datasets.length-1)*3;
    datasets.forEach((ds,di)=>{labels.forEach((lbl,li)=>{const val=ds.data[li]||0;const barH=(val/maxVal)*chartH;const x=pad.left+groupW*li+(groupW-totalBarW)/2+di*(barW+3);const y=pad.top+chartH-barH;ctx.fillStyle=ds.color;ctx.beginPath();const r=Math.min(4,barH/2);ctx.moveTo(x+r,y);ctx.lineTo(x+barW-r,y);ctx.arcTo(x+barW,y,x+barW,y+r,r);ctx.lineTo(x+barW,y+barH);ctx.lineTo(x,y+barH);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();ctx.fill();if(barH>14){ctx.fillStyle="#fff";ctx.font="bold 9px Plus Jakarta Sans,sans-serif";ctx.textAlign="center";ctx.fillText(val,x+barW/2,y+12);}});});
    labels.forEach((lbl,li)=>{ctx.fillStyle="#374151";ctx.font="11px Plus Jakarta Sans,sans-serif";ctx.textAlign="center";ctx.fillText(lbl,pad.left+groupW*li+groupW/2,pad.top+chartH+16);});
    datasets.forEach((ds,di)=>{const lx=pad.left+di*120,ly=H-12;ctx.fillStyle=ds.color;ctx.fillRect(lx,ly-8,12,8);ctx.fillStyle="#374151";ctx.font="10px Plus Jakarta Sans,sans-serif";ctx.textAlign="left";ctx.fillText(ds.label,lx+16,ly);});
  },50);
}

function drawLineChart(canvasId,labels,datasets){
  setTimeout(()=>{
    const canvas=document.getElementById(canvasId);if(!canvas)return;
    const ctx=canvas.getContext("2d");const W=canvas.width,H=canvas.height;
    const pad={top:24,right:20,bottom:40,left:44};
    const chartW=W-pad.left-pad.right,chartH=H-pad.top-pad.bottom;
    ctx.clearRect(0,0,W,H);ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
    const maxVal=100,gridLines=5;
    for(let i=0;i<=gridLines;i++){const y=pad.top+chartH-(i/gridLines)*chartH;ctx.strokeStyle="#e5e7eb";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(pad.left+chartW,y);ctx.stroke();ctx.fillStyle="#9ca3af";ctx.font="10px Plus Jakarta Sans,sans-serif";ctx.textAlign="right";ctx.fillText(Math.round((i/gridLines)*maxVal)+"%",pad.left-4,y+4);}
    const xStep=labels.length>1?chartW/(labels.length-1):chartW;
    datasets.forEach(ds=>{const pts=ds.data.map((v,i)=>({x:pad.left+i*xStep,y:pad.top+chartH-(v/maxVal)*chartH}));ctx.beginPath();ctx.moveTo(pts[0].x,pad.top+chartH);pts.forEach(p=>ctx.lineTo(p.x,p.y));ctx.lineTo(pts[pts.length-1].x,pad.top+chartH);ctx.closePath();ctx.fillStyle=ds.color+"22";ctx.fill();ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.strokeStyle=ds.color;ctx.lineWidth=2.5;ctx.stroke();pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle=ds.color;ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.stroke();});});
    labels.forEach((lbl,li)=>{ctx.fillStyle="#374151";ctx.font="11px Plus Jakarta Sans,sans-serif";ctx.textAlign="center";ctx.fillText(lbl,pad.left+li*xStep,pad.top+chartH+16);});
    datasets.forEach((ds,di)=>{const lx=pad.left+di*120,ly=H-8;ctx.fillStyle=ds.color;ctx.fillRect(lx,ly-8,20,3);ctx.beginPath();ctx.arc(lx+10,ly-6.5,4,0,Math.PI*2);ctx.fillStyle=ds.color;ctx.fill();ctx.fillStyle="#374151";ctx.font="10px Plus Jakarta Sans,sans-serif";ctx.textAlign="left";ctx.fillText(ds.label,lx+24,ly);});
  },50);
}

let _chartQueue=[];
function scheduleChart(fn){_chartQueue.push(fn);}
function flushCharts(){const q=[..._chartQueue];_chartQueue=[];setTimeout(()=>{q.forEach(fn=>{try{fn();}catch(e){}});},80);}

let _searchTimer=null;
function handleSearch(val){searchQuery=val;clearTimeout(_searchTimer);_searchTimer=setTimeout(()=>refreshContent(),300);}
function handleFeeSearch(val){feeFilter.search=val;clearTimeout(_searchTimer);_searchTimer=setTimeout(()=>refreshContent(),300);}

// ================================================================
// SECTION 6 — RENDER ENGINE
// ----------------------------------------------------------------
// The two core functions that update the DOM.
//
//   render()
//     Full re-render: replaces the entire #app innerHTML.
//     Called on login, logout, navigation, and modal open/close.
//
//   refreshContent()
//     Partial re-render: replaces only #main-content innerHTML.
//     Called by filter dropdowns and search inputs so typing
//     does NOT destroy and recreate the whole page — the focused
//     input element is saved and restored after the update.
// ================================================================
function render(){_chartQueue=[];document.getElementById("app").innerHTML=currentUser?renderShell():renderLogin();flushCharts();}
function refreshContent(){
  _chartQueue=[];
  // Save focused search input info before re-render
  const activeId=document.activeElement?.id||"";
  const activeVal=document.activeElement?.value||"";
  const activeSel=[document.activeElement?.selectionStart,document.activeElement?.selectionEnd];
  const el=document.getElementById("main-content");
  if(el)el.innerHTML=renderPage();
  flushCharts();
  // Restore focus to search input if it was active
  if(activeId){
    const restored=document.getElementById(activeId);
    if(restored){
      restored.focus();
      try{restored.setSelectionRange(activeSel[0],activeSel[1]);}catch(e){}
    }
  }
}

// ================================================================
// SECTION 7 — LOGIN
// ----------------------------------------------------------------
// renderLogin()      — returns the full login page HTML string.
//                      Two-column layout: branding left, form right.
// switchLoginRole(r) — changes the selected role tab and re-renders.
// doLogin()          — validates credentials and sets currentUser.
//
// Demo credentials:
//   Admin   :  admin / admin123
//   Teacher :  T001–T005 / teach1–teach5
//   Student :  S001–S008 / 1234
// ================================================================
function renderLogin(){
  const hints={admin:{h:"admin / admin123 (or sub-admin credentials)",i:"🛡️",l:"Admin"},teacher:{h:"T001–T005 / teach1–teach5",i:"👨‍🏫",l:"Teacher"},student:{h:"S001–S008 / 1234",i:"🎓",l:"Student"}};
  return `<div style="min-height:100vh;display:flex;align-items:stretch;font-family:'Plus Jakarta Sans',sans-serif">
  <div style="flex:1;background:linear-gradient(160deg,#064e3b 0%,#047857 60%,#059669 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:52px;min-height:100vh;position:relative;overflow:hidden">
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.06) 0%,transparent 60%)"></div>
    <div style="max-width:420px;width:100%;position:relative;z-index:1">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:52px">
        <div style="width:52px;height:52px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px">🎓</div>
        <div><div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:800;color:#fff">NEXus Solution</div><div style="font-size:12px;color:rgba(255,255,255,.55);margin-top:1px">College Management System</div></div>
      </div>
      <div style="font-family:'Space Grotesk',sans-serif;font-size:38px;font-weight:800;color:#fff;line-height:1.15;margin-bottom:16px">Welcome<br>Back! 👋</div>
      <div style="font-size:15px;color:rgba(255,255,255,.65);line-height:1.8;margin-bottom:40px">Attendance · Grades · Fees · Reports · Assignments — all in one secure portal.</div>
      <div style="display:flex;flex-wrap:wrap;gap:9px;margin-bottom:44px">
        ${["📋 Attendance","📈 Grades","💳 Fees","📊 Reports","📝 Assignments","🕐 Timetable"].map(f=>`<span style="background:rgba(255,255,255,.1);color:rgba(255,255,255,.85);border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:5px 14px;font-size:12px;font-weight:600">${f}</span>`).join("")}
      </div>
      <div style="display:flex;gap:28px;padding-top:32px;border-top:1px solid rgba(255,255,255,.12)">
        ${[["8+","Students"],["5","Teachers"],["4","Classes"],["3","Exams"]].map(([n,l])=>`<div><div style="font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:800;color:#fff">${n}</div><div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:3px">${l}</div></div>`).join("")}
      </div>
    </div>
  </div>
  <div style="width:490px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:52px;flex-shrink:0;min-height:100vh">
    <div style="width:100%;max-width:380px">
      <div style="margin-bottom:32px"><div style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:800;color:${T.text}">Sign In</div><div style="font-size:13px;color:${T.muted};margin-top:5px">Select your role and enter your credentials</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:28px">
        ${["admin","teacher","student"].map(r=>`<button onclick="switchLoginRole('${r}')" style="padding:14px 8px;border-radius:12px;cursor:pointer;font-weight:700;font-size:12px;border:2px solid ${loginRole===r?T.accent:T.border};background:${loginRole===r?T.accentL:"#fff"};color:${loginRole===r?T.accentD:T.muted};display:flex;flex-direction:column;align-items:center;gap:5px;font-family:'Plus Jakarta Sans',sans-serif;transition:all .2s"><span style="font-size:22px">${hints[r].i}</span>${hints[r].l}</button>`).join("")}
      </div>
      <div style="background:${T.accentL};border:1px solid ${T.border2};border-radius:10px;padding:11px 14px;font-size:12px;color:${T.accentD};margin-bottom:22px;font-weight:600;display:flex;align-items:center;gap:8px"><span>💡</span>${hints[loginRole].h}</div>
      <div style="margin-bottom:14px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">User ID</label><input id="l-uid" type="text" placeholder="${loginRole==="admin"?"admin or sub-admin username":loginRole==="teacher"?"e.g. T001":"e.g. S001"}" style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:12px 14px;color:${T.text};font-size:14px;outline:none;box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif" onfocus="this.style.borderColor='${T.accent}'" onblur="this.style.borderColor='${T.border}'"/></div>
      <div style="margin-bottom:20px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Password</label><input id="l-pwd" type="password" placeholder="Enter your password" style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:12px 14px;color:${T.text};font-size:14px;outline:none;box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif" onfocus="this.style.borderColor='${T.accent}'" onblur="this.style.borderColor='${T.border}'" onkeydown="if(event.key==='Enter')doLogin()"/></div>
      ${loginErr?`<div style="background:${T.redL};border:1px solid #fca5a5;border-radius:10px;padding:12px 14px;font-size:13px;color:${T.red};margin-bottom:16px;font-weight:600;display:flex;gap:8px;align-items:center"><span>⚠️</span>${esc(loginErr)}</div>`:""}
      <button onclick="doLogin()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;box-shadow:0 4px 14px rgba(5,150,105,.4)">Sign In →</button>
      <div style="text-align:center;margin-top:28px;font-size:12px;color:${T.muted}">NEXus Solution · 2025–26 Academic Year</div>
    </div>
  </div>
</div>`;}

function switchLoginRole(r){loginRole=r;loginErr="";render();}
function doLogin(){
  const uid=(document.getElementById("l-uid")?.value||"").trim();
  const pwd=(document.getElementById("l-pwd")?.value||"").trim();
  loginErr="";
  if(loginRole==="admin"){
    if(uid==="admin"&&pwd===adminPassword){
      currentUser={role:"admin",name:"Admin / Principal",id:"ADMIN",isSubAdmin:false};currentPage="dashboard";render();
    } else {
      // Check sub-admins
      const sa=subAdmins.find(x=>x.username===uid&&x.password===pwd&&x.portal==="active");
      if(sa){currentUser={role:"admin",name:sa.name,id:sa.id,isSubAdmin:true,permissions:sa.permissions};currentPage="dashboard";render();}
      else{loginErr="Invalid credentials.";render();}
    }
  } else if(loginRole==="teacher"){
    const t=teachers.find(x=>x.id===uid&&x.password===pwd);
    if(t){currentUser={role:"teacher",name:t.name,id:t.id,photo:t.photo||null};currentPage="dashboard";render();}
    else{loginErr="Invalid ID or password. Try: T001 / teach1";render();}
  } else {
    const s=students.find(x=>x.id===uid&&x.password===pwd);
    if(s){currentUser={role:"student",name:s.name,id:s.id,photo:s.photo||null};currentPage="dashboard";render();}
    else{loginErr="Invalid ID or password. Try: S001 / 1234";render();}
  }
}

// ================================================================
// SECTION 8 — PERMISSION CHECK
// ----------------------------------------------------------------
// canAccess(page)
//   Returns true if the logged-in user may view the given page.
//   Full admins always pass. Sub-admins are checked against their
//   permissions array. Students and teachers always pass (they have
//   their own limited nav so they never reach admin-only pages).
//
//   Pages only the full admin can see:
//     dashboard, portals, subadmins, settings
// ================================================================
function canAccess(page){
  if(!currentUser||currentUser.role!=="admin")return true;
  if(!currentUser.isSubAdmin)return true;
  const map={students:"students",teachers:"teachers",attendance:"attendance",grades:"grades",fees:"fees",exams:"exams",notices:"notices",complaints:"complaints",reports:"reports",timetable:"timetable",dashboard:null,portals:null,settings:null,subadmins:null};
  const perm=map[page];
  if(perm===null)return false; // full admin only
  if(perm===undefined)return false;
  return (currentUser.permissions||[]).includes(perm);
}

// ================================================================
// SECTION 9 — SHELL
// ----------------------------------------------------------------
// renderShell()
//   The outer chrome rendered after login.
//   Builds the sidebar, top header, and the #main-content region.
//   Also appends renderModal() output so modals overlay everything.
//
// getNav()
//   Returns the navigation items array for the current user's role.
//   Admin   → full 15-item nav (or sub-set for sub-admins)
//   Teacher → 7-item nav
//   Student → 8-item nav
//
// renderPage()
//   Router: calls renderAdminPage / renderTeacherPage / renderStudentPage
//   based on currentUser.role.
// ================================================================
function renderShell(){
  const nav=getNav(),isMobile=window.innerWidth<=768,sw=sidebarCollapsed?64:240,lbl=nav.find(n=>n.key===currentPage)?.label||"";
  const sidebarStyle=isMobile
    ?`position:fixed;left:0;top:0;height:100vh;z-index:1000;width:240px;background:${T.sidebar};display:flex;flex-direction:column;flex-shrink:0;overflow:hidden;box-shadow:4px 0 20px rgba(6,78,59,.3);transition:transform .25s;transform:${sidebarCollapsed?"translateX(-100%)":"translateX(0)"}`
    :`width:${sw}px;background:${T.sidebar};display:flex;flex-direction:column;flex-shrink:0;overflow:hidden;box-shadow:4px 0 20px rgba(6,78,59,.3);transition:width .25s`;
  return `
  ${isMobile&&!sidebarCollapsed?`<div onclick="toggleSidebar()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:999"></div>`:""}
  <div style="display:flex;height:100vh;overflow:hidden">
  <div style="${sidebarStyle}">
    <div style="padding:18px 14px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px;justify-content:${(!isMobile&&sidebarCollapsed)?"center":"flex-start"};height:68px;flex-shrink:0">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,${T.accent},${T.accentD});border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:16px">🎓</div>
      ${(isMobile||!sidebarCollapsed)?`<div><div style="font-weight:800;font-size:15px;font-family:'Space Grotesk',sans-serif;color:#fff">NEXus Solution</div><div style="font-size:10px;color:${T.sidebarText};opacity:.6">2025–26</div></div>`:""}
    </div>
    <nav style="flex:1;padding:10px 8px;overflow-y:auto">
      ${nav.map(n=>{const a=currentPage===n.key;return `<div onclick="navTo('${n.key}')" title="${n.label}" class="nav-item" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;margin-bottom:2px;background:${a?"rgba(16,185,129,.2)":"transparent"};color:${a?"#fff":T.sidebarText};font-weight:${a?700:500};font-size:13px;white-space:nowrap;overflow:hidden;justify-content:${(!isMobile&&sidebarCollapsed)?"center":"flex-start"};border-left:${a?`3px solid ${T.accent}`:"3px solid transparent"};transition:all .15s"><span style="font-size:16px;flex-shrink:0">${n.icon}</span>${(isMobile||!sidebarCollapsed)?`<span>${n.label}</span>`:""}</div>`;}).join("")}
    </nav>
    ${(isMobile||!sidebarCollapsed)?`<div style="padding:12px 14px;border-top:1px solid rgba(255,255,255,.08)"><div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,.07);border-radius:10px">${ava(currentUser.name,32,getUserPhoto())}<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(currentUser.name)}</div><div style="font-size:10px;color:${T.sidebarText};opacity:.6;text-transform:capitalize">${currentUser.isSubAdmin?"Sub-Admin":currentUser.role}</div></div></div></div>`:""}
    ${!isMobile?`<div style="padding:10px 8px;border-top:1px solid rgba(255,255,255,.08)"><div onclick="toggleSidebar()" style="display:flex;align-items:center;justify-content:center;padding:8px;border-radius:10px;cursor:pointer;background:rgba(255,255,255,.06);color:${T.sidebarText};font-size:16px">${sidebarCollapsed?"→":"←"}</div></div>`:""}
  </div>
  <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:${T.bg}">
    <div style="background:#fff;border-bottom:1px solid ${T.border};padding:0 ${isMobile?"12px":"28px"};display:flex;align-items:center;justify-content:space-between;height:68px;flex-shrink:0;box-shadow:0 1px 8px rgba(5,150,105,.06)">
      <div style="display:flex;align-items:center;gap:10px">
        ${isMobile?`<button onclick="toggleSidebar()" style="background:${T.accentL};border:none;border-radius:8px;width:36px;height:36px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:${T.accentD}">☰</button>`:""}
        <div>
          <div style="font-weight:800;font-size:${isMobile?"14px":"17px"};font-family:'Space Grotesk',sans-serif;color:${T.text}">${lbl}</div>
          ${!isMobile?`<div style="font-size:11px;color:${T.muted};margin-top:1px">${new Date().toLocaleDateString("en-PK",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>`:""}
        </div>
      </div>
      <div style="display:flex;gap:${isMobile?"6px":"12px"};align-items:center">
        ${!isMobile?`<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:${T.text}">${esc(currentUser.name)}</div><div style="font-size:10px;color:${T.muted};text-transform:capitalize">${currentUser.isSubAdmin?"Sub-Admin":currentUser.role}</div></div>`:""}
        ${ava(currentUser.name,38,getUserPhoto())}
        <button onclick="openModal('changePassword')" style="background:${T.accentL};color:${T.accentD};border:1.5px solid ${T.border2};border-radius:10px;padding:7px ${isMobile?"8px":"14px"};font-size:12px;font-weight:700;cursor:pointer">🔑${!isMobile?" Password":""}</button>
        <button onclick="doLogout()" style="background:${T.redL};color:${T.red};border:1px solid #fca5a5;border-radius:10px;padding:7px ${isMobile?"8px":"14px"};font-size:12px;font-weight:700;cursor:pointer">${isMobile?"⬅️":"Logout"}</button>
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:${isMobile?"12px":"28px"}" id="main-content">${renderPage()}</div>
  </div>
</div>
${renderModal()}`;}

function getNav(){
  if(currentUser.role==="admin"){
    if(currentUser.isSubAdmin){
      const perms=currentUser.permissions||[];
      const allNav=[{key:"dashboard",icon:"📊",label:"Dashboard"},...SUB_ADMIN_PERMS.filter(p=>perms.includes(p.key)).map(p=>({key:p.key,icon:p.label.split(" ")[0],label:p.label.replace(/^[^ ]+ /,"")}))]
      return allNav;
    }
    return [{key:"dashboard",icon:"📊",label:"Dashboard"},{key:"students",icon:"🎓",label:"Students"},{key:"teachers",icon:"👨‍🏫",label:"Teachers"},{key:"attendance",icon:"📋",label:"Attendance"},{key:"exams",icon:"📝",label:"Exams"},{key:"grades",icon:"📈",label:"Grades"},{key:"fees",icon:"💳",label:"Fees"},{key:"assignments",icon:"📎",label:"Assignments"},{key:"timetable",icon:"🕐",label:"Timetable"},{key:"notices",icon:"📢",label:"Notices"},{key:"complaints",icon:"⚠️",label:"Complaints"},{key:"reports",icon:"📋",label:"Reports"},{key:"portals",icon:"🔐",label:"Portal Access"},{key:"subadmins",icon:"👥",label:"Sub-Admins"},{key:"settings",icon:"⚙️",label:"Settings"}];
  }
  if(currentUser.role==="teacher")return [{key:"dashboard",icon:"📊",label:"Dashboard"},{key:"attendance",icon:"📋",label:"Mark Attendance"},{key:"grades",icon:"📈",label:"Enter Grades"},{key:"assignments",icon:"📎",label:"Assignments"},{key:"complaints",icon:"⚠️",label:"Complaints"},{key:"timetable",icon:"🕐",label:"My Timetable"},{key:"notices",icon:"📢",label:"Notices"}];
  return [{key:"dashboard",icon:"📊",label:"Dashboard"},{key:"attendance",icon:"📋",label:"My Attendance"},{key:"grades",icon:"📈",label:"My Grades"},{key:"assignments",icon:"📎",label:"Assignments"},{key:"fees",icon:"💳",label:"Fee Vouchers"},{key:"timetable",icon:"🕐",label:"Timetable"},{key:"exams",icon:"📝",label:"Exams"},{key:"notices",icon:"📢",label:"Notices"}];
}

function renderPage(){if(currentUser.role==="admin")return renderAdminPage();if(currentUser.role==="teacher")return renderTeacherPage();return renderStudentPage();}

// ================================================================
// SECTION 10 — ADMIN PAGES
// ----------------------------------------------------------------
// renderAdminPage()   — switch on currentPage to pick sub-renderer.
// renderNoAccess()    — locked screen for sub-admins without permission.
// renderAdminDash()   — dashboard with KPI cards + charts.
// renderAdminStudents() — searchable student list + add/edit/delete.
// renderAdminTeachers() — teacher list + add/edit/delete.
// renderAttPage()     — attendance marking grid (shared admin+teacher).
// renderAdminExams()  — exam cards + add/delete.
// renderGrades()      — grades table (admin view = read-only summary).
// renderAdminFees()   — full fee management with installment plans.
// renderAdminAssignments() — admin overview of all assignments.
// renderAdminTT()     — timetable upload per teacher.
// renderAdminNotices()  — post and delete notices.
// renderAdminComplaints() — view all student complaints.
// renderReports()     — reports centre (attendance/grades/fees/performance).
// renderAdminPortals()  — grant/revoke student & teacher portal access.
// renderSubAdmins()   — create and manage sub-admin accounts.
// renderAdminSettings() — change admin password, college info.
// ================================================================
function renderAdminPage(){
  switch(currentPage){
    case "dashboard":   return renderAdminDash();
    case "students":    return canAccess("students")?renderAdminStudents():renderNoAccess();
    case "teachers":    return canAccess("teachers")?renderAdminTeachers():renderNoAccess();
    case "attendance":  return canAccess("attendance")?renderAttPage(true):renderNoAccess();
    case "exams":       return canAccess("exams")?renderAdminExams():renderNoAccess();
    case "grades":      return canAccess("grades")?renderGrades(false):renderNoAccess();
    case "fees":        return canAccess("fees")?renderAdminFees():renderNoAccess();
    case "assignments": return canAccess("assignments")?renderAdminAssignments():renderNoAccess();
    case "timetable":   return canAccess("timetable")?renderAdminTT():renderNoAccess();
    case "notices":     return canAccess("notices")?renderAdminNotices():renderNoAccess();
    case "complaints":  return canAccess("complaints")?renderAdminComplaints():renderNoAccess();
    case "reports":     return canAccess("reports")?renderReports():renderNoAccess();
    case "portals":     return (!currentUser.isSubAdmin)?renderAdminPortals():renderNoAccess();
    case "subadmins":   return (!currentUser.isSubAdmin)?renderSubAdmins():renderNoAccess();
    case "settings":    return (!currentUser.isSubAdmin)?renderAdminSettings():renderNoAccess();
    default:            return renderAdminDash();
  }
}

function renderNoAccess(){
  return card(`<div style="text-align:center;padding:60px"><div style="font-size:56px;margin-bottom:16px">🔒</div><div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:20px;margin-bottom:10px;color:${T.red}">Access Restricted</div><div style="color:${T.muted};font-size:14px;line-height:1.6">You don't have permission to access this section.<br>Contact the main administrator.</div></div>`);
}

// ─── ADMIN DASHBOARD ───
function renderAdminDash(){
  const tp=Object.values(attendance).filter(r=>r[today]==="present").length;
  const pc=students.filter(s=>s.feeStatus==="paid").length;
  const totalSubs=submissions.length;
  const pendingGrade=submissions.filter(s=>s.status==="submitted").length;
  const classAttData=CLASSES.map(cls=>{const cs=students.filter(s=>s.cls===cls);const pres=cs.filter(s=>attendance[s.id]?.[today]==="present").length;return cs.length?Math.round(pres/cs.length*100):0;});
  const classGradeData=CLASSES.map(cls=>{const cs=students.filter(s=>s.cls===cls);const avgs=cs.map(s=>{const tots=SUBJECTS.slice(0,5).map(sub=>grades[s.id]?.[sub]?.total||0);return tots.length?Math.round(tots.reduce((a,b)=>a+b,0)/tots.length):0;});return avgs.length?Math.round(avgs.reduce((a,b)=>a+b,0)/avgs.length):0;});
  const campusAtt=weekDays.map(d=>{const pres=students.filter(s=>attendance[s.id]?.[d]==="present").length;return students.length?Math.round(pres/students.length*100):0;});
  const dayLabels=weekDays.map(d=>new Date(d).toLocaleDateString("en",{weekday:"short"}));
  scheduleChart(()=>drawLineChart('campusAttChart',dayLabels,[{label:'Campus Attendance %',data:campusAtt,color:T.accent}]),'campusAttChart');
  scheduleChart(()=>drawBarChart('classCompChart',CLASSES,[{label:'Attendance %',data:classAttData,color:T.accent},{label:'Avg Grade %',data:classGradeData.map(v=>Math.round((v/175)*100)),color:T.purple}],{maxVal:100}),'classCompChart');
  return `
  ${currentUser.isSubAdmin?`<div style="background:${T.yellowL};border:1px solid #fcd34d;border-radius:12px;padding:12px 18px;margin-bottom:18px;display:flex;gap:10px;align-items:center"><span style="font-size:18px">👥</span><div><strong style="color:${T.yellow}">Sub-Admin Access:</strong><span style="font-size:13px;color:${T.yellow};margin-left:6px">Permissions: ${(currentUser.permissions||[]).join(", ") || "None"}</span></div></div>`:""}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:24px">
    ${statCard("🎓",students.length,"Total Students",T.accent,"All classes")}
    ${statCard("👨‍🏫",teachers.length,"Teachers",T.purple,"5 departments")}
    ${statCard("✅",tp,"Present Today",T.green,`${students.length-tp} absent`)}
    ${statCard("💳",`${pc}/${students.length}`,"Fee Paid",T.yellow,`${students.filter(s=>s.feeStatus==="overdue").length} overdue`)}
    ${statCard("📎",assignments.length,"Assignments",T.blue,`${pendingGrade} pending grade`)}
    ${statCard("⚠️",complaints.length,"Complaints",T.red,"Pending")}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px">
    ${card(`${secTitle("📊 Campus Attendance This Week")}<canvas id="campusAttChart" width="480" height="200" style="width:100%;height:200px"></canvas>`)}
    ${card(`${secTitle("📈 Class Attendance vs Grades Today")}<canvas id="classCompChart" width="480" height="200" style="width:100%;height:200px"></canvas>`)}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px">
    ${card(`${secTitle("🏫 Attendance by Class (Today)")}<div style="display:grid;gap:10px;margin-top:4px">${CLASSES.map((cls,i)=>{const pct=classAttData[i];const col=pct>=80?T.green:pct>=60?T.yellow:T.red;return `<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span style="font-weight:700">${cls}</span><span style="color:${col};font-weight:700">${pct}%</span></div>${pbar(pct,col)}</div>`;}).join("")}</div>`)}
    ${card(`${secTitle("📚 Average Grade by Class")}<div style="display:grid;gap:10px;margin-top:4px">${CLASSES.map((cls,i)=>{const avg=classGradeData[i];const col=gradeColor(avg);return `<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span style="font-weight:700">${cls}</span><span style="color:${col};font-weight:700">${avg}/175 · ${gradeLabel(avg)}</span></div>${pbar((avg/175)*100,col)}</div>`;}).join("")}</div>`)}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
    ${card(`${secTitle("📢 Recent Notices")}${notices.slice(0,4).map(n=>`<div style="border-bottom:1px solid ${T.border};padding-bottom:10px;margin-bottom:10px"><div style="font-size:13px;font-weight:600;margin-bottom:5px">${esc(n.title)}</div><div style="display:flex;gap:8px">${badge(n.type)}<span style="font-size:11px;color:${T.muted}">${n.date}</span></div></div>`).join("")}`)}
    ${card(`${secTitle("📈 Fee Overview")}${["paid","pending","overdue"].map(st=>{const cnt=students.filter(s=>s.feeStatus===st).length;const pct=students.length?Math.round(cnt/students.length*100):0;const col={paid:T.green,pending:T.yellow,overdue:T.red}[st];return `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span style="font-weight:600;text-transform:capitalize">${st}</span><span style="color:${col};font-weight:700">${cnt} students (${pct}%)</span></div>${pbar(pct,col)}</div>`;}).join("")}`)}
  </div>`;
}

// ─── SUB-ADMINS MANAGEMENT ───
function renderSubAdmins(){
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px">
    ${secTitle("👥 Sub-Admin Management")}
    ${pbtn("+ Add Sub-Admin","openModal('addSubAdmin')")}
  </div>

  <!-- Info Banner -->
  <div style="background:${T.blueL};border:1px solid #bfdbfe;border-radius:12px;padding:14px 18px;margin-bottom:20px;display:flex;gap:12px;align-items:flex-start">
    <span style="font-size:20px">ℹ️</span>
    <div><div style="font-weight:700;color:${T.blue};font-size:13px;margin-bottom:4px">About Sub-Admins</div>
    <div style="font-size:12px;color:${T.blue};line-height:1.7">Sub-admins can log in using the <strong>Admin</strong> role tab with their username & password. They only see the sections you grant them access to. The full admin (admin/admin123) always has complete access.</div></div>
  </div>

  ${subAdmins.length===0?card(`<div style="text-align:center;padding:56px;color:${T.muted}"><div style="font-size:56px;margin-bottom:14px">👥</div><div style="font-weight:700;font-size:16px">No sub-admins yet</div><div style="font-size:13px;margin-top:8px">Create sub-admins with limited portal access</div></div>`):
  `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
    ${subAdmins.map(sa=>`<div class="card-hover" style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow};border-top:3px solid ${T.purple}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:44px;height:44px;border-radius:12px;background:${T.purpleL};display:flex;align-items:center;justify-content:center;font-size:20px">👤</div>
          <div>
            <div style="font-weight:800;font-size:14px">${esc(sa.name)}</div>
            <div style="font-size:12px;color:${T.muted};margin-top:1px">@${esc(sa.username)}</div>
          </div>
        </div>
        ${badge(sa.portal)}
      </div>
      <div style="background:${T.bg};border-radius:10px;padding:12px;margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Permissions (${sa.permissions.length}/${SUB_ADMIN_PERMS.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          ${SUB_ADMIN_PERMS.map(p=>`<span style="background:${sa.permissions.includes(p.key)?T.purpleL:"#f1f5f9"};color:${sa.permissions.includes(p.key)?T.purple:T.muted};border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;border:1px solid ${sa.permissions.includes(p.key)?"#c4b5fd":"#e2e8f0"}">${p.label.split(" ")[0]} ${p.label.replace(/^[^ ]+ /,"")}</span>`).join("")}
        </div>
      </div>
      <div style="font-size:11px;color:${T.muted};margin-bottom:12px">📅 Created: ${sa.createdAt}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${obtn("✏️ Edit",`openEditSubAdmin('${sa.id}')`, "sm")}
        ${sa.portal==="active"?wbtn("🔒 Revoke",`toggleSubAdmin('${sa.id}')`, "sm"):sbtn("✅ Activate",`toggleSubAdmin('${sa.id}')`, "sm")}
        ${dbtn("🗑️ Delete",`delSubAdmin('${sa.id}')`, "sm")}
      </div>
    </div>`).join("")}
  </div>`}`;
}

// ─── ADMIN SETTINGS ───
function renderAdminSettings(){
  return `${secTitle("⚙️ Admin Settings")}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

    <!-- Change Admin Password -->
    ${card(`<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div style="width:48px;height:48px;background:${T.accentL};border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px">🔑</div>
      <div><div style="font-weight:800;font-size:15px">Change Admin Password</div><div style="font-size:12px;color:${T.muted};margin-top:2px">Update the main administrator login password</div></div>
    </div>
    <div style="background:${T.yellowL};border:1px solid #fcd34d;border-radius:10px;padding:11px 14px;font-size:12px;color:${T.yellow};margin-bottom:18px;font-weight:600;display:flex;gap:8px;align-items:center"><span>⚠️</span>This changes the password for the main admin account (username: admin)</div>
    ${fld("Current Password","s-curpwd","","password",null,"Enter current password")}
    ${fld("New Password","s-newpwd","","password",null,"Minimum 6 characters")}
    ${fld("Confirm New Password","s-confpwd","","password",null,"Re-enter new password")}
    <button onclick="changeAdminPassword()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;box-shadow:0 2px 8px rgba(5,150,105,.3)">🔑 Update Password</button>
    <div id="admin-pwd-msg" style="margin-top:10px;font-size:13px;text-align:center"></div>`)}

    <!-- System Info -->
    ${card(`<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div style="width:48px;height:48px;background:${T.blueL};border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px">ℹ️</div>
      <div><div style="font-weight:800;font-size:15px">System Information</div><div style="font-size:12px;color:${T.muted};margin-top:2px">Current system status</div></div>
    </div>
    <div style="display:grid;gap:10px">
      ${[["👨‍🎓 Total Students",students.length],["👨‍🏫 Total Teachers",teachers.length],["📎 Total Assignments",assignments.length],["📋 Total Submissions",submissions.length],["👥 Sub-Admins",subAdmins.length],["⚠️ Complaints",complaints.length]].map(([l,v])=>`<div style="display:flex;justify-content:space-between;background:${T.bg};border-radius:10px;padding:11px 14px;border:1px solid ${T.border}"><span style="font-size:13px;color:${T.muted};font-weight:600">${l}</span><span style="font-weight:800;font-size:14px;color:${T.text}">${v}</span></div>`).join("")}
    </div>`)}
  </div>`;
}

function changeAdminPassword(){
  const cur=document.getElementById("s-curpwd")?.value||"";
  const n=document.getElementById("s-newpwd")?.value||"";
  const c=document.getElementById("s-confpwd")?.value||"";
  const msg=document.getElementById("admin-pwd-msg");
  if(!cur||!n||!c){msg.innerHTML=`<span style="color:${T.red}">Please fill all fields.</span>`;return;}
  if(cur!==adminPassword){msg.innerHTML=`<span style="color:${T.red}">Current password is incorrect.</span>`;return;}
  if(n.length<6){msg.innerHTML=`<span style="color:${T.red}">New password must be at least 6 characters.</span>`;return;}
  if(n!==c){msg.innerHTML=`<span style="color:${T.red}">New passwords do not match.</span>`;return;}
  adminPassword=n;
  msg.innerHTML=`<span style="color:${T.green};font-weight:700">✅ Password updated successfully!</span>`;
  document.getElementById("s-curpwd").value="";document.getElementById("s-newpwd").value="";document.getElementById("s-confpwd").value="";
}

// ─── STUDENTS ───
function renderAdminStudents(){
  const filtS=students.filter(s=>s.name.toLowerCase().includes(searchQuery.toLowerCase())||s.id.toLowerCase().includes(searchQuery.toLowerCase()));
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:12px;flex-wrap:wrap">
    <div style="position:relative"><span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px">🔍</span><input id="student-search-input" value="${esc(searchQuery)}" oninput="handleSearch(this.value)" placeholder="Search students..." style="background:#fff;border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px 9px 36px;font-size:13px;outline:none;width:260px;font-family:'Plus Jakarta Sans',sans-serif"/></div>
    ${pbtn("+ Add Student","openModal('addStudent')")}
  </div>
  ${card(tblHtml(["ID","Name","Class","Roll#","Phone","Guardian","Fee","Portal","Actions"],filtS.map(s=>[
    `<span style="color:${T.accent};font-weight:800;font-family:'Space Grotesk',sans-serif">${s.id}</span>`,
    `<div style="display:flex;align-items:center;gap:8px">${ava(s.name,28,s.photo||null)}<span style="font-weight:700">${esc(s.name)}</span></div>`,
    `<span style="background:${T.accentL};color:${T.accentD};border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700">${s.cls}</span>`,
    s.rollNo,s.phone,s.guardianPhone,badge(s.feeStatus),badge(s.portal),
    `<div style="display:flex;gap:6px">${obtn("View",`viewStudent('${s.id}')`, "sm")}${obtn("Edit",`openEditStudent('${s.id}')`, "sm")}${dbtn("Del",`confirmDelStudent('${s.id}')`, "sm")}</div>`
  ])),"",0)}`;}

function renderAdminTeachers(){
  const filtT=teachers.filter(t=>t.name.toLowerCase().includes(searchQuery.toLowerCase())||t.id.toLowerCase().includes(searchQuery.toLowerCase()));
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:12px;flex-wrap:wrap">
    <div style="position:relative"><span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px">🔍</span><input id="teacher-search-input" value="${esc(searchQuery)}" oninput="handleSearch(this.value)" placeholder="Search teachers..." style="background:#fff;border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px 9px 36px;font-size:13px;outline:none;width:260px;font-family:'Plus Jakarta Sans',sans-serif"/></div>
    ${pbtn("+ Add Teacher","openModal('addTeacher')")}
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px">
    ${filtT.map(t=>`<div class="card-hover" style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow}">
      <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:16px">${ava(t.name,46,t.photo||null)}<div style="flex:1"><div style="font-weight:700;font-size:14px">${esc(t.name)}</div><div style="font-size:12px;color:${T.accent};font-weight:600;margin-top:2px">${t.subject}</div><div style="font-size:11px;color:${T.muted}">${t.dept}</div></div>${badge(t.portal)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;background:${T.bg};border-radius:10px;padding:12px">${[["ID",t.id],["Qual.",t.qualification],["Phone",t.phone],["Joined",t.joinDate]].map(([k,v])=>`<div><div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase">${k}</div><div style="font-size:12px;margin-top:2px;font-weight:600">${esc(v)}</div></div>`).join("")}</div>
      <div style="display:flex;gap:8px">${obtn("Edit",`openEditTeacher('${t.id}')`, "sm")}${dbtn("Remove",`delTeacher('${t.id}')`, "sm")}${timetables[t.id]?`<button onclick="window.open(timetables['${t.id}'].data)" style="background:${T.accentL};color:${T.accent};border:1px solid ${T.border2};border-radius:10px;padding:5px 13px;font-size:12px;font-weight:700;cursor:pointer">View TT</button>`:""}</div>
    </div>`).join("")}
  </div>`;}

function renderAttPage(isAdmin){
  // ── Agar dbClasses empty hai toh students se unique classes nikalo ──
  const effectiveClasses = dbClasses.length
    ? dbClasses
    : [...new Set(students.map(s => s.cls).filter(Boolean))].sort()
        .map(c => ({id: c, name: c, code: c}));

  // Agar abhi tak koi class select nahi hui toh pehli class set karo
  if (effectiveClasses.length && !attFilter.class_id && !attFilter.cls) {
    attFilter.class_id = effectiveClasses[0].id === effectiveClasses[0].name
      ? null : effectiveClasses[0].id;
    attFilter.cls = effectiveClasses[0].code || effectiveClasses[0].name;
  }

  // Build student list: prefer class_id match (DB-backed), fallback to cls string
  const cs = attFilter.class_id
    ? students.filter(s => s.class_id === attFilter.class_id || s.classId === attFilter.class_id)
    : students.filter(s => s.cls === attFilter.cls);

  // Build class dropdown options
  const classOptions = effectiveClasses.map(c => {
    const isSelected = dbClasses.length
      ? c.id === attFilter.class_id
      : (c.code || c.name) === attFilter.cls;
    return `<option value="${c.id}" data-cls="${c.code||c.name}" ${isSelected?'selected':''}>${c.name}${c.code&&c.code!==c.name?' ('+c.code+')':''}</option>`;
  }).join('');

  // Build section dropdown (filtered by selected class_id)
  const relevantSections = attFilter.class_id
    ? dbSections.filter(s => s.classId === attFilter.class_id)
    : dbSections;
  const sectionDropdown = relevantSections.length ? `
    <div><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase">Section</label>
    <select onchange="attFilter.section_id=this.value?parseInt(this.value):null;refreshContent()" style="background:#fff;border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
      <option value="">All Sections</option>
      ${relevantSections.map(s=>`<option value="${s.id}" ${s.id===attFilter.section_id?'selected':''}>${s.name}</option>`).join('')}
    </select></div>` : '';

  return `${isAdmin?"":secTitle("Mark Attendance")}
  <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:flex-end">
    <div><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase">Class</label>
    <select onchange="
      if(window.dbClasses && window.dbClasses.length){
        const sel=this.options[this.selectedIndex];
        attFilter.class_id=parseInt(this.value)||null;
        attFilter.cls=sel.dataset.cls||this.value;
        attFilter.section_id=null;
      } else {
        attFilter.cls=this.value;
      }
      refreshContent()
    " style="background:#fff;border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
      ${classOptions}
    </select></div>
    ${sectionDropdown}
    <div><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase">Date</label><input type="date" value="${attFilter.date}" onchange="attFilter.date=this.value;refreshContent()" style="background:#fff;border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif"/></div>
    ${sbtn("✅ All Present","bulkAtt('present')")}${dbtn("❌ All Absent","bulkAtt('absent')")}
  </div>
  <div style="display:grid;gap:10px">${cs.map(s=>{
    const st=attendance[s.id]?.[attFilter.date]||"absent";
    const sc={present:T.green,absent:T.red,late:T.yellow}[st];
    return `<div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:14px 18px;box-shadow:${T.shadow};display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;border-left:4px solid ${sc}">
      <div style="display:flex;align-items:center;gap:12px">${ava(s.name,38)}<div><div style="font-weight:700;font-size:14px">${esc(s.name)}</div><div style="font-size:11px;color:${T.muted}">Roll# ${s.rollNo} · ${s.cls}</div></div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${badge(st)}${["present","absent","late"].map(opt=>`<button onclick="markAtt('${s.id}','${opt}')" style="background:${st===opt?(opt==="present"?T.greenL:opt==="absent"?T.redL:T.yellowL):"#fff"};color:${st===opt?(opt==="present"?T.green:opt==="absent"?T.red:T.yellow):T.muted};border:1.5px solid ${st===opt?(opt==="present"?T.green:opt==="absent"?T.red:T.yellow):T.border};border-radius:8px;padding:5px 12px;cursor:pointer;font-weight:700;font-size:11px;font-family:'Plus Jakarta Sans',sans-serif;text-transform:capitalize">${opt}</button>`).join("")}${!isAdmin?dbtn("⚠️",`openComplaint('${s.id}')`, "sm"):""}</div>
    </div>`;}).join("")}
  </div>`;}


function renderAdminExams(){
  return `<div style="display:flex;justify-content:flex-end;margin-bottom:18px">${pbtn("+ Schedule Exam","openModal('addExam')")}</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
    ${exams.map(e=>`<div class="card-hover" style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow};border-top:3px solid ${T.accent}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px"><div><div style="font-weight:800;font-size:15px;font-family:'Space Grotesk',sans-serif">${esc(e.title)}</div><div style="font-size:13px;color:${T.accent};font-weight:600;margin-top:3px">${esc(e.subject)}</div></div><span style="background:${T.accentL};color:${T.accentD};border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700">${e.cls}</span></div>
      <div style="background:${T.bg};border-radius:10px;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">${[["📅 Date",e.date],["🕐 Time",e.time],["⏱ Duration",e.duration],["🚪 Room",e.room],["📝 Marks",String(e.totalMarks)]].map(([k,v])=>`<div><div style="font-size:10px;color:${T.muted};font-weight:700">${k}</div><div style="font-size:12px;font-weight:700;margin-top:2px">${esc(v)}</div></div>`).join("")}</div>
      ${dbtn("Remove",`delExam('${e.id}')`, "sm")}
    </div>`).join("")}
  </div>`;}

function renderGrades(editable){
  const cs=students.filter(s=>s.cls===gradesFilter.cls);
  // Collect all unique subjects for the displayed students
  const groupSubjects=["English","Urdu","Islamiyat","Biology","Physics","Chemistry","Mathematics","Computer Science"];
  return `<div style="margin-bottom:16px"><select onchange="gradesFilter.cls=this.value;refreshContent()" style="background:#fff;border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">${CLASSES.map(c=>`<option value="${c}" ${c===gradesFilter.cls?"selected":""}>${c}</option>`).join("")}</select></div>
  ${card(`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:600px">
    <thead><tr style="border-bottom:2px solid ${T.border}">
      <th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2}">Student</th>
      <th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2}">Group</th>
      <th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2}">Subjects & Marks</th>
      <th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:${T.muted};text-transform:uppercase;background:${T.bg2}">Grade</th>
    </tr></thead>
    <tbody>${cs.map((s,i)=>{
      const subs=SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||[];
      const mg=grades[s.id]||{};
      const tots=subs.map(sub=>mg[sub]?.total||0);
      const total=tots.reduce((a,b)=>a+b,0);
      const avg=subs.length?Math.round(total/subs.length):0;
      const subsDisplay=subs.map(sub=>{
        const g=mg[sub];
        return `<span style="display:inline-block;background:${g?gradeColor(g.total)+"15":"#f1f5f9"};border:1px solid ${g?gradeColor(g.total)+"40":T.border};border-radius:6px;padding:2px 8px;font-size:10px;margin:2px;font-weight:700;color:${g?gradeColor(g.total):T.muted}">${sub.split(" ")[0]}${g?":"+g.total:""}</span>`;
      }).join("");
      return `<tr style="border-bottom:1px solid ${T.border};background:${i%2?"#f9fffe":"#fff"}">
        <td style="padding:10px 14px;font-weight:700;font-size:13px">${esc(s.name)}</td>
        <td style="padding:10px 14px;font-size:11px"><span style="background:${T.accentL};color:${T.accentD};border-radius:12px;padding:2px 8px;font-weight:700">${s.subjectGroup||"CS"}</span></td>
        <td style="padding:8px 14px">${subsDisplay}</td>
        <td style="padding:10px 14px;text-align:center"><span style="background:${gradeColor(avg)}20;color:${gradeColor(avg)};border-radius:20px;padding:3px 12px;font-weight:800;font-size:12px">${gradeLabel(avg)}</span></td>
      </tr>`;}).join("")}
    </tbody></table></div>`,"",0)}`;
}

function renderAdminFees(){
  const paid=students.filter(s=>s.feeStatus==="paid").length;
  const pending=students.filter(s=>s.feeStatus==="pending").length;
  const overdue=students.filter(s=>s.feeStatus==="overdue").length;
  const partial=students.filter(s=>s.feeStatus==="partial").length;
  const totalCollected=Object.values(feeInstallments).reduce((acc,plan)=>acc+(plan.installments||[]).filter(i=>i.status==="paid").reduce((s,i)=>s+i.amount,0),0);

  // ── FILTER BAR ──────────────────────────────────────────────────
  const feeFilterBar=`
  <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:14px 18px;margin-bottom:18px;display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;box-shadow:${T.shadow}">
    <div style="position:relative;flex:1;min-width:200px">
      <span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:14px;pointer-events:none">🔍</span>
      <input id="fee-search-input" type="text" value="${esc(feeFilter.search)}" oninput="handleFeeSearch(this.value)" placeholder="Search by name or ID…"
        style="width:100%;box-sizing:border-box;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 12px 9px 34px;font-size:13px;color:${T.text};outline:none;font-family:'Plus Jakarta Sans',sans-serif"/>
    </div>
    <div>
      <label style="font-size:10px;color:${T.muted};display:block;margin-bottom:4px;font-weight:700;text-transform:uppercase">Class</label>
      <select onchange="feeFilter.cls=this.value;refreshContent()" style="background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        <option value="ALL" ${feeFilter.cls==="ALL"?"selected":""}>All Classes</option>
        ${CLASSES.map(cl=>`<option value="${cl}" ${feeFilter.cls===cl?"selected":""}>${cl}</option>`).join("")}
      </select>
    </div>
    <div>
      <label style="font-size:10px;color:${T.muted};display:block;margin-bottom:4px;font-weight:700;text-transform:uppercase">Status</label>
      <select onchange="feeFilter.status=this.value;refreshContent()" style="background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        <option value="ALL"     ${feeFilter.status==="ALL"?"selected":""}>All Status</option>
        <option value="paid"    ${feeFilter.status==="paid"?"selected":""}>✅ Paid</option>
        <option value="partial" ${feeFilter.status==="partial"?"selected":""}>🔄 Partial</option>
        <option value="pending" ${feeFilter.status==="pending"?"selected":""}>⏳ Pending</option>
        <option value="overdue" ${feeFilter.status==="overdue"?"selected":""}>🚨 Overdue</option>
        <option value="noPlan"  ${feeFilter.status==="noPlan"?"selected":""}>📋 No Plan</option>
      </select>
    </div>
    ${(feeFilter.cls!=="ALL"||feeFilter.status!=="ALL"||feeFilter.search.trim())
      ?`<button onclick="feeFilter={cls:'ALL',status:'ALL',search:''};refreshContent()" style="background:${T.redL};color:${T.red};border:1px solid #fca5a5;border-radius:10px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer">✕ Clear</button>`
      :""}
  </div>`;

  // ── STATS (clicking a stat filters by that status) ───────────────
  const statsHtml=`<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:14px">
    <div onclick="feeFilter={cls:'ALL',status:'paid',search:''};refreshContent()" style="background:${T.surface};border:1px solid ${feeFilter.status==='paid'?T.green:T.border};border-radius:14px;padding:18px;text-align:center;border-top:3px solid ${T.green};box-shadow:${T.shadow};cursor:pointer">
      <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:6px">✅ Paid</div>
      <div style="font-size:28px;font-weight:800;color:${T.green};font-family:'Space Grotesk',sans-serif">${paid}</div></div>
    <div onclick="feeFilter={cls:'ALL',status:'partial',search:''};refreshContent()" style="background:${T.surface};border:1px solid ${feeFilter.status==='partial'?T.orange:T.border};border-radius:14px;padding:18px;text-align:center;border-top:3px solid ${T.orange};box-shadow:${T.shadow};cursor:pointer">
      <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:6px">🔄 Partial</div>
      <div style="font-size:28px;font-weight:800;color:${T.orange};font-family:'Space Grotesk',sans-serif">${partial}</div></div>
    <div onclick="feeFilter={cls:'ALL',status:'pending',search:''};refreshContent()" style="background:${T.surface};border:1px solid ${feeFilter.status==='pending'?T.yellow:T.border};border-radius:14px;padding:18px;text-align:center;border-top:3px solid ${T.yellow};box-shadow:${T.shadow};cursor:pointer">
      <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:6px">⏳ Pending</div>
      <div style="font-size:28px;font-weight:800;color:${T.yellow};font-family:'Space Grotesk',sans-serif">${pending}</div></div>
    <div onclick="feeFilter={cls:'ALL',status:'overdue',search:''};refreshContent()" style="background:${T.surface};border:1px solid ${feeFilter.status==='overdue'?T.red:T.border};border-radius:14px;padding:18px;text-align:center;border-top:3px solid ${T.red};box-shadow:${T.shadow};cursor:pointer">
      <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:6px">🚨 Overdue</div>
      <div style="font-size:28px;font-weight:800;color:${T.red};font-family:'Space Grotesk',sans-serif">${overdue}</div></div>
    <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:18px;text-align:center;border-top:3px solid ${T.accent};box-shadow:${T.shadow}">
      <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:6px">💰 Collected</div>
      <div style="font-size:16px;font-weight:800;color:${T.accent};font-family:'Space Grotesk',sans-serif">PKR ${totalCollected.toLocaleString()}</div></div>
  </div>`;

  // ── APPLY FILTERS ────────────────────────────────────────────────
  const q=(feeFilter.search||"").toLowerCase().trim();
  const visibleStudents=students.filter(s=>{
    if(feeFilter.cls!=="ALL"&&s.cls!==feeFilter.cls)return false;
    if(feeFilter.status==="noPlan"&&feeInstallments[s.id])return false;
    if(feeFilter.status!=="ALL"&&feeFilter.status!=="noPlan"&&s.feeStatus!==feeFilter.status)return false;
    if(q&&!s.name.toLowerCase().includes(q)&&!s.id.toLowerCase().includes(q)&&!s.cls.toLowerCase().includes(q))return false;
    return true;
  });

  const planCards=visibleStudents.map(s=>{
    const plan=feeInstallments[s.id];
    const paidCount=plan?(plan.installments||[]).filter(i=>i.status==="paid").length:0;
    const borderCol=!plan?T.border:paidCount===3?T.green:paidCount>0?T.orange:T.yellow;
    return `<div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow};border-left:4px solid ${borderCol}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        ${ava(s.name,38,s.photo||null)}
        <div style="flex:1"><div style="font-weight:800;font-size:14px">${esc(s.name)}</div><div style="font-size:11px;color:${T.muted}">${s.id} · ${s.cls}${s.subjectGroup?` · ${s.subjectGroup}`:""}</div></div>
        ${badge(s.feeStatus)}
      </div>
      ${plan?`
        <div style="background:${T.bg};border-radius:10px;padding:10px 12px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:${T.muted};margin-bottom:6px">
            <span>Total: <strong style="color:${T.text}">PKR ${plan.totalFee.toLocaleString()}</strong> · Session: ${plan.session||"—"}</span>
            <span style="font-weight:700;color:${paidCount===3?T.green:T.orange}">${paidCount}/3 paid</span>
          </div>
          ${pbar(Math.round(paidCount/3*100),paidCount===3?T.green:T.orange)}
        </div>
        <div style="display:grid;gap:7px;margin-bottom:12px">
          ${(plan.installments||[]).map(inst=>{
            const iCol={paid:T.green,pending:T.yellow,overdue:T.red}[inst.status]||T.muted;
            return `<div style="background:${iCol}12;border:1px solid ${iCol}35;border-radius:10px;padding:10px 12px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px">
                <div>
                  <div style="font-size:12px;font-weight:700;color:${T.text}">Installment ${inst.no} &nbsp;·&nbsp; <span style="color:${T.accent}">PKR ${inst.amount.toLocaleString()}</span></div>
                  <div style="font-size:10px;color:${T.muted};margin-top:2px">📄 ${inst.voucherNo} &nbsp;|&nbsp; Due: ${inst.dueDate}</div>
                  ${inst.status==="paid"?`<div style="font-size:10px;color:${T.green};font-weight:700;margin-top:2px">✅ Paid ${inst.paidDate} · ${inst.receiptNo||""}</div>`:""}
                </div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
                  ${badge(inst.status,"sm")}
                  ${inst.status!=="paid"?`<button onclick="printFeeVoucher('${s.id}',${inst.no})" title="Print Voucher" style="background:${T.blueL};color:${T.blue};border:1px solid #bfdbfe;border-radius:7px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">🖨️ Voucher</button>`:""}
                  ${inst.status!=="paid"?`<button onclick="markInstallmentPaid('${s.id}',${inst.no})" style="background:${T.greenL};color:${T.green};border:1px solid #86efac;border-radius:7px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">✅ Mark Paid</button>`:""}
                  ${inst.status==="pending"?`<button onclick="setInstallmentOverdue('${s.id}',${inst.no})" style="background:${T.redL};color:${T.red};border:1px solid #fca5a5;border-radius:7px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">🚨</button>`:""}
                  ${inst.status==="paid"?`<button onclick="printInstallmentReceipt('${s.id}',${inst.no})" style="background:${T.purpleL};color:${T.purple};border:1px solid #c4b5fd;border-radius:7px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">🧾 Receipt</button>`:""}
                  ${inst.status==="paid"?`<button onclick="revertInstallmentPaid('${s.id}',${inst.no})" title="Revert" style="background:${T.yellowL};color:${T.yellow};border:1px solid #fcd34d;border-radius:7px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">↩️</button>`:""}
                </div>
              </div>
            </div>`;}).join("")}
        </div>
        <div style="display:flex;gap:8px">${obtn("✏️ Edit Plan",`openEditFeePlan('${s.id}')`, "sm")}${dbtn("🗑️ Remove",`removeFeePlan('${s.id}')`, "sm")}</div>
      `:`
        <div style="background:${T.bg};border-radius:10px;padding:12px;text-align:center;font-size:12px;color:${T.muted};margin-bottom:12px;border:1px dashed ${T.border2}">No fee plan yet</div>
        ${pbtn("+ Create 3-Installment Plan",`openCreateFeePlan('${s.id}')`, "sm")}
      `}
    </div>`;
  }).join("");

  const noResults=visibleStudents.length===0?`<div style="text-align:center;padding:60px;color:${T.muted};background:${T.surface};border:1px solid ${T.border};border-radius:16px;box-shadow:${T.shadow}"><div style="font-size:48px;margin-bottom:14px">🔍</div><div style="font-weight:700;font-size:16px">No students match</div><div style="font-size:13px;margin-top:6px">Try adjusting class, status, or search term</div></div>`:"";
  const countInfo=visibleStudents.length!==students.length?`<div style="font-size:12px;color:${T.muted};margin-bottom:12px;font-weight:600">Showing ${visibleStudents.length} of ${students.length} students</div>`:"";

  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
    ${secTitle("💳 Fee Management — 3 Installments")}${pbtn("📊 Fee Report","openModal('feeReport')")}
  </div>
  ${statsHtml}
  ${feeFilterBar}
  ${countInfo}
  ${noResults||`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">${planCards}</div>`}`;
}

function renderAdminAssignments(){
  return `${secTitle("Assignments Overview")}
  ${assignments.length===0?card(`<div style="text-align:center;padding:48px;color:${T.muted}"><div style="font-size:48px;margin-bottom:12px">📎</div><div style="font-weight:700">No assignments yet</div><div style="font-size:13px;margin-top:6px">Teachers post assignments from their portal</div></div>`):
  `<div style="display:grid;gap:12px">${assignments.map(a=>{const subs=submissions.filter(s=>s.assignmentId===a.id);const graded=subs.filter(s=>s.status==="graded").length;return `<div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:20px;box-shadow:${T.shadow};border-left:4px solid ${T.blue}"><div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px"><div><div style="font-weight:700;font-size:15px;margin-bottom:4px">${esc(a.title)}</div><div style="font-size:12px;color:${T.muted};margin-bottom:8px">📚 ${a.subject} · 🏫 ${a.cls} · 👨‍🏫 ${esc(a.teacherName)}</div><div style="display:flex;gap:8px;align-items:center"><span style="font-size:12px;color:${T.muted}">📅 Due: ${a.dueDate}</span><span style="font-size:12px;background:${T.blueL};color:${T.blue};border-radius:20px;padding:2px 10px;font-weight:700">${subs.length} submitted</span><span style="font-size:12px;background:${T.greenL};color:${T.green};border-radius:20px;padding:2px 10px;font-weight:700">${graded} graded</span></div></div></div></div>`;}).join("")}</div>`}`;}

function renderAdminTT(){
  return `${secTitle("Upload Teacher Timetables")}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px">
    ${teachers.map(t=>`<div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">${ava(t.name,40)}<div><div style="font-weight:700;font-size:14px">${esc(t.name)}</div><div style="font-size:11px;color:${T.accent};font-weight:600">${t.subject}</div></div></div>
      ${timetables[t.id]?`<div style="background:${T.accentL};border:1px solid ${T.border2};border-radius:10px;padding:10px 12px;margin-bottom:12px"><div style="font-size:12px;font-weight:600;color:${T.accent}">📎 ${esc(timetables[t.id].name)}</div><div style="font-size:11px;color:${T.muted};margin-top:2px">Uploaded: ${timetables[t.id].uploadedAt}</div></div>`:`<div style="background:${T.bg};border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:${T.muted}">No timetable uploaded yet</div>`}
      <label style="display:block;cursor:pointer"><input type="file" accept=".pdf,.xlsx,.csv,.jpg,.png" style="display:none" onchange="uploadTT('${t.id}',this)"/><span style="display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border-radius:10px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer">📤 ${timetables[t.id]?"Re-upload":"Upload"}</span></label>
    </div>`).join("")}
  </div>`;}

function renderAdminNotices(){
  const cmap={holiday:T.orange,academic:T.blue,event:T.green,fee:T.yellow};
  return `<div style="display:flex;justify-content:flex-end;margin-bottom:18px">${pbtn("+ Post Notice","openModal('addNotice')")}</div>
  <div style="display:grid;gap:12px">${notices.map(n=>`<div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:18px 22px;box-shadow:${T.shadow};border-left:4px solid ${cmap[n.type]||T.accent};display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
    <div><div style="font-weight:700;font-size:14px;margin-bottom:6px">${esc(n.title)}</div><div style="display:flex;gap:8px;align-items:center">${badge(n.type)}<span style="font-size:11px;color:${T.muted}">By ${esc(n.author)} · ${n.date}</span></div></div>
    ${dbtn("Delete",`delNotice(${n.id})`, "sm")}
  </div>`).join("")}</div>`;}

function renderAdminComplaints(){
  return complaints.length===0?card(`<div style="text-align:center;padding:48px;color:${T.muted}"><div style="font-size:48px;margin-bottom:12px">📭</div><div style="font-weight:700;font-size:16px">No complaints yet</div></div>`):
  `<div style="display:grid;gap:12px">${complaints.map(c=>`<div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:20px;box-shadow:${T.shadow};border-left:4px solid ${T.red}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
      <div style="flex:1"><div style="font-weight:700;font-size:14px;margin-bottom:4px">${esc(c.studentName)} <span style="font-size:11px;color:${T.muted}">(${c.studentId})</span></div><div style="font-size:13px;margin-bottom:8px;line-height:1.6">${esc(c.message)}</div><div style="font-size:12px;color:${T.muted}">📅 ${c.date} · 👨‍🏫 ${esc(c.teacherName)} · 📱 ${c.guardianPhone}</div></div>
      <a href="sms:${c.guardianPhone}?body=${encodeURIComponent(`Dear Guardian, regarding ${c.studentName}: ${c.message} - CMS`)}" style="display:inline-flex;align-items:center;gap:6px;background:${T.greenL};color:${T.green};border:1px solid #86efac;border-radius:10px;padding:8px 16px;font-size:12px;font-weight:700;flex-shrink:0">💬 SMS Guardian</a>
    </div>
  </div>`).join("")}</div>`;}

function renderAdminPortals(){
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
    ${card(`${secTitle("👨‍🎓 Student Portals")}<div style="display:grid;gap:8px">${students.map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:${T.bg};border-radius:10px;border:1px solid ${T.border}"><div style="display:flex;align-items:center;gap:8px">${ava(s.name,28,s.photo||null)}<div><div style="font-weight:600;font-size:13px">${esc(s.name)}</div><div style="font-size:11px;color:${T.muted}">${s.id} · ${s.cls}</div></div></div><div style="display:flex;gap:8px;align-items:center">${badge(s.portal)}${s.portal==="active"?wbtn("Revoke",`togglePortal('student','${s.id}')`, "sm"):sbtn("Grant",`togglePortal('student','${s.id}')`, "sm")}</div></div>`).join("")}</div>`)}
    ${card(`${secTitle("👨‍🏫 Teacher Portals")}<div style="display:grid;gap:8px">${teachers.map(t=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:${T.bg};border-radius:10px;border:1px solid ${T.border}"><div style="display:flex;align-items:center;gap:8px">${ava(t.name,28,t.photo||null)}<div><div style="font-weight:600;font-size:13px">${esc(t.name)}</div><div style="font-size:11px;color:${T.muted}">${t.id} · ${t.subject}</div></div></div><div style="display:flex;gap:8px;align-items:center">${badge(t.portal)}${t.portal==="active"?wbtn("Revoke",`togglePortal('teacher','${t.id}')`, "sm"):sbtn("Grant",`togglePortal('teacher','${t.id}')`, "sm")}</div></div>`).join("")}</div>`)}
  </div>`;}

// ═══════════════════════════════════════════════
// REPORTS MODULE
// ═══════════════════════════════════════════════
function renderReports(){
  const rTypes=["Attendance Report","Grade Sheet","Exam Sheet","Fee Report","Class Performance"];
  const months=MONTHS.map(m=>m+" "+new Date().getFullYear());
  return `
  ${secTitle("📋 Reports Center")}
  <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:18px;margin-bottom:20px;display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;box-shadow:${T.shadow}">
    <div><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase">Report Type</label>
      <select onchange="reportFilter.type=this.value;refreshContent()" style="background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        ${rTypes.map((r,i)=>`<option value="${["attendance","grades","exams","fees","performance"][i]}" ${reportFilter.type===["attendance","grades","exams","fees","performance"][i]?"selected":""}>${r}</option>`).join("")}
      </select></div>
    ${reportFilter.type!=="fees"&&reportFilter.type!=="performance"?`<div><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase">Class</label>
      <select onchange="
        if(window.dbClasses && window.dbClasses.length){
          const sel=this.options[this.selectedIndex];
          if(this.value==='ALL'){reportFilter.class_id=null;reportFilter.cls='ALL';}
          else{reportFilter.class_id=parseInt(this.value)||null;reportFilter.cls=sel.dataset.cls||this.value;}
        } else {
          reportFilter.cls=this.value;
        }
        refreshContent()
      " style="background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        ${(()=>{
          const effCls = dbClasses.length
            ? dbClasses
            : [...new Set(students.map(s=>s.cls).filter(Boolean))].sort().map(c=>({id:c,name:c,code:c}));
          return effCls.map(c=>`<option value="${c.id}" data-cls="${c.code||c.name}" ${c.id===reportFilter.class_id?'selected':''}>${c.name}${c.code&&c.code!==c.name?' ('+c.code+')':''}</option>`).join('');
        })()}
        <option value="ALL" ${reportFilter.class_id===null&&reportFilter.cls==="ALL"?"selected":""}>All Classes</option>
      </select></div>`:""}
    ${reportFilter.type==="attendance"||reportFilter.type==="fees"?`<div><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase">Month</label>
      <select onchange="reportFilter.month=this.value;refreshContent()" style="background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        ${months.map(m=>`<option value="${m}" ${m===reportFilter.month?"selected":""}>${m}</option>`).join("")}
      </select></div>`:""}
    <button onclick="printReport()" style="background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:10px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(5,150,105,.3)">🖨️ Print</button>
    <button onclick="downloadReportPDF()" style="background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;border:none;border-radius:10px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px">📄 PDF</button>
    <button onclick="downloadReportExcel()" style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:10px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px">📊 Excel</button>
    ${reportFilter.type==="performance"?`<button onclick="downloadPerformanceReport()" style="background:linear-gradient(135deg,${T.purple},#6d28d9);color:#fff;border:none;border-radius:10px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(124,58,237,.3)">⬇️ Download Report</button>`:""}
  </div>
  <div id="report-content" style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:28px;box-shadow:${T.shadow}">${generateReport()}</div>`;}

function generateReport(){
  const cls=reportFilter.cls||"CS-A";
  // Prefer class_id (DB-backed) filtering over legacy cls string matching
  const rStudents = reportFilter.cls==="ALL"
    ? students
    : reportFilter.class_id
      ? students.filter(s => s.class_id===reportFilter.class_id || s.classId===reportFilter.class_id)
      : students.filter(s=>s.cls===cls);
  if(reportFilter.type==="attendance"){
    const dates=weekDays;const totalDays=dates.length;
    return `<div style="text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid ${T.border}"><div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:800;color:${T.text}">Monthly Attendance Report</div><div style="font-size:13px;color:${T.muted};margin-top:4px">Class: ${cls==="ALL"?"All Classes":cls} · Month: ${reportFilter.month} · Total Working Days: ${totalDays}</div><div style="font-size:11px;color:${T.muted};margin-top:2px">NEXus Solution · Generated: ${new Date().toLocaleDateString()}</div></div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:${T.bg2}"><th style="padding:10px 12px;text-align:left;font-weight:700;border:1px solid ${T.border}">Roll#</th><th style="padding:10px 12px;text-align:left;font-weight:700;border:1px solid ${T.border}">Student Name</th><th style="padding:10px 12px;text-align:left;font-weight:700;border:1px solid ${T.border}">Class</th>${dates.map(d=>`<th style="padding:10px 6px;text-align:center;font-weight:700;border:1px solid ${T.border};white-space:nowrap;font-size:10px">${d.slice(5)}</th>`).join("")}<th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">Present</th><th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">Absent</th><th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">%</th><th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">Status</th></tr></thead>
    <tbody>${rStudents.map((s,i)=>{const myAtt=attendance[s.id]||{};const pres=dates.filter(d=>myAtt[d]==="present").length;const abs=dates.filter(d=>myAtt[d]==="absent").length;const pct=totalDays?Math.round(pres/totalDays*100):0;const col=pct>=75?T.green:T.red;return `<tr style="background:${i%2?"#f9fffe":"#fff"}"><td style="padding:8px 12px;border:1px solid ${T.border};font-weight:600">${s.rollNo}</td><td style="padding:8px 12px;border:1px solid ${T.border};font-weight:600">${esc(s.name)}</td><td style="padding:8px 12px;border:1px solid ${T.border}">${s.cls}</td>${dates.map(d=>{const st=myAtt[d]||"absent";const ic=st==="present"?"✓":st==="late"?"L":"✗";const c=st==="present"?T.green:st==="late"?T.yellow:T.red;return `<td style="padding:6px;text-align:center;border:1px solid ${T.border};color:${c};font-weight:700;font-size:11px">${ic}</td>`;}).join("")}<td style="padding:8px;text-align:center;border:1px solid ${T.border};color:${T.green};font-weight:700">${pres}</td><td style="padding:8px;text-align:center;border:1px solid ${T.border};color:${T.red};font-weight:700">${abs}</td><td style="padding:8px;text-align:center;border:1px solid ${T.border};color:${col};font-weight:800">${pct}%</td><td style="padding:8px;text-align:center;border:1px solid ${T.border}"><span style="background:${col}20;color:${col};border-radius:20px;padding:2px 8px;font-weight:700;font-size:10px">${pct>=75?"Regular":"Short"}</span></td></tr>`;}).join("")}</tbody></table></div>`;
  }
  if(reportFilter.type==="grades"){
    return `<div style="text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid ${T.border}"><div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:800">Grade Sheet</div><div style="font-size:13px;color:${T.muted};margin-top:4px">Class: ${cls==="ALL"?"All Classes":cls} · Academic Year: 2025–26</div></div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:${T.bg2}"><th style="padding:10px 12px;border:1px solid ${T.border};text-align:left">Roll#</th><th style="padding:10px 12px;border:1px solid ${T.border};text-align:left">Name</th><th style="padding:10px 12px;border:1px solid ${T.border};text-align:left">Class</th>${SUBJECTS.slice(0,5).map(sub=>`<th style="padding:10px 8px;border:1px solid ${T.border};text-align:center;font-size:10px;white-space:nowrap">${sub.split(" ")[0]}</th>`).join("")}<th style="padding:10px 8px;border:1px solid ${T.border};text-align:center">Grade</th><th style="padding:10px 8px;border:1px solid ${T.border};text-align:center">Result</th><th style="padding:10px 8px;border:1px solid ${T.border};text-align:center">Sheet</th></tr></thead>
    <tbody>${rStudents.map((s,i)=>{const sg=grades[s.id]||{};const tots=SUBJECTS.slice(0,5).map(sub=>sg[sub]?.total||0);const total=tots.reduce((a,b)=>a+b,0);const avg=tots.length?Math.round(total/tots.length):0;const gl=gradeLabel(avg);const col=gradeColor(avg);const passed=avg>=45;return `<tr style="background:${i%2?"#f9fffe":"#fff"}"><td style="padding:8px 12px;border:1px solid ${T.border};font-weight:600">${s.rollNo}</td><td style="padding:8px 12px;border:1px solid ${T.border};font-weight:700">${esc(s.name)}</td><td style="padding:8px 12px;border:1px solid ${T.border}">${s.cls}</td>${SUBJECTS.slice(0,5).map(sub=>{const t=sg[sub]?.total||0;return `<td style="padding:8px;text-align:center;border:1px solid ${T.border};color:${gradeColor(t)};font-weight:700">${t||"-"}</td>`;}).join("")}<td style="padding:8px;text-align:center;border:1px solid ${T.border}"><span style="background:${col}20;color:${col};border-radius:20px;padding:2px 8px;font-weight:800">${gl}</span></td><td style="padding:8px;text-align:center;border:1px solid ${T.border}"><span style="background:${passed?T.greenL:T.redL};color:${passed?T.green:T.red};border-radius:20px;padding:2px 8px;font-weight:700;font-size:11px">${passed?"Pass":"Fail"}</span></td><td style="padding:6px;text-align:center;border:1px solid ${T.border}"><button onclick="downloadStudentGradesPDF('${s.id}')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:8px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer">📄 PDF</button></td></tr>`;}).join("")}</tbody></table></div>`;
  }
  if(reportFilter.type==="exams"){
    const clsExams=cls==="ALL"?exams:exams.filter(e=>e.cls===cls);
    return `<div style="text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid ${T.border}"><div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:800">Exam Schedule Sheet</div><div style="font-size:13px;color:${T.muted};margin-top:4px">Class: ${cls==="ALL"?"All Classes":cls}</div></div>
    ${clsExams.length===0?`<div style="text-align:center;padding:40px;color:${T.muted}">No exams scheduled</div>`:`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:${T.bg2}"><th style="padding:12px 14px;font-weight:700;border:1px solid ${T.border}">#</th><th style="padding:12px 14px;font-weight:700;border:1px solid ${T.border}">Exam</th><th style="padding:12px 14px;font-weight:700;border:1px solid ${T.border}">Subject</th><th style="padding:12px 14px;font-weight:700;border:1px solid ${T.border}">Class</th><th style="padding:12px 14px;font-weight:700;border:1px solid ${T.border}">Date</th><th style="padding:12px 14px;font-weight:700;border:1px solid ${T.border}">Time</th><th style="padding:12px 14px;font-weight:700;border:1px solid ${T.border}">Room</th><th style="padding:12px 14px;text-align:center;font-weight:700;border:1px solid ${T.border}">Marks</th></tr></thead><tbody>${clsExams.map((e,i)=>`<tr style="background:${i%2?"#f9fffe":"#fff"}"><td style="padding:10px 14px;border:1px solid ${T.border}">${i+1}</td><td style="padding:10px 14px;border:1px solid ${T.border};font-weight:700">${esc(e.title)}</td><td style="padding:10px 14px;border:1px solid ${T.border}">${esc(e.subject)}</td><td style="padding:10px 14px;border:1px solid ${T.border}">${e.cls}</td><td style="padding:10px 14px;border:1px solid ${T.border};font-weight:600">${e.date}</td><td style="padding:10px 14px;border:1px solid ${T.border}">${e.time}</td><td style="padding:10px 14px;border:1px solid ${T.border}">${e.room}</td><td style="padding:10px 14px;text-align:center;border:1px solid ${T.border};font-weight:800;color:${T.accent}">${e.totalMarks}</td></tr>`).join("")}</tbody></table></div>`}`;
  }
  if(reportFilter.type==="fees"){
    const paidStudents=students.filter(s=>s.feeStatus==="paid");
    const totalCollected=paidStudents.reduce((acc,s)=>{const v=(feeVouchers[s.id]||[])[0];return acc+(v?.amount||15000);},0);
    return `<div style="text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid ${T.border}"><div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:800">Fee Collection Report</div><div style="font-size:13px;color:${T.muted};margin-top:4px">Month: ${reportFilter.month}</div></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px">${[["💰 Collected","PKR "+totalCollected.toLocaleString(),T.green],["✅ Paid",paidStudents.length+" students",T.green],["⏳ Pending",students.filter(s=>s.feeStatus==="pending").length+" students",T.yellow],["🚨 Overdue",students.filter(s=>s.feeStatus==="overdue").length+" students",T.red]].map(([l,v,c])=>`<div style="background:${c}10;border:1px solid ${c}30;border-radius:12px;padding:16px;text-align:center"><div style="font-size:11px;color:${T.muted};font-weight:700;margin-bottom:6px">${l}</div><div style="font-size:18px;font-weight:800;color:${c};font-family:'Space Grotesk',sans-serif">${v}</div></div>`).join("")}</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:${T.bg2}"><th style="padding:10px 14px;text-align:left;border:1px solid ${T.border};font-weight:700">Student</th><th style="padding:10px 14px;text-align:left;border:1px solid ${T.border};font-weight:700">ID</th><th style="padding:10px 14px;text-align:left;border:1px solid ${T.border};font-weight:700">Class</th><th style="padding:10px 14px;text-align:center;border:1px solid ${T.border};font-weight:700">Amount</th><th style="padding:10px 14px;text-align:center;border:1px solid ${T.border};font-weight:700">Status</th></tr></thead><tbody>${students.map((s,i)=>{const col={paid:T.green,pending:T.yellow,overdue:T.red}[s.feeStatus]||T.muted;return `<tr style="background:${i%2?"#f9fffe":"#fff"}"><td style="padding:9px 14px;border:1px solid ${T.border};font-weight:700">${esc(s.name)}</td><td style="padding:9px 14px;border:1px solid ${T.border};color:${T.accent};font-weight:700">${s.id}</td><td style="padding:9px 14px;border:1px solid ${T.border}">${s.cls}</td><td style="padding:9px 14px;text-align:center;border:1px solid ${T.border};font-weight:700">15,000</td><td style="padding:9px 14px;text-align:center;border:1px solid ${T.border}"><span style="background:${col}20;color:${col};border-radius:20px;padding:2px 10px;font-weight:700;font-size:11px;text-transform:capitalize">${s.feeStatus}</span></td></tr>`;}).join("")}</tbody></table></div>`;
  }
  if(reportFilter.type==="performance"){
    // ── per-class stats ──────────────────────────────────────────────
    const classStats=CLASSES.map(cl=>{
      const cs=students.filter(s=>s.cls===cl);
      if(!cs.length)return null;
      const results=cs.map(s=>{
        const subs=SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||[];
        const sg=grades[s.id]||{};
        const tots=subs.map(sub=>sg[sub]?.total||0);
        const avg=tots.length?Math.round(tots.reduce((a,b)=>a+b,0)/tots.length):0;
        const passed=avg>=45;
        return {s,avg,passed};
      });
      const passed=results.filter(r=>r.passed).length;
      const failed=results.filter(r=>!r.passed).length;
      const passPct=Math.round(passed/cs.length*100);
      const failPct=100-passPct;
      const avgScore=Math.round(results.reduce((a,r)=>a+r.avg,0)/results.length);
      // attendance
      const attDates=weekDays;
      const attPcts=cs.map(s=>{const ma=attendance[s.id]||{};const p=attDates.filter(d=>ma[d]==="present").length;return attDates.length?Math.round(p/attDates.length*100):0;});
      const avgAtt=attDates.length&&cs.length?Math.round(attPcts.reduce((a,b)=>a+b,0)/attPcts.length):0;
      // grade distribution
      const gradeDistrib={A:0,B:0,C:0,D:0,F:0};
      results.forEach(r=>{const g=gradeLabel(r.avg);if(g==="A+"||g==="A")gradeDistrib.A++;else if(g==="B+"||g==="B")gradeDistrib.B++;else if(g==="C")gradeDistrib.C++;else if(g==="D")gradeDistrib.D++;else gradeDistrib.F++;});
      return {cl,total:cs.length,passed,failed,passPct,failPct,avgScore,avgAtt,gradeDistrib,results};
    }).filter(Boolean);

    // ── overall totals ───────────────────────────────────────────────
    const grandTotal=students.length;
    const grandPassed=classStats.reduce((a,c)=>a+c.passed,0);
    const grandFailed=classStats.reduce((a,c)=>a+c.failed,0);
    const grandPassPct=grandTotal?Math.round(grandPassed/grandTotal*100):0;
    const grandAvg=classStats.length?Math.round(classStats.reduce((a,c)=>a+c.avgScore,0)/classStats.length):0;
    const grandAtt=classStats.length?Math.round(classStats.reduce((a,c)=>a+c.avgAtt,0)/classStats.length):0;

    // ── draw bar charts after render ─────────────────────────────────
    scheduleChart(()=>{
      // pass/fail chart
      const canvas=document.getElementById("perfBarChart");
      if(canvas){
        const ctx=canvas.getContext("2d");
        const W=canvas.width,H=canvas.height;
        const pad={top:20,right:20,bottom:36,left:40};
        const cw=W-pad.left-pad.right,ch=H-pad.top-pad.bottom;
        ctx.clearRect(0,0,W,H);ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
        const gLines=5;
        for(let i=0;i<=gLines;i++){const y=pad.top+ch-(i/gLines)*ch;ctx.strokeStyle="#e5e7eb";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(pad.left+cw,y);ctx.stroke();ctx.fillStyle="#9ca3af";ctx.font="9px Plus Jakarta Sans,sans-serif";ctx.textAlign="right";ctx.fillText(Math.round(i/gLines*100)+"%",pad.left-4,y+3);}
        const gw=cw/classStats.length;const bw=Math.min(gw*0.3,28);
        classStats.forEach((c,li)=>{
          const passH=(c.passPct/100)*ch;const failH=(c.failPct/100)*ch;
          const gx=pad.left+gw*li+gw/2;
          // pass bar
          const px=gx-bw-2;const py=pad.top+ch-passH;
          ctx.fillStyle="#16a34a";ctx.beginPath();const r=Math.min(4,passH/2);ctx.moveTo(px+r,py);ctx.lineTo(px+bw-r,py);ctx.arcTo(px+bw,py,px+bw,py+r,r);ctx.lineTo(px+bw,pad.top+ch);ctx.lineTo(px,pad.top+ch);ctx.lineTo(px,py+r);ctx.arcTo(px,py,px+r,py,r);ctx.closePath();ctx.fill();
          if(passH>14){ctx.fillStyle="#fff";ctx.font="bold 9px Plus Jakarta Sans,sans-serif";ctx.textAlign="center";ctx.fillText(c.passPct+"%",px+bw/2,py+12);}
          // fail bar
          const fx=gx+2;const fy=pad.top+ch-failH;
          ctx.fillStyle="#dc2626";ctx.beginPath();const r2=Math.min(4,failH/2);ctx.moveTo(fx+r2,fy);ctx.lineTo(fx+bw-r2,fy);ctx.arcTo(fx+bw,fy,fx+bw,fy+r2,r2);ctx.lineTo(fx+bw,pad.top+ch);ctx.lineTo(fx,pad.top+ch);ctx.lineTo(fx,fy+r2);ctx.arcTo(fx,fy,fx+r2,fy,r2);ctx.closePath();ctx.fill();
          if(failH>14){ctx.fillStyle="#fff";ctx.font="bold 9px Plus Jakarta Sans,sans-serif";ctx.textAlign="center";ctx.fillText(c.failPct+"%",fx+bw/2,fy+12);}
          // label
          ctx.fillStyle="#374151";ctx.font="11px Plus Jakarta Sans,sans-serif";ctx.textAlign="center";ctx.fillText(c.cl,gx,pad.top+ch+16);
        });
        // legend
        ctx.fillStyle="#16a34a";ctx.fillRect(pad.left,H-10,12,8);ctx.fillStyle="#374151";ctx.font="10px Plus Jakarta Sans,sans-serif";ctx.textAlign="left";ctx.fillText("Pass %",pad.left+16,H-3);
        ctx.fillStyle="#dc2626";ctx.fillRect(pad.left+80,H-10,12,8);ctx.fillStyle="#374151";ctx.fillText("Fail %",pad.left+96,H-3);
      }
      // avg score chart
      const canvas2=document.getElementById("perfAvgChart");
      if(canvas2)drawBarChart("perfAvgChart",classStats.map(c=>c.cl),[{label:"Avg Score",data:classStats.map(c=>c.avgScore),color:"#7c3aed"},{label:"Avg Att %",data:classStats.map(c=>c.avgAtt),color:"#059669"}],{maxVal:100});
    });

    return `
    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid ${T.border}">
      <div style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800;color:${T.text}">📊 Class Performance Report</div>
      <div style="font-size:13px;color:${T.muted};margin-top:5px">Academic Year 2025–26 &nbsp;·&nbsp; All Classes &nbsp;·&nbsp; NEXus Solution</div>
      <div style="font-size:11px;color:${T.muted};margin-top:2px">Generated: ${new Date().toLocaleString()}</div>
    </div>

    <!-- Overall summary cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-bottom:26px">
      ${[
        ["🎓","Total Students",grandTotal,T.accent],
        ["✅","Total Passed",grandPassed,T.green],
        ["❌","Total Failed",grandFailed,T.red],
        ["📊","Overall Pass %",grandPassPct+"%",grandPassPct>=50?T.green:T.red],
        ["📈","Overall Avg Score",grandAvg,gradeColor(grandAvg)],
        ["📋","Avg Attendance",grandAtt+"%",grandAtt>=75?T.green:T.red]
      ].map(([icon,label,val,col])=>`
        <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:18px 14px;text-align:center;box-shadow:${T.shadow};border-top:3px solid ${col}">
          <div style="font-size:22px;margin-bottom:6px">${icon}</div>
          <div style="font-size:26px;font-weight:800;color:${col};font-family:'Space Grotesk',sans-serif;line-height:1">${val}</div>
          <div style="font-size:11px;color:${T.muted};font-weight:600;margin-top:5px">${label}</div>
        </div>`).join("")}
    </div>

    <!-- Charts row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:26px">
      <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:20px;box-shadow:${T.shadow}">
        <div style="font-weight:800;font-size:13px;color:${T.text};margin-bottom:14px;font-family:'Space Grotesk',sans-serif">✅ Pass vs ❌ Fail — By Class</div>
        <canvas id="perfBarChart" width="420" height="200" style="width:100%;height:200px"></canvas>
      </div>
      <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:20px;box-shadow:${T.shadow}">
        <div style="font-weight:800;font-size:13px;color:${T.text};margin-bottom:14px;font-family:'Space Grotesk',sans-serif">📈 Avg Score & Attendance — By Class</div>
        <canvas id="perfAvgChart" width="420" height="200" style="width:100%;height:200px"></canvas>
      </div>
    </div>

    <!-- Per-class breakdown cards -->
    <div style="font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:800;color:${T.text};margin-bottom:14px">📋 Detailed Breakdown by Class</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-bottom:26px">
      ${classStats.map(c=>{
        const passCol=c.passPct>=50?T.green:T.red;
        return `
        <div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow};border-top:4px solid ${passCol}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:800;color:${T.text}">${c.cl}</div>
            <span style="background:${passCol}15;color:${passCol};border-radius:20px;padding:4px 14px;font-size:12px;font-weight:800">${c.total} Students</span>
          </div>
          <!-- Pass / Fail row -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <div style="background:${T.greenL};border:1px solid #86efac;border-radius:12px;padding:12px;text-align:center">
              <div style="font-size:28px;font-weight:800;color:${T.green};font-family:'Space Grotesk',sans-serif">${c.passed}</div>
              <div style="font-size:11px;color:${T.green};font-weight:700;margin-top:2px">✅ Passed</div>
              <div style="font-size:20px;font-weight:800;color:${T.green};margin-top:4px">${c.passPct}%</div>
            </div>
            <div style="background:${T.redL};border:1px solid #fca5a5;border-radius:12px;padding:12px;text-align:center">
              <div style="font-size:28px;font-weight:800;color:${T.red};font-family:'Space Grotesk',sans-serif">${c.failed}</div>
              <div style="font-size:11px;color:${T.red};font-weight:700;margin-top:2px">❌ Failed</div>
              <div style="font-size:20px;font-weight:800;color:${T.red};margin-top:4px">${c.failPct}%</div>
            </div>
          </div>
          <!-- Pass % progress bar -->
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:5px"><span style="color:${T.green}">Pass Rate</span><span style="color:${passCol}">${c.passPct}%</span></div>
            <div style="background:#f1f5f9;border-radius:99px;height:10px;overflow:hidden">
              <div style="width:${c.passPct}%;height:100%;background:linear-gradient(90deg,${T.green},#4ade80);border-radius:99px;transition:width .4s"></div>
            </div>
          </div>
          <!-- Avg score & attendance -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <div style="background:${T.bg};border-radius:10px;padding:10px 12px;border:1px solid ${T.border}">
              <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:4px">Avg Score</div>
              <div style="font-size:20px;font-weight:800;color:${gradeColor(c.avgScore)};font-family:'Space Grotesk',sans-serif">${c.avgScore}</div>
              <div style="font-size:10px;font-weight:700;color:${gradeColor(c.avgScore)};margin-top:2px">${gradeLabel(c.avgScore)}</div>
            </div>
            <div style="background:${T.bg};border-radius:10px;padding:10px 12px;border:1px solid ${T.border}">
              <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:4px">Avg Attendance</div>
              <div style="font-size:20px;font-weight:800;color:${c.avgAtt>=75?T.green:T.red};font-family:'Space Grotesk',sans-serif">${c.avgAtt}%</div>
              <div style="font-size:10px;font-weight:700;color:${c.avgAtt>=75?T.green:T.red};margin-top:2px">${c.avgAtt>=75?"Regular":"Short"}</div>
            </div>
          </div>
          <!-- Grade distribution -->
          <div style="background:${T.bg};border-radius:10px;padding:12px;border:1px solid ${T.border}">
            <div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:8px">Grade Distribution</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${Object.entries(c.gradeDistrib).map(([g,cnt])=>{
                const gc=g==="A"?T.green:g==="B"?T.accent:g==="C"?T.blue:g==="D"?T.yellow:T.red;
                const pct=c.total?Math.round(cnt/c.total*100):0;
                return `<div style="flex:1;min-width:38px;text-align:center;background:${gc}15;border:1px solid ${gc}40;border-radius:8px;padding:6px 4px">
                  <div style="font-size:16px;font-weight:800;color:${gc};font-family:'Space Grotesk',sans-serif">${cnt}</div>
                  <div style="font-size:10px;font-weight:700;color:${gc}">${g}</div>
                  <div style="font-size:9px;color:${T.muted}">${pct}%</div>
                </div>`;}).join("")}
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>

    <!-- Full student-level table -->
    <div style="font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:800;color:${T.text};margin-bottom:14px">👨‍🎓 Student-Level Results</div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:${T.bg2}">
            <th style="padding:10px 12px;text-align:left;font-weight:700;border:1px solid ${T.border}">#</th>
            <th style="padding:10px 12px;text-align:left;font-weight:700;border:1px solid ${T.border}">Student</th>
            <th style="padding:10px 12px;text-align:left;font-weight:700;border:1px solid ${T.border}">Class</th>
            <th style="padding:10px 12px;text-align:left;font-weight:700;border:1px solid ${T.border}">Group</th>
            <th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">Avg Score</th>
            <th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">Grade</th>
            <th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">Attendance %</th>
            <th style="padding:10px 8px;text-align:center;font-weight:700;border:1px solid ${T.border}">Result</th>
          </tr>
        </thead>
        <tbody>
          ${students.map((s,i)=>{
            const subs=SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||[];
            const sg=grades[s.id]||{};
            const tots=subs.map(sub=>sg[sub]?.total||0);
            const avg=tots.length?Math.round(tots.reduce((a,b)=>a+b,0)/tots.length):0;
            const passed=avg>=45;
            const ma=attendance[s.id]||{};
            const attP=weekDays.filter(d=>ma[d]==="present").length;
            const attPct=weekDays.length?Math.round(attP/weekDays.length*100):0;
            const gl=gradeLabel(avg);const gc=gradeColor(avg);
            return `<tr style="background:${i%2?"#f9fffe":"#fff"}">
              <td style="padding:8px 12px;border:1px solid ${T.border};color:${T.muted};font-weight:600">${i+1}</td>
              <td style="padding:8px 12px;border:1px solid ${T.border};font-weight:700">${esc(s.name)}</td>
              <td style="padding:8px 12px;border:1px solid ${T.border}"><span style="background:${T.accentL};color:${T.accentD};border-radius:12px;padding:1px 8px;font-weight:700">${s.cls}</span></td>
              <td style="padding:8px 12px;border:1px solid ${T.border};font-size:11px;color:${T.muted};font-weight:600">${s.subjectGroup||"—"}</td>
              <td style="padding:8px;text-align:center;border:1px solid ${T.border};font-weight:800;color:${gc}">${avg}</td>
              <td style="padding:8px;text-align:center;border:1px solid ${T.border}"><span style="background:${gc}20;color:${gc};border-radius:20px;padding:2px 10px;font-weight:800;font-size:11px">${gl}</span></td>
              <td style="padding:8px;text-align:center;border:1px solid ${T.border};font-weight:700;color:${attPct>=75?T.green:T.red}">${attPct}%</td>
              <td style="padding:8px;text-align:center;border:1px solid ${T.border}"><span style="background:${passed?T.greenL:T.redL};color:${passed?T.green:T.red};border-radius:20px;padding:2px 10px;font-weight:800;font-size:11px">${passed?"✅ Pass":"❌ Fail"}</span></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
  }
  return `<div style="text-align:center;padding:40px;color:${T.muted}">Select a report type above</div>`;
}

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

  // Smart matching: find which subject-groups study this teacher's subject
  // First try exact match in SUBJECT_TO_GROUPS, then fallback to scanning SUBJECT_GROUPS
  let eligibleGroups=SUBJECT_TO_GROUPS[subj]||[];
  if(!eligibleGroups.length){
    // Fallback: scan all groups manually (handles newly added subjects)
    eligibleGroups=Object.keys(SUBJECT_GROUPS).filter(g=>(SUBJECT_GROUPS[g]||[]).includes(subj));
  }

  // Filter students: must belong to a group that studies this subject
  const myStudents=students.filter(s=>{
    const grp=s.subjectGroup||"Computer Science";
    return eligibleGroups.includes(grp);
  });

  // Further split by class for display (grouped view)
  const classesPresent=[...new Set(myStudents.map(s=>s.cls))].sort();

  // Active class filter for this teacher attendance
  if(!window._tAttCls||!classesPresent.includes(window._tAttCls))window._tAttCls=classesPresent[0]||"";
  const activeCls=window._tAttCls;
  const visStudents=activeCls?myStudents.filter(s=>s.cls===activeCls):myStudents;
  const ids=visStudents.map(s=>s.id);

  // Stats for current date & visible students
  const presentCount=visStudents.filter(s=>(attendance[s.id]?.[attFilter.date]||"absent")==="present").length;
  const absentCount=visStudents.filter(s=>(attendance[s.id]?.[attFilter.date]||"absent")==="absent").length;
  const lateCount=visStudents.filter(s=>(attendance[s.id]?.[attFilter.date]||"absent")==="late").length;
  const pct=visStudents.length?Math.round(presentCount/visStudents.length*100):0;

  return `
  <!-- Header -->
  <div style="background:linear-gradient(135deg,${T.accent},${T.accentD});border-radius:16px;padding:20px 24px;margin-bottom:20px;color:#fff;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
    <div>
      <div style="font-size:11px;font-weight:700;opacity:.75;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Subject Attendance</div>
      <div style="font-size:20px;font-weight:800;font-family:'Space Grotesk',sans-serif">📚 ${esc(subj)}</div>
      <div style="font-size:12px;opacity:.85;margin-top:3px">${eligibleGroups.length?eligibleGroups.join(" · "):"No groups mapped — contact admin"}</div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div style="background:rgba(255,255,255,.18);border-radius:12px;padding:10px 16px;text-align:center">
        <div style="font-size:22px;font-weight:800;font-family:'Space Grotesk',sans-serif">${myStudents.length}</div>
        <div style="font-size:10px;opacity:.85;font-weight:600">Total</div>
      </div>
      <div style="background:rgba(255,255,255,.18);border-radius:12px;padding:10px 16px;text-align:center">
        <div style="font-size:22px;font-weight:800;font-family:'Space Grotesk',sans-serif">${classesPresent.length}</div>
        <div style="font-size:10px;opacity:.85;font-weight:600">Classes</div>
      </div>
    </div>
  </div>

  ${myStudents.length===0?`
  <!-- Empty state -->
  <div style="background:${T.surface};border:2px dashed ${T.border2};border-radius:16px;padding:56px 24px;text-align:center">
    <div style="font-size:48px;margin-bottom:12px">📭</div>
    <div style="font-weight:800;font-size:16px;color:${T.text};margin-bottom:6px">No Students Found for "${esc(subj)}"</div>
    <div style="font-size:13px;color:${T.muted};max-width:340px;margin:0 auto">
      This subject is not mapped to any student group. Please contact the administrator to assign students to this subject.
    </div>
  </div>`:`

  <!-- Controls bar -->
  <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:16px 20px;margin-bottom:16px;box-shadow:${T.shadow}">
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">
      <!-- Date picker -->
      <div>
        <label style="font-size:10px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">📅 Date</label>
        <input type="date" value="${attFilter.date}" onchange="attFilter.date=this.value;refreshContent()"
          style="background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 14px;color:${T.text};font-size:13px;outline:none;font-family:'Plus Jakarta Sans',sans-serif;font-weight:600"/>
      </div>
      <!-- Class tabs -->
      ${classesPresent.length>1?`
      <div>
        <label style="font-size:10px;color:${T.muted};display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">🏫 Filter by Class</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button onclick="window._tAttCls='';refreshContent()"
            style="background:${activeCls===''?T.accent:'#fff'};color:${activeCls===''?'#fff':T.muted};border:1.5px solid ${activeCls===''?T.accent:T.border};border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">All</button>
          ${classesPresent.map(c=>`
          <button onclick="window._tAttCls='${c}';refreshContent()"
            style="background:${activeCls===c?T.accent:'#fff'};color:${activeCls===c?'#fff':T.muted};border:1.5px solid ${activeCls===c?T.accent:T.border};border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${c}</button>`).join("")}
        </div>
      </div>`:""}
      <!-- Bulk actions -->
      <div style="margin-left:auto;display:flex;gap:8px;align-items:flex-end">
        ${sbtn("✅ All Present","bulkSubjectAtt('present',"+JSON.stringify(ids)+")")}
        ${dbtn("❌ All Absent","bulkSubjectAtt('absent',"+JSON.stringify(ids)+")")}
      </div>
    </div>
  </div>

  <!-- Attendance stats strip -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
    ${[["✅ Present",presentCount,T.green,T.greenL],["❌ Absent",absentCount,T.red,T.redL],["⏰ Late",lateCount,T.yellow,T.yellowL],["📊 Rate",pct+"%",pct>=75?T.green:pct>=50?T.yellow:T.red,pct>=75?T.greenL:pct>=50?T.yellowL:T.redL]].map(([l,v,c,bg])=>`
    <div style="background:${bg};border:1px solid ${c}30;border-radius:12px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:11px;color:${c};font-weight:700">${l}</div>
      <div style="font-size:20px;font-weight:800;color:${c};font-family:'Space Grotesk',sans-serif">${v}</div>
    </div>`).join("")}
  </div>

  <!-- Student list -->
  <div style="display:grid;gap:10px">
    ${visStudents.length===0?`
    <div style="background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:40px;text-align:center;color:${T.muted}">
      No students in class <strong>${activeCls}</strong> for this subject.
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
              Roll# ${s.rollNo||"—"} &nbsp;·&nbsp; <span style="background:${T.accentL};color:${T.accentD};border-radius:6px;padding:1px 7px;font-weight:700">${s.cls}</span>
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

// ─── Teacher: grades scoped to teacher's own subject only ──────────
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
        ${CLASSES.map(cl=>`<option value="${cl}" ${gradesFilter.cls===cl?"selected":""}>${cl}</option>`).join("")}
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
          ${examScore?`<span style="background:${gradeColor(pct)}20;color:${gradeColor(pct)};border-radius:20px;padding:3px 12px;font-weight:800;font-size:12px">${gradeLabel(pct)}</span>`:"—"}
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
          <span id="grade-total-${s.id}-${subj.replace(/\s/g,'_')}" style="background:${gradeColor(tot)}20;color:${gradeColor(tot)};border-radius:20px;padding:3px 12px;font-weight:800;font-size:12px">${tot||0} · ${gradeLabel(tot)}</span>
        </td>
      </tr>`;}).join("")}</tbody>
  </table></div>`, "", 0)}`;
}


function renderTeacherDash(t){
  const subj=t?.subject||'';
  const eligGrps=SUBJECT_TO_GROUPS[subj]||Object.keys(SUBJECT_GROUPS).filter(g=>(SUBJECT_GROUPS[g]||[]).includes(subj));
  const myStudents=students.filter(s=>eligGrps.includes(s.subjectGroup||'Computer Science'));

  // Today's present count (all campus)
  const tp=Object.values(attendance).filter(r=>r[today]==='present').length;
  // My subject students present today
  const myPresentToday=myStudents.filter(s=>attendance[s.id]?.[today]==='present').length;

  const myAssignments=assignments.filter(a=>a.teacherId===t?.id);
  const pendingSubs=submissions.filter(s=>myAssignments.some(a=>a.id===s.assignmentId)&&s.status==='submitted').length;

  // Per-class attendance (teacher's subject students only)
  const classAttData=CLASSES.map(cls=>{const cs=myStudents.filter(s=>s.cls===cls);const pres=cs.filter(s=>attendance[s.id]?.[today]==='present').length;return cs.length?Math.round(pres/cs.length*100):0;});

  // Week trend — teacher's subject students attendance per day
  const weekLabels=weekDays.map(d=>new Date(d).toLocaleDateString('en',{weekday:'short'}));
  const weekAttData=weekDays.map(d=>{const pres=myStudents.filter(s=>attendance[s.id]?.[d]==='present').length;return myStudents.length?Math.round(pres/myStudents.length*100):0;});

  scheduleChart(()=>drawBarChart('tAttChart',CLASSES,[{label:'Attendance %',data:classAttData,color:T.accent}],{maxVal:100}),'tAttChart');
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
    ${card(`${secTitle('📊 Subject Coverage')}<div style="display:grid;gap:10px;margin-top:4px">${CLASSES.map((cls,i)=>{const cs=myStudents.filter(s=>s.cls===cls);const pres=cs.filter(s=>attendance[s.id]?.[today]==='present').length;const pct=cs.length?Math.round(pres/cs.length*100):0;const col=pct>=80?T.green:pct>=60?T.yellow:cs.length?T.red:T.muted;return `<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span style="font-weight:700">${cls}</span><span style="color:${T.muted};font-size:11px">${cs.length} students</span><span style="color:${col};font-weight:700">${cs.length?pct+'%':'—'}</span></div>${cs.length?pbar(pct,col):`<div style="height:8px;background:${T.bg};border-radius:99px"></div>`}</div>`;}).join('')}</div>`)}
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
    const classStudents = a.class_id
      ? students.filter(s => s.class_id === a.class_id || s.classId === a.class_id)
      : students.filter(s => s.cls === a.cls);
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
  const ma=attendance[s.id]||{},dates=Object.keys(ma);
  const pd=dates.filter(d=>ma[d]==="present").length,attPct=dates.length?Math.round(pd/dates.length*100):0;
  const mg=grades[s.id]||{};
  const studentSubjects=SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||SUBJECT_GROUPS["Computer Science"];
  const tots=studentSubjects.map(sub=>mg[sub]?.total||0).filter(x=>x>0);
  const avg=tots.length?Math.round(tots.reduce((a,b)=>a+b,0)/tots.length):0;
  const myEx=exams.filter(e=>e.cls===s.cls);
  const myAssignA=assignments.filter(a=>a.class_id&&s.class_id?a.class_id===s.class_id:a.cls===s.cls);
  const mySubs=submissions.filter(sub=>sub.studentId===s.id);
  const pendingA=myAssignA.filter(a=>!mySubs.some(sub=>sub.assignmentId===a.id));
  // Use weekDays for chart - shows latest working days, always fresh
  const chartDays=weekDays.length?weekDays:dates.slice(-5);
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
  const ma=attendance[s.id]||{},dates=Object.keys(ma);
  const pd=dates.filter(d=>ma[d]==="present").length,ad=dates.filter(d=>ma[d]==="absent").length,ld=dates.filter(d=>ma[d]==="late").length;
  const pct=dates.length?Math.round(pd/dates.length*100):0;
  // Sort dates so chart shows chronological order
  const sortedDates=dates.sort();
  const dayLabels=sortedDates.map(d=>new Date(d).toLocaleDateString("en",{month:"short",day:"numeric"}));
  const attBarData=sortedDates.map(d=>ma[d]==="present"?100:ma[d]==="late"?50:0);
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
  ${card(tblHtml(["Subject","Midterm","Final","Internal","Total","Grade"],studentSubjects.map(sub=>{const g=mg[sub];return [`<span style="font-weight:700">${esc(sub)}</span>`,g?.midterm||"-",g?.final||"-",g?.internal||"-",`<span style="font-weight:800;color:${g?gradeColor(g.total):T.muted}">${g?.total||"-"}</span>`,g?`<span style="background:${gradeColor(g.total)}20;color:${gradeColor(g.total)};border-radius:20px;padding:3px 12px;font-weight:800;font-size:12px">${gradeLabel(g.total)}</span>`:"-"];})),"",0)}
  <div style="display:flex;gap:12px;margin-top:18px;flex-wrap:wrap">
    <button onclick="downloadStudentGradesPDF('${s.id}')" style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;border:none;border-radius:12px;padding:11px 22px;font-size:13px;font-weight:700;cursor:pointer">📄 Download Grade Sheet PDF</button>
    <button onclick="downloadMarksSheetExcel()" style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:12px;padding:11px 22px;font-size:13px;font-weight:700;cursor:pointer">📊 Download Excel</button>
  </div>`;}

function renderStudentAssignments(s){
  const myA=assignments.filter(a=>a.class_id&&s.class_id?a.class_id===s.class_id:a.cls===s.cls);
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

function renderStudentFees(s){
  const vouchers=feeVouchers[s.id]||[];
  const plan=feeInstallments[s.id];
  return `${secTitle('My Fee Vouchers')}
  ${plan?`<div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;margin-bottom:18px;box-shadow:${T.shadow}">
    ${secTitle('📋 Installment Plan')}
    <div style="background:${T.bg};border-radius:10px;padding:10px 12px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12px;color:${T.muted};margin-bottom:6px"><span>Total: <strong style="color:${T.text}">PKR ${plan.totalFee.toLocaleString()}</strong> · Session: ${plan.session||'—'}</span><span style="font-weight:700;color:${T.accent}">${(plan.installments||[]).filter(i=>i.status==='paid').length}/3 paid</span></div>${pbar(Math.round((plan.installments||[]).filter(i=>i.status==='paid').length/3*100),T.accent)}</div>
    <div style="display:grid;gap:8px">${(plan.installments||[]).map(inst=>{const iCol={paid:T.green,pending:T.yellow,overdue:T.red}[inst.status]||T.muted;return `<div style="background:${iCol}10;border:1px solid ${iCol}30;border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div><div style="font-size:13px;font-weight:700">Installment ${inst.no} · <span style="color:${T.accent}">PKR ${inst.amount.toLocaleString()}</span></div><div style="font-size:11px;color:${T.muted};margin-top:2px">📄 ${inst.voucherNo} · Due: ${inst.dueDate}${inst.status==='paid'?` · Paid: ${inst.paidDate}`:''}</div></div><span style="background:${iCol}20;color:${iCol};border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;text-transform:capitalize">${inst.status}</span></div>`;}).join('')}</div>
    <div style="margin-top:14px">${pbtn('🧾 Download Fee Receipt',`downloadFeeReceipt('${s.id}')`)}</div>
  </div>`:''}<div style="display:grid;gap:14px">${vouchers.length===0?card(`<div style="text-align:center;padding:40px;color:${T.muted}">No fee vouchers found</div>`):vouchers.map(v=>`<div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;box-shadow:${T.shadow};border-left:4px solid ${v.status==='paid'?T.green:v.status==='overdue'?T.red:T.yellow}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px">
      <div><div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:17px;margin-bottom:14px">${esc(v.month)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${[['Voucher #',v.voucherNo],['Amount','PKR '+v.amount.toLocaleString()],['Due Date',v.dueDate],['Paid Date',v.paidDate||'Not paid']].map(([k,val])=>`<div><div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;letter-spacing:.06em">${k}</div><div style="font-size:14px;font-weight:700;margin-top:3px">${esc(String(val))}</div></div>`).join('')}</div></div>
      <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-end">${badge(v.status,'lg')}${v.status!=='paid'?`<button style="background:${T.yellowL};color:${T.yellow};border:1px solid #fcd34d;border-radius:10px;padding:8px 16px;cursor:pointer;font-weight:700;font-size:13px">🏦 Pay Now</button>`:''}</div>
    </div>
  </div>`).join('')}</div>`;
}

function renderStudentTT(){const tt=timetables[teachers[0]?.id];return `${secTitle("Class Timetable")}${tt?card(`<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px"><div style="width:52px;height:52px;background:${T.accentL};border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px">📅</div><div><div style="font-weight:700;font-size:15px">${esc(tt.name)}</div><div style="font-size:12px;color:${T.muted};margin-top:2px">Uploaded: ${tt.uploadedAt}</div></div></div>${tt.data.startsWith("data:image")?`<img src="${tt.data}" alt="timetable" style="width:100%;border-radius:12px;border:1px solid ${T.border}"/>`:pbtn("📎 Open Timetable","window.open(timetables[teachers[0].id].data)")}`)
  :card(`<div style="text-align:center;padding:56px;color:${T.muted}"><div style="font-size:56px;margin-bottom:14px">📭</div><div style="font-weight:700;font-size:16px">No timetable available yet</div></div>`)}`;}

function renderStudentExams(s){const myEx=exams.filter(e=>e.cls===s.cls);return `${secTitle(`My Exams — ${s.cls}`)}${myEx.length===0?card(`<div style="text-align:center;padding:40px;color:${T.muted}">No exams scheduled for ${s.cls}</div>`):myEx.map(e=>`<div style="background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:22px;margin-bottom:12px;box-shadow:${T.shadow};border-left:4px solid ${T.accent}"><div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:16px;margin-bottom:14px">${esc(e.title)} — ${esc(e.subject)}</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px">${[["📅 Date",e.date],["🕐 Time",e.time],["⏱ Duration",e.duration],["🚪 Room",e.room],["📝 Marks",String(e.totalMarks)]].map(([k,v])=>`<div style="background:${T.bg};border-radius:10px;padding:10px 14px"><div style="font-size:10px;color:${T.muted};font-weight:700">${k}</div><div style="font-size:14px;font-weight:700;margin-top:3px">${esc(v)}</div></div>`).join("")}</div></div>`).join("")}`;}

// ═══════════════════════════════════════════════
// ================================================================
// SECTION 28 — MODALS
// ----------------------------------------------------------------
// renderModal() — returns the overlay + panel HTML for the
//                 currently open modal (modalState variable).
//
// Available modal types: addStudent, editStudent, addTeacher,
// editTeacher, addExam, addNotice, addComplaint, createAssignment,
// gradeSubmission, createFeePlan, editFeePlan, feeReport,
// changePassword, addSubAdmin, editSubAdmin
// ================================================================
function renderModal(){
  if(!modalState)return "";
  let title="",content="";

  // ─── CHANGE PASSWORD MODAL ───
  if(modalState==="changePassword"){
    title="🔑 Change Password";
    const role=currentUser.role;
    const isAdmin=role==="admin"&&!currentUser.isSubAdmin;
    content=`
    <div style="background:${T.accentL};border:1px solid ${T.border2};border-radius:10px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:${T.accentD};font-weight:600;display:flex;gap:8px;align-items:center">
      <span>🔐</span>
      ${isAdmin?"Changing main admin password":"Changing your account password. You'll use this to log in next time."}
    </div>
    <div style="margin-bottom:14px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">Current Password</label><input type="password" id="cp-cur" placeholder="Enter current password" style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif"/></div>
    <div style="margin-bottom:14px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">New Password</label><input type="password" id="cp-new" placeholder="Minimum 4 characters" style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif"/></div>
    <div style="margin-bottom:18px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">Confirm New Password</label><input type="password" id="cp-conf" placeholder="Re-enter new password" style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif"/></div>
    <div id="cp-msg" style="margin-bottom:12px;font-size:13px;min-height:20px;text-align:center"></div>
    <button onclick="submitChangePassword()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">🔑 Update Password</button>`;
  }

  // ─── ADD SUB-ADMIN MODAL ───
  if(modalState==="addSubAdmin"||modalState==="editSubAdmin"){
    const isEdit=modalState==="editSubAdmin";
    const sa=isEdit?subAdmins.find(x=>x.id===formData._saId):null;
    title=isEdit?"✏️ Edit Sub-Admin":"👥 Add Sub-Admin";
    content=`
    ${fld("Full Name","f-name",isEdit?sa?.name||formData.name||"":formData.name||"")}
    ${fld("Username (for login)","f-username",isEdit?sa?.username||formData.username||"":formData.username||"","text",null,"e.g. registrar")}
    ${isEdit?`<div style="margin-bottom:14px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">New Password <span style="font-weight:400;text-transform:none">(leave blank to keep)</span></label><input type="password" id="f-password" placeholder="Leave blank to keep current" style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif" oninput="setForm('f-password',this.value)"/></div>`:
    fld("Password","f-password",formData.password||"","password",null,"Set a login password")}
    <div style="margin-bottom:18px">
      <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Permissions (select what this sub-admin can access)</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="perm-grid">
        ${SUB_ADMIN_PERMS.map(p=>{const checked=(isEdit?(sa?.permissions||[]):(subAdminPermsSelected)).includes(p.key);return `<label style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:${checked?T.purpleL:T.bg};border:1.5px solid ${checked?"#c4b5fd":T.border};border-radius:10px;cursor:pointer;transition:all .15s" onclick="togglePermCheck('${p.key}',this)">
          <div style="width:18px;height:18px;border-radius:5px;border:2px solid ${checked?T.purple:T.border};background:${checked?T.purple:"#fff"};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:800" id="pchk-${p.key}">${checked?"✓":""}</div>
          <div><div style="font-size:12px;font-weight:700;color:${T.text}">${p.label}</div><div style="font-size:10px;color:${T.muted}">${p.desc}</div></div>
        </label>`;}).join("")}
      </div>
    </div>
    <button onclick="${isEdit?`submitEditSubAdmin('${sa?.id}')`:"submitAddSubAdmin()"}" style="width:100%;background:linear-gradient(135deg,${T.purple},#6d28d9);color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${isEdit?"💾 Save Changes":"👥 Create Sub-Admin"}</button>`;
  }

  if(modalState==="addStudent"){title="➕ Add New Student";content=`
    <div style="margin-bottom:18px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:8px;font-weight:700;text-transform:uppercase">Profile Photo (Optional)</label>
      <div style="display:flex;align-items:center;gap:14px"><div id="stu-photo-preview" style="width:64px;height:64px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid ${T.border2};background:linear-gradient(135deg,${T.accent},${T.accentD});display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#fff">${formData._photoData?`<img src="${formData._photoData}" style="width:100%;height:100%;object-fit:cover"/>`:formData.name?formData.name[0].toUpperCase():"👤"}</div>
      <div style="flex:1"><label style="display:inline-flex;align-items:center;gap:8px;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 16px;cursor:pointer;font-size:12px;font-weight:700;color:${T.accent}">📷 Choose Photo<input type="file" accept="image/*" style="display:none" onchange="previewStudentPhoto(this)"/></label>
      <div style="font-size:11px;color:${T.muted};margin-top:5px">JPG, PNG · Max 2MB</div></div></div></div>
    ${fld("Full Name","f-name",formData.name||"")}${fld("Class","f-cls",formData.cls||"CS-A","text",CLASSES)}
    <div style="margin-bottom:14px">
      <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Subject Group</label>
      <select id="f-subjectGroup" onchange="setForm('f-subjectGroup',this.value);updateSubjectPreview('add-subject-preview',this.value)"
        style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        ${ALL_GROUPS.map(g=>`<option value="${g}" ${(formData.subjectGroup||"Computer Science")===g?"selected":""}>${g}</option>`).join("")}
      </select>
      <div id="add-subject-preview" style="background:${T.bg};border:1px solid ${T.border};border-radius:8px;padding:8px 12px;margin-top:6px;font-size:11px;color:${T.muted}">
        📚 Subjects: <strong style="color:${T.accent}">${(SUBJECT_GROUPS[formData.subjectGroup||"Computer Science"]||[]).join(" · ")}</strong>
      </div>
    </div>
    ${fld("Password (for login)","f-password",formData.password||"1234","text",null,"Login password")}${fld("Phone","f-phone",formData.phone||"")}${fld("Guardian Phone","f-guardianPhone",formData.guardianPhone||"")}${fld("Email","f-email",formData.email||"")}${fld("Date of Birth","f-dob",formData.dob||"","date")}${fld("Fee Status","f-feeStatus",formData.feeStatus||"pending","text",["paid","pending","overdue"])}
    <div style="background:${T.accentL};border:1px solid ${T.border2};border-radius:10px;padding:11px 14px;font-size:12px;color:${T.accentD};margin-bottom:16px;font-weight:600">💡 Auto-generated ID + password = student login credentials.</div>
    <button onclick="submitAddStudent()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Add Student</button>`;}

  if(modalState==="addTeacher"){title="➕ Add New Teacher";content=`
    <div style="margin-bottom:18px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:8px;font-weight:700;text-transform:uppercase">Profile Photo (Optional)</label>
      <div style="display:flex;align-items:center;gap:14px"><div id="teach-photo-preview" style="width:64px;height:64px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid ${T.border2};background:linear-gradient(135deg,${T.accent},${T.accentD});display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#fff">${formData._photoData?`<img src="${formData._photoData}" style="width:100%;height:100%;object-fit:cover"/>`:formData.name?formData.name[0].toUpperCase():"👨‍🏫"}</div>
      <div style="flex:1"><label style="display:inline-flex;align-items:center;gap:8px;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 16px;cursor:pointer;font-size:12px;font-weight:700;color:${T.accent}">📷 Choose Photo<input type="file" accept="image/*" style="display:none" onchange="previewTeacherPhoto(this)"/></label>
      <div style="font-size:11px;color:${T.muted};margin-top:5px">JPG, PNG · Max 2MB</div></div></div></div>
    ${fld("Full Name","f-name",formData.name||"")}${fld("Subject","f-subject",formData.subject||SUBJECTS[0],"text",SUBJECTS)}${fld("Department","f-dept",formData.dept||"")}${fld("Qualification","f-qualification",formData.qualification||"")}${fld("Phone","f-phone",formData.phone||"")}${fld("Email","f-email",formData.email||"")}
    <button onclick="submitAddTeacher()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Add Teacher</button>`;}

  if(modalState==="addExam"){title="📝 Schedule Exam";content=`
    ${fld("Exam Title","f-title",formData.title||"")}${fld("Subject","f-subject",formData.subject||SUBJECTS[0],"text",SUBJECTS)}${fld("Class","f-cls",formData.cls||"CS-A","text",CLASSES)}${fld("Date","f-date",formData.date||"","date")}${fld("Time","f-time",formData.time||"")}${fld("Duration","f-duration",formData.duration||"")}${fld("Room","f-room",formData.room||"")}${fld("Total Marks","f-totalMarks",formData.totalMarks||"100")}
    <button onclick="submitAddExam()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Schedule Exam</button>`;}

  if(modalState==="addNotice"){title="📢 Post Notice";content=`
    ${fld("Title","f-title",formData.title||"")}${fld("Type","f-type",formData.type||"academic","text",["academic","holiday","event","fee"])}${fld("Author","f-author",formData.author||"Principal")}
    <button onclick="submitAddNotice()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Post Notice</button>`;}

  if(modalState==="viewStudent"){const s=formData;title="👤 Student Profile";
    content=`
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding:18px;background:linear-gradient(135deg,${T.accentD},${T.accent});border-radius:14px;position:relative">
      <div style="position:relative">${ava(s.name||"?",72,s.photo||null)}<label style="position:absolute;bottom:0;right:0;width:24px;height:24px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,.2);border:2px solid ${T.border2}">📷<input type="file" accept="image/*" style="display:none" onchange="changeStudentPhoto('${s.id}',this)"/></label></div>
      <div style="flex:1"><div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:20px;color:#fff">${esc(s.name)}</div><div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:3px">${s.id} · ${s.cls} · Roll# ${s.rollNo}</div><div style="display:flex;gap:6px;margin-top:8px">${badge(s.feeStatus)}${badge(s.portal)}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
      ${[["📛 Full Name",s.name],["🆔 Student ID",s.id],["🏫 Class",s.cls],["📋 Roll No",s.rollNo],["📚 Subject Group",s.subjectGroup||"—"],["📞 Phone",s.phone],["👨‍👩‍👦 Guardian",s.guardianPhone],["✉️ Email",s.email],["🎂 Date of Birth",s.dob]].map(([lbl,val])=>`<div style="background:${T.bg};border-radius:10px;padding:11px 14px;border:1px solid ${T.border}"><div style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;margin-bottom:4px">${lbl}</div><div style="font-size:13px;font-weight:600">${esc(String(val||"—"))}</div></div>`).join("")}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <button onclick="openEditStudent('${s.id}')" style="background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer">✏️ Edit Student</button>
      <button onclick="confirmDelStudent('${s.id}')" style="background:${T.redL};color:${T.red};border:1.5px solid #fca5a5;border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer">🗑️ Delete</button>
    </div>`;}

  if(modalState==="editStudent"){const s=formData;title="✏️ Edit Student";content=`
    <div style="margin-bottom:18px;display:flex;align-items:center;gap:14px">
      <div id="edit-stu-photo-preview" style="width:64px;height:64px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid ${T.border2}">${s.photo?`<img src="${s.photo}" style="width:100%;height:100%;object-fit:cover"/>`:ava(s.name,64)}</div>
      <label style="display:inline-flex;align-items:center;gap:8px;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 16px;cursor:pointer;font-size:12px;font-weight:700;color:${T.accent}">📷 Change Photo<input type="file" accept="image/*" style="display:none" onchange="previewEditStuPhoto(this)"/></label>
    </div>
    ${fld("Full Name","f-name",s.name||"")}${fld("Class","f-cls",s.cls||"CS-A","text",CLASSES)}
    <div style="margin-bottom:14px">
      <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Subject Group</label>
      <select id="f-subjectGroup" onchange="setForm('f-subjectGroup',this.value);updateSubjectPreview('edit-subject-preview',this.value)"
        style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif">
        ${ALL_GROUPS.map(g=>`<option value="${g}" ${(s.subjectGroup||"Computer Science")===g?"selected":""}>${g}</option>`).join("")}
      </select>
      <div id="edit-subject-preview" style="background:${T.bg};border:1px solid ${T.border};border-radius:8px;padding:8px 12px;margin-top:6px;font-size:11px;color:${T.muted}">
        📚 Subjects: <strong style="color:${T.accent}">${(SUBJECT_GROUPS[s.subjectGroup||"Computer Science"]||[]).join(" · ")}</strong>
      </div>
    </div>
    ${fld("Phone","f-phone",s.phone||"")}${fld("Guardian Phone","f-guardianPhone",s.guardianPhone||"")}${fld("Email","f-email",s.email||"")}${fld("Date of Birth","f-dob",s.dob||"","date")}${fld("Fee Status","f-feeStatus",s.feeStatus||"pending","text",["paid","pending","overdue"])}${fld("New Password (leave blank to keep)","f-password","","text",null,"Leave blank to keep")}
    <button onclick="submitEditStudent('${s.id}')" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;margin-top:6px">💾 Save Changes</button>`;}

  if(modalState==="editTeacher"){const t=formData;title="✏️ Edit Teacher";content=`
    <div style="margin-bottom:18px;display:flex;align-items:center;gap:14px">
      <div id="edit-teach-photo-preview" style="width:64px;height:64px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid ${T.border2}">${t.photo?`<img src="${t.photo}" style="width:100%;height:100%;object-fit:cover"/>`:ava(t.name,64)}</div>
      <label style="display:inline-flex;align-items:center;gap:8px;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:9px 16px;cursor:pointer;font-size:12px;font-weight:700;color:${T.accent}">📷 Change Photo<input type="file" accept="image/*" style="display:none" onchange="previewEditTeachPhoto(this)"/></label>
    </div>
    ${fld("Full Name","f-name",t.name||"")}${fld("Subject","f-subject",t.subject||SUBJECTS[0],"text",SUBJECTS)}${fld("Department","f-dept",t.dept||"")}${fld("Qualification","f-qualification",t.qualification||"")}${fld("Phone","f-phone",t.phone||"")}${fld("Email","f-email",t.email||"")}
    <button onclick="submitEditTeacher('${t.id}')" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;margin-top:6px">💾 Save Changes</button>`;}

  if(modalState==="addComplaint"){
    const t=teachers.find(x=>x.id===currentUser?.id);
    const cs=students.filter(s=>s.cls===attFilter.cls);
    const sel=students.find(s=>s.id===formData.studentId)||cs[0];
    title="⚠️ Send Complaint";
    content=`<div style="background:${T.redL};border:1px solid #fca5a5;border-radius:10px;padding:11px 14px;margin-bottom:18px;font-size:12px;color:${T.red};font-weight:600">⚠️ This complaint is logged and visible to Admin.</div>
    ${fld("Select Student","f-studentId",formData.studentId||cs[0]?.id||"","text",cs.map(s=>s.id))}
    ${sel?`<div style="background:${T.bg};border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:${T.muted};border:1px solid ${T.border}">👨‍👩‍👦 Guardian: <strong>${sel.guardianPhone}</strong></div>`:""}
    <div style="margin-bottom:14px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">Complaint Message</label><textarea id="f-message" rows="4" oninput="formData.message=this.value" style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif;resize:vertical">${esc(formData.message||"")}</textarea></div>
    ${sel&&formData.message?`<a href="sms:${sel.guardianPhone}?body=${encodeURIComponent(`Dear Guardian, regarding ${sel.name}: ${formData.message} - ${t?.name||""}, CMS`)}" style="display:block;text-align:center;background:${T.greenL};color:${T.green};border:1px solid #86efac;border-radius:10px;padding:10px;font-size:13px;font-weight:700;margin-bottom:12px">💬 Send SMS to Guardian</a>`:""}
    <button onclick="submitComplaint()" style="width:100%;background:linear-gradient(135deg,${T.red},#b91c1c);color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Log Complaint</button>`;}

  if(modalState==="createAssignment"){
    const teacher=teachers.find(x=>x.id===currentUser?.id);
    title="📎 Create Assignment";
    // ── Class dropdown: DB-backed (dbClasses) preferred over legacy CLASSES ──
    const fldSt=`width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif`;
    const lbl=lk=>`<label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">${lk}</label>`;
    // Pick initial class_id from formData or first dbClass
    const initClsId = formData.class_id || (dbClasses.length ? dbClasses[0].id : null);
    const initCls   = formData.cls || (dbClasses.length ? (dbClasses[0].code||dbClasses[0].name) : (CLASSES[0]||'CS-A'));
    const classDropdown = dbClasses.length
      ? `<div style="margin-bottom:14px">${lbl('Class')}
          <select id="f-cls-id" style="${fldSt}" onchange="
            const sel=this.options[this.selectedIndex];
            formData.class_id=parseInt(this.value)||null;
            formData.cls=sel.dataset.cls||this.value;
          ">
          ${dbClasses.map(c=>`<option value="${c.id}" data-cls="${esc(c.code||c.name)}" ${c.id===initClsId?'selected':''}>${esc(c.name)} (${esc(c.code)})</option>`).join('')}
          </select></div>`
      : fld('Class','f-cls',initCls,'text',CLASSES);
    content=`${fld("Assignment Title","f-title",formData.title||"")}${fld("Subject","f-subject",formData.subject||teacher?.subject||SUBJECTS[0],"text",SUBJECTS)}${classDropdown}${fld("Due Date","f-dueDate",formData.dueDate||"","date")}
    <div style="margin-bottom:14px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">Description / Instructions</label><textarea id="f-description" rows="4" oninput="formData.description=this.value" placeholder="Write assignment instructions here..." style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif;resize:vertical">${esc(formData.description||"")}</textarea></div>
    <button onclick="submitCreateAssignment()" style="width:100%;background:linear-gradient(135deg,${T.blue},#1d4ed8);color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Create Assignment</button>`;
    // Pre-set formData so submitCreateAssignment picks correct values
    formData.class_id = initClsId;
    formData.cls      = initCls;
  }

  if(modalState==="gradeSubmission"){
    title="✏️ Grade Submission";
    const sub=submissions.find(s=>s.id===formData.subId);
    content=sub?`<div style="background:${T.bg};border-radius:10px;padding:14px;margin-bottom:18px"><div style="font-weight:700;font-size:14px;margin-bottom:4px">${esc(sub.studentName)}</div><div style="font-size:12px;color:${T.muted}">📎 ${esc(sub.fileName)} · Submitted: ${sub.submittedAt}</div></div>
    ${fld("Grade (0–100)","f-grade",String(formData.grade||""),"number")}
    <div style="margin-bottom:14px"><label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">Feedback</label><textarea id="f-feedback" rows="3" oninput="formData.feedback=this.value" placeholder="Optional feedback..." style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif;resize:vertical">${esc(formData.feedback||"")}</textarea></div>
    <button onclick="submitGrade()" style="width:100%;background:linear-gradient(135deg,${T.green},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Submit Grade</button>`:"Submission not found.";}

  if(modalState==="createFeePlan"||modalState==="editFeePlan"){
    const isEdit=modalState==="editFeePlan";
    const sid=formData._sid||"";
    const s=students.find(x=>x.id===sid);
    const plan=isEdit?feeInstallments[sid]:null;
    title=isEdit?"✏️ Edit Fee Plan":"💳 Create 3-Installment Fee Plan";
    const tf=formData.totalFee||plan?.totalFee||"";
    const sess=formData.session||plan?.session||"2025-26";
    const d1=formData.due1||(plan?.installments?.[0]?.dueDate)||"";
    const d2=formData.due2||(plan?.installments?.[1]?.dueDate)||"";
    const d3=formData.due3||(plan?.installments?.[2]?.dueDate)||"";
    const instAmt=tf?Math.floor(Number(tf)/3):0;
    content=`
    <div style="background:${T.accentL};border:1px solid ${T.border2};border-radius:10px;padding:11px 14px;margin-bottom:18px;font-size:12px;color:${T.accentD};font-weight:600">
      🎓 Student: <strong>${s?s.name+" ("+s.id+")":"—"}</strong>
    </div>
    ${fld("Academic Session","f-session",sess,"text",["2024-25","2025-26","2026-27"])}
    <div style="margin-bottom:14px">
      <label style="font-size:11px;color:${T.muted};display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase">Total Fee Amount (PKR)</label>
      <input type="number" id="f-totalFee" value="${tf}" placeholder="e.g. 45000" min="0"
        style="width:100%;background:${T.bg};border:1.5px solid ${T.border};border-radius:10px;padding:10px 14px;color:${T.text};font-size:13px;box-sizing:border-box;outline:none;font-family:'Plus Jakarta Sans',sans-serif"
        oninput="formData.totalFee=this.value;document.getElementById('fp-preview').innerHTML=feeInstallPreview(this.value)"/>
    </div>
    <div id="fp-preview" style="background:${T.bg};border:1px solid ${T.border};border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;text-align:center;color:${T.muted}">${tf?feeInstallPreview(tf):"Enter total fee to see installment breakdown"}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
      ${fld("Installment 1 Due","f-due1",d1,"date")}
      ${fld("Installment 2 Due","f-due2",d2,"date")}
      ${fld("Installment 3 Due","f-due3",d3,"date")}
    </div>
    <button onclick="${isEdit?`submitEditFeePlan('${sid}')`:`submitCreateFeePlan('${sid}')`}" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">${isEdit?"💾 Save Changes":"🚀 Create Plan & Generate Vouchers"}</button>`;
  }

  if(modalState==="feeReport"){title="📊 Fee Report Summary";
    const paidC=students.filter(s=>s.feeStatus==="paid").length;
    const pendC=students.filter(s=>s.feeStatus==="pending").length;
    const ovdC=students.filter(s=>s.feeStatus==="overdue").length;
    const totalCol=paidC*15000;
    content=`<div style="display:grid;gap:12px;margin-bottom:18px">
      ${[["✅ Paid",paidC,T.green,"PKR "+totalCol.toLocaleString()+" collected"],["⏳ Pending",pendC,T.yellow,"PKR "+(pendC*15000).toLocaleString()+" expected"],["🚨 Overdue",ovdC,T.red,"PKR "+(ovdC*15000).toLocaleString()+" overdue"]].map(([l,c,col,sub])=>`<div style="background:${col}10;border:1px solid ${col}30;border-radius:12px;padding:16px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:700;font-size:13px">${l}</div><div style="font-size:12px;color:${T.muted};margin-top:2px">${sub}</div></div><div style="font-size:28px;font-weight:800;color:${col};font-family:'Space Grotesk',sans-serif">${c}</div></div>`).join("")}
    </div>
    <div style="background:${T.accentL};border-radius:10px;padding:14px;text-align:center;margin-bottom:16px"><div style="font-size:12px;color:${T.muted};font-weight:600;margin-bottom:4px">TOTAL MONTHLY COLLECTION</div><div style="font-size:24px;font-weight:800;color:${T.accent};font-family:'Space Grotesk',sans-serif">PKR ${totalCol.toLocaleString()}</div></div>
    <button onclick="closeModal()" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accentD});color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer">Close</button>`;}

  return `<div onclick="closeModal()" style="position:fixed;inset:0;background:rgba(6,78,59,.45);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px">
    <div onclick="event.stopPropagation()" style="background:#fff;border-radius:20px;padding:30px;width:100%;max-width:${modalState==="addSubAdmin"||modalState==="editSubAdmin"?"580px":"520px"};max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.25)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <span style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:18px;color:${T.text}">${title}</span>
        <button onclick="closeModal()" style="background:${T.bg};border:none;color:${T.muted};border-radius:10px;width:34px;height:34px;cursor:pointer;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center">✕</button>
      </div>${content}
    </div>
  </div>`;}

// ================================================================
// SECTION 29 — ACTIONS  (Event Handlers)
// ----------------------------------------------------------------
// All onclick="" handlers used in the rendered HTML live here.
//
// Navigation
//   navTo(p)            — change page, reset search, re-render
//   toggleSidebar()     — collapse / expand sidebar
//   doLogout()          — clear currentUser, back to login
//
// Modal helpers
//   openModal(type)     — set modalState + seed formData, re-render
//   closeModal()        — clear modalState + formData, re-render
//   setForm(id, val)    — sync a form field value into formData
//
// CRUD — Students
//   submitAddStudent()  — validate + push new student
//   submitEditStudent() — validate + update existing student
//   delStudent(id)      — confirm + splice from array
//   previewStudentPhoto / previewEditStudentPhoto
//
// CRUD — Teachers
//   submitAddTeacher / submitEditTeacher / delTeacher
//
// CRUD — Exams
//   submitAddExam / delExam
//
// CRUD — Notices
//   submitAddNotice / delNotice
//
// Attendance
//   markAtt(sid, status)  — mark single student attendance
//   bulkAtt(status)       — mark all visible students
//
// Grades
//   updateGrade(sid, sub, field, val)
//   saveExamGrade(sid, sub, examId, val)
//
// Fees
//   submitCreateFeePlan / submitEditFeePlan / removeFeePlan
//   markInstallmentPaid / revertInstallmentPaid / setInstallmentOverdue
//
// Assignments
//   submitCreateAssignment / submitGrade / uploadAssignment
//
// Portals
//   togglePortal(type, id)
//
// Sub-admins
//   submitAddSubAdmin / submitEditSubAdmin / delSubAdmin
//   toggleSubAdminPerm(key)
//
// Password
//   submitChangePassword
// ================================================================
function navTo(p){currentPage=p;searchQuery="";render();}
function toggleSidebar(){
  if(window.innerWidth<=768){
    sidebarCollapsed=!sidebarCollapsed;
  } else {
    sidebarCollapsed=!sidebarCollapsed;
  }
  render();
}
function doLogout(){currentUser=null;loginErr="";loginRole="admin";render();}
function closeModal(){modalState=null;formData={};subAdminPermsSelected=[];render();}
function updateSubjectPreview(previewId,group){
  const el=document.getElementById(previewId);
  if(el){const subs=SUBJECT_GROUPS[group]||[];el.innerHTML='📚 Subjects: <strong style="color:'+T.accent+'">'+subs.join(" · ")+"</strong>";}
}
function setForm(id,val){formData[id.replace("f-","")]=val;}

function openModal(type){
  if(type==="addStudent")formData={name:"",cls:"CS-A",subjectGroup:"Computer Science",phone:"",guardianPhone:"",email:"",feeStatus:"pending",dob:"",password:"1234",_photoData:null};
  else if(type==="addTeacher")formData={name:"",subject:SUBJECTS[0],dept:"Computer Science",phone:"",email:"",qualification:"",_photoData:null};
  else if(type==="addExam")formData={title:"",subject:SUBJECTS[0],cls:"CS-A",date:"",time:"09:00 AM",duration:"3 hours",room:"",totalMarks:"100"};
  else if(type==="addNotice")formData={title:"",type:"academic",author:"Principal"};
  else if(type==="addComplaint"){const cs=students.filter(s=>s.cls===attFilter.cls);formData={studentId:cs[0]?.id||"",message:""};}
  else if(type==="createAssignment"){const t=teachers.find(x=>x.id===currentUser?.id);const firstCls=dbClasses[0]||null;formData={title:"",subject:t?.subject||SUBJECTS[0],cls:firstCls?(firstCls.code||firstCls.name):"CS-A",class_id:firstCls?firstCls.id:null,dueDate:"",description:""};}
  else if(type==="feeReport")formData={};
  else if(type==="changePassword")formData={};
  else if(type==="addSubAdmin"){formData={name:"",username:"",password:""};subAdminPermsSelected=[];}
  modalState=type;render();
}

// ─── PASSWORD CHANGE HANDLER ───
function submitChangePassword(){
  const cur=document.getElementById("cp-cur")?.value||"";
  const n=document.getElementById("cp-new")?.value||"";
  const c=document.getElementById("cp-conf")?.value||"";
  const msg=document.getElementById("cp-msg");
  if(!cur||!n||!c){msg.innerHTML=`<span style="color:${T.red}">Please fill all fields.</span>`;return;}
  if(n.length<4){msg.innerHTML=`<span style="color:${T.red}">New password must be at least 4 characters.</span>`;return;}
  if(n!==c){msg.innerHTML=`<span style="color:${T.red}">New passwords do not match.</span>`;return;}

  const role=currentUser.role;
  if(role==="admin"&&!currentUser.isSubAdmin){
    if(cur!==adminPassword){msg.innerHTML=`<span style="color:${T.red}">Current password is incorrect.</span>`;return;}
    adminPassword=n;
  } else if(role==="admin"&&currentUser.isSubAdmin){
    const sa=subAdmins.find(x=>x.id===currentUser.id);
    if(!sa||cur!==sa.password){msg.innerHTML=`<span style="color:${T.red}">Current password is incorrect.</span>`;return;}
    sa.password=n;
  } else if(role==="teacher"){
    const t=teachers.find(x=>x.id===currentUser.id);
    if(!t||cur!==t.password){msg.innerHTML=`<span style="color:${T.red}">Current password is incorrect.</span>`;return;}
    t.password=n;
  } else if(role==="student"){
    const s=students.find(x=>x.id===currentUser.id);
    if(!s||cur!==s.password){msg.innerHTML=`<span style="color:${T.red}">Current password is incorrect.</span>`;return;}
    s.password=n;
  }
  msg.innerHTML=`<span style="color:${T.green};font-weight:700">✅ Password updated successfully! Use your new password next login.</span>`;
  setTimeout(()=>closeModal(),1800);
}

// ─── SUB-ADMIN PERMISSION TOGGLE ───
function togglePermCheck(key,el){
  const chk=document.getElementById("pchk-"+key);
  const idx=subAdminPermsSelected.indexOf(key);
  if(idx>=0){subAdminPermsSelected.splice(idx,1);chk.textContent="";chk.style.background="#fff";chk.style.borderColor=T.border;el.style.background=T.bg;el.style.borderColor=T.border;}
  else{subAdminPermsSelected.push(key);chk.textContent="✓";chk.style.background=T.purple;chk.style.borderColor=T.purple;el.style.background=T.purpleL;el.style.borderColor="#c4b5fd";}
}

// ─── ADD SUB-ADMIN ───
function submitAddSubAdmin(){
  const name=(document.getElementById("f-name")?.value||"").trim();
  const username=(document.getElementById("f-username")?.value||"").trim();
  const password=(document.getElementById("f-password")?.value||"").trim();
  if(!name){alert("Please enter a name");return;}
  if(!username){alert("Please enter a username");return;}
  if(!password){alert("Please enter a password");return;}
  if(username==="admin"){alert("Username 'admin' is reserved for the main admin");return;}
  if(subAdmins.some(x=>x.username===username)){alert("Username already taken. Choose a different one.");return;}
  const newSA={id:"SA"+Date.now(),name,username,password,permissions:[...subAdminPermsSelected],portal:"active",createdAt:today};
  subAdmins.push(newSA);
  alert(`✅ Sub-Admin Created!\n\nUsername: ${username}\nPassword: ${password}\n\nThey can log in using the Admin tab.`);
  closeModal();
}

// ─── EDIT SUB-ADMIN ───
function openEditSubAdmin(id){
  const sa=subAdmins.find(x=>x.id===id);
  if(sa){formData={...sa,_saId:id};subAdminPermsSelected=[...sa.permissions];modalState="editSubAdmin";render();}
}
function submitEditSubAdmin(id){
  const sa=subAdmins.find(x=>x.id===id);if(!sa)return;
  const name=(document.getElementById("f-name")?.value||"").trim();
  const username=(document.getElementById("f-username")?.value||"").trim();
  const pwd=(document.getElementById("f-password")?.value||"").trim();
  if(!name){alert("Name cannot be empty");return;}
  if(!username){alert("Username cannot be empty");return;}
  if(username==="admin"){alert("Username 'admin' is reserved");return;}
  if(subAdmins.some(x=>x.username===username&&x.id!==id)){alert("Username already taken.");return;}
  sa.name=name;sa.username=username;
  if(pwd)sa.password=pwd;
  sa.permissions=[...subAdminPermsSelected];
  if(currentUser&&currentUser.id===id){currentUser.name=sa.name;currentUser.permissions=[...sa.permissions];}
  alert("✅ Sub-admin updated!");
  closeModal();
}
function toggleSubAdmin(id){const sa=subAdmins.find(x=>x.id===id);if(sa)sa.portal=sa.portal==="active"?"inactive":"active";refreshContent();}
function delSubAdmin(id){if(confirm("Delete this sub-admin?"))subAdmins=subAdmins.filter(x=>x.id!==id);refreshContent();}

// ─── PHOTO PREVIEW HELPERS ───
function previewStudentPhoto(input){const file=input.files[0];if(!file)return;if(file.size>2*1024*1024){alert("Photo too large. Max 2MB.");return;}const reader=new FileReader();reader.onload=ev=>{formData._photoData=ev.target.result;const prev=document.getElementById("stu-photo-preview");if(prev)prev.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover"/>`;};reader.readAsDataURL(file);}
function previewTeacherPhoto(input){const file=input.files[0];if(!file)return;if(file.size>2*1024*1024){alert("Photo too large. Max 2MB.");return;}const reader=new FileReader();reader.onload=ev=>{formData._photoData=ev.target.result;const prev=document.getElementById("teach-photo-preview");if(prev)prev.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover"/>`;};reader.readAsDataURL(file);}
function previewEditStuPhoto(input){const file=input.files[0];if(!file)return;if(file.size>2*1024*1024){alert("Photo too large. Max 2MB.");return;}const reader=new FileReader();reader.onload=ev=>{formData._photoData=ev.target.result;const prev=document.getElementById("edit-stu-photo-preview");if(prev)prev.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover"/>`;};reader.readAsDataURL(file);}
function previewEditTeachPhoto(input){const file=input.files[0];if(!file)return;if(file.size>2*1024*1024){alert("Photo too large. Max 2MB.");return;}const reader=new FileReader();reader.onload=ev=>{formData._photoData=ev.target.result;const prev=document.getElementById("edit-teach-photo-preview");if(prev)prev.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover"/>`;};reader.readAsDataURL(file);}

// ─── EDIT STUDENT / TEACHER ───
function openEditStudent(sid){const s=students.find(x=>x.id===sid);if(s){formData={...s,_photoData:null};modalState="editStudent";render();}}
function openEditTeacher(tid){const t=teachers.find(x=>x.id===tid);if(t){formData={...t,_photoData:null};modalState="editTeacher";render();}}
function confirmDelStudent(sid){if(confirm("Are you sure you want to delete this student?")){students=students.filter(s=>s.id!==sid);if(modalState==="viewStudent"||modalState==="editStudent"){closeModal();}else{refreshContent();}}}
function changeStudentPhoto(sid,input){const file=input.files[0];if(!file)return;if(file.size>2*1024*1024){alert("Photo too large.");return;}const reader=new FileReader();reader.onload=async ev=>{const s=students.find(x=>x.id===sid);if(s){s.photo=ev.target.result;formData={...s};}render();try{await fetch(`/api/students/${sid}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({photo:ev.target.result})});}catch(e){console.error('Photo update error:',e);}};reader.readAsDataURL(file);}

function submitEditStudent(sid){
  const s=students.find(x=>x.id===sid);if(!s)return;
  const g=(id)=>document.getElementById(id)?.value||formData[id.replace("f-","")]||"";
  const name=g("f-name").trim();if(!name){alert("Name cannot be empty");return;}
  s.name=name;s.cls=g("f-cls")||s.cls;s.subjectGroup=g("f-subjectGroup")||s.subjectGroup||"Computer Science";s.phone=g("f-phone")||s.phone;s.guardianPhone=g("f-guardianPhone")||s.guardianPhone;s.email=g("f-email")||s.email;s.dob=g("f-dob")||s.dob;s.feeStatus=g("f-feeStatus")||s.feeStatus;
  const newPwd=g("f-password").trim();if(newPwd)s.password=newPwd;
  if(formData._photoData)s.photo=formData._photoData;
  if(currentUser&&currentUser.id===sid){currentUser.name=s.name;if(s.photo)currentUser.photo=s.photo;}
  alert("✅ Student updated!");closeModal();
}
function submitEditTeacher(tid){
  const t=teachers.find(x=>x.id===tid);if(!t)return;
  const g=(id)=>document.getElementById(id)?.value||formData[id.replace("f-","")]||"";
  const name=g("f-name").trim();if(!name){alert("Name cannot be empty");return;}
  t.name=name;t.subject=g("f-subject")||t.subject;t.dept=g("f-dept")||t.dept;t.qualification=g("f-qualification")||t.qualification;t.phone=g("f-phone")||t.phone;t.email=g("f-email")||t.email;
  if(formData._photoData)t.photo=formData._photoData;
  if(currentUser&&currentUser.id===tid){currentUser.name=t.name;if(t.photo)currentUser.photo=t.photo;}
  alert("✅ Teacher updated!");closeModal();
}

// ─── NAVIGATION & ATTENDANCE ───
function openComplaint(sid){formData={studentId:sid,message:""};modalState="addComplaint";render();}
function viewStudent(sid){const s=students.find(x=>x.id===sid);if(s){formData={...s};modalState="viewStudent";render();}}
function delStudent(sid){if(confirm("Delete this student?")){students=students.filter(s=>s.id!==sid);refreshContent();}}
function delTeacher(tid){if(confirm("Remove this teacher?")){teachers=teachers.filter(t=>t.id!==tid);refreshContent();}}
function delExam(eid){exams=exams.filter(e=>e.id!==eid);refreshContent();}
function delNotice(nid){notices=notices.filter(n=>n.id!==nid);refreshContent();}
function markPaid(sid){const s=students.find(x=>x.id===sid);if(s){s.feeStatus="paid";const v=(feeVouchers[s.id]||[])[0];if(v){v.status="paid";v.paidDate=today;}refreshContent();}}
function revertFee(sid){if(!confirm("Revert paid status to Pending?"))return;const s=students.find(x=>x.id===sid);if(s){s.feeStatus="pending";const v=(feeVouchers[s.id]||[])[0];if(v){v.status="pending";v.paidDate=null;}refreshContent();}}
function setFeeStatus(sid,status){const s=students.find(x=>x.id===sid);if(s){s.feeStatus=status;const v=(feeVouchers[s.id]||[])[0];if(v){v.status=status;if(status==="paid")v.paidDate=today;else v.paidDate=null;}refreshContent();}}
function togglePortal(type,id){if(type==="student"){const s=students.find(x=>x.id===id);if(s)s.portal=s.portal==="active"?"inactive":"active";}else{const t=teachers.find(x=>x.id===id);if(t)t.portal=t.portal==="active"?"inactive":"active";}refreshContent();}
function bulkAtt(status){
  students.filter(s=>s.cls===attFilter.cls||s.class_id===attFilter.class_id||s.classId===attFilter.class_id).forEach(s=>{if(!attendance[s.id])attendance[s.id]={};attendance[s.id][attFilter.date]=status;});
  refreshContent();
  fetch('/api/attendance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cls:attFilter.cls,class_id:attFilter.class_id,section_id:attFilter.section_id,date:attFilter.date,status})}).catch(e=>console.error('Bulk att error:',e));
}
function bulkSubjectAtt(status,ids){
  ids.forEach(sid=>{if(!attendance[sid])attendance[sid]={};attendance[sid][attFilter.date]=status;});
  refreshContent();
  const t=teachers.find(x=>x.id===currentUser?.id);const subj=t?.subject||'';
  fetch('/api/attendance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subjectBulk:subj,cls:attFilter.cls,date:attFilter.date,status})}).catch(e=>console.error('Subject bulk att error:',e));
}
function saveExamGrade(sid,subj,examId,val){if(!grades[sid])grades[sid]={};if(!grades[sid][subj])grades[sid][subj]={midterm:0,final:0,internal:0,total:0};grades[sid][subj]["exam_"+examId]=Number(val);}
function markAtt(sid,status){
  if(!attendance[sid])attendance[sid]={};
  attendance[sid][attFilter.date]=status;
  refreshContent();
  fetch('/api/attendance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:sid,date:attFilter.date,status})}).catch(e=>console.error('Att error:',e));
}
function updateGrade(sid,sub,field,val){if(!grades[sid])grades[sid]={};if(!grades[sid][sub])grades[sid][sub]={midterm:0,final:0,internal:0,total:0};grades[sid][sub][field]=Number(val);const g=grades[sid][sub];g.total=(g.midterm||0)+(g.final||0)+(g.internal||0);}
function uploadTT(tid,input){const file=input.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>{timetables[tid]={name:file.name,data:ev.target.result,uploadedAt:today};refreshContent();};r.readAsDataURL(file);}
function printReport(){window.print();}
function openGradeSubmission(subId){formData={subId,grade:"",feedback:""};modalState="gradeSubmission";render();}

function submitAssignment(assignmentId,studentId,studentName,cls,input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{const newSub={id:"SUB"+Date.now(),assignmentId,studentId,studentName,cls,fileData:ev.target.result,fileName:file.name,submittedAt:today,grade:null,feedback:"",status:"submitted"};window["sub_"+newSub.id+"_data"]=ev.target.result;submissions.push(newSub);refreshContent();alert("✅ Assignment submitted!");};
  reader.readAsDataURL(file);
}

function submitGrade(){
  const subId=formData.subId;const grade=parseInt(document.getElementById("f-grade")?.value||formData.grade||"0");const feedback=document.getElementById("f-feedback")?.value||formData.feedback||"";
  if(isNaN(grade)||grade<0||grade>100){alert("Please enter a valid grade (0–100)");return;}
  const sub=submissions.find(s=>s.id===subId);if(sub){sub.grade=grade;sub.feedback=feedback;sub.status="graded";}closeModal();
}
function submitCreateAssignment(){
  const title=(document.getElementById("f-title")?.value||formData.title||"").trim();if(!title){alert("Please enter assignment title");return;}
  const teacher=teachers.find(x=>x.id===currentUser?.id);
  const dueDate=document.getElementById("f-dueDate")?.value||formData.dueDate||"";if(!dueDate){alert("Please set a due date");return;}
  const newA={id:"A"+Date.now(),title,subject:document.getElementById("f-subject")?.value||formData.subject||SUBJECTS[0],cls:document.getElementById("f-cls")?.value||formData.cls||"CS-A",teacherId:currentUser.id,teacherName:teacher?.name||"Teacher",dueDate,description:document.getElementById("f-description")?.value||formData.description||"",createdAt:today};
  assignments.push(newA);closeModal();
}
function submitAddStudent(){
  const name=(document.getElementById("f-name")?.value||formData.name||"").trim();if(!name){alert("Please enter student name");return;}
  const pwd=(document.getElementById("f-password")?.value||formData.password||"1234").trim();
  const newId="S"+String(students.length+1).padStart(3,"0");
  const newStu={id:newId,name,cls:document.getElementById("f-cls")?.value||formData.cls||"CS-A",subjectGroup:document.getElementById("f-subjectGroup")?.value||formData.subjectGroup||"Computer Science",rollNo:String(students.length+1).padStart(2,"0"),phone:document.getElementById("f-phone")?.value||"",guardianPhone:document.getElementById("f-guardianPhone")?.value||"",email:document.getElementById("f-email")?.value||"",feeStatus:document.getElementById("f-feeStatus")?.value||"pending",dob:document.getElementById("f-dob")?.value||"",password:pwd,portal:"active",photo:formData._photoData||null};
  students.push(newStu);attendance[newId]={};grades[newId]={};
  feeVouchers[newId]=[{month:new Date().toLocaleString("default",{month:"long",year:"numeric"}),amount:15000,dueDate:today,status:newStu.feeStatus==="paid"?"paid":"pending",voucherNo:"V001-"+newId,paidDate:newStu.feeStatus==="paid"?today:null}];
  alert(`✅ Student Added!\n\nID: ${newId}\nPassword: ${pwd}`);closeModal();
}
function submitAddTeacher(){
  const name=(document.getElementById("f-name")?.value||"").trim();if(!name){alert("Please enter teacher name");return;}
  const newId="T"+String(teachers.length+1).padStart(3,"0");const pwd="teach"+String(teachers.length+1);
  teachers.push({id:newId,name,subject:document.getElementById("f-subject")?.value||SUBJECTS[0],dept:document.getElementById("f-dept")?.value||"",qualification:document.getElementById("f-qualification")?.value||"",phone:document.getElementById("f-phone")?.value||"",email:document.getElementById("f-email")?.value||"",joinDate:today,password:pwd,portal:"active",photo:formData._photoData||null});
  alert(`✅ Teacher Added!\nID: ${newId}\nPassword: ${pwd}`);closeModal();
}
function submitAddExam(){
  const title=(document.getElementById("f-title")?.value||"").trim();if(!title){alert("Please enter exam title");return;}
  exams.push({id:"E"+String(exams.length+1).padStart(3,"0"),title,subject:document.getElementById("f-subject")?.value||SUBJECTS[0],cls:document.getElementById("f-cls")?.value||"CS-A",date:document.getElementById("f-date")?.value||"",time:document.getElementById("f-time")?.value||"",duration:document.getElementById("f-duration")?.value||"",room:document.getElementById("f-room")?.value||"",totalMarks:document.getElementById("f-totalMarks")?.value||"100"});
  closeModal();
}
function submitAddNotice(){
  const title=(document.getElementById("f-title")?.value||"").trim();if(!title){alert("Please enter notice title");return;}
  notices.unshift({id:Date.now(),title,type:document.getElementById("f-type")?.value||"academic",author:document.getElementById("f-author")?.value||"Admin",date:today});closeModal();
}
function submitComplaint(){
  const sid=document.getElementById("f-studentId")?.value||formData.studentId||"";const msg=(document.getElementById("f-message")?.value||formData.message||"").trim();
  if(!sid||!msg){alert("Please select a student and write a message");return;}
  const s=students.find(x=>x.id===sid);if(!s)return;
  const t=teachers.find(x=>x.id===currentUser?.id);
  complaints.push({id:Date.now(),studentId:s.id,studentName:s.name,guardianPhone:s.guardianPhone,teacherName:t?.name||"Teacher",message:msg,date:today});closeModal();
}

// ================================================================
// SECTION 30 — PDF / EXCEL DOWNLOADS
// ----------------------------------------------------------------
// These functions open a new browser window with a print-ready
// HTML page, or trigger a CSV file download.
//
//   downloadReportPDF()          — current report → print window
//   downloadReportExcel()        — current report → .csv download
//   downloadPerformanceReport()  — class performance → print + CSV
//   downloadStudentGradesPDF(sid)— individual grade sheet → print
//   downloadMarksSheetExcel()    — all marks → .csv
//   printFeeVoucher(sid, no)     — single installment voucher → print
//   printInstallmentReceipt(sid, no) — paid receipt → print
// ================================================================
function downloadReportPDF(){
  const reportEl=document.getElementById("report-content");
  if(!reportEl){alert("No report loaded.");return;}
  const w=window.open("","_blank","width=900,height=700");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Report</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet"/><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',sans-serif;color:#0d2b23;background:#fff;padding:28px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:8px 10px;border:1px solid #d1fae5}th{background:#ecfdf5;font-weight:700;text-align:left}.footer{margin-top:24px;text-align:center;font-size:11px;color:#4b7a66;border-top:1px solid #d1fae5;padding-top:12px}@media print{.no-print{display:none}}</style></head><body>
  <div class="no-print" style="text-align:center;margin-bottom:16px"><button onclick="window.print()" style="background:#059669;color:#fff;border:none;padding:10px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Print / Save as PDF</button></div>
  ${reportEl.innerHTML}
  <div class="footer">NEXus Solution · Generated: ${new Date().toLocaleString()}</div></body></html>`);
  w.document.close();
}

function downloadReportExcel(){
  let csv="",filename="report.csv";
  const cls=reportFilter.cls||"CS-A";
  const rStudents=cls==="ALL"?students:students.filter(s=>s.cls===cls);
  if(reportFilter.type==="attendance"){
    filename=`Attendance_${cls}_${reportFilter.month.replace(" ","_")}.csv`;
    const dates=weekDays;
    csv="Roll#,Student Name,Class,"+dates.map(d=>d.slice(5)).join(",")+",Present,Absent,Late,%,Status\n";
    rStudents.forEach(s=>{const myA=attendance[s.id]||{};const pres=dates.filter(d=>myA[d]==="present").length;const abs=dates.filter(d=>myA[d]==="absent").length;const late=dates.filter(d=>myA[d]==="late").length;const pct=dates.length?Math.round(pres/dates.length*100):0;csv+=`"${s.rollNo}","${s.name}","${s.cls}",${dates.map(d=>{const st=myA[d]||"A";return st==="present"?"P":st==="late"?"L":"A";}).join(",")},${pres},${abs},${late},${pct}%,"${pct>=75?"Regular":"Short"}"\n`;});
  } else if(reportFilter.type==="grades"){
    filename=`GradeSheet_${cls}_2025-26.csv`;
    const subs=SUBJECTS.slice(0,5);
    csv="Roll#,Name,Class,"+subs.join(",")+",Total,Average,Grade,Result\n";
    rStudents.forEach(s=>{const sg=grades[s.id]||{};const tots=subs.map(sub=>sg[sub]?.total||0);const total=tots.reduce((a,b)=>a+b,0);const avg=tots.length?Math.round(total/tots.length):0;csv+=`"${s.rollNo}","${s.name}","${s.cls}",${tots.join(",")},${total},${avg},"${gradeLabel(avg)}","${avg>=45?"Pass":"Fail"}"\n`;});
  } else if(reportFilter.type==="fees"){
    filename=`FeeReport_${reportFilter.month.replace(" ","_")}.csv`;
    csv="Name,ID,Class,Voucher No,Amount,Due Date,Paid Date,Status\n";
    students.forEach(s=>{const v=(feeVouchers[s.id]||[])[0];csv+=`"${s.name}","${s.id}","${s.cls}","${v?.voucherNo||"—"}",15000,"${v?.dueDate||"—"}","${v?.paidDate||"—"}","${s.feeStatus}"\n`;});
  } else if(reportFilter.type==="exams"){
    filename=`ExamSchedule_${cls}_2025-26.csv`;const clsExams=cls==="ALL"?exams:exams.filter(e=>e.cls===cls);
    csv="#,Exam,Subject,Class,Date,Time,Duration,Room,Marks\n";
    clsExams.forEach((e,i)=>{csv+=`${i+1},"${e.title}","${e.subject}","${e.cls}","${e.date}","${e.time}","${e.duration}","${e.room}",${e.totalMarks}\n`;});
  }
  if(!csv){alert("No data.");return;}
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

function downloadPerformanceReport(){
  const classStats=CLASSES.map(cl=>{
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
    const gc=gradeColor(r.avg);
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
    +'<div class="hdr"><div class="logo">NEXus Solution — Class Performance Report</div>'
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
    +'<div class="footer">NEXus Solution · Class Performance Report · Academic Year 2025-26 · '+new Date().toLocaleString()+'</div>'
    +'<script>function dlCSV(){const d=atob("'+csvB64+'");const b=new Blob([d],{type:"text/csv"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download="ClassPerformanceReport_2025-26.csv";a.click();}<'+'/script>'
    +'</body></html>';
  w.document.write(html);
  w.document.close();
}


function downloadStudentGradesPDF(sid){
  const s=students.find(x=>x.id===sid)||students.find(x=>x.id===currentUser?.id);if(!s){alert("Student not found");return;}
  const sg=grades[s.id]||{};const subs=SUBJECTS.slice(0,5);
  const rows=subs.map(sub=>{const g=sg[sub]||{midterm:0,final:0,internal:0,total:0};const gl=gradeLabel(g.total);const col=gradeColor(g.total);return `<tr><td>${sub}</td><td style="text-align:center">${g.midterm||0}/30</td><td style="text-align:center">${g.internal||0}/20</td><td style="text-align:center">${g.final||0}/50</td><td style="text-align:center;font-weight:800;color:${col}">${g.total||0}/100</td><td style="text-align:center"><span style="background:${col}20;color:${col};border-radius:20px;padding:2px 8px;font-weight:800">${gl}</span></td><td style="text-align:center;color:${g.total>=45?"#16a34a":"#dc2626"};font-weight:700">${g.total>=45?"Pass":"Fail"}</td></tr>`;}).join("");
  const tots=subs.map(sub=>sg[sub]?.total||0);const total=tots.reduce((a,b)=>a+b,0);const avg=tots.length?Math.round(total/tots.length):0;const overallGrade=gradeLabel(avg);const overallCol=gradeColor(avg);
  const photoHTML=s.photo?`<img src="${s.photo}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid #d1fae5"/>`:
    `<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#059669,#047857);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff">${(s.name||"?")[0].toUpperCase()}</div>`;
  const w=window.open("","_blank","width=800,height=700");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Grade Sheet - ${s.name}</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet"/><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',sans-serif;color:#0d2b23;background:#fff;padding:32px}.header{background:linear-gradient(135deg,#064e3b,#059669);color:#fff;border-radius:16px;padding:24px 28px;margin-bottom:24px;display:flex;align-items:center;gap:20px}.logo{font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:800}table{border-collapse:collapse;width:100%;font-size:13px;margin-bottom:20px}th{background:#ecfdf5;padding:10px 14px;font-weight:700;text-align:left;border:1px solid #d1fae5}td{padding:10px 14px;border:1px solid #d1fae5}.summary{background:#f0fdf8;border:2px solid #a7f3d0;border-radius:14px;padding:20px;margin-bottom:20px;display:flex;justify-content:space-around;align-items:center;text-align:center}.footer{text-align:center;font-size:11px;color:#4b7a66;border-top:1px solid #d1fae5;padding-top:14px;margin-top:20px}@media print{.no-print{display:none}}</style></head><body>
  <div class="no-print" style="text-align:center;margin-bottom:16px"><button onclick="window.print()" style="background:#059669;color:#fff;border:none;padding:10px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Print / Save PDF</button></div>
  <div class="header"><div style="text-align:center">${photoHTML}</div><div style="flex:1"><div class="logo">NEXus Solution · Grade Sheet</div><div style="font-size:13px;opacity:.75;margin-top:4px">Academic Year 2025–26</div><div style="margin-top:12px;display:grid;grid-template-columns:repeat(3,auto);gap:12px 24px;font-size:12px"><div><div style="opacity:.6">Student</div><div style="font-weight:700">${s.name}</div></div><div><div style="opacity:.6">ID</div><div style="font-weight:700">${s.id}</div></div><div><div style="opacity:.6">Class</div><div style="font-weight:700">${s.cls}</div></div></div></div></div>
  <table><thead><tr><th>Subject</th><th style="text-align:center">Mid/30</th><th style="text-align:center">Int/20</th><th style="text-align:center">Final/50</th><th style="text-align:center">Total/100</th><th style="text-align:center">Grade</th><th style="text-align:center">Result</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="summary"><div><div style="font-size:11px;color:#4b7a66;font-weight:700;text-transform:uppercase">Total</div><div style="font-size:28px;font-weight:800;color:#059669;font-family:'Space Grotesk',sans-serif">${total}/${subs.length*100}</div></div><div><div style="font-size:11px;color:#4b7a66;font-weight:700;text-transform:uppercase">Average</div><div style="font-size:28px;font-weight:800;color:${overallCol};font-family:'Space Grotesk',sans-serif">${avg}%</div></div><div><div style="font-size:11px;color:#4b7a66;font-weight:700;text-transform:uppercase">Grade</div><div style="font-size:28px;font-weight:800;color:${overallCol};font-family:'Space Grotesk',sans-serif">${overallGrade}</div></div><div><div style="font-size:11px;color:#4b7a66;font-weight:700;text-transform:uppercase">Result</div><div style="font-size:28px;font-weight:800;color:${avg>=45?"#16a34a":"#dc2626"};font-family:'Space Grotesk',sans-serif">${avg>=45?"PASS":"FAIL"}</div></div></div>
  <div class="footer">NEXus Solution · Generated: ${new Date().toLocaleString()}</div></body></html>`);
  w.document.close();
}

function downloadMarksSheetExcel(){
  const sid=currentUser?.role==="student"?currentUser.id:null;
  const targetStudents=sid?[students.find(x=>x.id===sid)].filter(Boolean):students;
  const subs=SUBJECTS.slice(0,5);
  let csv="ID,Name,Class,Roll#,"+subs.map(s=>s+" Mid,"+s+" Int,"+s+" Final,"+s+" Total").join(",")+",Grand Total,Avg,Grade,Result\n";
  targetStudents.forEach(s=>{const sg=grades[s.id]||{};const subData=subs.map(sub=>{const g=sg[sub]||{};return `${g.midterm||0},${g.internal||0},${g.final||0},${g.total||0}`;}).join(",");const tots=subs.map(sub=>sg[sub]?.total||0);const total=tots.reduce((a,b)=>a+b,0);const avg=tots.length?Math.round(total/tots.length):0;csv+=`"${s.id}","${s.name}","${s.cls}","${s.rollNo}",${subData},${total},${avg}%,"${gradeLabel(avg)}","${avg>=45?"Pass":"Fail"}"\n`;});
  const fname=sid?`MarksSheet_${sid}_2025-26.csv`:"MarksSheet_All_2025-26.csv";
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=fname;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

function downloadFeeReceipt(sid){
  const s=students.find(x=>x.id===sid)||students.find(x=>x.id===currentUser?.id);if(!s){alert("Student not found");return;}
  const vouchers=feeVouchers[s.id]||[];
  const photoHTML=s.photo?`<img src="${s.photo}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid #d1fae5"/>`:
    `<div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#059669,#047857);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff">${(s.name||"?")[0].toUpperCase()}</div>`;
  const voucherRows=vouchers.map((v,i)=>{const col={paid:"#16a34a",pending:"#d97706",overdue:"#dc2626"}[v.status]||"#4b7a66";return `<tr><td>${i+1}</td><td>${v.voucherNo||"—"}</td><td>${v.month}</td><td style="text-align:center;font-weight:700">PKR ${(v.amount||15000).toLocaleString()}</td><td style="text-align:center">${v.dueDate||"—"}</td><td style="text-align:center;color:${col};font-weight:600">${v.paidDate||"—"}</td><td style="text-align:center"><span style="background:${col}20;color:${col};border-radius:20px;padding:2px 10px;font-weight:700;font-size:11px;text-transform:capitalize">${v.status}</span></td></tr>`;}).join("");
  const w=window.open("","_blank","width=800,height=600");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Fee Receipt - ${s.name}</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet"/><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',sans-serif;color:#0d2b23;background:#fff;padding:32px}.header{background:linear-gradient(135deg,#064e3b,#059669);color:#fff;border-radius:16px;padding:24px;margin-bottom:24px;display:flex;align-items:center;gap:20px}table{border-collapse:collapse;width:100%;font-size:13px}th{background:#ecfdf5;padding:10px 14px;font-weight:700;border:1px solid #d1fae5;text-align:left}td{padding:10px 14px;border:1px solid #d1fae5}.footer{text-align:center;font-size:11px;color:#4b7a66;border-top:1px solid #d1fae5;padding-top:12px;margin-top:24px}@media print{.no-print{display:none}}</style></head><body>
  <div class="no-print" style="text-align:center;margin-bottom:16px"><button onclick="window.print()" style="background:#059669;color:#fff;border:none;padding:10px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Print / Save PDF</button></div>
  <div class="header"><div>${photoHTML}</div><div style="flex:1"><div style="font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:800">NEXus Solution · Fee Record</div><div style="opacity:.75;font-size:12px;margin-top:4px">Academic Year 2025–26</div><div style="margin-top:12px;display:flex;gap:24px;font-size:12px"><div><span style="opacity:.65">Name: </span><strong>${s.name}</strong></div><div><span style="opacity:.65">ID: </span><strong>${s.id}</strong></div><div><span style="opacity:.65">Class: </span><strong>${s.cls}</strong></div></div></div></div>
  <table><thead><tr><th>#</th><th>Voucher No</th><th>Month</th><th style="text-align:center">Amount</th><th style="text-align:center">Due Date</th><th style="text-align:center">Paid Date</th><th style="text-align:center">Status</th></tr></thead><tbody>${voucherRows||`<tr><td colspan="7" style="text-align:center;padding:20px;color:#4b7a66">No fee records</td></tr>`}</tbody></table>
  <div class="footer">NEXus Solution · Generated: ${new Date().toLocaleString()}</div></body></html>`);
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
  if(!tf||tf<1){alert("Please enter a valid total fee.");return;}
  if(!d1||!d2||!d3){alert("Please fill all three due dates.");return;}
  const each=Math.floor(tf/3),last=tf-(each*2);
  feeInstallments[sid]={totalFee:tf,session:sess,installments:[
    {no:1,amount:each,dueDate:d1,status:"pending",voucherNo:`VCH-${sid}-1`,paidDate:null,receiptNo:null},
    {no:2,amount:each,dueDate:d2,status:"pending",voucherNo:`VCH-${sid}-2`,paidDate:null,receiptNo:null},
    {no:3,amount:last,dueDate:d3,status:"pending",voucherNo:`VCH-${sid}-3`,paidDate:null,receiptNo:null},
  ]};
  const s=students.find(x=>x.id===sid);if(s)s.feeStatus="pending";
  alert("Fee plan created! 3 installment vouchers ready. Click 'Voucher' on each to print.");closeModal();
}
async function submitEditFeePlan(sid){
  const plan=feeInstallments[sid];if(!plan)return;
  const tf=Number(document.getElementById('f-totalFee')?.value||formData.totalFee||0);
  const sess=(document.getElementById('f-session')?.value||formData.session||'2025-26').trim();
  const d1=(document.getElementById('f-due1')?.value||formData.due1||'').trim();
  const d2=(document.getElementById('f-due2')?.value||formData.due2||'').trim();
  const d3=(document.getElementById('f-due3')?.value||formData.due3||'').trim();
  if(!tf||tf<1){alert('Please enter a valid total fee.');return;}
  if(!d1||!d2||!d3){alert('Please fill all three due dates.');return;}
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
  alert('Fee plan updated.');closeModal();await loadAllDataFromDB();
}
function removeFeePlan(sid){
  if(!confirm("Remove this fee plan?"))return;
  delete feeInstallments[sid];
  const s=students.find(x=>x.id===sid);if(s)s.feeStatus="pending";
  refreshContent();
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
function revertInstallmentPaid(sid,no){
  if(!confirm("Revert installment to pending?"))return;
  const plan=feeInstallments[sid];if(!plan)return;
  const inst=plan.installments.find(i=>i.no===no);if(!inst)return;
  inst.status="pending";inst.paidDate=null;inst.receiptNo=null;
  _updateStudentFeeStatus(sid);refreshContent();
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
  if(!inst||!s){alert("Voucher not found");return;}
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
  +'<div style="flex:1"><div style="font-family:\'Space Grotesk\',sans-serif;font-size:19px;font-weight:800;color:#fff">NEXus Solution</div>'
  +'<div style="font-size:11px;color:rgba(255,255,255,.6)">Fee Payment Voucher &middot; '+plan.session+'</div>'
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
  +'<div style="text-align:center;font-size:9px;color:#4b7a66;margin:6px 0 12px;letter-spacing:.1em">'+inst.voucherNo+' &middot; NEXus Solution</div>'
  +'<div style="text-align:center;font-size:10px;color:#4b7a66;border-top:1px solid #d1fae5;padding-top:10px">Please pay by <strong>'+inst.dueDate+'</strong> to avoid overdue charges &middot; Generated: '+new Date().toLocaleString()+'</div>'
  +'</div></div>'
  +'</body></html>');
  w.document.close();
}

function printInstallmentReceipt(sid,no){
  const plan=feeInstallments[sid];
  const inst=plan&&plan.installments&&plan.installments.find(function(i){return i.no===no;});
  const s=students.find(function(x){return x.id===sid;});
  if(!inst||!s||inst.status!=="paid"){alert("Receipt only available for paid installments.");return;}
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
  +'<div style="flex:1"><div style="font-family:\'Space Grotesk\',sans-serif;font-size:17px;font-weight:800;color:#fff">NEXus Solution</div><div style="font-size:10px;color:rgba(255,255,255,.6)">Fee Payment Receipt &middot; '+plan.session+'</div></div>'
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
  +'<div style="text-align:center;font-size:9px;color:#4b7a66;margin-top:10px;padding-top:8px;border-top:1px solid #d1fae5">Computer generated receipt &middot; NEXus Solution &middot; '+new Date().toLocaleString()+'</div>'
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
// ── Lightweight dropdown refresh ─────────────────────────────────────────────
// Yeh function sirf class aur section dropdowns ko dobara DB se load karta hai.
// Classes page par nai class/section add, update, ya delete hone ke baad call
// hota hai taake Attendance page ka select box hamesha updated rahe.
async function loadDropdownsFromDB() {
  try {
    const [clsRes, secRes] = await Promise.all([
      fetch('/api/classes/dropdown'),
      fetch('/api/sections/dropdown'),
    ]);
    if (clsRes.ok) {
      const fresh = await clsRes.json();
      dbClasses = fresh;
      window.dbClasses = dbClasses;
      // Auto-select first class if current selection is gone
      if (dbClasses.length && (!attFilter.class_id || !dbClasses.find(c=>c.id===attFilter.class_id))) {
        attFilter.class_id = dbClasses[0].id;
        attFilter.cls = dbClasses[0].code || dbClasses[0].name;
        attFilter.section_id = null;
      }
    }
    if (secRes.ok) {
      dbSections = await secRes.json();
      window.dbSections = dbSections;
      // If current section_id no longer exists for current class, reset it
      const valid = dbSections.filter(s=>s.classId===attFilter.class_id).map(s=>s.id);
      if (attFilter.section_id && !valid.includes(attFilter.section_id)) {
        attFilter.section_id = null;
      }
    }
  } catch(e) {
    console.warn('loadDropdownsFromDB error:', e);
  }
}

async function loadAllDataFromDB() {
  try {
    const [stuRes, tchRes, examRes, noticeRes, compRes, assignRes, clsRes, secRes] = await Promise.all([
      fetch('/api/students'),
      fetch('/api/teachers'),
      fetch('/api/exams'),
      fetch('/api/notices'),
      fetch('/api/complaints'),
      fetch('/api/assignments'),
      fetch('/api/classes/dropdown'),
      fetch('/api/sections/dropdown'),
    ]);

    // ── Students pehle load karo (baaki sab us par depend karta hai) ──
    if (stuRes.ok)    students    = (await stuRes.json()).map(s=>({...s,feeStatus:s.fee_status||s.feeStatus||"pending",subjectGroup:s.subject_group||s.subjectGroup||"Computer Science",rollNo:s.roll_no||s.rollNo||"",guardianPhone:s.guardian_phone||s.guardianPhone||"",portal:s.portal||"active",photo:s.photo||null}));

    // ── Populate dynamic class & section dropdowns ──────────────────
    if (clsRes.ok) {
      dbClasses = await clsRes.json();
      window.dbClasses = dbClasses;
      // Legacy CLASSES string array — student.cls values se banao
      if (students.length) {
        CLASSES = [...new Set(students.map(s => s.cls).filter(Boolean))].sort();
      }
      if (!CLASSES.length) CLASSES = dbClasses.map(c => c.code || c.name);
    }
    if (secRes.ok) {
      dbSections = await secRes.json();
      window.dbSections = dbSections;
    }

    // ── attFilter class_id aur cls dono properly set karo ──
    if (dbClasses.length && !attFilter.class_id) {
      attFilter.class_id = dbClasses[0].id;
      attFilter.cls      = dbClasses[0].code || dbClasses[0].name;
    }
    if (tchRes.ok)    teachers    = (await tchRes.json()).map(t=>({...t,joinDate:t.join_date||t.joinDate||"",portal:t.portal||"active",photo:t.photo||null}));
    if (examRes.ok)   exams       = (await examRes.json()).map(e=>({...e,date:e.exam_date||e.date||''}));
    if (noticeRes.ok) notices     = (await noticeRes.json()).map(n=>({...n,date:n.created_date||n.date||''}));
    if (compRes.ok)   complaints  = (await compRes.json()).map(c=>({...c,date:c.created_date||c.date||''}));
    if (assignRes.ok) assignments = (await assignRes.json()).map(a=>({...a,dueDate:a.due_date||a.dueDate||'',createdAt:a.created_date||a.createdAt||''}));

    // Grades load karo
    const gRes = await fetch('/api/grades');
    if (gRes.ok) grades = await gRes.json();

    // Attendance load karo — teacher ke liye subject-based + full week, admin ke liye class-based
    let aUrl = `/api/attendance?date=${attFilter.date}`;
    if (currentUser && currentUser.role === 'teacher') {
      // Teacher: load full week attendance for all their students (for graph + today marking)
      const weekFetches = weekDays.map(d => fetch(`/api/teacher/${currentUser.id}/students?date=${d}`));
      const weekResults = await Promise.allSettled(weekFetches);
      weekResults.forEach((result, idx) => {
        const d = weekDays[idx];
        if (result.status === 'fulfilled' && result.value.ok) {
          result.value.json().then(subjStudents => {
            subjStudents.forEach(s => {
              if (!students.find(x => x.id === s.id)) {
                students.push({...s, feeStatus:s.fee_status||s.feeStatus||'pending',
                  subjectGroup:s.subject_group||s.subjectGroup||'Computer Science',
                  rollNo:s.roll_no||s.rollNo||'', guardianPhone:s.guardian_phone||s.guardianPhone||'',
                  portal:s.portal||'active', photo:s.photo||null});
              }
              if (!attendance[s.id]) attendance[s.id] = {};
              attendance[s.id][d] = s.attendanceStatus || 'absent';
            });
          }).catch(()=>{});
        }
      });
      // Also load today specifically (synchronously for immediate use)
      const teacherSubjRes = await fetch(`/api/teacher/${currentUser.id}/students?date=${attFilter.date}`);
      if (teacherSubjRes.ok) {
        const subjStudents = await teacherSubjRes.json();
        subjStudents.forEach(s => {
          if (!students.find(x => x.id === s.id)) {
            students.push({...s, feeStatus:s.fee_status||s.feeStatus||'pending',
              subjectGroup:s.subject_group||s.subjectGroup||'Computer Science',
              rollNo:s.roll_no||s.rollNo||'', guardianPhone:s.guardian_phone||s.guardianPhone||'',
              portal:s.portal||'active', photo:s.photo||null});
          }
          if (!attendance[s.id]) attendance[s.id] = {};
          attendance[s.id][attFilter.date] = s.attendanceStatus || 'absent';
        });
      }
    } else if (currentUser && currentUser.role === 'student') {
      // Student: load own full attendance history for chart + calendar
      try {
        const sAttRes = await fetch(`/api/attendance/student/${currentUser.id}`);
        if (sAttRes.ok) {
          const sAttData = await sAttRes.json();
          if (!attendance[currentUser.id]) attendance[currentUser.id] = {};
          Object.assign(attendance[currentUser.id], sAttData);
        }
      } catch(e) { console.error('Student att load error:', e); }
    } else {
      // Admin: load all attendance for selected class + full week for charts
      const weekAdminFetches = weekDays.map(d => fetch(`/api/attendance?date=${d}`));
      const weekAdminResults = await Promise.allSettled(weekAdminFetches);
      weekAdminResults.forEach((result, idx) => {
        const d = weekDays[idx];
        if (result.status === 'fulfilled' && result.value.ok) {
          result.value.json().then(attRows => {
            attRows.forEach(r => {
              if (!attendance[r.id]) attendance[r.id] = {};
              attendance[r.id][d] = r.status;
            });
          }).catch(()=>{});
        }
      });
      const aUrl = attFilter.class_id
        ? `/api/attendance?class_id=${attFilter.class_id}&date=${attFilter.date}`
        : `/api/attendance?cls=${attFilter.cls}&date=${attFilter.date}`;
      const aRes = await fetch(aUrl);
      if (aRes.ok) {
        const attRows = await aRes.json();
        attRows.forEach(r => {
          if (!attendance[r.id]) attendance[r.id] = {};
          attendance[r.id][attFilter.date] = r.status;
        });
      }
    }

    // Sub-admins load karo
    if (currentUser && currentUser.role === 'admin' && !currentUser.isSubAdmin) {
      const saRes = await fetch('/api/subadmins');
      if (saRes.ok) subAdmins = await saRes.json();
    }

    // Fee data load karo
    const fRes = await fetch('/api/fees');
    if (fRes.ok) {
      const feeData = await fRes.json();
      feeData.forEach(item => {
        const s = item.student;
        if (s) {
          feeVouchers[s.id] = (item.vouchers || []).map(v => ({
            ...v, dueDate: v.due_date || v.dueDate, paidDate: v.paid_date || v.paidDate
          }));
          if (item.installments) {
            feeInstallments[s.id] = {
              totalFee: item.installments.total_fee,
              session: item.installments.session,
              installments: (item.installments.installments || []).map(i => ({
                no: i.inst_no, amount: i.amount,
                dueDate: i.due_date || i.dueDate,
                status: i.status,
                voucherNo: i.voucher_no || i.voucherNo,
                paidDate: i.paid_date || i.paidDate,
                receiptNo: i.receipt_no || i.receiptNo,
              }))
            };
          }
        }
      });
    }
  } catch(e) {
    console.error('DB load error:', e);
  }
  refreshContent();
}

// ── LOGIN — DB se ──
async function doLogin() {
  const uid = (document.getElementById('l-uid')?.value || '').trim();
  const pwd = (document.getElementById('l-pwd')?.value || '').trim();
  loginErr = '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({role: loginRole, username: uid, password: pwd})
    });
    const data = await res.json();
    if (data.success) {
      currentUser = {
        id: data.user.id,
        role: data.user.role,
        name: data.user.name,
        isSubAdmin: data.user.isSubAdmin || false,
        permissions: data.user.permissions || []
      };
      currentPage = 'dashboard';
      render();
      await loadAllDataFromDB();
    } else {
      loginErr = data.error || 'Invalid credentials.';
      render();
    }
  } catch(e) {
    loginErr = 'Server error. Make sure Flask is running.';
    render();
  }
}

// ── LOGOUT ──
async function doLogout() {
  try { await fetch('/api/logout', {method:'POST'}); } catch(e) {}
  currentUser = null; loginErr = ''; loginRole = 'admin'; render();
}

// ── ADD STUDENT ──
async function submitAddStudent() {
  const name = (document.getElementById('f-name')?.value || '').trim();
  if (!name) { alert('Please enter student name'); return; }
  const pwd = (document.getElementById('f-password')?.value || '1234').trim();
  const body = {
    name, password: pwd,
    cls: document.getElementById('f-cls')?.value || 'CS-A',
    subjectGroup: document.getElementById('f-subjectGroup')?.value || 'Computer Science',
    phone: document.getElementById('f-phone')?.value || '',
    guardianPhone: document.getElementById('f-guardianPhone')?.value || '',
    email: document.getElementById('f-email')?.value || '',
    feeStatus: document.getElementById('f-feeStatus')?.value || 'pending',
    dob: document.getElementById('f-dob')?.value || '',
    photo: formData._photoData || null,
  };
  try {
    const res = await fetch('/api/students', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    const data = await res.json();
    if (data.success) {
      alert(`✅ Student Added!\n\nID: ${data.id}\nPassword: ${data.plainPassword}`);
      closeModal();
      await loadAllDataFromDB();
    } else { alert('Error: ' + (data.error || 'Unknown error')); }
  } catch(e) { alert('Server error: ' + e.message); }
}

// ── EDIT STUDENT ──
async function submitEditStudent(sid) {
  const g = (id) => document.getElementById(id)?.value || formData[id.replace('f-','')] || '';
  const name = g('f-name').trim(); if (!name) { alert('Name cannot be empty'); return; }
  const body = {
    name, cls: g('f-cls'), subjectGroup: g('f-subjectGroup'),
    phone: g('f-phone'), guardianPhone: g('f-guardianPhone'),
    email: g('f-email'), dob: g('f-dob'), feeStatus: g('f-feeStatus'),
  };
  const pwd = g('f-password').trim(); if (pwd) body.password = pwd;
  if (formData._photoData) body.photo = formData._photoData;
  try {
    const res = await fetch(`/api/students/${sid}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    const data = await res.json();
    if (data.success) {
      if (currentUser && currentUser.id === sid) currentUser.name = name;
      alert('✅ Student updated!'); closeModal();
      await loadAllDataFromDB();
    } else { alert('Error: ' + (data.error || 'Unknown')); }
  } catch(e) { alert('Server error: ' + e.message); }
}

// ── DELETE STUDENT ──
async function delStudent(sid) {
  if (!confirm('Delete this student?')) return;
  try {
    await fetch(`/api/students/${sid}`, {method:'DELETE'});
    students = students.filter(s => s.id !== sid);
    refreshContent();
  } catch(e) { alert('Error deleting: ' + e.message); }
}
function confirmDelStudent(sid) { delStudent(sid); if(modalState==='viewStudent'||modalState==='editStudent') closeModal(); }

// ── ADD TEACHER ──
async function submitAddTeacher() {
  const name = (document.getElementById('f-name')?.value || '').trim();
  if (!name) { alert('Please enter teacher name'); return; }
  const body = {
    name,
    subject: document.getElementById('f-subject')?.value || '',
    dept: document.getElementById('f-dept')?.value || '',
    qualification: document.getElementById('f-qualification')?.value || '',
    phone: document.getElementById('f-phone')?.value || '',
    email: document.getElementById('f-email')?.value || '',
    photo: formData._photoData || null,
  };
  try {
    const res = await fetch('/api/teachers', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    const data = await res.json();
    if (data.success) {
      alert(`✅ Teacher Added!\nID: ${data.id}\nPassword: ${data.plainPassword}`);
      closeModal(); await loadAllDataFromDB();
    } else { alert('Error: ' + (data.error || 'Unknown')); }
  } catch(e) { alert('Server error: ' + e.message); }
}

// ── EDIT TEACHER ──
async function submitEditTeacher(tid) {
  const g = (id) => document.getElementById(id)?.value || formData[id.replace('f-','')] || '';
  const name = g('f-name').trim(); if (!name) { alert('Name cannot be empty'); return; }
  const body = { name, subject: g('f-subject'), dept: g('f-dept'), qualification: g('f-qualification'), phone: g('f-phone'), email: g('f-email') };
  const pwd = g('f-password').trim(); if (pwd) body.password = pwd;
  if (formData._photoData) body.photo = formData._photoData;
  try {
    const res = await fetch(`/api/teachers/${tid}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    const data = await res.json();
    if (data.success) {
      if (currentUser && currentUser.id === tid) currentUser.name = name;
      alert('✅ Teacher updated!'); closeModal(); await loadAllDataFromDB();
    } else { alert('Error: ' + (data.error || 'Unknown')); }
  } catch(e) { alert('Server error: ' + e.message); }
}

// ── DELETE TEACHER ──
async function delTeacher(tid) {
  if (!confirm('Remove this teacher?')) return;
  try {
    await fetch(`/api/teachers/${tid}`, {method:'DELETE'});
    teachers = teachers.filter(t => t.id !== tid); refreshContent();
  } catch(e) { alert('Error: ' + e.message); }
}

// ── MARK ATTENDANCE ──
async function markAtt(sid, status) {
  if (!attendance[sid]) attendance[sid] = {};
  attendance[sid][attFilter.date] = status;
  refreshContent();
  try {
    await fetch('/api/attendance', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({studentId: sid, date: attFilter.date, status})});
  } catch(e) { console.error('Att error:', e); }
}

// ── BULK ATTENDANCE (Admin — by class) ──
async function bulkAtt(status) {
  const cls_students = students.filter(s => {
    const classMatch = attFilter.class_id
      ? (s.class_id === attFilter.class_id || s.classId === attFilter.class_id)
      : s.cls === attFilter.cls;
    const sectionMatch = attFilter.section_id
      ? (s.section_id === attFilter.section_id || s.sectionId === attFilter.section_id)
      : true;
    return classMatch && sectionMatch;
  });
  cls_students.forEach(s => { if(!attendance[s.id])attendance[s.id]={}; attendance[s.id][attFilter.date]=status; });
  refreshContent();
  const payload = { date: attFilter.date, status };
  if (attFilter.class_id) {
    payload.class_id = attFilter.class_id;
    if (attFilter.section_id) payload.section_id = attFilter.section_id;
  } else {
    payload.cls = attFilter.cls;
  }
  try {
    await fetch('/api/attendance', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)});
  } catch(e) { console.error('Bulk att error:', e); }
}

// ── BULK ATTENDANCE (Teacher — by subject scope) ──
async function bulkSubjectAtt(status, ids) {
  // Optimistic UI update
  ids.forEach(sid => { if(!attendance[sid])attendance[sid]={}; attendance[sid][attFilter.date]=status; });
  refreshContent();
  // Persist to backend — use subjectBulk mode with teacher's subject
  try {
    const t = teachers.find(x => x.id === currentUser?.id);
    const subj = t?.subject || '';
    const activeCls = window._tAttCls || '';
    await fetch('/api/attendance', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({subjectBulk: subj, cls: activeCls, date: attFilter.date, status})
    });
  } catch(e) {
    console.error('Subject bulk att error:', e);
  }
}

let _gradeTimer=null;
async function updateGrade(sid, sub, field, val) {
  if (!grades[sid]) grades[sid] = {};
  if (!grades[sid][sub]) grades[sid][sub] = {midterm:0, final:0, internal:0, total:0};
  grades[sid][sub][field] = Number(val);
  const g = grades[sid][sub];
  g.total = (g.midterm||0) + (g.final||0) + (g.internal||0);
  // Update only the total display cell without full re-render
  const totalEl = document.getElementById(`grade-total-${sid}-${sub.replace(/\s/g,'_')}`);
  if(totalEl) totalEl.innerHTML = `${g.total||0} · ${gradeLabel(g.total)}`;
  // Debounced backend save
  clearTimeout(_gradeTimer);
  _gradeTimer = setTimeout(async()=>{
    try {
      await fetch('/api/grades', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({studentId:sid, subject:sub, midterm:g.midterm, final:g.final, internal:g.internal})});
    } catch(e) { console.error('Grade error:', e); }
  }, 800);
}

// ── ADD EXAM ──
async function submitAddExam() {
  const title = (document.getElementById('f-title')?.value || '').trim();
  if (!title) { alert('Please enter exam title'); return; }
  const body = {
    title, subject: document.getElementById('f-subject')?.value || '',
    cls: document.getElementById('f-cls')?.value || 'CS-A',
    date: document.getElementById('f-date')?.value || '',
    time: document.getElementById('f-time')?.value || '',
    duration: document.getElementById('f-duration')?.value || '',
    room: document.getElementById('f-room')?.value || '',
    totalMarks: document.getElementById('f-totalMarks')?.value || '100',
  };
  try {
    const res = await fetch('/api/exams', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    const data = await res.json();
    if (data.success) { closeModal(); await loadAllDataFromDB(); }
    else { alert('Error: ' + (data.error || 'Unknown')); }
  } catch(e) { alert('Server error: ' + e.message); }
}

// ── DELETE EXAM ──
async function delExam(eid) {
  try {
    await fetch(`/api/exams/${eid}`, {method:'DELETE'});
    exams = exams.filter(e => e.id !== eid); refreshContent();
  } catch(e) { alert('Error: ' + e.message); }
}

// ── ADD NOTICE ──
async function submitAddNotice() {
  const title = (document.getElementById('f-title')?.value || '').trim();
  if (!title) { alert('Please enter notice title'); return; }
  const body = {
    title, type: document.getElementById('f-type')?.value || 'academic',
    author: document.getElementById('f-author')?.value || 'Admin',
  };
  try {
    const res = await fetch('/api/notices', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    const data = await res.json();
    if (data.success) { closeModal(); await loadAllDataFromDB(); }
    else { alert('Error: ' + (data.error || 'Unknown')); }
  } catch(e) { alert('Server error: ' + e.message); }
}

// ── DELETE NOTICE ──
async function delNotice(nid) {
  try {
    await fetch(`/api/notices/${nid}`, {method:'DELETE'});
    notices = notices.filter(n => n.id !== nid); refreshContent();
  } catch(e) { alert('Error: ' + e.message); }
}

// ── ADD COMPLAINT ──
async function submitComplaint() {
  const sid = document.getElementById('f-studentId')?.value || formData.studentId || '';
  const msg = (document.getElementById('f-message')?.value || '').trim();
  if (!sid || !msg) { alert('Please select a student and write a message'); return; }
  try {
    const res = await fetch('/api/complaints', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({studentId: sid, message: msg})});
    const data = await res.json();
    if (data.success) { closeModal(); await loadAllDataFromDB(); }
    else { alert('Error: ' + (data.error || 'Unknown')); }
  } catch(e) { alert('Server error: ' + e.message); }
}

// ── FEE STATUS ──
async function setFeeStatus(sid, status) {
  const s = students.find(x => x.id === sid); if (s) s.feeStatus = status;
  refreshContent();
  try {
    await fetch(`/api/fees/${sid}/status`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({status})});
    await loadAllDataFromDB();
  } catch(e) { console.error('Fee error:', e); }
}
async function markPaid(sid) { setFeeStatus(sid, 'paid'); }
async function revertFee(sid) { if (!confirm('Revert to Pending?')) return; setFeeStatus(sid, 'pending'); }

// ── FEE PLAN ──
async function submitCreateFeePlan(sid) {
  const tf = Number(document.getElementById('f-totalFee')?.value || 0);
  const sess = (document.getElementById('f-session')?.value || '2025-26').trim();
  const d1 = document.getElementById('f-due1')?.value || '';
  const d2 = document.getElementById('f-due2')?.value || '';
  const d3 = document.getElementById('f-due3')?.value || '';
  if (!tf || tf < 1) { alert('Please enter a valid total fee.'); return; }
  if (!d1 || !d2 || !d3) { alert('Please fill all three due dates.'); return; }
  try {
    const res = await fetch(`/api/fees/${sid}/plan`, {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({totalFee: tf, session: sess, due1: d1, due2: d2, due3: d3})});
    const data = await res.json();
    if (data.success) { alert('Fee plan created! 3 installment vouchers ready.'); closeModal(); await loadAllDataFromDB(); }
    else { alert('Error: ' + (data.error || 'Unknown')); }
  } catch(e) { alert('Server error: ' + e.message); }
}

// ── MARK INSTALLMENT PAID ──
async function markInstallmentPaid(sid, no) {
  try {
    await fetch(`/api/fees/${sid}/installment/${no}/pay`, {method:'POST'});
    await loadAllDataFromDB();
    setTimeout(() => printInstallmentReceipt(sid, no), 300);
  } catch(e) { alert('Error: ' + e.message); }
}

async function revertInstallmentPaid(sid,no){
  if(!confirm('Revert installment to pending?'))return;
  try{await fetch(`/api/fees/${sid}/installment/${no}/revert`,{method:'POST'});await loadAllDataFromDB();}catch(e){alert('Error: '+e.message);}
}

// ── PORTAL TOGGLE ──
async function togglePortal(type, id) {
  try {
    const url = type === 'student' ? `/api/portal/student/${id}` : `/api/portal/teacher/${id}`;
    const res = await fetch(url, {method:'POST'});
    const data = await res.json();
    if (data.success) {
      if (type === 'student') { const s = students.find(x=>x.id===id); if(s) s.portal = data.portal; }
      else { const t = teachers.find(x=>x.id===id); if(t) t.portal = data.portal; }
      refreshContent();
    }
  } catch(e) { alert('Error: ' + e.message); }
}

// ── SUB-ADMINS ──
async function submitAddSubAdmin() {
  const name = (document.getElementById('f-name')?.value || '').trim();
  const username = (document.getElementById('f-username')?.value || '').trim();
  const password = (document.getElementById('f-password')?.value || '').trim();
  if (!name) { alert('Please enter a name'); return; }
  if (!username) { alert('Please enter a username'); return; }
  if (!password) { alert('Please enter a password'); return; }
  if (username === 'admin') { alert("Username 'admin' is reserved"); return; }
  try {
    const res = await fetch('/api/subadmins', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({name, username, password, permissions: subAdminPermsSelected})});
    const data = await res.json();
    if (data.success) {
      alert(`✅ Sub-Admin Created!\n\nUsername: ${username}\nPassword: ${password}`);
      closeModal(); await loadAllDataFromDB();
    } else { alert('Error: ' + (data.error || 'Unknown')); }
  } catch(e) { alert('Server error: ' + e.message); }
}

async function submitEditSubAdmin(id) {
  const name = (document.getElementById('f-name')?.value || '').trim();
  const username = (document.getElementById('f-username')?.value || '').trim();
  const pwd = (document.getElementById('f-password')?.value || '').trim();
  if (!name) { alert('Name cannot be empty'); return; }
  if (!username) { alert('Username cannot be empty'); return; }
  const body = {name, username, permissions: subAdminPermsSelected};
  if (pwd) body.password = pwd;
  try {
    const res = await fetch(`/api/subadmins/${id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    const data = await res.json();
    if (data.success) {
      if (currentUser && currentUser.id === id) { currentUser.name = name; currentUser.permissions = [...subAdminPermsSelected]; }
      alert('✅ Sub-admin updated!'); closeModal(); await loadAllDataFromDB();
    } else { alert('Error: ' + (data.error || 'Unknown')); }
  } catch(e) { alert('Server error: ' + e.message); }
}

async function toggleSubAdmin(id) {
  try {
    const res = await fetch(`/api/subadmins/${id}/toggle`, {method:'POST'});
    const data = await res.json();
    if (data.success) { const sa = subAdmins.find(x=>x.id===id); if(sa) sa.portal = data.portal; refreshContent(); }
  } catch(e) { alert('Error: ' + e.message); }
}

async function delSubAdmin(id) {
  if (!confirm('Delete this sub-admin?')) return;
  try {
    await fetch(`/api/subadmins/${id}`, {method:'DELETE'});
    subAdmins = subAdmins.filter(x => x.id !== id); refreshContent();
  } catch(e) { alert('Error: ' + e.message); }
}

// ── CHANGE PASSWORD ──
async function submitChangePassword() {
  const cur = document.getElementById('cp-cur')?.value || '';
  const n = document.getElementById('cp-new')?.value || '';
  const c = document.getElementById('cp-conf')?.value || '';
  const msg = document.getElementById('cp-msg');
  if (!cur||!n||!c) { msg.innerHTML=`<span style="color:${T.red}">Please fill all fields.</span>`; return; }
  if (n.length < 4) { msg.innerHTML=`<span style="color:${T.red}">Min 4 characters.</span>`; return; }
  if (n !== c) { msg.innerHTML=`<span style="color:${T.red}">Passwords do not match.</span>`; return; }
  try {
    const res = await fetch('/api/change-password', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({currentPassword: cur, newPassword: n})});
    const data = await res.json();
    if (data.success) {
      msg.innerHTML=`<span style="color:${T.green};font-weight:700">✅ Password updated successfully!</span>`;
      setTimeout(()=>closeModal(), 1800);
    } else { msg.innerHTML=`<span style="color:${T.red}">${data.error}</span>`; }
  } catch(e) { msg.innerHTML=`<span style="color:${T.red}">Server error.</span>`; }
}

// ── CREATE ASSIGNMENT ──
async function submitCreateAssignment() {
  const title = (document.getElementById('f-title')?.value || '').trim();
  if (!title) { alert('Please enter assignment title'); return; }
  const dueDate = document.getElementById('f-dueDate')?.value || '';
  if (!dueDate) { alert('Please set a due date'); return; }

  // Prefer DB-backed class_id dropdown; fallback to legacy f-cls text field
  let clsId  = formData.class_id || null;
  let clsStr = formData.cls || 'CS-A';
  const clsIdEl = document.getElementById('f-cls-id');
  const clsEl   = document.getElementById('f-cls');
  if (clsIdEl) {
    clsId  = parseInt(clsIdEl.value) || null;
    clsStr = clsIdEl.options[clsIdEl.selectedIndex]?.dataset?.cls || clsStr;
  } else if (clsEl) {
    clsStr = clsEl.value || clsStr;
  }

  const body = {
    title, dueDate,
    subject:     document.getElementById('f-subject')?.value || '',
    cls:         clsStr,
    class_id:    clsId,
    description: document.getElementById('f-description')?.value || '',
  };
  try {
    const res = await fetch('/api/assignments', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    const data = await res.json();
    if (data.success) { closeModal(); await loadAllDataFromDB(); }
    else { alert('Error: ' + (data.error || 'Unknown')); }
  } catch(e) { alert('Server error: ' + e.message); }
}

// ── ASSIGNMENT SUBMIT (STUDENT) ──
async function submitAssignment(assignmentId, studentId, studentName, cls, input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/submit`, {method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({fileName: file.name, fileData: ev.target.result})});
      const data = await res.json();
      if (data.success) { alert('✅ Assignment submitted!'); await loadAllDataFromDB(); }
      else { alert('Error: ' + (data.error || 'Unknown')); }
    } catch(e) { alert('Server error: ' + e.message); }
  };
  reader.readAsDataURL(file);
}

// ── TIMETABLE ──
async function uploadTT(tid, input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = async ev => {
    try {
      await fetch(`/api/timetable/${tid}`, {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({name: file.name, data: ev.target.result})});
      timetables[tid] = {name: file.name, data: ev.target.result, uploadedAt: today};
      refreshContent();
    } catch(e) { console.error('TT upload error:', e); }
  };
  r.readAsDataURL(file);
}

// ── ON PAGE LOAD: check if already logged in ──
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = {id: data.id, role: data.role, name: data.name, isSubAdmin: data.isSubAdmin, permissions: data.permissions || []};
      currentPage = 'dashboard';
      render();
      await loadAllDataFromDB();
    } else {
      render();
    }
  } catch(e) {
    render();
  }
});
