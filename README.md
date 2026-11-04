# Waves — Complete Setup & Operations Manual

Waves manages interval starts across **Call-up**, **E-punch Check**, **Start Manager**, **Full Grid**, and **Change Log** during an orienteering meet.

---

## 1. New Host Laptop Setup (One-Time)

### A. Install Required Software
1. **Node.js (v20+) & pnpm**
   - Install Node.js from https://nodejs.org/
   - Open PowerShell and enable `pnpm`:
     ```powershell
     corepack enable
     ```
2. **Python 3.10+ & Excel packages** (for converting start-list spreadsheets)
   - Install Python from https://www.python.org/downloads/ (check **"Add python.exe to PATH"**).
   - Install required Python libraries:
     ```powershell
     pip install pandas openpyxl
     ```
3. **MongoDB Community Server (v8.x) & MongoDB Shell (`mongosh`)**
   - Install MongoDB Server to `C:\Program Files\MongoDB\Server\8.3\` (you can disable the Windows service so `start-waves.cmd` controls it directly).
   - Install `mongosh` and ensure it is on your system `PATH`.
   - Create the data folder `C:\MongoDB`.
4. **nginx for Windows**
   - Extract nginx to `C:\nginx-1.30.5` (so `C:\nginx-1.30.5\nginx.exe` exists).
   - *(If your MongoDB or nginx paths differ, update the 3 path lines at the top of [`start-waves.cmd`](file:///c:/Users/nlsc/Desktop/waves/start-waves.cmd#L6-L8) and [`stop-waves.cmd`](file:///c:/Users/nlsc/Desktop/waves/stop-waves.cmd#L3).)*
5. **Install Project Packages**
   ```powershell
   cd waves-server
   pnpm install

   cd ..\waves-app
   pnpm install
   ```

### B. Configure Local Domains (`hosts` file)
Open Notepad **as Administrator**, open `C:\Windows\System32\drivers\etc\hosts`, and add:
```text
127.0.0.1 app.waves.local
127.0.0.1 server.waves.local
```

### C. Generate Local HTTPS Certificates (`mkcert`)
Waves uses HTTPS so browsers allow fast local database storage (`IndexedDB`) across devices.
1. Install `mkcert` (e.g. `winget install FiloSottile.mkcert`).
2. Find your host laptop's Wi-Fi IP address by running `ipconfig` (e.g. `192.168.0.34`).
3. Install the local Certificate Authority and generate the certificate into the `security/` folder:
   ```powershell
   mkcert -install
   mkcert -cert-file security/waves-cert.pem -key-file security/waves-key.pem app.waves.local server.waves.local localhost 127.0.0.1 192.168.0.34
   ```
   *(Replace `192.168.0.34` with your laptop's current Wi-Fi IP whenever you change networks.)*

---

## 2. Setting Up Secondary Devices (iPhones, iPads, Other Laptops)

All devices must be connected to the **same Wi-Fi network** as the host laptop. First, run `mkcert -CAROOT` in PowerShell on the host laptop to locate **`rootCA.pem`**, and check the host laptop's Wi-Fi IP address with `ipconfig` (e.g. `192.168.0.34`).

### A. iPhone or iPad (Safari)
1. Send **`rootCA.pem`** from the host laptop to the iPhone/iPad (via iCloud Drive, AirDrop, or email) and tap the file to download the profile.
2. Open **Settings → Profile Downloaded** (near the top) and tap **Install**.
3. Enable full trust: open **Settings → General → About → Certificate Trust Settings** (at the very bottom) and toggle **ON** the `mkcert` root certificate.
4. In Safari, open **`https://<HOST-LAPTOP-IP>:5173`** (e.g. `https://192.168.0.34:5173`). Always include `https://`.

### B. Another Windows Laptop
1. **Install `rootCA.pem` as a Trusted Root Certificate** (do either one):
   - **Quickest (PowerShell as Administrator):** Copy `rootCA.pem` to the laptop and run:
     ```powershell
     certutil -addstore -f "ROOT" .\rootCA.pem
     ```
   - **Or via Windows GUI:** Open **Manage computer certificates** (`certlm.msc` from the Start menu) → expand **Trusted Root Certification Authorities** → right-click **Certificates** → **All Tasks → Import…** → browse to `rootCA.pem` (select *All Files (`*.*`)* in the file picker) → click **Next** and **Finish**.
2. **Open Waves in Chrome:**
   - Go directly to **`https://<HOST-LAPTOP-IP>:5173`** (e.g. `https://192.168.0.34:5173`), **OR**
   - To use **`https://app.waves.local`**, open Notepad as Administrator, edit `C:\Windows\System32\drivers\etc\hosts`, and point both domains to the host laptop's IP:
     ```text
     192.168.0.34 app.waves.local
     192.168.0.34 server.waves.local
     ```

### C. Another Mac Laptop
1. **Install & Trust `rootCA.pem`:**
   - Copy `rootCA.pem` to the Mac and double-click it to open **Keychain Access** (add it to the **System** keychain if prompted).
   - Find the **`mkcert ...`** certificate in Keychain Access, double-click it, expand the **▸ Trust** section, set **When using this certificate** to **Always Trust**, and close the window (enter your Mac password to save).
2. **Open Waves in Chrome or Safari:**
   - Go directly to **`https://<HOST-LAPTOP-IP>:5173`** (e.g. `https://192.168.0.34:5173`), **OR**
   - To use **`https://app.waves.local`** on a Mac, open Terminal, run `sudo nano /etc/hosts`, and point both domains to the host laptop's Wi-Fi IP:
     ```text
     192.168.0.34 app.waves.local
     192.168.0.34 server.waves.local
     ```
     Save (`Ctrl+O`, `Enter`, `Ctrl+X`), then open **`https://app.waves.local`**.

