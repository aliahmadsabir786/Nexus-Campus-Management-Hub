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
