# Waves Architecture

Waves manages interval starts for orienteering meets across multiple phones, tablets, and laptops on a local Wi-Fi network without internet access.

---

## 1. System Overview

Waves uses a **local-first** architecture. Every connected browser keeps a complete copy of the meet database in IndexedDB (via RxDB + Dexie) so the UI responds instantly and continues working if Wi-Fi drops. A central sync server on the host laptop replicates changes between all connected devices and persists them to MongoDB.

```mermaid
flowchart LR
  subgraph Client Devices (Phones / Tablets / Laptops)
    UI[React 19 + Tailwind UI]
    TDB[TanStack DB Live Queries]
    RX[RxDB Client<br/>IndexedDB / Dexie]
    UI <--> TDB <--> RX
  end

  subgraph Host Laptop
    NGX[nginx<br/>:80 Web / :5443 Sync]
    VITE[Vite App Server :5173]
    RXS[rxdb-server<br/>Express :3000]
    MONGO[(MongoDB :27017<br/>Replica Set rs0)]
    NGX -->|:80| VITE
    NGX -->|:5443| RXS <--> MONGO
  end

  UI -. "HTTP :80" .-> NGX
  RX <-->|"Live Replication (:5443)"| NGX
```

### Core Components

| Component | Path | Purpose |
|---|---|---|
| **Web App** | `waves-app/` | React 19 + TypeScript + Tailwind 4 single-page app. |
| **Client Database** | `waves-app/src/database.ts` | RxDB (Dexie/IndexedDB) wrapped in TanStack DB collections for reactive UI queries. Uses pure-JS SHA-256 and UUID helpers (`cryptoHelpers.ts`) so it runs over plain HTTP on any LAN IP or domain. |
| **Sync Server** | `waves-server/server.ts` | Express `rxdb-server` on port `3000` syncing `slots`, `participants`, and `changes` with MongoDB (`wavesmongodb_<eventId>`). |
| **Reverse Proxy** | `waves-server/nginx.conf` | Listens on plain HTTP port `80` (web app) and port `5443` (RxDB replication stream) with `server_name _;`, allowing access via `localhost`, LAN IP, or local router DNS (`http://waves.cascadeoc.org`). |
| **Meet Scripts** | `make-start-list.cmd`, `start-waves.cmd`, `stop-waves.cmd` | Convert the meet Excel workbook (`data/input/*.xlsm`) into `startlist.csv` + `event.json`, launch/stop all services, and compute headcount on course (`count_people_on_course.py`). |

---

## 2. Data Model

Each event uses an isolated database namespace keyed by `eventId` (from `waves-app/public/event.json`). There are three RxDB collections:

| Collection | Key Fields | Description |
|---|---|---|
| `slots` | `id`, `course`, `time`, `participants[]`, `isUsable` | Represents a `(course, time)` cell (`c1`–`c9`, `HH:MM`), plus two special holding slots per course: `_needsAssignment` (Standby) and `_notAttending`. |
| `participants` | `id`, `name`, `club`, `epunch`, `isRental`, `isNonCompete`, `groupSize`, `state`, `prevState`, `originalStartTime`, `startChanged` | One starter or group entry. Every participant belongs to **exactly one** slot at all times. |
| `changes` | `id`, `participantId`, `changedAt`, `changeType`, `old`, `new`, `needsProcessing`, `isProcessed` | Append-only audit log of all edits. Changes that affect timing software (`epunch`, `courseChange`, `addParticipant`, `competitiveStatus`) set `needsProcessing: true` and appear in the **Download** queue. |

### Participant States
- **`waiting`**: Scheduled in a start slot, not yet checked in.
- **`present`**: Checked in at **Call-up**.
- **`validated`**: E-punch verified at **E-punch Check**.
- **`wrongEpunch`** / **`noShow`**: Exception states (encoded in `state` and `prevState` so a runner can be flagged for both simultaneously and resolved independently).
- **`needsAssignment`**: In the **Standby** queue (`_needsAssignment` slot) awaiting an open start time.
- **`notAttending`**: Withdrawn from the meet (`_notAttending` slot); original start slot is freed.

---

## 3. Station Views & Access Control

- **View-Only Default & Volunteer PIN (`9465`)**: New browser sessions open on the read-only **Full Grid** so spectators, runners, and coaches can view live start times. Entering the 4-digit volunteer PIN (`9465` / `WIOL`) unlocks all station tabs and editing controls (persisted in `localStorage`).
- **Call-up (`Callup.tsx`)**: Displays Current and Next waves (`+8` min ahead of clock time by default) to mark runners **Present** or **No Show**.
- **E-punch Check (`EpunchVerify.tsx`)**: Runs 2 minutes behind Call-up (`+6` min ahead of clock time by default) to mark runners **Validated** or **Wrong E-punch**.
- **Start Manager (`Manager.tsx`)**: Exception handling—search by runner/school/e-punch, triage **Wrong e-punch** / **Standby** / **No-shows**, reassign start times (with automatic 10-minute same-school spacing recommendations), edit e-punches or group sizes, and add walk-up or 2nd-course runners.
- **Download (`Download.tsx`)**: Finish-tent queue showing only changes that must be entered into the timing computer, with one-click **Clear** tracking.
- **Full Grid (`FullGrid.tsx`) & Change Log (`Changes.tsx`)**: Full meet overview, chronological audit log, and CSV exports (`Export Changes CSV`, `Export Full Roster CSV`).