---

## 3. Handling Meet Data

### Before the Meet: Importing the Start List
1. Put **only** this meet's Excel workbook (`.xlsx` or `.xlsm`) inside [`data/input/`](file:///c:/Users/nlsc/Desktop/waves/data/input) and **close Excel**.
2. Double-click **[`make-start-list.cmd`](file:///c:/Users/nlsc/Desktop/waves/make-start-list.cmd)**.
   - Reads the `StartSheet` tab, generates `waves-app/public/startlist.csv`, and creates a unique `eventId` in `waves-app/public/event.json`.
   - Automatically archives any previous meet's files into `data/archive/`.
   - Review the console summary for starter counts and any `CHECK THESE ITEM(S)` warnings (duplicate e-punches, missing names).

### During & After the Meet: Exporting Data
1. Click **`Change Log`** in the top navigation bar.
2. Click **`Export Changes CSV`** for a chronological log of every e-punch edit, start-time move, course change, and added runner.
3. Click **`Export Full Roster CSV`** for the complete final start list with updated courses, start times, original start times, e-punches, and check-in states.

### Resetting / Re-importing the Current Meet *(Organizer Only)*
- If you need to wipe test clicks before the meet begins and reload `startlist.csv` from scratch, visit `https://app.waves.local/?organizer` and click **`Re-import start list`** in the top bar.

---

## 4. Launching & Shutting Down

### Launching Waves
1. On the host laptop, double-click **[`start-waves.cmd`](file:///c:/Users/nlsc/Desktop/waves/start-waves.cmd)**.
2. It launches MongoDB, the sync server, nginx, and the web app in order, then opens `https://app.waves.local`.
3. **Keep the 3 black command windows open** (`Waves - database`, `Waves - sync server`, `Waves - app`) for the duration of the meet (minimizing them is fine).
4. Verify the green **`Synced`** badge appears in the top-right header.

### Shutting Down Waves
1. Export your final CSVs from the **`Change Log`** tab.
2. Double-click **[`stop-waves.cmd`](file:///c:/Users/nlsc/Desktop/waves/stop-waves.cmd)** on the host laptop.
   - Cleanly stops the web app, sync server, nginx, and MongoDB. All data remains safely stored on disk.

---

## 5. Meet-Day Station Guide

### Header Controls (All Stations)
- **Clock Time (`HH:MM:SS`)**: Click the clock in the top-right to add/subtract hours, minutes, or seconds so the app matches the official start clock.
- **Wave Offset (`+8`)**: Click `(+8)` next to the current wave time to set how many minutes ahead of the start clock Call-up / E-punch Check is operating.
- **Auto-Advancing Waves**: Call-up and E-punch Check automatically advance to the next wave as the clock ticks forward. You can still use **`<`**, **`Next`**, **`Now`**, or the wave dropdown at any time.

### Station 1: Call-up (`Call-up`)
- Mark runners **`Present`** (blue) as they arrive, or **`No Show`** (red) if they miss their call-up wave.
- Clicking an active button again clears the selection back to waiting (no state).

### Station 2: E-punch Check (`Epunch Check`)
- Click **`Validate`** (turns green **`Validated`**) when the runner's e-punch matches the screen.
- Click **`Wrong E-punch`** (amber) if their stick does not match and send them to the Start Manager. Once Start Manager updates their stick, your screen updates to **`Validated`** automatically.

### Station 3: Start Manager (`Start Manager`)
- **Find runners**: Search by name/school/e-punch, click anyone in the 3 triage queues (**Wrong e-punch**, **Needs a new time**, **No-shows**), or click a school in **Schools & Clubs** to expand its roster inline.
- **Change Start Time**: Click **`Change start time`** on a runner's page to open the time picker. Waves automatically recommends a **Preferred Start Time** spaced at least **10 minutes apart** from teammates of the same school on the same course (dashed amber slots indicate `<10 min` spacing and can still be clicked to override).
- **Add Participant / 2nd Course**:
  - Click **`+ Add Participant`** in the top bar to register a walk-up or second-course runner.
  - Or open an existing runner and click **`Add 2nd course`** to pre-fill their name, school, and e-punch (defaulting to non-competitive on the next harder course).
- **Close Runner View**: Click the red **`Done`** button in the top-right to return to the main dashboard.

---

## 6. Quick Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **Header says `Offline (saved locally)`** | Keep working—clicks are saved locally and sync automatically once Wi-Fi reconnects. If on a phone/iPad after switching Wi-Fi networks, check if the host laptop's IP changed (`ipconfig`) and re-run the `mkcert` command in Section 1C with the new IP. |
| **Red `Records needing repair` banner in Start Manager** | Happens if two offline devices moved the same runner (or took the same open slot) before reconnecting, leaving a runner in `0` or `2+` slots. Click the runner's name in the red banner and click **`Keep this one`** on the correct slot (or choose a course to place them in **Needs a new time**). |
| **Phone/iPad says "Cannot open page" or "Not private"** | Ensure `rootCA.pem` is installed **and** toggled ON under **Settings → General → About → Certificate Trust Settings**, and use `https://<HOST-IP>:5173`. |
| **`start-waves.cmd` says Waves is already running** | Double-click `stop-waves.cmd` first, then run `start-waves.cmd` again. |
| **Run automated health checks** | Double-click [`run-tests.cmd`](file:///c:/Users/nlsc/Desktop/waves/run-tests.cmd) to run all unit tests, multi-station browser tests, and build checks. |
