#!/usr/bin/env python3
"""Export all post-meet CSV archives and calculate total people on course when closing Waves.

Writes into data/archive/<Meet Name>/:
- original_start_list.csv
- change_log.csv
- final_participant_status.csv
- download_log.csv
- people_on_course.csv

If any of the 4 post-meet CSVs already exist in data/archive/<Meet Name>/ from an earlier
close during the same meet, the previous set is moved into data/archive/<Meet Name>/history/<timestamp>/
before writing the latest files.
"""
import csv
import datetime
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EVENT_FILE = ROOT / "waves-app" / "public" / "event.json"
STARTLIST_CSV = ROOT / "waves-app" / "public" / "startlist.csv"
ARCHIVE_DIR = ROOT / "data" / "archive"
MONGO_URL = "mongodb://127.0.0.1:27017/?directConnection=true"

COURSE_NAMES = {
    "c1": "c1 (Elementary / Beginner)",
    "c2": "c2 (Middle School)",
    "c3": "c3 (Rookie Female / Adv Beginner)",
    "c4": "c4 (Rookie Male)",
    "c5": "c5 (JV Female / Intermediate)",
    "c6": "c6 (JV Male / College JV)",
    "c7": "c7 (Varsity)",
    "c8": "c8 (Short Advanced)",
    "c9": "c9 (College Varsity / Long Advanced)",
}

COURSE_SHORT = {
    "c1": "Elem / Beg",
    "c2": "Middle Sch",
    "c3": "Rookie F / Adv Beg",
    "c4": "Rookie M",
    "c5": "JV F / Int",
    "c6": "JV M",
    "c7": "Varsity",
    "c8": "Short Adv",
    "c9": "Long Adv",
}

STATE_LABELS = {
    "waiting": "Waiting",
    "present": "Present",
    "validated": "Validated",
    "wrongEpunch": "Wrong E-punch",
    "noShow": "No Show",
    "notAttending": "Not Attending",
    "needsAssignment": "Standby",
    "started": "Started",
}

CHANGE_LABELS = {
    "noShow": "No show",
    "wrongEpunch": "Wrong e-punch",
    "notAttending": "Not attending",
    "needsAssignment": "Standby",
    "newTime": "New time",
    "newCourse": "New course",
    "epunch": "E-punch",
    "competitiveStatus": "Competitive status",
    "groupSize": "Group size",
    "repair": "Record repaired",
    "addedParticipant": "Added participant",
    "compassRental": "Compass rental",
}

EXPORT_FILENAMES = (
    "change_log.csv",
    "final_participant_status.csv",
    "download_log.csv",
    "people_on_course.csv",
)


def derive_meet_folder_name(source_name: str, explicit_meet_name: str = "", event_id: str = "") -> str:
    raw = explicit_meet_name.strip() if explicit_meet_name else (Path(source_name).stem if source_name else "")
    cleaned = re.sub(r"[\s_-]*start[\s_-]*list$", "", raw, flags=re.IGNORECASE).strip(" -_")
    cleaned = re.sub(r'[<>:"/\\|?*]', "_", cleaned).strip()
    return cleaned or (f"Meet_{event_id}" if event_id else "Meet")


def format_slot_time(time_val: str) -> str:
    if time_val == "_needsAssignment":
        return "Standby"
    if time_val == "_notAttending":
        return "Not attending"
    return time_val


def format_clock_hhmm(ms: int | float) -> str:
    dt = datetime.datetime.fromtimestamp(float(ms) / 1000.0)
    return dt.strftime("%H:%M")


def parse_epunch_change_value(raw: str) -> tuple[str, bool]:
    m = re.match(r"^(.*),\s*Rental:(true|false)$", raw or "")
    if m:
        return (m.group(1).strip() or "none", m.group(2) == "true")
    return ((raw or "").strip() or "none", False)


