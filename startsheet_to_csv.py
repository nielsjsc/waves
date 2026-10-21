#!/usr/bin/env python3
"""Convert the 'StartSheet' tab of a WIOL start-list workbook (.xlsm/.xlsx)
into the expanded start-list CSV (Time + 3 columns per course).

Each course cell in the workbook is a stack of lines:
    Name / School / Epunch      -> cols: Name, School, Epunch
    Name Group (x) / Epunch     -> cols: Name, "Group (x)", Epunch
    Name / Epunch (no school)   -> cols: Name, Epunch, (blank)

Everyday use (no arguments): put the workbook in data/input/ and run this
script. It writes waves-app/public/startlist.csv and keeps the previous CSV
in data/archive/. Optional overrides, for developers:
    python startsheet_to_csv.py [workbook] [output] [--sheet StartSheet] [--nc-style school]
"""
import argparse
import csv
import datetime
import hashlib
import json
import re
import shutil
import sys

from pathlib import Path

try:
    from openpyxl import load_workbook
except ImportError:
    sys.exit("PROBLEM: the 'openpyxl' add-on is not installed.\n"
             "Fix: open a command window and run:  py -m pip install openpyxl")

ROOT = Path(__file__).resolve().parent
INPUT_DIR = ROOT / "data" / "input"
ARCHIVE_DIR = ROOT / "data" / "archive"
OUTPUT_FILE = ROOT / "waves-app" / "public" / "startlist.csv"

# The Waves importer (dataImport.ts) looks columns up BY NAME, so the CSV must
# use exactly these course names, in this order, even when the workbook's
# header text changes from week to week. Courses are matched by position.
STANDARD_COURSES = [
    "ELEMENTARYBEGINNER",
    "MIDDLE SCHOOL",
    "ROOKIE FEMALEADV BEGINNER",
    "ROOKIE MALE",
    "JV FEMALECOLLEGIATE JVINTERMEDIATE",
    "JV MALE",
    "VARSITY",
    "SHORT ADVANCED",
    "COLLEGE VARSITYLONG ADVANCED",
]

EPUNCH_RE = re.compile(r"\d+(?: \(R\))?")
GROUP_RE = re.compile(r"^(?P<name>.+?)\s+Group\s*\((?P<n>\d+)\)$", re.IGNORECASE)
NC_RE = re.compile(r"\s*\(NC\)\s*$", re.IGNORECASE)


def clean_lines(value):
    """Split a cell into stripped, non-empty lines (handles the literal
    '_x000D_' carriage-return escapes present in this workbook)."""
    text = str(value).replace("_x000D_", "").replace("\r", "")
    return [ln.strip() for ln in text.split("\n") if ln.strip()]


def clean_header(value):
    text = str(value).replace("_x000D_", "").replace("\r", "").replace("\n", "")
    return text.strip()


def parse_cell(value, nc_style, where, warnings):
    """Return (cell1, cell2, cell3) for one course cell."""
    if value is None or not str(value).strip():
        return "", "", ""
    lines = clean_lines(value)

    epunch = ""
    if EPUNCH_RE.fullmatch(lines[-1]):
        epunch = lines.pop()
    else:
        warnings.append(f"{where}: no epunch found in {lines!r}")
    if not lines:
        warnings.append(f"{where}: cell has an epunch but no name")
        return "", epunch, ""

    name = lines[0]
    school = " ".join(lines[1:])

    if not school:
        m = GROUP_RE.match(name)
        if m:  # group leader: name + "Group (x)" on the same line
            return m["name"].strip(), f"Group ({m['n']})", epunch
        return name, epunch, ""  # no school, no group: epunch goes in cell 2

    if len(lines) > 2:
        warnings.append(f"{where}: unexpected extra lines {lines!r}")

    if NC_RE.search(school) and nc_style == "epunch":
        school = NC_RE.sub("", school).strip()
        if epunch:
            epunch += " - NC"
        else:
            warnings.append(f"{where}: (NC) school but no epunch to attach it to")
    return name, school, epunch


def fmt_time(t):
    if isinstance(t, datetime.datetime):
        t = t.time()
    return f"{t.hour:02d}:{t.minute:02d}:{t.second:02d}"


def find_headers(ws):
    """First row whose col A is empty and B.. are text = course header band."""
    for row in ws.iter_rows(min_row=1, max_row=10):
        if row[0].value is None and isinstance(row[1].value, str):
            heads = []
            for cell in row[1:]:
                if not isinstance(cell.value, str) or not cell.value.strip():
                    break
                heads.append(clean_header(cell.value))
            return heads
    raise SystemExit("Could not find the course header row.")


def fail(msg):
    print()
    print("PROBLEM: " + msg)
    print("Nothing was changed.")
    sys.exit(1)


