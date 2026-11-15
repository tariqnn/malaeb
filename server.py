#!/usr/bin/env python3
"""Malaeb local server. Standard library only; binds to loopback by default."""
from __future__ import annotations

import json
import mimetypes
import os
import re
import sqlite3
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
DB_PATH = Path(os.environ.get("MALAEB_DB_PATH", str(DATA / "malaeb.sqlite3")))
HOST = os.environ.get("MALAEB_HOST", "127.0.0.1")
PORT = int(os.environ.get("MALAEB_PORT", "4173"))

def format_jod(amount_fils: int) -> str:
    amount=amount_fils/1000
    return f"{amount:,.0f} JOD" if amount_fils%1000==0 else f"{amount:,.3f} JOD"


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA journal_mode=WAL")
    return db


def seed(db: sqlite3.Connection):
    db.executescript((DATA / "schema.sql").read_text(encoding="utf-8"))
    if db.execute("SELECT 1 FROM organization WHERE id=1").fetchone():
        if not db.execute("SELECT 1 FROM schema_migrations WHERE version='jod-fils-1000' ").fetchone():
            # The initial local prototype used 1/100 units; migrate its own seeded ledger to fils.
            db.execute("UPDATE programs SET fee_fils=fee_fils*10")
            db.execute("UPDATE members SET fee_fils=fee_fils*10")
            db.execute("UPDATE payments SET amount_fils=amount_fils*10")
            db.execute("INSERT INTO schema_migrations(version) VALUES('jod-fils-1000')")
            db.commit()
        if not db.execute("SELECT 1 FROM schema_migrations WHERE version='initial-seed-currency-correction'").fetchone():
            # Correct only the six known starter programs, eight starter members and four fixed seed receipts.
            for row_id,wrong_amount in enumerate((1800000,2400000,1800000,2100000,1950000,2400000),1):
                db.execute("UPDATE programs SET fee_fils=fee_fils/10 WHERE id=? AND fee_fils=?",(row_id,wrong_amount))
            for row_id,wrong_amount in enumerate((1800000,2400000,1800000,2100000,1800000,1950000,2400000,1800000),1):
                db.execute("UPDATE members SET fee_fils=fee_fils/10 WHERE id=? AND fee_fils=?",(row_id,wrong_amount))
            for row_id,wrong_amount in enumerate((900000,2400000,900000,2100000),1):
                db.execute("UPDATE payments SET amount_fils=amount_fils/10 WHERE id=? AND amount_fils=? AND receipt_code IN ('M-2461','M-2460','M-2459','M-2458')",(row_id,wrong_amount))
            db.execute("INSERT INTO schema_migrations(version) VALUES('initial-seed-currency-correction')")
            db.commit()
        return
    db.execute("INSERT INTO organization(id,name,city,timezone,locale) VALUES(1,?,?,?,?)",
               ("Amman Athletic Club", "Amman", "Asia/Amman", "en"))
    programs = [
        ("Football · U14", "Football", "U14", 180000, 30),
        ("Basketball · U12", "Basketball", "U12", 240000, 24),
        ("Football · U16", "Football", "U16", 180000, 30),
        ("Swimming · U12", "Swimming", "U12", 210000, 20),
        ("Volleyball · U16", "Volleyball", "U16", 195000, 24),
        ("Basketball · U10", "Basketball", "U10", 240000, 24),
    ]
    db.executemany("INSERT INTO programs(name,sport,age_group,fee_fils,capacity) VALUES(?,?,?,?,?)", programs)
    pids = {r["name"]: r["id"] for r in db.execute("SELECT id,name FROM programs")}
    members = [
        ("Yazan Haddad", 13, "Football · U14", "Rana Haddad", "079 ••• ••42", "Active"),
        ("Leen Nasser", 11, "Basketball · U12", "Omar Nasser", "078 ••• ••17", "Pending"),
        ("Adam Saleh", 15, "Football · U16", "Maha Saleh", "079 ••• ••83", "Active"),
        ("Jana Qasem", 10, "Swimming · U12", "Samer Qasem", "077 ••• ••25", "Active"),
        ("Kareem Odeh", 12, "Football · U14", "Dima Odeh", "078 ••• ••61", "Overdue"),
        ("Mira Taha", 14, "Volleyball · U16", "Rami Taha", "079 ••• ••09", "Active"),
        ("Zaid Barakat", 9, "Basketball · U10", "Hala Barakat", "077 ••• ••34", "Pending"),
        ("Noor Ahmad", 12, "Football · U14", "Sara Ahmad", "079 ••• ••71", "Active"),
    ]
    for name, age, program, guardian, phone, status in members:
        fee = db.execute("SELECT fee_fils FROM programs WHERE id=?", (pids[program],)).fetchone()[0]
        db.execute("INSERT INTO members(athlete_name,age,program_id,guardian_name,guardian_phone,status,fee_fils) VALUES(?,?,?,?,?,?,?)",
                   (name, age, pids[program], guardian, phone, status, fee))
    teams = [
        ("U14 Falcons", "Football · U14", "Ahmad Khalil", "AK", 18, "Pitch 2", "17:30"),
        ("U12 Hoops", "Basketball · U12", "Sara Mansour", "SM", 14, "Main court", "18:00"),
        ("U16 Strikers", "Football · U16", "Omar Yasin", "OY", 21, "Pitch 1", "16:00"),
        ("U12 Dolphins", "Swimming · U12", "Hiba Rami", "HR", 12, "Pool A", "17:15"),
        ("U16 Spikers", "Volleyball · U16", "Dana Nabil", "DN", 16, "Indoor court", "18:30"),
    ]
    db.executemany("INSERT INTO teams(name,program_id,coach_name,coach_initials,players,facility,next_session) VALUES(?,?,?,?,?,?,?)",
                   [(n,pids[p],c,i,count,f,t) for n,p,c,i,count,f,t in teams])
    teamids = {r["name"]: r["id"] for r in db.execute("SELECT id,name FROM teams")}
    memberships = {
        "U14 Falcons":["Yazan Haddad","Kareem Odeh","Noor Ahmad"],
        "U12 Hoops":["Leen Nasser","Zaid Barakat"],
        "U16 Strikers":["Adam Saleh"],
        "U12 Dolphins":["Jana Qasem"],
        "U16 Spikers":["Mira Taha"],
    }
    for team_name,athletes in memberships.items():
        for athlete in athletes:
            member=db.execute("SELECT id FROM members WHERE athlete_name=?",(athlete,)).fetchone()
            if member: db.execute("INSERT OR IGNORE INTO team_memberships(team_id,member_id) VALUES(?,?)",(teamids[team_name],member[0]))
    db.executemany("INSERT INTO facilities(name,location,sport) VALUES(?,?,?)", [
        ("Main football pitch", "Al Madinah Sports Complex", "Football"),
        ("Indoor court", "Abdoun Clubhouse", "Basketball"),
        ("Training pool", "Al Madinah Sports Complex", "Swimming"),
        ("Practice pitch 2", "Khalda Sports Ground", "Football"),
    ])
    db.executemany("INSERT INTO registrations(athlete_name,age,program_id,guardian_name,guardian_phone,status,submitted_at) VALUES(?,?,?,?,?,?,?)", [
        ("Leen Nasser",11,pids["Basketball · U12"],"Omar Nasser","078 ••• ••17","Needs review","2026-11-15 12:10:00"),
        ("Zaid Barakat",9,pids["Basketball · U10"],"Hala Barakat","077 ••• ••34","Needs review","2026-11-15 10:24:00"),
        ("Yazan Haddad",13,pids["Football · U14"],"Rana Haddad","079 ••• ••42","Approved","2026-11-14 11:24:00"),
        ("Mira Taha",14,pids["Volleyball · U16"],"Rami Taha","079 ••• ••09","Approved","2026-11-13 09:45:00"),
        ("Sami Darwish",12,pids["Football · U14"],"Laila Darwish","078 ••• ••18","Waitlist","2026-11-12 15:32:00"),
    ])
    db.execute("INSERT INTO message_threads(name,audience,preview) VALUES('U14 Falcons parents','Team','Reminder: training is on pitch 2 today.')")
    db.execute("INSERT INTO message_threads(name,audience,preview) VALUES('Leen Nasser’s family','Family','Thank you, we have received the receipt.')")
    db.execute("INSERT INTO message_threads(name,audience,preview) VALUES('All club families','Club','Autumn season photos are ready to view.')")
    thread = db.execute("SELECT id FROM message_threads ORDER BY id LIMIT 1").fetchone()[0]
    db.executemany("INSERT INTO messages(thread_id,sender,body,sent_at) VALUES(?,?,?,?)", [
        (thread,"Coach Ahmad","Reminder: training is on pitch 2 today. Please arrive 10 minutes early.","2026-11-15 13:16:00"),
        (thread,"You","Thank you! Is the match still on for Thursday?","2026-11-15 13:30:00"),
        (thread,"Coach Ahmad","Yes, the match is confirmed. Details are in the club schedule.","2026-11-15 14:42:00"),
    ])
    db.execute("INSERT INTO club_profile(id,display_name,slug,tagline,phone,address,published,locale) VALUES(1,?,?,?,?,?,?,?)",
               ("Amman Athletic Club","amman-ac","Grow together through sport","06 ••• ••40","Sports City, Amman",1,"en"))
    today = datetime.now().astimezone().date().isoformat()
    event_specs = [
        ("U14 Falcons · Training", "U14 Falcons", "17:30", "Practice", "Pitch 2"),
        ("U12 Hoops · Training", "U12 Hoops", "18:00", "Practice", "Main court"),
        ("U16 Strikers · Training", "U16 Strikers", "19:15", "Practice", "Pitch 1"),
        ("U12 Dolphins · Swim session", "U12 Dolphins", "19:30", "Practice", "Pool A"),
    ]
    for title, team, start, kind, place in event_specs:
        db.execute("INSERT INTO events(title,team_id,facility,event_type,starts_at,ends_at) VALUES(?,?,?,?,?,?)",
                   (title,teamids[team],place,kind,f"{today}T{start}:00",f"{today}T{int(start[:2])+1:02d}:{start[3:]}:00"))
    pay_rows = [(1,"Haddad family","Yazan Haddad",90000,"Cash","M-2461"),
                (2,"Nasser family","Leen Nasser",240000,"CliQ","M-2460"),
                (5,"Odeh family","Kareem Odeh",90000,"Cash","M-2459"),
                (4,"Qasem family","Jana Qasem",210000,"Cash","M-2458")]
    db.executemany("INSERT INTO payments(member_id,family_name,athlete_name,amount_fils,method,receipt_code) VALUES(?,?,?,?,?,?)", pay_rows)
    db.execute("INSERT INTO schema_migrations(version) VALUES('jod-fils-1000')")
    db.commit()


