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

// ── Seed data ──────────────────────────────────────────────────
let students = [
  {id:'S001',name:'Ayesha Khan',     cls:'CS-A', rollNo:'01',phone:'03001234567',guardianPhone:'03009876543',email:'ayesha@cms.edu', feeStatus:'paid',   dob:'2003-04-12',password:'1234',portal:'active',subjectGroup:'Computer Science'},
  {id:'S002',name:'Hassan Raza',     cls:'CS-A', rollNo:'02',phone:'03119876543',guardianPhone:'03118765432',email:'hassan@cms.edu', feeStatus:'pending',dob:'2003-07-22',password:'1234',portal:'active',subjectGroup:'Computer Science'},
  {id:'S003',name:'Zara Ahmed',      cls:'CS-B', rollNo:'01',phone:'03335551234',guardianPhone:'03334441234',email:'zara@cms.edu',   feeStatus:'paid',   dob:'2004-01-09',password:'1234',portal:'active',subjectGroup:'Medical'},
  {id:'S004',name:'Ali Hamza',       cls:'CS-B', rollNo:'02',phone:'03217774321',guardianPhone:'03216664321',email:'ali@cms.edu',    feeStatus:'paid',   dob:'2003-11-30',password:'1234',portal:'active',subjectGroup:'Non-Medical'},
  {id:'S005',name:'Sara Malik',      cls:'BBA-A',rollNo:'01',phone:'03452223344',guardianPhone:'03453334455',email:'sara@cms.edu',   feeStatus:'overdue',dob:'2004-03-15',password:'1234',portal:'active',subjectGroup:'Business'},
  {id:'S006',name:'Usman Tariq',     cls:'BBA-A',rollNo:'02',phone:'03128889900',guardianPhone:'03127779900',email:'usman@cms.edu',  feeStatus:'paid',   dob:'2003-08-05',password:'1234',portal:'active',subjectGroup:'Business'},
  {id:'S007',name:'Hina Butt',       cls:'BBA-B',rollNo:'01',phone:'03231112233',guardianPhone:'03232223344',email:'hina@cms.edu',   feeStatus:'pending',dob:'2004-06-18',password:'1234',portal:'active',subjectGroup:'Medical'},
  {id:'S008',name:'Farhan Siddiqui', cls:'CS-A', rollNo:'03',phone:'03014445566',guardianPhone:'03015556677',email:'farhan@cms.edu', feeStatus:'paid',   dob:'2003-12-01',password:'1234',portal:'active',subjectGroup:'Computer Science'},
  {id:'S009',name:'Bilal Ahmed',     cls:'CS-B', rollNo:'03',phone:'03321112233',guardianPhone:'03322223344',email:'bilal@cms.edu',  feeStatus:'paid',   dob:'2004-02-10',password:'1234',portal:'active',subjectGroup:'Computer Science'},
];

let teachers = [
  {id:'T001',name:'Dr. Khalid Mehmood', subject:'Data Structures',   dept:'Computer Science',phone:'03001111111',email:'khalid@cms.edu',joinDate:'2015-03-01',qualification:'PhD CS',     password:'teach1',portal:'active'},
  {id:'T002',name:'Prof. Amina Syed',   subject:'Calculus',          dept:'Mathematics',     phone:'03112222222',email:'amina@cms.edu', joinDate:'2018-08-15',qualification:'MPhil Math', password:'teach2',portal:'active'},
  {id:'T003',name:'Mr. Tariq Javed',    subject:'English Literature',dept:'English',         phone:'03333333333',email:'tariq@cms.edu', joinDate:'2020-01-10',qualification:'MA English', password:'teach3',portal:'active'},
  {id:'T004',name:'Ms. Rabia Nawaz',    subject:'Microeconomics',    dept:'Business Admin',  phone:'03214444444',email:'rabia@cms.edu', joinDate:'2019-06-20',qualification:'MBA',        password:'teach4',portal:'active'},
  {id:'T005',name:'Dr. Imran Sheikh',   subject:'Physics',           dept:'Sciences',        phone:'03455555555',email:'imran@cms.edu', joinDate:'2012-09-01',qualification:'PhD Physics',password:'teach5',portal:'active'},
];

