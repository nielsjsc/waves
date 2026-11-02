# Waves — Volunteer & Meet-Day Guide

Waves keeps interval starts running smoothly across **Call-up**, **E-punch Check**, **Start Manager**, and the **Timing Desk** during an orienteering meet.

---

## 1. Before the Meet: Prepare the Start List

Do this on the **host laptop** once the start-list spreadsheet (`.xlsx` or `.xlsm`) is ready:

1. **Place the Excel file in `data/input/`**
   - Open the [`data/input`](file:///c:/Users/nlsc/Desktop/waves/data/input) folder.
   - Make sure **only this meet's Excel file** is inside `data/input/` (move old workbooks out) and **close Excel** so the file is not locked.
2. **Double-click `make-start-list.cmd`**
   - Converts the `StartSheet` tab into `waves-app/public/startlist.csv` and writes a unique `event.json` ID for this meet (archiving any previous meet's list in `data/archive/`).
   - Check the summary printed in the window:
     - Confirm the number of **start times** and **starters**.
     - Fix any **`CHECK THESE ITEM(S)`** warnings (such as duplicate e-punch numbers or missing names) in Excel and run `make-start-list.cmd` again.
3. **(Optional) Run the automated system check**
   - Double-click `run-tests.cmd` to verify that all unit tests, multi-station browser simulations, and builds pass.

---

## 2. Meet Morning: Starting Waves

### On the Host Laptop
1. **Double-click `start-waves.cmd`**
   - Starts the database, sync server, web server, and app automatically, then opens `https://app.waves.local`.
   - **Leave the 3 black command windows open** (`Waves - database`, `Waves - sync server`, `Waves - app`). You can minimize them, but do not close them during the meet.
2. **Verify the Start List Loaded**
   - Each new event starts with a fresh database and imports `startlist.csv` automatically the first time the page opens.

### On Every Volunteer Laptop
1. Connect to the meet Wi-Fi network.
2. Open Chrome to **`https://app.waves.local`**.
3. Check the top header bar:
   - **Sync badge**: Confirm it says **`Synced`** (green dot).
   - **Station selection**: Click the **menu icon (`☰`)** in the top-right to switch to your station (`Call-up`, `Epunch Check`, `Start Manager`, `Full Grid`, or `Change Log`).
   - **Clock alignment**: If a laptop's clock is off from the official meet clock, click the **clock time (`HH:MM:SS`)** in the top-right to adjust the offset.
   - **Wave offset (`+8`)**: Click `(+8)` next to the wave time in the header if Call-up or E-punch Check is operating a different number of minutes ahead of the start clock.

*(Your selected station, clock offset, and wave offset are saved automatically if you refresh the page.)*

---

## 3. Station Guides for Volunteers

### Station A — Tent 1: Call-up (`Call-up`)
**Goal:** Check in runners as they arrive for their wave and flag missing runners so Start Manager can reassign them if they show up late.

- **Selecting a wave**: The **"Calling now"** column shows your selected wave, and **"Up next"** previews the following wave. Click **`Now (...)`** to jump to the current clock wave, or **`Next (...)`** to advance to the next wave.
- **When a runner arrives**: Click **`Present`** (turns blue).
- **When a wave closes and a runner is missing**: Click **`No Show`** (turns red).
- **Accidental click?**: Tap the same button again to undo and return the runner to their previous state.

---

### Station B — Tent 1: E-punch Check (`Epunch Check`)
**Goal:** Verify that the e-punch stick on the runner's finger matches the number in the system before they step into the start box.

- **E-punch matches the screen**: Click **`Validate`** (button turns green and says **`Validated`**).
- **E-punch does NOT match (or runner has no e-punch)**:
  1. Click **`Wrong E-punch`** (turns amber).
  2. Direct the runner to the **Start Manager** desk.
  3. Their start slot remains reserved—as soon as the Start Manager enters their correct/rental e-punch, their card on your screen will automatically update to **`Validated`** with the new number.

---

### Station C — Start Manager (`Start Manager`)
**Goal:** Help runners with wrong/rental e-punches, late arrivals, new start times, course changes, and scratches.

#### Finding a Runner
- **Search bar**: Type any part of a runner's **name**, **school/club**, or **e-punch number** (press `Enter` to select, `Esc` to clear).
- **Live Queues**: Click anyone listed under **Wrong e-punch**, **Needs a new time**, **No-shows**, or **Recent changes**.
- **Schools & Clubs directory**: Scroll down to **Schools & Clubs** and click any school to see its full attendance summary and student roster without typing names.

#### Common Actions (Once a Runner is Selected)
- **Fix a Wrong E-punch or Assign a Rental**:
  - Click **`Edit e-punch`** $\to$ type the 5–9 digit e-punch number $\to$ choose **`Rental`** or **`Owned`** $\to$ click **`Save`**.
  - If they were flagged as `Wrong E-punch`, saving their new e-punch **automatically marks them `Validated`** and sends the change to the Timing Desk.
  - If their original e-punch was actually fine, click **`Mark e-punch validated`**.
- **Assign a New Start Time (Late Arrival / No-Show)**:
  - In the **"Move to a new time"** panel on the right, click any open time button (soonest open times after call-up are shown first).
  - Need a time that is already past call-up? Check **"Include times already past call-up"**.
  - If a runner has arrived late, is waiting for a time, and you want to free their old slot first, click **`Needs new time`**.
- **Move a Runner to a Different Course**:
  - In the **"Move to a new time"** panel, click the new **Course** tab (`c1`–`c9`), pick an open time, and click **`Confirm move`** in the confirmation bar.
- **Change Competitive Status**:
  - Click **`Set non-competitive`** or **`Set competitive`**.
- **Runner is Not Coming (Scratch / DNS)**:
  - Click **`Not attending`** $\to$ **`Yes, not attending`**. This frees their start slot for other runners while remembering their original start time.
- **Undo or Restore Original**:
  - **Immediate Undo**: After any action, a yellow **`Undo`** banner appears at the bottom of the screen for 3 seconds.
  - **Later Restore**: Whenever a runner's start time, course, or e-punch differs from the imported start list, a **"Changed from the original"** box appears on their card with one-click **`Restore`** buttons.
- **When finished with a runner**: Click **`Done`** (or press `Esc` in an empty search box) to return to the queues.

---

### Station D — Timing Desk (`Change Log`)
**Goal:** Enter e-punch, course, and competitive-status changes into the timing software (MeOS / SportIdent) so every starter downloads cleanly at the finish.

1. Keep the page on the **`Needs timing entry`** tab (selected by default).
   - The badge shows how many changes are waiting to be entered in the timing software.
2. For each row in the list:
   - Enter the updated **E-punch**, **New course**, or **Competitive status** into the timing software.
   - Click **`Mark entered`** (turns green **`Entered ✓`** and moves out of the pending queue).
3. **End-of-Meet Exports (or Periodic Backups)**:
   - Click **`Export Changes CSV`** to download a complete spreadsheet of every change made during the meet.
   - Click **`Export Full Roster CSV`** to download the final roster with every participant's course, start time, original start time, check-in status, and e-punch.

---

## 4. Shutting Down After the Meet

1. On the Timing Desk or Host Laptop, open **`Change Log`** and click **`Export Changes CSV`** and **`Export Full Roster CSV`** to save final CSV copies.
2. On the Host Laptop, double-click **`stop-waves.cmd`**.
   - Safely closes the web app, sync server, nginx, and MongoDB database. All meet data remains saved on disk.

---

## 5. Quick Troubleshooting

| What You See | What It Means & How to Fix It |
| :--- | :--- |
| **`Offline (saved locally)`** badge in header | This laptop temporarily lost Wi-Fi connection to the host laptop. **Keep working normally**—all clicks are saved on your laptop and sync automatically as soon as Wi-Fi reconnects. |
| **`New event loaded`** screen | A new start list was generated with `make-start-list.cmd` while this tab was open. Click **`Reload for new event`**. |
| **`Records needing repair`** red banner in Start Manager | A brief multi-laptop sync conflict listed a runner in 0 or 2 slots. If it stays for more than a few seconds, click the runner's name and click **`Keep this one`** on the correct slot. |
| **`start-waves.cmd` says Waves is already running** | Double-click **`stop-waves.cmd`** first, then double-click **`start-waves.cmd`** again. No data is lost. |
| **Need to wipe and re-import the current start list** *(Organizer only)* | Before the meet starts, open `https://app.waves.local/?organizer`, click the `☰` menu, and click **`Re-import start list`**. |
