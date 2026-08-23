/* ================================================================
   js/data.js  —  Seed data, constants, and reactive state
   ================================================================ */

// ── Constants ──────────────────────────────────────────────────
// CLASSES is no longer a static list — class/section data is loaded dynamically
// from the Academics module via /api/classes/dropdown and /api/sections/dropdown.
// Use the initStudentClassDropdown() helper in api.js instead.
const CLASSES  = []; // kept for backward compatibility (some non-student dropdowns may use it)
const SUBJECTS = ['English','Urdu','Islamiyat','Biology','Physics','Chemistry','Mathematics','Computer Science','Data Structures','Calculus','Statistics','OOP'];
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const SUBJECT_GROUPS = {
  'Medical':          ['English','Urdu','Islamiyat','Biology','Physics','Chemistry'],
  'Non-Medical':      ['English','Urdu','Islamiyat','Mathematics','Physics','Chemistry'],
  'Computer Science': ['English','Urdu','Islamiyat','Mathematics','Physics','Computer Science','Data Structures','OOP','Statistics'],
  'General Science':  ['English','Urdu','Islamiyat','Biology','Mathematics','Chemistry','Statistics'],
  'Business':         ['English','Urdu','Islamiyat','Mathematics','Microeconomics','Statistics','Calculus'],
};

const SUBJECT_TO_GROUPS = {
  'English':           ['Medical','Non-Medical','Computer Science','General Science','Business'],
  'Urdu':              ['Medical','Non-Medical','Computer Science','General Science','Business'],
  'Islamiyat':         ['Medical','Non-Medical','Computer Science','General Science','Business'],
  'Biology':           ['Medical','General Science'],
  'Physics':           ['Medical','Non-Medical','Computer Science'],
  'Chemistry':         ['Medical','Non-Medical','General Science'],
  'Mathematics':       ['Non-Medical','Computer Science','General Science','Business'],
  'Computer Science':  ['Computer Science'],
  'Data Structures':   ['Computer Science'],
  'OOP':               ['Computer Science'],
  'Statistics':        ['Computer Science','General Science','Business'],
  'Calculus':          ['Non-Medical','Computer Science','Business'],
  'Microeconomics':    ['Business'],
  'English Literature':['Medical','Non-Medical','Computer Science','General Science','Business'],
};

const ALL_GROUPS = ['Medical','Non-Medical','Computer Science','General Science','Business'];

const SUB_ADMIN_PERMS = [
  {key:'classes',    label:'🏫 Classes',    desc:'Manage classes, sections, students'},
  {key:'students',   label:'👨‍🎓 Students',  desc:'View & manage students'},
  {key:'teachers',   label:'👨‍🏫 Teachers',  desc:'View & manage teachers'},
  {key:'attendance', label:'📋 Attendance', desc:'Mark & view attendance'},
  {key:'grades',     label:'📈 Grades',     desc:'View & enter grades'},
  {key:'fees',       label:'💳 Fees',       desc:'Manage fee status'},
  {key:'exams',      label:'📝 Exams',      desc:'Schedule exams'},
  {key:'notices',    label:'📢 Notices',    desc:'Post notices'},
  {key:'complaints', label:'⚠️ Complaints', desc:'View complaints'},
  {key:'reports',    label:'📋 Reports',    desc:'Generate reports'},
  {key:'timetable',  label:'🕐 Timetable',  desc:'Upload timetables'},
];

const today    = new Date().toISOString().split('T')[0];
const curMonth = MONTHS[new Date().getMonth()] + ' ' + new Date().getFullYear();

// Last 5 working days
const weekDays = Array.from({length:7},(_,i)=>{
  const d = new Date(); d.setDate(d.getDate()-6+i);
  return d.toISOString().split('T')[0];
}).filter(d=>![0,6].includes(new Date(d).getDay()));

// ── Reactive state ─────────────────────────────────────────────
// These all start EMPTY and are filled by loadAllDataFromDB() in api.js from
// endpoints the backend scopes to the session's department/campus.
//
// They used to hold a demo dataset (S001-S009 with plaintext passwords). That
// data belonged to no department or campus, so with the institution split it
// would flash on screen inside a Boys/Girls/BS session for the moment before
// the first fetch resolved. clearContextCaches() in api.js already resets these
// to exactly the values below on logout, so an empty start is a state the whole
// UI is built to render.
let students = [];

let teachers = [];

let attendance = {};

let grades = {};

let feeVouchers = {};

let feeInstallments = {};

let notices = [];

let exams = [];

let complaints   = [];
let timetables   = {};
let assignments  = [];
let submissions  = [];
let subAdmins    = [];
// `adminPassword` no longer exists: admin authentication lives in the DB
// (admin_config.password_hash) and is verified by /api/change-password and
// /api/settings/admin-password.  No plaintext passwords are kept client-side.