// Generate realistic attendance (not purely random — weighted toward present)
let attendance = (()=>{
  const r = {};
  students.forEach(s=>{
    r[s.id] = {};
    weekDays.forEach((d,i)=>{
      const rand = Math.random();
      r[s.id][d] = rand > 0.12 ? 'present' : rand > 0.06 ? 'late' : 'absent';
    });
  });
  return r;
})();

// Generate realistic grades
let grades = (()=>{
  const g = {};
  students.forEach(s=>{
    g[s.id] = {};
    const subs = SUBJECT_GROUPS[s.subjectGroup || 'Computer Science'] || [];
    subs.forEach(sub=>{
      const mid    = Math.floor(Math.random()*14)+16;   // 16-30
      const fin    = Math.floor(Math.random()*22)+28;   // 28-50
      const intern = Math.floor(Math.random()*8)+12;    // 12-20
      g[s.id][sub] = {midterm:mid, final:fin, internal:intern, total:mid+fin+intern};
    });
  });
  return g;
})();

let feeVouchers = {
  S001:[{month:'January 2025',amount:15000,dueDate:'2025-01-15',status:'paid',  voucherNo:'V001-S001',paidDate:'2025-01-10'}],
  S002:[{month:'January 2025',amount:15000,dueDate:'2025-01-15',status:'pending',voucherNo:'V001-S002',paidDate:null}],
  S003:[{month:'January 2025',amount:15000,dueDate:'2025-01-15',status:'paid',  voucherNo:'V001-S003',paidDate:'2025-01-12'}],
  S004:[{month:'February 2025',amount:15000,dueDate:'2025-02-15',status:'paid', voucherNo:'V002-S004',paidDate:'2025-02-10'}],
  S005:[{month:'December 2024',amount:15000,dueDate:'2024-12-15',status:'overdue',voucherNo:'V012-S005',paidDate:null}],
  S006:[{month:'February 2025',amount:15000,dueDate:'2025-02-15',status:'paid', voucherNo:'V002-S006',paidDate:'2025-02-08'}],
  S007:[{month:'January 2025',amount:15000,dueDate:'2025-01-15',status:'pending',voucherNo:'V001-S007',paidDate:null}],
  S008:[{month:'February 2025',amount:15000,dueDate:'2025-02-15',status:'paid', voucherNo:'V002-S008',paidDate:'2025-02-14'}],
};

let feeInstallments = {};

let notices = [
  {id:1,title:'College closed Friday for Juma Prayer',     date:'2025-02-21',type:'holiday', author:'Principal'},
  {id:2,title:'Mid-Term result cards distributed Monday',  date:'2025-02-24',type:'academic',author:'Controller of Exams'},
  {id:3,title:'Annual Sports Week starting March 3',       date:'2025-02-25',type:'event',   author:'Sports Dept'},
  {id:4,title:'Fee submission deadline extended to Feb 28',date:'2025-02-26',type:'fee',     author:'Accounts Dept'},
];

let exams = [
  {id:'E001',title:'Mid-Term',subject:'Data Structures',cls:'CS-A',date:'2025-03-10',time:'09:00 AM',duration:'3 hours',room:'Hall-A',totalMarks:50},
  {id:'E002',title:'Mid-Term',subject:'Calculus',       cls:'CS-B',date:'2025-03-11',time:'09:00 AM',duration:'3 hours',room:'Hall-B',totalMarks:50},
  {id:'E003',title:'Final',   subject:'Physics',        cls:'CS-A',date:'2025-05-15',time:'10:00 AM',duration:'3 hours',room:'Hall-C',totalMarks:100},
];

let complaints   = [];
let timetables   = {};
let assignments  = [];
let submissions  = [];
let subAdmins    = [];
let adminPassword = 'admin123';