def extract_course_code(raw: str) -> str:
    trimmed = (raw or "").strip()
    return trimmed.split()[0] if trimmed else ""


def format_course_with_label(code: str) -> str:
    if not code:
        return "—"
    hint = COURSE_SHORT.get(code.lower(), "")
    return f"{code.upper()} ({hint})" if hint else code.upper()


def format_change_value(change_type: str, value: str) -> str:
    if change_type == "epunch":
        ep, is_rental = parse_epunch_change_value(value)
        return f"{ep} (rental)" if is_rental else ep
    if change_type == "groupSize":
        return "Individual (1)" if value == "1" else f"Group ({value})"
    if not value:
        return "none"
    return format_slot_time(value)


def normalize_download_val(change_type: str, raw: str) -> str:
    if change_type == "newCourse":
        return extract_course_code(raw).lower()
    if change_type == "epunch":
        ep, is_rental = parse_epunch_change_value(raw)
        return f"{ep.strip()}|{'true' if is_rental else 'false'}"
    return (raw or "").strip().lower()


def filter_download_changes(changes: list[dict]) -> list[dict]:
    download_types = {"epunch", "newCourse", "addedParticipant", "competitiveStatus"}
    collapsible_types = {"epunch", "newCourse", "competitiveStatus"}

    out: list[dict] = []
    groups: dict[tuple[str, str], list[tuple[int, dict]]] = {}

    for idx, c in enumerate(changes):
        ctype = c.get("changeType", "")
        if ctype not in download_types:
            continue
        if ctype not in collapsible_types:
            out.append(dict(c))
            continue
        key = (c.get("participantId", ""), ctype)
        groups.setdefault(key, []).append((idx, c))

    for items in groups.values():
        sorted_items = sorted(items, key=lambda x: (float(x[1].get("changedAt", 0)), x[0]))
        run_start = 0
        n = len(sorted_items)
        while run_start < n:
            proc_state = bool(sorted_items[run_start][1].get("isProcessed"))
            run_end = run_start + 1
            while run_end < n and bool(sorted_items[run_end][1].get("isProcessed")) == proc_state:
                run_end += 1
            first_c = sorted_items[run_start][1]
            last_c = sorted_items[run_end - 1][1]
            ctype = first_c.get("changeType", "")
            if normalize_download_val(ctype, first_c.get("old", "")) != normalize_download_val(ctype, last_c.get("new", "")):
                collapsed = dict(last_c)
                collapsed["old"] = first_c.get("old", "")
                collapsed["new"] = last_c.get("new", "")
                out.append(collapsed)
            run_start = run_end

    return sorted(out, key=lambda c: float(c.get("changedAt", 0)))


def fetch_event_data(event_id: str) -> dict:
    db_name = f"wavesmongodb_{event_id}"
    eval_js = (
        f"const d = db.getSiblingDB({json.dumps(db_name)});"
        "JSON.stringify({"
        "participants: d.participants.find({}, {_id: 0}).toArray(),"
        "slots: d.slots.find({}, {_id: 0}).toArray(),"
        "changes: d.changes.find({}, {_id: 0}).toArray()"
        "})"
    )
    proc = subprocess.run(
        ["mongosh", "--quiet", MONGO_URL, "--eval", eval_js],
        capture_output=True,
        text=True,
        timeout=15,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "mongosh returned a non-zero exit code")
    raw = proc.stdout.strip()
    if not raw:
        raise RuntimeError("Empty response from mongosh")
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    return json.loads(lines[-1])