def find_input_workbook():
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    found = sorted(p for p in INPUT_DIR.iterdir()
                   if p.suffix.lower() in (".xlsx", ".xlsm") and not p.name.startswith("~$"))
    if not found:
        fail(f"No Excel file found in {INPUT_DIR}\n"
             "Copy the start-list workbook (.xlsx or .xlsm) into that folder and run this again.")
    if len(found) > 1:
        names = "\n".join("  - " + p.name for p in found)
        fail(f"More than one Excel file is in {INPUT_DIR}:\n{names}\n"
             "Leave only the one you want to use in that folder and run this again.")
    return found[0]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("workbook", nargs="?", help="default: the one Excel file in data/input/")
    ap.add_argument("output", nargs="?", help=f"default: {OUTPUT_FILE}")
    ap.add_argument("--sheet", default="StartSheet")
    ap.add_argument("--nc-style", choices=["epunch", "school"], default="epunch",
                    help="'epunch' moves '(NC)' from the school to the epunch as "
                         "' - NC' (default); 'school' leaves it on the school.")
    args = ap.parse_args()

    workbook = Path(args.workbook) if args.workbook else find_input_workbook()
    output = Path(args.output) if args.output else OUTPUT_FILE
    if not workbook.exists():
        fail(f"Cannot find {workbook}")
    print(f"Reading {workbook.name} ...")

    try:
        wb = load_workbook(workbook, data_only=True, read_only=False)
    except PermissionError:
        fail(f"{workbook.name} is locked. Close it in Excel and run this again.")
    except Exception as e:
        fail(f"{workbook.name} could not be opened as an Excel workbook ({e}).")
    if args.sheet not in wb.sheetnames:
        fail(f"The workbook has no tab named {args.sheet!r}. Tabs found: {', '.join(wb.sheetnames)}")
    ws = wb[args.sheet]

    try:
        courses = find_headers(ws)
    except SystemExit:
        fail("Could not find the row of course names near the top of the sheet.")
    if len(courses) != len(STANDARD_COURSES):
        fail(f"Expected {len(STANDARD_COURSES)} courses but the sheet has {len(courses)}: "
             f"{', '.join(courses)}\nWaves is set up for {len(STANDARD_COURSES)} courses; "
             "this needs a developer.")

    notes = []
    for i, (found, std) in enumerate(zip(courses, STANDARD_COURSES), start=1):
        if found != std:
            notes.append(f"Course {i} is called {found!r} in the workbook; "
                         f"saved as the standard name {std!r}.")
    header = ["Time"] + [f"{c}.{i}" for c in STANDARD_COURSES for i in (1, 2, 3)]

    warnings, out_rows = [], []
    for row in ws.iter_rows():
        t = row[0].value
        if not isinstance(t, (datetime.time, datetime.datetime)):
            continue  # header repeats, blanks, footer stats
        out = [fmt_time(t)]
        for i in range(len(courses)):
            where = f"{fmt_time(t)} / {courses[i]}"
            out.extend(parse_cell(row[1 + i].value, args.nc_style, where, warnings))
        out_rows.append(out)
    if not out_rows:
        fail("No start times were found in the sheet.")

    times = [r[0] for r in out_rows]
    for t in sorted({t for t in times if times.count(t) > 1}):
        warnings.append(f"the start time {t} appears more than once")

    # e-punch sanity check (placeholder numbers like 999999 are ignored)
    seen = {}
    for r in out_rows:
        for i in range(len(courses)):
            name, c2, c3 = r[1 + 3 * i: 4 + 3 * i]
            if not name:
                continue
            m = re.match(r"\d+", c3 if c3 else c2)
            if m and len(set(m[0])) > 1:
                seen.setdefault(m[0], []).append(f"{name} ({r[0]})")
    for num, who in seen.items():
        if len(who) > 1:
            warnings.append(f"e-punch {num} is listed more than once: {', '.join(who)}")

    # Write to a temporary file first so a failure never damages the current CSV.
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp = output.with_name(output.name + ".tmp")
    with open(tmp, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)  # default CRLF line endings, matching the template
        w.writerow(header)
        w.writerows(out_rows)

    # event.json names this event. Waves gives every event its own database named
    # after it, so a new start list starts empty everywhere with no manual clean-up.
    # The id comes from the list itself: re-running with the same list keeps the same
    # event (and its check-in progress); a changed list is a new event.
    event_id = hashlib.sha1(tmp.read_bytes()).hexdigest()[:8]
    event_file = output.with_name("event.json")

    archived = None
    if output.exists():
        ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.datetime.now().strftime("%Y-%m-%d_%H%M%S")
        archived = ARCHIVE_DIR / f"startlist_{stamp}.csv"
        shutil.copy2(output, archived)
        if event_file.exists():
            shutil.copy2(event_file, ARCHIVE_DIR / f"event_{stamp}.json")
    tmp.replace(output)
    event_file.write_text(json.dumps({
        "eventId": event_id,
        "source": workbook.name,
        "createdAt": datetime.datetime.now().isoformat(timespec="seconds"),
        "starters": sum(1 for r in out_rows for i in range(len(courses)) if r[1 + 3 * i]),
    }, indent=2), encoding="utf-8")

    people = sum(1 for r in out_rows for i in range(len(courses)) if r[1 + 3 * i])
    print()
    print(f"DONE: {len(out_rows)} start times, {people} starters.")
    print(f"Saved to: {output}")
    print(f"Event id: {event_id}  (Waves starts a fresh, empty event for each new id)")
    if archived:
        print(f"The previous list was kept in: {archived}")
    for n in notes:
        print("Note:", n)
    if warnings:
        print()
        print(f"CHECK THESE {len(warnings)} ITEM(S) in the Excel sheet before event day:")
        for msg in warnings:
            print("  -", msg)
    print()
    print("Next step: close any Waves windows left open from last week, then start Waves.")
    print("The list appears in Waves by itself - nothing to load.")


if __name__ == "__main__":
    main()