def rowdict(row):
    return dict(row) if row else None


def bootstrap(db):
    program_rows = [rowdict(r) for r in db.execute("SELECT * FROM programs ORDER BY sport,age_group")]
    program_map = {p["id"]: p for p in program_rows}
    members = []
    for r in db.execute("SELECT * FROM members ORDER BY id DESC"):
        p = program_map.get(r["program_id"], {})
        name = r["athlete_name"]
        initials = "".join(part[0] for part in name.split()[:2]).upper()
        members.append({"id":r["id"],"name":name,"initials":initials,"age":r["age"],"program":p.get("name","Unassigned"),
                        "guardian":r["guardian_name"],"phone":r["guardian_phone"],"status":r["status"],
                        "fee":format_jod(r["fee_fils"]),"fee_fils":r["fee_fils"],"tone":""})
    teams = []
    for r in db.execute("SELECT t.*,p.sport,p.name program,(SELECT COUNT(*) FROM team_memberships tm WHERE tm.team_id=t.id) roster_count FROM teams t LEFT JOIN programs p ON p.id=t.program_id ORDER BY t.id"):
        teams.append({"id":r["id"],"name":r["name"],"sport":r["sport"] or "Sport","program":r["program"] or "","program_id":r["program_id"],"coach":r["coach_name"],
                      "initials":r["coach_initials"],"players":r["roster_count"],"next":r["next_session"],"facility":r["facility"],"tone":"green",
                      "roster":[dict(m) for m in db.execute("SELECT m.id,m.athlete_name name,m.age FROM team_memberships tm JOIN members m ON m.id=tm.member_id WHERE tm.team_id=? ORDER BY m.athlete_name",(r["id"],))]})
    registrations = []
    for r in db.execute("SELECT r.*,p.name program FROM registrations r LEFT JOIN programs p ON p.id=r.program_id ORDER BY r.submitted_at DESC"):
        registrations.append({"id":r["id"],"name":r["athlete_name"],"age":r["age"],"program":r["program"] or "Unassigned",
                              "guardian":r["guardian_name"],"phone":r["guardian_phone"],"status":r["status"],"submitted":r["submitted_at"]})
    payments = [dict(id=r["id"],family=r["family_name"],athlete=r["athlete_name"],amount=format_jod(r["amount_fils"]),
                     amount_fils=r["amount_fils"],method=r["method"],date=r["received_at"],receipt=r["receipt_code"],status=r["status"])
                for r in db.execute("SELECT * FROM payments ORDER BY received_at DESC,id DESC LIMIT 50")]
    events = [dict(r) for r in db.execute("SELECT e.*,t.name team FROM events e LEFT JOIN teams t ON t.id=e.team_id ORDER BY e.starts_at")]
    threads = [dict(r) for r in db.execute("SELECT * FROM message_threads ORDER BY updated_at DESC,id")]
    for t in threads:
        t["messages"] = [dict(r) for r in db.execute("SELECT * FROM messages WHERE thread_id=? ORDER BY sent_at,id", (t["id"],))]
    facilities = [dict(r) for r in db.execute("SELECT * FROM facilities ORDER BY id")]
    facility_bookings = [dict(r) for r in db.execute("SELECT b.*,f.name facility,t.name team FROM facility_bookings b LEFT JOIN facilities f ON f.id=b.facility_id LEFT JOIN teams t ON t.id=b.team_id ORDER BY b.booking_date,b.starts_at LIMIT 100")]
    profile = rowdict(db.execute("SELECT * FROM club_profile WHERE id=1").fetchone())
    latest_event=db.execute("SELECT id FROM events ORDER BY starts_at LIMIT 1").fetchone()
    saved_attendance={}
    if latest_event:
        saved_attendance={str(r["member_id"]):r["status"] for r in db.execute("SELECT member_id,status FROM attendance WHERE event_id=?",(latest_event["id"],))}
    attendance_present=sum(1 for status in saved_attendance.values() if status in {"Present","Late"})
    summary = {
        "members":db.execute("SELECT COUNT(*) FROM members WHERE status!='Inactive'").fetchone()[0],
        "pending":db.execute("SELECT COUNT(*) FROM registrations WHERE status='Needs review'").fetchone()[0],
        "fees_fils":db.execute("SELECT COALESCE(SUM(amount_fils),0) FROM payments WHERE status='Recorded'").fetchone()[0],
        "outstanding_fils":db.execute("SELECT COALESCE(SUM(MAX(0,m.fee_fils-COALESCE(p.total,0))),0) FROM members m LEFT JOIN (SELECT member_id,SUM(amount_fils) total FROM payments WHERE status='Recorded' GROUP BY member_id) p ON p.member_id=m.id WHERE m.status!='Inactive'").fetchone()[0],
        "team_count":db.execute("SELECT COUNT(*) FROM teams").fetchone()[0],
        "attendance_present":attendance_present,
        "attendance_percent":round((attendance_present/len(saved_attendance))*100) if saved_attendance else 0,
    }
    return {"members":members,"teams":teams,"registrations":registrations,"payments":payments,"events":events,
            "threads":threads,"facilities":facilities,"facility_bookings":facility_bookings,"programs":program_rows,"profile":profile,"summary":summary,"attendance":saved_attendance}