def compute_headcount(participants: list[dict], slots: list[dict]) -> dict:
    course_by_pid = {}
    for slot in slots:
        course = slot.get("course", "")
        for pid in slot.get("participants", []) or []:
            if pid not in course_by_pid:
                course_by_pid[pid] = course

    total_registered_entries = len(participants)
    no_show_entries = 0
    not_attending_entries = 0
    active_entries = 0
    runners_count = 0
    nc_shadows_count = 0
    second_course_or_added_entries = 0

    by_course: dict[str, dict[str, int]] = {}

    for p in participants:
        pid = p.get("id", "")
        state = p.get("state", "waiting")
        prev_state = p.get("prevState", "")
        course = course_by_pid.get(pid, "unassigned")
        c_stats = by_course.setdefault(
            course,
            {"entries": 0, "runners": 0, "shadows": 0, "total_people": 0, "no_shows": 0, "not_attending": 0},
        )

        if state == "notAttending":
            not_attending_entries += 1
            c_stats["not_attending"] += 1
            continue
        if state == "noShow" or prev_state == "noShow":
            no_show_entries += 1
            c_stats["no_shows"] += 1
            continue

        group_size = max(1, int(p.get("groupSize") or 1))
        is_nc = bool(p.get("isNonCompete"))
        is_second_course = bool(p.get("isSecondCourse"))
        # NC on original start list always has 1 shadow; 2nd-course entries cannot have a shadow
        shadow = 1 if (is_nc and not is_second_course) else 0
        people_for_entry = group_size + shadow

        active_entries += 1
        runners_count += group_size
        nc_shadows_count += shadow
        if "-added-" in pid or is_second_course:
            second_course_or_added_entries += 1

        c_stats["entries"] += 1
        c_stats["runners"] += group_size
        c_stats["shadows"] += shadow
        c_stats["total_people"] += people_for_entry

    return {
        "total_registered_entries": total_registered_entries,
        "second_course_or_added_entries": second_course_or_added_entries,
        "no_show_entries": no_show_entries,
        "not_attending_entries": not_attending_entries,
        "active_entries": active_entries,
        "runners_count": runners_count,
        "nc_shadows_count": nc_shadows_count,
        "total_people_on_course": runners_count + nc_shadows_count,
        "by_course": dict(sorted(by_course.items())),
    }


def rotate_existing_exports_to_history(meet_dir: Path, now: datetime.datetime) -> Path | None:
    existing = [meet_dir / name for name in EXPORT_FILENAMES if (meet_dir / name).exists()]
    if not existing:
        return None
    mtime = datetime.datetime.fromtimestamp(existing[0].stat().st_mtime)
    stamp = mtime.strftime("%Y-%m-%d_%H%M%S")
    hist_dir = meet_dir / "history" / stamp
    if hist_dir.exists():
        stamp = now.strftime("%Y-%m-%d_%H%M%S")
        hist_dir = meet_dir / "history" / stamp
    hist_dir.mkdir(parents=True, exist_ok=True)
    for f in existing:
        shutil.move(str(f), str(hist_dir / f.name))
    return hist_dir


