# NEXus Solution — College Management System
## Setup Guide (Sirf 3 Steps!)

---

### Step 1 — Database Setup

MySQL mein yeh command run karein:
```
mysql -u root -p < schema.sql
```
Password maangega — apna MySQL password daalein.

---

### Step 2 — db.py mein Password Change Karein

`db.py` file kholein aur apna MySQL password set karein:
```python
DB_CONFIG = {
    "host":     "localhost",
    "user":     "root",
    "password": "APNA_PASSWORD_YAHAN",   # <-- yahan apna password
    "database": "nexus_cms",
    ...
}
```

---

### Step 3 — Run Karein

```bash
pip install -r requirements.txt
python app.py
```

Browser mein open karein: **http://127.0.0.1:5000**

---

## Default Login Credentials

| Role    | Username | Password |
|---------|----------|----------|
| Admin   | admin    | admin123 |
| Student | S001     | 1234     |
| Student | S002     | 1234     |
| Teacher | T001     | teach1   |
| Teacher | T002     | teach2   |

---

## Kya Fix Kiya Gaya

1. **schema.sql** — `JSON DEFAULT ('[]')` → `JSON DEFAULT (JSON_ARRAY())` fixed
2. **class_students table** — missing table add ki gayi
3. **routes/classes.py** — `class_students` table properly use ho raha hai
4. **config.py** — `classes` permission SUB_ADMIN_PERMS mein add ki