class Handler(BaseHTTPRequestHandler):
    server_version = "MalaebLocal/1.0"

    def log_message(self, fmt, *args):
        # Keep logs useful without emitting submitted names or phone numbers.
        print(f"{self.address_string()} {fmt % args}")

    def send_json(self, payload, status=200):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 1_000_000:
            raise ValueError("Request is too large")
        raw = self.rfile.read(length) if length else b"{}"
        data = json.loads(raw.decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("Expected a JSON object")
        return data

    def audit(self, db, action, entity_type, entity_id=None, details=""):
        db.execute("INSERT INTO audit_log(action,entity_type,entity_id,details) VALUES(?,?,?,?)",
                   (action,entity_type,entity_id,details[:240]))

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_json({"ok":True,"service":"Malaeb Local","database":"SQLite","seeded":DB_PATH.exists()})
            return
        if parsed.path == "/api/bootstrap":
            with connect() as db:
                seed(db)
                self.send_json(bootstrap(db))
            return
        if parsed.path == "/api/audit":
            with connect() as db:
                rows = [dict(r) for r in db.execute("SELECT * FROM audit_log ORDER BY created_at DESC,id DESC LIMIT 100")]
                self.send_json(rows)
            return
        self.serve_file(parsed.path)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            data = self.body()
            with connect() as db:
                seed(db)
                if path == "/api/members":
                    name = str(data.get("athlete", "")).strip()
                    guardian = str(data.get("guardian", "")).strip()
                    phone = str(data.get("mobile", "")).strip()
                    try: age = int(str(data.get("age", 0)).removeprefix("U"))
                    except (TypeError, ValueError): age = 0
                    if not name or not guardian or len(phone) < 7 or age < 4 or age > 19:
                        return self.send_json({"error":"Enter the athlete, a guardian, a valid contact number, and an age from 4 to 19."},400)
                    program = db.execute("SELECT id,fee_fils FROM programs WHERE name=?", (str(data.get("program","")),)).fetchone()
                    if not program: return self.send_json({"error":"Choose an available program."},400)
                    duplicate = db.execute("SELECT id FROM members WHERE lower(athlete_name)=lower(?) AND program_id=? AND status!='Inactive'",(name,program["id"])).fetchone()
                    if duplicate: return self.send_json({"error":"This athlete is already enrolled in that program."},409)
                    cur=db.execute("INSERT INTO members(athlete_name,age,program_id,guardian_name,guardian_phone,email,status,fee_fils) VALUES(?,?,?,?,?,?,?,?)",
                                   (name,age,program["id"],guardian,phone,str(data.get("email",""))[:160],"Pending",program["fee_fils"]))
                    self.audit(db,"MEMBER_CREATED","member",cur.lastrowid,"Added athlete to local season roster")
                    db.commit(); return self.send_json({"ok":True,"id":cur.lastrowid,"data":bootstrap(db)})
                if path == "/api/programs":
                    name=str(data.get("name","")).strip(); sport=str(data.get("sport","")).strip(); age_group=str(data.get("age_group","")).strip()
                    try: fee_fils=round(float(data.get("fee",0))*1000); capacity=max(1,min(500,int(data.get("capacity",30))))
                    except (TypeError,ValueError): return self.send_json({"error":"Enter a valid fee and capacity."},400)
                    if not name or not sport or not age_group or fee_fils<0: return self.send_json({"error":"Complete the program details."},400)
                    cur=db.execute("INSERT INTO programs(name,sport,age_group,fee_fils,capacity) VALUES(?,?,?,?,?)",(name,sport,age_group,fee_fils,capacity))
                    self.audit(db,"PROGRAM_CREATED","program",cur.lastrowid,"Created season program")
                    db.commit(); return self.send_json({"ok":True,"id":cur.lastrowid,"data":bootstrap(db)},201)
                if path == "/api/registrations":
                    name=str(data.get("athlete","")).strip(); guardian=str(data.get("guardian","")).strip(); phone=str(data.get("mobile","")).strip()
                    try: age=int(data.get("age",0))
                    except (TypeError,ValueError): age=0
                    program=db.execute("SELECT id FROM programs WHERE name=?",(str(data.get("program","")),)).fetchone()
                    normalized_phone=re.sub(r"[\s()-]","",phone)
                    if not name or not guardian or not re.fullmatch(r"\+?\d{7,15}",normalized_phone) or not 4<=age<=19 or not program or not data.get("consent"):
                        return self.send_json({"error":"Complete the required fields, choose a program, and confirm guardian consent."},400)
                    duplicate=db.execute("SELECT id FROM registrations WHERE lower(athlete_name)=lower(?) AND program_id=? AND status IN ('Needs review','Approved') LIMIT 1",(name,program["id"])).fetchone()
                    if duplicate:
                        return self.send_json({"error":"An active application already exists for this athlete and program."},409)
                    cur=db.execute("INSERT INTO registrations(athlete_name,age,program_id,guardian_name,guardian_phone,email,consent_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)",
                                   (name,age,program["id"],guardian,normalized_phone,str(data.get("email",""))[:160]))
                    self.audit(db,"REGISTRATION_SUBMITTED","registration",cur.lastrowid,"Local family registration request")
                    db.commit(); return self.send_json({"ok":True,"id":cur.lastrowid,"data":bootstrap(db)},201)
                if path == "/api/payments":
                    try: amount_fils=round(float(data.get("amount",0))*1000)
                    except (TypeError,ValueError): amount_fils=0
                    member=db.execute("SELECT id,athlete_name,guardian_name FROM members WHERE id=?",(data.get("member_id"),)).fetchone() if data.get("member_id") else None
                    if not member:
                        picked=str(data.get("family",""))
                        athlete=picked.split(" · ",1)[-1].strip()
                        member=db.execute("SELECT id,athlete_name,guardian_name FROM members WHERE athlete_name LIKE ? OR guardian_name LIKE ? ORDER BY id DESC LIMIT 1",(f"%{athlete}%",f"%{picked.split(' family',1)[0]}%" )).fetchone()
                    method=str(data.get("method",""))
                    allowed={"Cash","CliQ"}
                    if amount_fils<=0 or not member or method not in allowed:
                        return self.send_json({"error":"Select a family, enter a positive JOD amount, and choose a payment method."},400)
                    receipt=f"M-{datetime.now().strftime('%y%m%d%H%M%S')}-{os.urandom(2).hex().upper()}"
                    received_date=str(data.get("date",""))
                    received_at=f"{received_date} {datetime.now().strftime('%H:%M:%S')}" if re.fullmatch(r"\d{4}-\d\d-\d\d",received_date) else datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    cur=db.execute("INSERT INTO payments(member_id,family_name,athlete_name,amount_fils,method,note,receipt_code,received_at) VALUES(?,?,?,?,?,?,?,?)",
                                   (member["id"],member["guardian_name"].split()[0]+" family",member["athlete_name"],amount_fils,method,str(data.get("note",""))[:240],receipt,received_at))
                    paid=db.execute("SELECT COALESCE(SUM(amount_fils),0) FROM payments WHERE member_id=? AND status='Recorded'",(member["id"],)).fetchone()[0]
                    balance=db.execute("SELECT fee_fils FROM members WHERE id=?",(member["id"],)).fetchone()[0]
                    if paid>=balance: db.execute("UPDATE members SET status='Active' WHERE id=?",(member["id"],))
                    elif paid>0: db.execute("UPDATE members SET status='Pending' WHERE id=? AND status!='Overdue'",(member["id"],))
                    self.audit(db,"PAYMENT_RECORDED","payment",cur.lastrowid,f"{amount_fils} fils · {method}")
                    db.commit(); return self.send_json({"ok":True,"id":cur.lastrowid,"receipt":receipt,"data":bootstrap(db)})
                if path == "/api/events":
                    title=str(data.get("event","")).strip(); team_id=data.get("team_id") or data.get("team")
                    if team_id and not str(team_id).isdigit():
                        team_row=db.execute("SELECT id FROM teams WHERE name=?",(str(team_id),)).fetchone(); team_id=team_row[0] if team_row else None
                    starts=str(data.get("starts_at","")); ends=str(data.get("ends_at",""))
                    kind=str(data.get("type","Practice")); facility=str(data.get("facility","Main pitch"))
                    if not title or not re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d",starts) or kind not in {"Practice","Match","Other"}:
                        return self.send_json({"error":"Enter an event name, date, time and event type."},400)
                    if not ends:
                        try: ends=(datetime.fromisoformat(starts)+__import__('datetime').timedelta(hours=1)).isoformat(timespec='minutes')
                        except ValueError: return self.send_json({"error":"Date or time is invalid."},400)
                    cur=db.execute("INSERT INTO events(title,team_id,facility,event_type,starts_at,ends_at) VALUES(?,?,?,?,?,?)",
                                   (title,team_id,facility,kind,starts,ends))
                    self.audit(db,"EVENT_CREATED","event",cur.lastrowid,"Added club calendar event")
                    db.commit(); return self.send_json({"ok":True,"id":cur.lastrowid,"data":bootstrap(db)},201)
                if path == "/api/teams":
                    name=str(data.get("name","")).strip(); coach=str(data.get("coach","")).strip(); program_name=str(data.get("program",""))
                    program=db.execute("SELECT id,sport FROM programs WHERE name=?",(program_name,)).fetchone()
                    if not name or not coach or not program: return self.send_json({"error":"Enter a team name, coach and program."},400)
                    cur=db.execute("INSERT INTO teams(name,program_id,coach_name,coach_initials,players,facility,next_session) VALUES(?,?,?,?,0,?,?)",
                                   (name,program["id"],coach,"".join(p[0] for p in coach.split()[:2]).upper(),str(data.get("facility","Main pitch")),"Not scheduled"))
                    self.audit(db,"TEAM_CREATED","team",cur.lastrowid,"Created team")
                    db.commit(); return self.send_json({"ok":True,"id":cur.lastrowid,"data":bootstrap(db)},201)
                if path == "/api/team-memberships":
                    team_id=data.get("team_id"); member_ids=data.get("member_ids",[])
                    if not team_id or not isinstance(member_ids,list): return self.send_json({"error":"Choose a team and roster."},400)
                    db.execute("DELETE FROM team_memberships WHERE team_id=?",(team_id,))
                    for member_id in set(member_ids):
                        if db.execute("SELECT 1 FROM members WHERE id=?",(member_id,)).fetchone():
                            db.execute("INSERT INTO team_memberships(team_id,member_id) VALUES(?,?)",(team_id,member_id))
                    self.audit(db,"ROSTER_UPDATED","team",team_id,f"Saved {len(member_ids)} roster positions")
                    db.commit(); return self.send_json({"ok":True,"data":bootstrap(db)})
                if path == "/api/messages":
                    thread_id=data.get("thread_id"); body=str(data.get("message","")).strip()
                    if not body or len(body)>4000: return self.send_json({"error":"Enter a message up to 4,000 characters."},400)
                    if not thread_id:
                        name=str(data.get("audience","All club families"))[:100]
                        cur=db.execute("INSERT INTO message_threads(name,audience,preview) VALUES(?,?,?)",(name,name,body[:180])); thread_id=cur.lastrowid
                    if not db.execute("SELECT 1 FROM message_threads WHERE id=?",(thread_id,)).fetchone():
                        return self.send_json({"error":"That conversation no longer exists."},404)
                    cur=db.execute("INSERT INTO messages(thread_id,sender,body) VALUES(?,?,?)",(thread_id,"You",body))
                    db.execute("UPDATE message_threads SET preview=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",(body[:180],thread_id))
                    self.audit(db,"MESSAGE_SAVED","message",cur.lastrowid,"Stored local message; no external delivery")
                    db.commit(); return self.send_json({"ok":True,"data":bootstrap(db)},201)
                if path == "/api/attendance":
                    event_id=data.get("event_id"); rows=data.get("attendance",[])
                    if not event_id or not isinstance(rows,list): return self.send_json({"error":"Choose a session and attendance list."},400)
                    for item in rows:
                        status=str(item.get("status",""))
                        if status not in {"Present","Absent","Excused","Late"}: continue
                        db.execute("INSERT INTO attendance(event_id,member_id,status,note) VALUES(?,?,?,?) ON CONFLICT(event_id,member_id) DO UPDATE SET status=excluded.status,note=excluded.note,recorded_at=CURRENT_TIMESTAMP",
                                   (event_id,item.get("member_id"),status,str(item.get("note",""))[:240]))
                    self.audit(db,"ATTENDANCE_RECORDED","event",event_id,f"Recorded {len(rows)} roster states")
                    db.commit(); return self.send_json({"ok":True,"data":bootstrap(db)})
                if path == "/api/facility-bookings":
                    facility_id=data.get("facility_id") or data.get("facility"); team_id=data.get("team_id") or data.get("team"); date=str(data.get("date","")); start=str(data.get("time",""))
                    if facility_id and not str(facility_id).isdigit():
                        facility_row=db.execute("SELECT id FROM facilities WHERE name=?",(str(facility_id).split(" · ",1)[0],)).fetchone(); facility_id=facility_row[0] if facility_row else None
                    if team_id and not str(team_id).isdigit():
                        team_row=db.execute("SELECT id FROM teams WHERE name=?",(str(team_id),)).fetchone(); team_id=team_row[0] if team_row else None
                    if not facility_id or not team_id or not re.fullmatch(r"\d{4}-\d\d-\d\d",date) or not re.fullmatch(r"\d\d:\d\d",start):
                        return self.send_json({"error":"Choose a facility, team, date and start time."},400)
                    conflict=db.execute("SELECT 1 FROM facility_bookings WHERE facility_id=? AND booking_date=? AND starts_at=? AND status!='Declined'",(facility_id,date,start)).fetchone()
                    if conflict: return self.send_json({"error":"That facility is already requested for this time."},409)
                    cur=db.execute("INSERT INTO facility_bookings(facility_id,team_id,booking_date,starts_at) VALUES(?,?,?,?)",(facility_id,team_id,date,start))
                    self.audit(db,"FACILITY_REQUESTED","facility_booking",cur.lastrowid,"Created local facility request")
                    db.commit(); return self.send_json({"ok":True,"id":cur.lastrowid,"data":bootstrap(db)},201)
                return self.send_json({"error":"Unknown API route."},404)
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json({"error":str(exc)},400)
        except sqlite3.IntegrityError as exc:
            self.send_json({"error":f"Could not save: {exc}"},409)
        except Exception as exc:
            print(f"Request failed: {type(exc).__name__}")
            self.send_json({"error":"The local server could not complete that request."},500)

    def do_PUT(self):
        path=urlparse(self.path).path
        try:
            data=self.body()
            if path!="/api/profile": return self.send_json({"error":"Unknown API route."},404)
            with connect() as db:
                cur=db.execute("UPDATE club_profile SET display_name=?,tagline=?,phone=?,address=?,published=? WHERE id=1",
                               (str(data.get("display_name",""))[:100],str(data.get("tagline",""))[:180],str(data.get("phone",""))[:80],str(data.get("address",""))[:180],1 if data.get("published") else 0))
                if not cur.rowcount: return self.send_json({"error":"Club profile is missing."},404)
                self.audit(db,"PROFILE_UPDATED","club_profile",1,"Updated public club profile")
                db.commit(); return self.send_json({"ok":True,"data":bootstrap(db)})
        except Exception as exc:
            self.send_json({"error":str(exc)},400)

    def do_PATCH(self):
        path=urlparse(self.path).path
        try:
            data=self.body()
            booking_match=re.fullmatch(r"/api/facility-bookings/(\d+)",path)
            if booking_match:
                booking_status=str(data.get("status",""))
                if booking_status not in {"Approved","Declined"}: return self.send_json({"error":"Invalid facility booking status."},400)
                with connect() as db:
                    booking=db.execute("SELECT id FROM facility_bookings WHERE id=?",(int(booking_match.group(1)),)).fetchone()
                    if not booking: return self.send_json({"error":"Facility request not found."},404)
                    db.execute("UPDATE facility_bookings SET status=? WHERE id=?",(booking_status,int(booking_match.group(1))))
                    self.audit(db,"FACILITY_REQUEST_REVIEWED","facility_booking",int(booking_match.group(1)),booking_status)
                    db.commit();return self.send_json({"ok":True,"data":bootstrap(db)})
            match=re.fullmatch(r"/api/registrations/(\d+)",path)
            if not match: return self.send_json({"error":"Unknown API route."},404)
            status=str(data.get("status",""))
            if status not in {"Approved","Waitlist","Declined","Needs review"}: return self.send_json({"error":"Invalid registration status."},400)
            with connect() as db:
                registration=db.execute("SELECT * FROM registrations WHERE id=?",(int(match.group(1)),)).fetchone()
                if not registration: return self.send_json({"error":"Registration not found."},404)
                if registration["status"] in {"Approved","Declined"} and status!=registration["status"]:
                    return self.send_json({"error":"This application has already been closed."},409)
                cur=db.execute("UPDATE registrations SET status=? WHERE id=?",(status,int(match.group(1))))
                if status=="Approved":
                    existing=db.execute("SELECT id FROM members WHERE lower(athlete_name)=lower(?) AND program_id=? AND status!='Inactive'",(registration["athlete_name"],registration["program_id"])).fetchone()
                    member_id=existing[0] if existing else db.execute("INSERT INTO members(athlete_name,age,program_id,guardian_name,guardian_phone,email,status,fee_fils) SELECT ?,?,?,?,?,?,'Pending',fee_fils FROM programs WHERE id=?",
                        (registration["athlete_name"],registration["age"],registration["program_id"],registration["guardian_name"],registration["guardian_phone"],registration["email"],registration["program_id"])).lastrowid
                    team=db.execute("SELECT id FROM teams WHERE program_id=? ORDER BY id LIMIT 1",(registration["program_id"],)).fetchone()
                    if team: db.execute("INSERT OR IGNORE INTO team_memberships(team_id,member_id) VALUES(?,?)",(team[0],member_id))
                self.audit(db,"REGISTRATION_REVIEWED","registration",int(match.group(1)),status)
                db.commit(); return self.send_json({"ok":True,"data":bootstrap(db)})
        except Exception as exc:
            self.send_json({"error":str(exc)},400)

    def serve_file(self,path):
        relative=unquote(path).lstrip("/") or "index.html"
        candidate=(ROOT/relative).resolve()
        if ROOT not in candidate.parents and candidate!=ROOT:
            self.send_error(403); return
        if candidate.is_dir(): candidate=candidate/"index.html"
        if not candidate.is_file(): self.send_error(404); return
        data=candidate.read_bytes(); mime=mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        if mime in {"text/html","text/css","application/javascript","text/javascript"}: mime+="; charset=utf-8"
        self.send_response(200); self.send_header("Content-Type",mime); self.send_header("Content-Length",str(len(data)))
        self.send_header("X-Content-Type-Options","nosniff"); self.send_header("Cache-Control","no-cache")
        self.end_headers(); self.wfile.write(data)


if __name__ == "__main__":
    with connect() as db: seed(db)
    print(f"Malaeb local server: http://{HOST}:{PORT}")
    print(f"SQLite database: {DB_PATH}")
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
