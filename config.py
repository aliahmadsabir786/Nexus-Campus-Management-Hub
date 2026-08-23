"""
config.py  —  NEXus CMS Configuration & Constants
"""

from datetime import date, timedelta

# ================================================================
# APP SETTINGS
# ================================================================
SECRET_KEY             = "nexus-cms-2025-change-this-in-production!"
SESSION_PERMANENT      = True
PERMANENT_SESSION_LIFETIME = timedelta(hours=8)

# ================================================================
# INSTITUTION / CONTEXT CONSTANTS
#
# NCMH
#  ├── BS DEPARTMENT            (independent — one implicit campus)
#  └── INTERMEDIATE DEPARTMENT
#        ├── BOYS CAMPUS
#        └── GIRLS CAMPUS
#
# These are *codes* only.  The authoritative records live in the
# `departments` / `campuses` tables (migrations/001_departments_campuses.sql);
# nothing here is ever trusted as an access decision — see utils/context.py.
# ================================================================
INSTITUTION_NAME = "NEXus Solution"

DEPT_BS    = "BS"       # departments.code for the BS department
DEPT_INTER = "INTER"    # departments.code for the Intermediate department

CAMPUS_BS_MAIN = "BS-MAIN"
CAMPUS_BOYS    = "BOYS"
CAMPUS_GIRLS   = "GIRLS"

# Departments that MUST have a campus chosen before login.
DEPARTMENTS_REQUIRING_CAMPUS = [DEPT_INTER]

# Logo assets — configurable file paths, never inline/base64 images.
# A department/campus row may override these through its `logo_path`
# column; this map is the fallback when that column is NULL.
LOGO_DIR = "/static/assets/logos"
DEFAULT_LOGOS = {
    DEPT_BS:         f"{LOGO_DIR}/bs-logo.png",
    DEPT_INTER:      f"{LOGO_DIR}/intermediate-logo.png",
    CAMPUS_BS_MAIN:  f"{LOGO_DIR}/bs-logo.png",
    CAMPUS_BOYS:     f"{LOGO_DIR}/boys-logo.png",
    CAMPUS_GIRLS:    f"{LOGO_DIR}/girls-logo.png",
}

# Prefixes used when generating new record IDs per context.
# BS keeps the legacy "S###" / "T###" scheme so existing IDs, links and
# saved credentials keep working; Intermediate gets clearly distinct IDs.
ID_PREFIXES = {
    (DEPT_BS,    None):           {"students": "S",       "teachers": "T"},
    (DEPT_INTER, CAMPUS_BOYS):    {"students": "INT-B-",  "teachers": "ITB-"},
    (DEPT_INTER, CAMPUS_GIRLS):   {"students": "INT-G-",  "teachers": "ITG-"},
}

# ================================================================
# ACADEMIC CONSTANTS
# ================================================================
CLASSES = ["CS-A", "CS-B", "BBA-A", "BBA-B"]

SUBJECTS = [
    "English", "Urdu", "Islamiyat", "Biology", "Physics",
    "Chemistry", "Mathematics", "Computer Science",
    "Data Structures", "Calculus", "Statistics", "OOP"
]

SUBJECT_GROUPS = {
    "Medical":          ["English","Urdu","Islamiyat","Biology","Physics","Chemistry"],
    "Non-Medical":      ["English","Urdu","Islamiyat","Mathematics","Physics","Chemistry"],
    "Computer Science": ["English","Urdu","Islamiyat","Mathematics","Physics","Computer Science","Data Structures","OOP","Statistics"],
    "General Science":  ["English","Urdu","Islamiyat","Biology","Mathematics","Chemistry","Statistics"],
    "Business":         ["English","Urdu","Islamiyat","Mathematics","Microeconomics","Statistics","Calculus"],
}

SUBJECT_TO_GROUPS = {
    "English":            ["Medical","Non-Medical","Computer Science","General Science","Business"],
    "Urdu":               ["Medical","Non-Medical","Computer Science","General Science","Business"],
    "Islamiyat":          ["Medical","Non-Medical","Computer Science","General Science","Business"],
    "Biology":            ["Medical","General Science"],
    "Physics":            ["Medical","Non-Medical","Computer Science"],
    "Chemistry":          ["Medical","Non-Medical","General Science"],
    "Mathematics":        ["Non-Medical","Computer Science","General Science","Business"],
    "Computer Science":   ["Computer Science"],
    "Data Structures":    ["Computer Science"],
    "OOP":                ["Computer Science"],
    "Statistics":         ["Computer Science","General Science","Business"],
    "Calculus":           ["Non-Medical","Computer Science","Business"],
    "Microeconomics":     ["Business"],
    "English Literature": ["Medical","Non-Medical","Computer Science","General Science","Business"],
}

SUB_ADMIN_PERMS = [
    "students","teachers","attendance","grades",
    "fees","exams","notices","complaints","reports","timetable","classes"
]

TODAY = date.today().isoformat()
