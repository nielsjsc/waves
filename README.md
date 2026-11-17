# Waves — Complete Setup & Operations Manual

Waves manages interval starts across **Call-up**, **E-punch Check**, **Start Manager**, **Download**, **Full Grid**, and **Change Log** during an orienteering meet.

---

## 1. New Host Laptop Setup (One-Time)

### A. Install Required Software
1. **Node.js (v20+) & pnpm**
   - Install Node.js from https://nodejs.org/
   - Open PowerShell and enable `pnpm`:
     ```powershell
     corepack enable
     ```
2. **Python 3.10+** (for converting start-list spreadsheets and exporting archives)
   - Install Python from https://www.python.org/downloads/ (check **"Add python.exe to PATH"**).
   - *(Required Python and Node packages are installed automatically on first run by `make-start-list.cmd` and `start-waves.cmd`.)*
3. **MongoDB Community Server (v8.x) & MongoDB Shell (`mongosh`)**
   - Install MongoDB Server to `C:\Program Files\MongoDB\Server\8.3\` (you can disable the Windows service so `start-waves.cmd` controls it directly).
   - Install `mongosh` and ensure it is on your system `PATH`.
   - Create the data folder `C:\MongoDB`.
4. **nginx for Windows**
   - Extract nginx to `C:\nginx-1.30.5` (so `C:\nginx-1.30.5\nginx.exe` exists).
   - *(If your MongoDB or nginx paths differ, update the path settings at the top of `start-waves.cmd` and `stop-waves.cmd`.)*

### B. Optional: Configure Router Local DNS
Waves runs over plain HTTP (`http://`) and accepts any hostname or IP address—no SSL certificates or `hosts` file edits are required.
- **Recommended (Router DNS)**: On the meet Wi-Fi router, set a static DHCP IP reservation for the Waves host laptop and map a local DNS name (for example, `waves.cascadeoc.org`) to that IP. Volunteers on any phone, tablet, or laptop can then open **`http://waves.cascadeoc.org`**.
- **Direct IP fallback**: Without router DNS, volunteers can connect to **`http://<HOST-LAPTOP-IP>`** (find the host IP with `ipconfig`, e.g. `http://192.168.0.34`).

---

## 2. Connecting Secondary Devices (Phones, Tablets, Other Laptops)

All devices must be connected to the **same Wi-Fi network** as the host laptop:

1. Connect the phone, tablet, or laptop to the meet Wi-Fi.
2. Open Chrome or Safari and navigate to **`http://waves.cascadeoc.org`** or **`http://<HOST-LAPTOP-IP>`**.
3. By default, devices open in **View-Only** mode on the Full Grid. Click **`Unlock Editing (PIN)`** and enter **`9465`** to unlock volunteer station tabs and editing controls.

---

## 3. Handling Meet Data

### Before the Meet: Importing the Start List
1. Put **only** this meet's Excel workbook (`.xlsx` or `.xlsm`, e.g. `WIOL ^N1 - Woodland Park - Start List.xlsx`) inside `data/input/` and **close Excel**.
2. Double-click **`make-start-list.cmd`**.
   - Reads the `StartSheet` (or `Sheet1`) tab, generates `waves-app/public/startlist.csv`, and writes `waves-app/public/event.json`.
   - Saves a copy of the pre-meet schedule to `data/archive/<Meet Name>/original_start_list.csv` (e.g. `data/archive/WIOL ^N1 - Woodland Park/original_start_list.csv`).
   - Review the console summary for starter counts and any `CHECK THESE ITEM(S)` warnings.

### After the Meet: Automatic Archive Exports
When you close Waves using **`stop-waves.cmd`**, all meet data is automatically exported into `data/archive/<Meet Name>/`:
- `original_start_list.csv` — the pre-meet schedule imported from Excel
- `change_log.csv` — chronological log of every change made during the meet
- `final_participant_status.csv` — every participant's final course, start time, original start time, status, e-punch, group size, `2nd course`, eligibility flags, and compass rental status
- `download_log.csv` — net changes for the Download / timing computer (`PENDING` / `CLEARED`)
- `people_on_course.csv` — per-course and total headcount breakdown (entries, runners, NC shadows, total people on course, no-shows, and not-attending counts)

*(If `stop-waves.cmd` is run multiple times during the same meet, the top-level CSVs are updated with the latest data and the previous set is moved into `data/archive/<Meet Name>/history/<timestamp>/`.)*