def write_csv(path: Path, headers: list[str], rows: list[list[object]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)


def export_meet_csvs(
    meet_dir: Path,
    participants: list[dict],
    slots: list[dict],
    changes: list[dict],
    stats: dict,
    now: datetime.datetime,
) -> Path | None:
    meet_dir.mkdir(parents=True, exist_ok=True)

    # Ensure original_start_list.csv is present in the meet folder
    orig_csv = meet_dir / "original_start_list.csv"
    if not orig_csv.exists() and STARTLIST_CSV.exists():
        shutil.copy2(STARTLIST_CSV, orig_csv)

    rotated_dir = rotate_existing_exports_to_history(meet_dir, now)

    participant_by_id = {p.get("id", ""): p for p in participants}
    slot_by_pid: dict[str, dict] = {}
    for s in slots:
        for pid in s.get("participants", []) or []:
            if pid not in slot_by_pid:
                slot_by_pid[pid] = s

    # 1. change_log.csv
    change_headers = [
        "Changed At",
        "Name",
        "School / Club",
        "Course",
        "Current Start",
        "Current E-punch",
        "Rental E-punch",
        "Non-Competitive",
        "Change Type",
        "Old Value",
        "New Value",
    ]
    change_rows: list[list[object]] = []
    for c in sorted(changes, key=lambda x: float(x.get("changedAt", 0))):
        p = participant_by_id.get(c.get("participantId", ""))
        if not p:
            continue
        ctype = c.get("changeType", "")
        if ctype == "noShow" and p.get("state") != "noShow" and p.get("prevState") != "noShow":
            continue
        if ctype == "wrongEpunch" and p.get("state") != "wrongEpunch" and p.get("prevState") != "wrongEpunch":
            continue
        slot = slot_by_pid.get(p.get("id", ""))
        club = p.get("club") or ""
        if club in ("unknown", "None"):
            club = ""
        change_rows.append([
            format_clock_hhmm(c.get("changedAt", 0)),
            p.get("name", ""),
            club,
            slot.get("course", "") if slot else "",
            format_slot_time(slot.get("time", "")) if slot else "",
            p.get("epunch", "") or "",
            bool(p.get("isRental")),
            bool(p.get("isNonCompete")),
            CHANGE_LABELS.get(ctype, ctype),
            format_change_value(ctype, c.get("old", "")),
            format_change_value(ctype, c.get("new", "")),
        ])
    write_csv(meet_dir / "change_log.csv", change_headers, change_rows)

    # 2. final_participant_status.csv
    roster_headers = [
        "Course",
        "Current Start",
        "Original Start",
        "Name",
        "School / Club",
        "State",
        "E-punch",
        "Rental E-punch",
        "Non-Competitive",
        "Group Size",
        "2nd Course",
        "Needs Waiver (N)",
        "Needs Payment (Need $)",
        "Compass Needs Return",
        "Compass ID",
    ]
    sorted_participants = sorted(
        participants,
        key=lambda p: (
            (slot_by_pid.get(p.get("id", ""), {}).get("course", "")),
            (slot_by_pid.get(p.get("id", ""), {}).get("time", "")),
            p.get("name", ""),
        ),
    )
    roster_rows: list[list[object]] = []
    for p in sorted_participants:
        slot = slot_by_pid.get(p.get("id", ""))
        club = p.get("club") or ""
        if club in ("unknown", "None"):
            club = ""
        state_code = p.get("state", "waiting")
        state_label = STATE_LABELS.get(state_code, state_code)
        curr_start = format_slot_time(slot.get("time", "")) if slot else ""
        orig_start = p.get("originalStartTime") or curr_start
        roster_rows.append([
            slot.get("course", "") if slot else "",
            curr_start,
            orig_start,
            p.get("name", ""),
            club,
            state_label,
            p.get("epunch", "") or "",
            bool(p.get("isRental")),
            bool(p.get("isNonCompete")),
            max(1, int(p.get("groupSize") or 1)),
            bool(p.get("isSecondCourse")),
            bool(p.get("needsWaiver")),
            bool(p.get("needsPayment")),
            bool(p.get("hasRentedCompass")),
            p.get("compassId", "") or "",
        ])
    write_csv(meet_dir / "final_participant_status.csv", roster_headers, roster_rows)

    # 3. download_log.csv
    download_headers = [
        "Status",
        "Time",
        "Change Type",
        "Participant Name",
        "School / Club",
        "Current Course",
        "Current E-punch",
        "Rental E-punch",
        "Non-Competitive",
        "Group Size",
        "Previous Value",
        "New Value",
    ]
    download_rows: list[list[object]] = []
    for c in filter_download_changes(changes):
        p = participant_by_id.get(c.get("participantId", ""))
        if not p:
            continue
        slot = slot_by_pid.get(p.get("id", ""))
        club = p.get("club") or ""
        if club in ("unknown", "None"):
            club = ""
        ctype = c.get("changeType", "")
        if ctype == "epunch":
            cat_code = "E-PUNCH"
            old_ep, old_r = parse_epunch_change_value(c.get("old", ""))
            new_ep, new_r = parse_epunch_change_value(c.get("new", ""))
            old_text = f"{old_ep} ({'Rental' if old_r else 'Own'})"
            new_text = f"{new_ep} ({'Rental' if new_r else 'Own'})"
        elif ctype == "newCourse":
            cat_code = "COURSE"
            old_text = format_course_with_label(extract_course_code(c.get("old", "")))
            new_text = format_course_with_label(extract_course_code(c.get("new", "")))
        elif ctype == "addedParticipant":
            cat_code = "2ND COURSE" if p.get("isNonCompete") else "REGISTRATION"
            old_text = "—"
            new_text = f"Registered on {format_course_with_label(extract_course_code(c.get('new', '')))}"
        elif ctype == "competitiveStatus":
            cat_code = "STATUS"
            old_text = c.get("old", "") or "—"
            new_text = c.get("new", "") or "—"
        else:
            cat_code = ctype.upper()
            old_text = c.get("old", "") or "—"
            new_text = c.get("new", "") or "—"

        download_rows.append([
            "CLEARED" if c.get("isProcessed") else "PENDING",
            format_clock_hhmm(c.get("changedAt", 0)),
            cat_code,
            p.get("name", ""),
            club,
            (slot.get("course", "") if slot else "").upper(),
            p.get("epunch", "") or "none",
            "Yes" if p.get("isRental") else "No",
            "NC" if p.get("isNonCompete") else "Competitive",
            max(1, int(p.get("groupSize") or 1)),
            old_text,
            new_text,
        ])
    write_csv(meet_dir / "download_log.csv", download_headers, download_rows)

    # 4. people_on_course.csv
    headcount_headers = [
        "Course",
        "Active Entries",
        "Runners",
        "NC Shadows",
        "Total People on Course",
        "No Shows",
        "Not Attending",
    ]
    headcount_rows: list[list[object]] = []
    for course, c_stats in stats["by_course"].items():
        headcount_rows.append([
            COURSE_NAMES.get(course, course),
            c_stats["entries"],
            c_stats["runners"],
            c_stats["shadows"],
            c_stats["total_people"],
            c_stats.get("no_shows", 0),
            c_stats.get("not_attending", 0),
        ])
    headcount_rows.append([
        "TOTAL",
        stats["active_entries"],
        stats["runners_count"],
        stats["nc_shadows_count"],
        stats["total_people_on_course"],
        stats["no_show_entries"],
        stats["not_attending_entries"],
    ])
    write_csv(meet_dir / "people_on_course.csv", headcount_headers, headcount_rows)

    return rotated_dir


def main() -> int:
    if not EVENT_FILE.exists():
        print("Archive export skipped: event.json not found.")
        return 0

    try:
        event_info = json.loads(EVENT_FILE.read_text(encoding="utf-8"))
        event_id = event_info.get("eventId", "")
        if not event_id:
            print("Archive export skipped: no eventId found in event.json.")
            return 0
        data = fetch_event_data(event_id)
        participants = data.get("participants", [])
        slots = data.get("slots", [])
        changes = data.get("changes", [])
        stats = compute_headcount(participants, slots)
        now = datetime.datetime.now()

        meet_name = derive_meet_folder_name(
            event_info.get("source", ""),
            event_info.get("meetName", ""),
            event_id,
        )
        meet_dir = ARCHIVE_DIR / meet_name
        rotated_dir = export_meet_csvs(meet_dir, participants, slots, changes, stats, now)
    except Exception as exc:
        print(f"Archive export failed: {exc}")
        return 1

    print(f"Archive export successful: {meet_dir}")
    if (meet_dir / "original_start_list.csv").exists():
        print("  - original_start_list.csv")
    for fname in EXPORT_FILENAMES:
        print(f"  - {fname}")
    if rotated_dir:
        print(f"  (Previous export moved to: {rotated_dir})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
