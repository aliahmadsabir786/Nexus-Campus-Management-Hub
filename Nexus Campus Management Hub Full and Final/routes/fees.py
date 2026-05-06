"""
routes/fees.py  —  Fee management routes
  GET  /api/fees
  POST /api/fees/<sid>/status
  POST /api/fees/<sid>/plan
  POST /api/fees/<sid>/installment/<no>/pay
  POST /api/fees/<sid>/installment/<no>/revert
"""

import random, string
from flask import Blueprint, request, jsonify
from flask_login import login_required

from db import query
from config import TODAY
from utils.auth import perm_required, ts, safe_student

fees_bp = Blueprint("fees", __name__)


@fees_bp.route("/api/fees", methods=["GET"])
@login_required
def api_get_fees():
    cls    = request.args.get("cls", "ALL")
    status = request.args.get("status", "ALL")
    search = request.args.get("search", "").lower()
    sql    = "SELECT * FROM students WHERE 1=1"
    args   = []

    if cls    != "ALL": sql += " AND cls=%s";        args.append(cls)
    if status != "ALL": sql += " AND fee_status=%s"; args.append(status)
    if search:
        sql  += " AND (LOWER(name) LIKE %s OR LOWER(id) LIKE %s)"
        args += [f"%{search}%", f"%{search}%"]

    pool   = query(sql, args)
    result = []
    for s in pool:
        vouchers = query("SELECT * FROM fee_vouchers WHERE student_id=%s", (s["id"],))
        plan_row = query("SELECT * FROM fee_plans WHERE student_id=%s", (s["id"],), one=True)
        plan     = None
        if plan_row:
            insts = query("SELECT * FROM fee_installments WHERE plan_id=%s", (plan_row["id"],))
            plan  = {
                **plan_row,
                "installments": [
                    {
                        **i,
                        "dueDate":  str(i.get("due_date", "")),
                        "paidDate": str(i.get("paid_date", "")) if i.get("paid_date") else None
                    }
                    for i in insts
                ]
            }
        result.append({
            "student":      safe_student(s),
            "vouchers":     [
                {
                    **v,
                    "dueDate":  str(v.get("due_date", "")),
                    "paidDate": str(v.get("paid_date", "")) if v.get("paid_date") else None
                }
                for v in vouchers
            ],
            "installments": plan
        })
    return jsonify(result)


@fees_bp.route("/api/fees/<sid>/status", methods=["POST"])
@perm_required("fees")
def api_set_fee_status(sid):
    s = query("SELECT id FROM students WHERE id=%s", (sid,), one=True)
    if not s:
        return jsonify({"error": "Student not found"}), 404

    status = (request.get_json() or {}).get("status")
    if status not in ("paid", "pending", "overdue"):
        return jsonify({"error": "Invalid status"}), 400

    query("UPDATE students SET fee_status=%s WHERE id=%s", (status, sid), commit=True)
    paid_date = TODAY if status == "paid" else None
    query("UPDATE fee_vouchers SET status=%s, paid_date=%s WHERE student_id=%s",
          (status, paid_date, sid), commit=True)
    return jsonify({"success": True})


@fees_bp.route("/api/fees/<sid>/plan", methods=["POST"])
@perm_required("fees")
def api_create_fee_plan(sid):
    s = query("SELECT id FROM students WHERE id=%s", (sid,), one=True)
    if not s:
        return jsonify({"error": "Student not found"}), 404

    data  = request.get_json() or {}
    total = int(data.get("totalFee", 45000))
    sess  = data.get("session", "2025-26")
    dues  = [data.get("due1"), data.get("due2"), data.get("due3")]
    amt   = total // 3
    rem   = total - amt * 3

    query("DELETE FROM fee_plans WHERE student_id=%s", (sid,), commit=True)
    plan_id = query(
        "INSERT INTO fee_plans (student_id,total_fee,session) VALUES (%s,%s,%s)",
        (sid, total, sess), commit=True
    )

    chars = string.ascii_uppercase + string.digits
    for i, (due, am) in enumerate(zip(dues, [amt, amt, amt + rem]), 1):
        vchr = f"VCH-{sid}-{i}-{''.join(random.choices(chars, k=4))}"
        query(
            """INSERT INTO fee_installments (plan_id,inst_no,amount,due_date,voucher_no)
               VALUES (%s,%s,%s,%s,%s)""",
            (plan_id, i, am, due, vchr), commit=True
        )

    query("UPDATE students SET fee_status='pending' WHERE id=%s", (sid,), commit=True)
    return jsonify({"success": True}), 201


@fees_bp.route("/api/fees/<sid>/installment/<int:no>/pay", methods=["POST"])
@perm_required("fees")
def api_pay_installment(sid, no):
    plan = query("SELECT * FROM fee_plans WHERE student_id=%s", (sid,), one=True)
    if not plan:
        return jsonify({"error": "No fee plan"}), 404

    inst = query(
        "SELECT * FROM fee_installments WHERE plan_id=%s AND inst_no=%s",
        (plan["id"], no), one=True
    )
    if not inst:
        return jsonify({"error": "Installment not found"}), 404

    rcpt = f"RCT-{sid}-{no}-{ts()}"
    query(
        "UPDATE fee_installments SET status='paid',paid_date=%s,receipt_no=%s WHERE id=%s",
        (TODAY, rcpt, inst["id"]), commit=True
    )

    all_inst   = query("SELECT status FROM fee_installments WHERE plan_id=%s", (plan["id"],))
    new_status = "paid" if all(i["status"] == "paid" for i in all_inst) else "pending"
    query("UPDATE students SET fee_status=%s WHERE id=%s", (new_status, sid), commit=True)
    return jsonify({"success": True})


@fees_bp.route("/api/fees/<sid>/installment/<int:no>/revert", methods=["POST"])
@perm_required("fees")
def api_revert_installment(sid, no):
    plan = query("SELECT * FROM fee_plans WHERE student_id=%s", (sid,), one=True)
    if not plan:
        return jsonify({"error": "No fee plan"}), 404

    inst = query(
        "SELECT * FROM fee_installments WHERE plan_id=%s AND inst_no=%s",
        (plan["id"], no), one=True
    )
    if not inst:
        return jsonify({"error": "Installment not found"}), 404

    query(
        "UPDATE fee_installments SET status='pending',paid_date=NULL,receipt_no=NULL WHERE id=%s",
        (inst["id"],), commit=True
    )
    query("UPDATE students SET fee_status='pending' WHERE id=%s", (sid,), commit=True)
    return jsonify({"success": True})
