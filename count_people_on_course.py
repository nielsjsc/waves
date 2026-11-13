#!/usr/bin/env python3
"""Calculate and output the total number of people on the course when closing Waves.

Rules:
- Includes all registered course entries, including 2nd-course and walk-up registrations.
- Subtracts No Shows (state == 'noShow' or prevState == 'noShow') and Not Attending (state == 'notAttending').
- Counts each active entry's groupSize (1 for individuals, N for groups).
- Adds +1 shadow (adult following the runner) for each active entry marked Non-Competitive (isNonCompete == True).
- Writes the report to a separate file (data/people_on_course.txt and data/archive/) and prints to the console.
"""
import datetime
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EVENT_FILE = ROOT / "waves-app" / "public" / "event.json"
OUTPUT_FILE = ROOT / "data" / "people_on_course.txt"
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


def fetch_event_data(event_id: str):
    db_name = f"wavesmongodb_{event_id}"
    eval_js = (
        f"const d = db.getSiblingDB({json.dumps(db_name)});"
        "JSON.stringify({"
        "participants: d.participants.find({}, {_id: 0}).toArray(),"
        "slots: d.slots.find({}, {_id: 0}).toArray()"
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
    # Use the last non-empty line in case mongosh prints any startup warnings
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

        if state == "notAttending":
            not_attending_entries += 1
            continue
        if state == "noShow" or prev_state == "noShow":
            no_show_entries += 1
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
        if "-added-" in pid:
            second_course_or_added_entries += 1

        course = course_by_pid.get(pid, "unassigned")
        c_stats = by_course.setdefault(
            course,
            {"entries": 0, "runners": 0, "shadows": 0, "total_people": 0},
        )
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


def format_report(event_info: dict, stats: dict, timestamp_str: str) -> str:
    event_id = event_info.get("eventId", "unknown")
    source = event_info.get("source", "unknown")
    lines = [
        "===========================================================",
        " WAVES - TOTAL PEOPLE ON COURSE REPORT",
        "===========================================================",
        f"Generated at : {timestamp_str}",
        f"Event ID     : {event_id}",
        f"Source Sheet : {source}",
        "-----------------------------------------------------------",
        f"Total registered entries (incl. 2nd courses) : {stats['total_registered_entries']}",
        f"  - Added / 2nd-course entries               : {stats['second_course_or_added_entries']}",
        f"  - Subtracted No Shows                      : -{stats['no_show_entries']}",
        f"  - Subtracted Not Attending                 : -{stats['not_attending_entries']}",
        f"Active entries on course                     : {stats['active_entries']}",
        "-----------------------------------------------------------",
        f"Runners on course (individuals + group sizes): {stats['runners_count']}",
        f"Non-competitive adult shadows (+1 per NC)    : {stats['nc_shadows_count']}",
        "===========================================================",
        f"TOTAL PEOPLE ON THE COURSE                   : {stats['total_people_on_course']}",
        "===========================================================",
        "",
        "Breakdown by Course:",
        f"  {'Course':<38} {'Entries':>7} {'Runners':>8} {'Shadows':>8} {'Total':>7}",
        f"  {'-' * 38} {'-' * 7} {'-' * 8} {'-' * 8} {'-' * 7}",
    ]
    for course, c_stats in stats["by_course"].items():
        label = COURSE_NAMES.get(course, course)
        lines.append(
            f"  {label:<38} {c_stats['entries']:>7} {c_stats['runners']:>8} {c_stats['shadows']:>8} {c_stats['total_people']:>7}"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    if not EVENT_FILE.exists():
        print("Could not find event.json; skipping course headcount report.")
        return 0

    try:
        event_info = json.loads(EVENT_FILE.read_text(encoding="utf-8"))
        event_id = event_info.get("eventId", "")
        if not event_id:
            print("No eventId found in event.json; skipping course headcount report.")
            return 0
        data = fetch_event_data(event_id)
    except Exception as exc:
        print(f"Note: Could not read live database for course headcount ({exc}).")
        return 0

    participants = data.get("participants", [])
    slots = data.get("slots", [])
    stats = compute_headcount(participants, slots)
    now = datetime.datetime.now()
    report_text = format_report(event_info, stats, now.strftime("%Y-%m-%d %H:%M:%S"))

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(report_text, encoding="utf-8")

    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    stamp = now.strftime("%Y-%m-%d_%H%M%S")
    archive_file = ARCHIVE_DIR / f"people_on_course_{event_id}_{stamp}.txt"
    archive_file.write_text(report_text, encoding="utf-8")

    print()
    print(report_text)
    print(f"Saved course headcount report to: {OUTPUT_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
