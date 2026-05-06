/* ================================================================
   js/state.js  —  Application state + render engine
   ================================================================ */

// ── Reactive state ─────────────────────────────────────────────
let currentUser     = null;
let currentPage     = 'dashboard';
let sidebarCollapsed = false;
let searchQuery     = '';
let attFilter       = {cls:'CS-A', class_id:null, section_id:null, date:today};
let gradesFilter    = {cls:'CS-A', class_id:null};
let modalState      = null;
let formData        = {};
let loginRole       = 'admin';
let loginErr        = '';
let reportFilter    = {type:'attendance', month:curMonth, cls:'CS-A', class_id:null};
let subAdminPermsSelected = [];
let feeFilter       = {cls:'ALL', status:'ALL', search:''};

// ── DB-backed class & section lists (for dropdowns) ────────────
let dbClasses  = [];   // [{id, name, code}] — /api/classes/dropdown
let dbSections = [];   // [{id, name, classId, className}] — /api/sections/dropdown
window.dbClasses  = dbClasses;
window.dbSections = dbSections;

// ── Search debounce ────────────────────────────────────────────
let _searchTimer = null;
function handleSearch(val){
  searchQuery = val;
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(()=> refreshContent(), 300);
}
function handleFeeSearch(val){
  feeFilter.search = val;
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(()=> refreshContent(), 300);
}

// ── Render engine ──────────────────────────────────────────────
function render(){
  _chartQueue = [];
  _chartFns   = {};
  document.getElementById('app').innerHTML = currentUser ? renderShell() : renderLogin();
  flushCharts();
}

function refreshContent(){
  _chartQueue = [];
  const activeId  = document.activeElement?.id || '';
  const activeSel = [document.activeElement?.selectionStart, document.activeElement?.selectionEnd];
  const el = document.getElementById('main-content');
  if(el) el.innerHTML = renderPage();
  flushCharts();
  if(activeId){
    const restored = document.getElementById(activeId);
    if(restored){
      restored.focus();
      try{ restored.setSelectionRange(activeSel[0], activeSel[1]); }catch(e){}
    }
  }
}

// ── Permission check ───────────────────────────────────────────
function canAccess(page){
  if(!currentUser || currentUser.role !== 'admin') return true;
  if(!currentUser.isSubAdmin) return true;
  const map = {
    students:'students', teachers:'teachers', attendance:'attendance',
    grades:'grades', fees:'fees', exams:'exams', notices:'notices',
    complaints:'complaints', reports:'reports', timetable:'timetable',
    dashboard:null, portals:null, settings:null, subadmins:null,
  };
  const perm = map[page];
  if(perm === null) return false;
  if(perm === undefined) return false;
  return (currentUser.permissions || []).includes(perm);
}

// ── Navigation ─────────────────────────────────────────────────
function navTo(p){
  currentPage  = p;
  searchQuery  = '';
  // Close mobile sidebar after nav
  sidebarCollapsed = window.innerWidth <= 640 ? true : sidebarCollapsed;
  render();
}

function toggleSidebar(){
  sidebarCollapsed = !sidebarCollapsed;
  render();
}

// ── Modal helpers ──────────────────────────────────────────────
function openModal(type){
  if(type==='addStudent')      formData={name:'',cls:'CS-A',subjectGroup:'Computer Science',phone:'',guardianPhone:'',email:'',feeStatus:'pending',dob:'',password:'1234',_photoData:null};
  else if(type==='addTeacher') formData={name:'',subject:SUBJECTS[0],dept:'Computer Science',phone:'',email:'',qualification:'',_photoData:null};
  else if(type==='addExam')    formData={title:'',subject:SUBJECTS[0],cls:'CS-A',date:'',time:'09:00 AM',duration:'3 hours',room:'',totalMarks:'100'};
  else if(type==='addNotice')  formData={title:'',type:'academic',author:'Principal'};
  else if(type==='addComplaint'){const cs=students.filter(s=>s.cls===attFilter.cls);formData={studentId:cs[0]?.id||'',message:''};}
  else if(type==='createAssignment'){const t=teachers.find(x=>x.id===currentUser?.id);formData={title:'',subject:t?.subject||SUBJECTS[0],cls:'CS-A',dueDate:'',description:''};}
  else if(type==='feeReport')      formData={};
  else if(type==='changePassword') formData={};
  else if(type==='addSubAdmin'){formData={name:'',username:'',password:''};subAdminPermsSelected=[];}
  modalState = type;
  render();
}

function closeModal(){
  modalState = null;
  formData   = {};
  subAdminPermsSelected = [];
  render();
}

function setForm(id, val){ formData[id.replace('f-','')] = val; }