### Resetting / Re-importing the Current Meet *(Organizer Only)*
- If you need to wipe test clicks before the meet begins and reload `startlist.csv` from scratch, visit `http://localhost/?organizer` on the host laptop and click **`Re-import start list`** in the top bar.

---

## 4. Launching & Shutting Down

### Launching Waves
1. On the host laptop, double-click **`start-waves.cmd`**.
2. It launches MongoDB, the sync server, nginx, and the web app in order, then opens `http://localhost`.
3. Leave the command windows/tabs open while the meet is running (minimizing them is fine).
4. Verify the green **`Synced`** badge appears in the top-right header.

### Shutting Down Waves
1. Double-click **`stop-waves.cmd`** on the host laptop.
2. It closes the web app, sync server, and nginx (automatically closing their command tabs), exports all 5 meet CSVs to `data/archive/<Meet Name>/`, and shuts down MongoDB cleanly.

---

## 5. Meet-Day Station Guide

### Header Controls
- **Clock Time (`HH:MM:SS`)**: On Call-up and E-punch Check, click the clock to add/subtract hours, minutes, or seconds so that device matches the official start clock.
- **Wave Offset (`+6` / `+4`)**: Call-up defaults to **`+6`** minutes ahead of the start clock and E-punch Check defaults to **`+4`** minutes ahead. Click the offset badge next to the wave time to adjust it on that device.

### Station 1: Call-up (`Call-up`)
- Mark runners **`Present`** (blue) as they arrive, or **`No Show`** (red) if they miss their call-up wave.

### Station 2: E-punch Check (`Epunch Check`)
- Click **`Validate`** (turns green **`Validated`**) when the runner's e-punch matches the screen.
- Click **`Wrong E-punch`** (amber) if their stick does not match—an inline e-punch box opens right on the card so you can type their new e-punch (and toggle `Rental`) to validate them immediately.

### Station 3: Start Manager (`Start Manager`)
- **Triage Queues**:
  - **Ineligible racers**: Runners flagged `N` (missing parent shadow waiver) or `Need $` on the start list. Click the runner to view the highlighted issue and click **`Set as Eligible`** once resolved.
  - **Wrong e-punch**, **Standby**, and **No-shows**: Click any runner to resolve their issue. When a No-show opens a slot on a course with waiting Standby runners, a priority banner prompts to assign the first eligible Standby runner (prioritizing FIFO order and avoiding `<6 min` same-school conflicts).
- **Change or Create Start Time**: Click **`Change start time`** to pick an open time (recommended times maintain **6+ minutes** spacing from same-school teammates on the same course) or click **`+ Add new start time`** to create a new start time (e.g. `9:38`).
- **Rent Compass**: Click **`Rent Compass`** on a runner (in Start Manager or on the Full Grid) and enter the **Compass ID** (or confirm renting without an ID).
- **Add Participant / 2nd Course**: Click **`Add Participant`** (or **`Add 2nd course`** on an existing runner's page) to register walk-ups or second courses. Second-course entries are badged **`2nd course`** and counted with `0` shadows in course headcounts.

### Station 4: Download (`Download`)
- **Main Queue**: Shows only net changes that require updates in the timing computer (`E-PUNCH`, `COURSE`, `REGISTRATION` / `2ND COURSE`, `STATUS`). Intermediate hops (e.g. `C5 → C4 → C6`) collapse into one net row (`C5 → C6`), and round trips back to the original value are hidden automatically.
- **Compass Box (Right Sidebar)**:
  - **`Needs Return`**: Lists every racer with an unreturned rental compass, showing their **`#<compassId>`** badge next to their name and a **`Clear`** button when returned.
  - **`Returned`**: Shows the log of returned compasses with return timestamps and a **`Restore`** button.

---

## 6. Quick Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **Header says `Offline (saved locally)`** | Keep working—clicks are saved locally and sync automatically once Wi-Fi reconnects. |
| **Red `Records needing repair` banner in Start Manager** | Happens if two offline devices moved the same runner before reconnecting. Click the runner's name in the banner and click **`Keep this one`** on the correct slot. |
| **Phone/iPad says "Cannot open page"** | Verify the device is connected to the meet Wi-Fi and using `http://` (not `https://`), e.g. `http://waves.cascadeoc.org` or `http://<HOST-IP>`. |
| **`start-waves.cmd` says Waves is already running** | Double-click `stop-waves.cmd` first, then run `start-waves.cmd` again. |
| **Run automated health checks** | Double-click `run-tests.cmd` to run all unit tests, multi-station browser tests, and build checks. |
