import {
    dropAllChanges,
    dropAllParticipants,
    dropAllSlots,
    EVENT_ID,
    getSyncStatus,
    isStaleEvent,
    onStaleEvent,
    onSyncStatusChange,
    slotsTanCollection,
    type SyncStatus,
} from "@/database"
import { useLiveQuery } from "@tanstack/react-db"
import { useState, useEffect } from "react"
import { getUniqueTimesFromSlots } from "./grid/StartGrid"
import { Modal } from "./Modal"
import { WaveOffsetEditor } from "./WaveOffsetEditor"
import { ClockOffsetEditor } from "./ClockOffsetEditor"
import { ensureStartListLoaded, readStartListCsv } from "@/dataImport"
import { FullGrid } from "@/pages/FullGrid"
import { Manager } from "@/pages/Manager"
import { CallUp } from "@/pages/Callup"
import { EpunchVerify } from "@/pages/EpunchVerify"
import { Download } from "@/pages/Download"
import { Changes } from "@/pages/Changes"
import { SvgIcon } from "./SvgIcon"
import { SvgIconWithText } from "./SvgIconWithText"

const STORAGE_PAGE_KEY = 'waves.appPage'
const STORAGE_CLOCK_OFFSET_KEY = `waves.clockOffset.${EVENT_ID}`
const STORAGE_WAVE_OFFSET_KEY = `waves.waveOffset.${EVENT_ID}`
const STORAGE_VOLUNTEER_UNLOCKED_KEY = 'waves.volunteerUnlocked'
const VOLUNTEER_PIN = '9465'

function readSavedVolunteerUnlocked(): boolean {
    try {
        return localStorage.getItem(STORAGE_VOLUNTEER_UNLOCKED_KEY) === 'true'
    } catch {
        return false
    }
}

function readSavedClockOffset(): { hours: number, minutes: number, seconds: number } {
    try {
        const raw = localStorage.getItem(STORAGE_CLOCK_OFFSET_KEY)
        if (!raw) return { hours: 0, minutes: 0, seconds: 0 }
        const parsed = JSON.parse(raw)
        return {
            hours: Number.isFinite(parsed?.hours) ? parsed.hours : 0,
            minutes: Number.isFinite(parsed?.minutes) ? parsed.minutes : 0,
            seconds: Number.isFinite(parsed?.seconds) ? parsed.seconds : 0,
        }
    } catch {
        return { hours: 0, minutes: 0, seconds: 0 }
    }
}

function readSavedWaveOffset(): number {
    try {
        const raw = localStorage.getItem(STORAGE_WAVE_OFFSET_KEY)
        if (raw === null) return 8
        const num = Number(raw)
        return Number.isFinite(num) && num >= 0 ? num : 8
    } catch {
        return 8
    }
}

function readSavedPage(): string {
    try {
        return localStorage.getItem(STORAGE_PAGE_KEY) ?? 'grid'
    } catch {
        return 'grid'
    }
}

function parseHHMMToMinutes(hhmm: string): number | undefined {
    const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
    if (!match) return undefined
    return Number(match[1]) * 60 + Number(match[2])
}

function HeaderClock({
    clockOffsetHours,
    clockOffsetMinutes,
    clockOffsetSeconds,
    onClick,
}: {
    clockOffsetHours: number
    clockOffsetMinutes: number
    clockOffsetSeconds: number
    onClick: () => void
}) {
    const [clockTime, setClockTime] = useState("")

    useEffect(() => {
        function updateClock() {
            const nowEpoch = Date.now()
            const nowEpochOffset =
                nowEpoch +
                clockOffsetSeconds * 1000 +
                clockOffsetMinutes * 60 * 1000 +
                clockOffsetHours * 60 * 60 * 1000
            const nowDate = new Date(nowEpochOffset)
            const hour = nowDate.getHours().toString().padStart(2, "0")
            const minute = nowDate.getMinutes().toString().padStart(2, "0")
            const second = nowDate.getSeconds().toString().padStart(2, "0")
            setClockTime(`${hour}:${minute}:${second}`)
        }
        updateClock()
        const timer = setInterval(updateClock, 1000)
        return () => clearInterval(timer)
    }, [clockOffsetHours, clockOffsetMinutes, clockOffsetSeconds])

    return (
        <span className="cursor-pointer border border-slate-300 bg-slate-50 px-2.5 py-1 text-sm font-bold tabular-nums text-slate-900 hover:bg-slate-100" onClick={onClick}>
            {clockTime}
        </span>
    )
}

function ClockOffsetModalWrapper({
    close,
    clockOffsetHours,
    clockOffsetMinutes,
    clockOffsetSeconds,
    handleHoursPlus,
    handleHoursMinus,
    handleMinutesPlus,
    handleMinutesMinus,
    handleSecondsPlus,
    handleSecondsMinus,
}: {
    close: () => void
    clockOffsetHours: number
    clockOffsetMinutes: number
    clockOffsetSeconds: number
    handleHoursPlus: () => void
    handleHoursMinus: () => void
    handleMinutesPlus: () => void
    handleMinutesMinus: () => void
    handleSecondsPlus: () => void
    handleSecondsMinus: () => void
}) {
    const [clockTime, setClockTime] = useState("")

    useEffect(() => {
        function update() {
            const nowEpoch = Date.now()
            const nowEpochOffset =
                nowEpoch +
                clockOffsetSeconds * 1000 +
                clockOffsetMinutes * 60 * 1000 +
                clockOffsetHours * 60 * 60 * 1000
            const nowDate = new Date(nowEpochOffset)
            const hour = nowDate.getHours().toString().padStart(2, "0")
            const minute = nowDate.getMinutes().toString().padStart(2, "0")
            const second = nowDate.getSeconds().toString().padStart(2, "0")
            setClockTime(`${hour}:${minute}:${second}`)
        }
        update()
        const timer = setInterval(update, 1000)
        return () => clearInterval(timer)
    }, [clockOffsetHours, clockOffsetMinutes, clockOffsetSeconds])

    return (
        <Modal
            close={close}
            title="Clock Time"
            content={
                <ClockOffsetEditor
                    clockTime={clockTime}
                    clockOffsetHours={clockOffsetHours}
                    clockOffsetMinutes={clockOffsetMinutes}
                    clockOffsetSeconds={clockOffsetSeconds}
                    handleHoursPlus={handleHoursPlus}
                    handleHoursMinus={handleHoursMinus}
                    handleMinutesPlus={handleMinutesPlus}
                    handleMinutesMinus={handleMinutesMinus}
                    handleSecondsPlus={handleSecondsPlus}
                    handleSecondsMinus={handleSecondsMinus}
                />
            }
        />
    )
}

const STATIONS = [
    { id: 'call-up', label: 'Call-up' },
    { id: 'epunch', label: 'Epunch Check' },
    { id: 'manager', label: 'Start Manager' },
    { id: 'grid', label: 'Full Grid' },
    { id: 'download', label: 'Download' },
    { id: 'changes', label: 'Change Log' },
] as const

export function HeaderWithWaveTime() {
    const initialClockOffset = readSavedClockOffset()
    const [clockOffsetHours, setClockOffsetHours] = useState(initialClockOffset.hours)
    const [clockOffsetMinutes, setClockOffsetMinutes] = useState(initialClockOffset.minutes)
    const [clockOffsetSeconds, setClockOffsetSeconds] = useState(initialClockOffset.seconds)
    const [currentMinuteTime, setCurrentMinuteTime] = useState(() => {
        const nowDate = new Date(
            Date.now() +
                initialClockOffset.seconds * 1000 +
                initialClockOffset.minutes * 60 * 1000 +
                initialClockOffset.hours * 60 * 60 * 1000
        )
        return `${nowDate.getHours().toString().padStart(2, "0")}:${nowDate.getMinutes().toString().padStart(2, "0")}`
    })
    const [waveOffsetMinutes, setWaveOffsetMinutes] = useState(readSavedWaveOffset)
    const [managerSelectedId, setManagerSelectedId] = useState('')
    const [isWaveOffsetModalOpen, setWaveOffsetModalOpen] = useState(false)
    const [isClockOffsetModalOpen, setClockOffsetModalOpen] = useState(false)
    const [staleEvent, setStaleEvent] = useState(() => isStaleEvent())
    const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => getSyncStatus())
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isUnlocked, setIsUnlocked] = useState(readSavedVolunteerUnlocked)
    const [isPinModalOpen, setIsPinModalOpen] = useState(false)
    const [isLockConfirmOpen, setIsLockConfirmOpen] = useState(false)
    const [pinInput, setPinInput] = useState('')
    const [pinError, setPinError] = useState('')

    const [appPage, setAppPage] = useState(readSavedPage)

    const { data: allSlots } = useLiveQuery((q) =>
        q.from({ slot: slotsTanCollection })
    )

    const waveTimes = getUniqueTimesFromSlots(allSlots)

    // Auto-import startlist.csv once the first sync with the server finishes and the event is still empty.
    useEffect(() => {
        void ensureStartListLoaded()
    }, [])

    // Listen for a new event replacing the one this tab opened with.
    useEffect(() => {
        return onStaleEvent(() => setStaleEvent(true))
    }, [])

    // Listen for replication connection changes.
    useEffect(() => {
        return onSyncStatusChange(setSyncStatus)
    }, [])

    // Persist station page and clock/wave offsets across accidental page refreshes.
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_PAGE_KEY, appPage)
        } catch { /* ignore */ }
    }, [appPage])

    useEffect(() => {
        try {
            localStorage.setItem(
                STORAGE_CLOCK_OFFSET_KEY,
                JSON.stringify({ hours: clockOffsetHours, minutes: clockOffsetMinutes, seconds: clockOffsetSeconds })
            )
        } catch { /* ignore */ }
    }, [clockOffsetHours, clockOffsetMinutes, clockOffsetSeconds])

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_WAVE_OFFSET_KEY, String(waveOffsetMinutes))
        } catch { /* ignore */ }
    }, [waveOffsetMinutes])

    // E-punch Check runs 2 minutes after Call-up (e.g., +6 min vs +8 min ahead of clock time)
    const activeWaveOffsetMinutes = isUnlocked && appPage === 'epunch' ? Math.max(0, waveOffsetMinutes - 2) : waveOffsetMinutes

    function openPinModal() {
        setPinInput('')
        setPinError('')
        setIsPinModalOpen(true)
    }

    function handlePinSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (pinInput.trim() === VOLUNTEER_PIN) {
            setIsUnlocked(true)
            setIsPinModalOpen(false)
            setPinInput('')
            setPinError('')
            try {
                localStorage.setItem(STORAGE_VOLUNTEER_UNLOCKED_KEY, 'true')
            } catch { /* ignore */ }
        } else {
            setPinError('Incorrect PIN. Please try again.')
        }
    }

    function handleLockClick() {
        setIsMobileMenuOpen(false)
        setIsLockConfirmOpen(true)
    }

    function confirmLock() {
        setIsLockConfirmOpen(false)
        setIsUnlocked(false)
        setIsMobileMenuOpen(false)
        setManagerSelectedId('')
        try {
            localStorage.removeItem(STORAGE_VOLUNTEER_UNLOCKED_KEY)
        } catch { /* ignore */ }
    }

    // CLOCK BASED CURRENT MINUTE
    useEffect(() => {
        function updateMinute() {
            const nowEpoch = Date.now()
            const nowEpochOffset =
                nowEpoch +
                clockOffsetSeconds * 1000 +
                clockOffsetMinutes * 60 * 1000 +
                clockOffsetHours * 60 * 60 * 1000
            const nowDate = new Date(nowEpochOffset)
            const hour = nowDate.getHours().toString().padStart(2, "0")
            const minute = nowDate.getMinutes().toString().padStart(2, "0")
            const minuteStr = `${hour}:${minute}`

            setCurrentMinuteTime((prev) => (prev === minuteStr ? prev : minuteStr))
        }

        updateMinute()
        const timer = setInterval(updateMinute, 1000)
        return () => clearInterval(timer)
    }, [clockOffsetHours, clockOffsetMinutes, clockOffsetSeconds])

    const clockWaveTime = (() => {
        const nowMinutes = parseHHMMToMinutes(currentMinuteTime)
        if (nowMinutes === undefined) return ""
        const targetMinutes = (nowMinutes + activeWaveOffsetMinutes) % 1440
        const lookbackMinutes = Math.max(activeWaveOffsetMinutes + 1, 2)

        let matched = ""
        for (const wt of waveTimes) {
            const wm = parseHHMMToMinutes(wt)
            if (wm === undefined) continue
            if (wm <= targetMinutes && targetMinutes - wm <= lookbackMinutes) {
                matched = wt
            }
        }
        return matched
    })()

    function displayWaveTime() {
        if (clockWaveTime !== '') {
            return <span>{clockWaveTime}</span>
        } else {
            return <span className="italic text-slate-500">No Wave</span>
        }
    }

    function handleOffsetEditClick() {
        if (!isUnlocked) {
            openPinModal()
            return
        }
        setWaveOffsetModalOpen((prev) => !prev)
    }

    const waveOffsetModal = isWaveOffsetModalOpen && isUnlocked ? (
        <Modal
            close={() => { handleOffsetEditClick() }}
            title="Wave Offset"
            content={
                <WaveOffsetEditor
                    waveOffsetMinutes={activeWaveOffsetMinutes}
                    handleWaveOffsetPlus={() => setWaveOffsetMinutes((prev) => prev + 1)}
                    handleWaveOffsetMinus={() => setWaveOffsetMinutes((prev) => (prev > 0 ? prev - 1 : 0))}
                />
            }
        />
    ) : null

    function handleClockEditClick() {
        if (!isUnlocked) {
            openPinModal()
            return
        }
        setClockOffsetModalOpen((prev) => !prev)
    }

    const clockOffsetModal = isClockOffsetModalOpen && isUnlocked ? (
        <ClockOffsetModalWrapper
            close={() => setClockOffsetModalOpen(false)}
            clockOffsetHours={clockOffsetHours}
            clockOffsetMinutes={clockOffsetMinutes}
            clockOffsetSeconds={clockOffsetSeconds}
            handleHoursPlus={() => setClockOffsetHours((prev) => prev + 1)}
            handleHoursMinus={() => setClockOffsetHours((prev) => prev - 1)}
            handleMinutesPlus={() => setClockOffsetMinutes((prev) => prev + 1)}
            handleMinutesMinus={() => setClockOffsetMinutes((prev) => prev - 1)}
            handleSecondsPlus={() => setClockOffsetSeconds((prev) => prev + 1)}
            handleSecondsMinus={() => setClockOffsetSeconds((prev) => prev - 1)}
        />
    ) : null

    const pinModal = isPinModalOpen ? (
        <Modal
            close={() => setIsPinModalOpen(false)}
            title="Volunteer Login"
            content={
                <form onSubmit={handlePinSubmit} className="flex flex-col gap-3 text-slate-900">
                    <p className="text-sm text-slate-700">
                        Enter the 4-digit volunteer PIN to unlock station views and editing.
                    </p>
                    <div>
                        <label htmlFor="volunteer-pin-input" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
                            Volunteer PIN
                        </label>
                        <input
                            id="volunteer-pin-input"
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            autoFocus
                            value={pinInput}
                            onChange={(e) => {
                                setPinInput(e.target.value)
                                if (pinError) setPinError('')
                            }}
                            placeholder="••••"
                            className="w-full border border-slate-400 bg-white px-3 py-2 text-lg font-bold tracking-widest text-slate-900 focus:border-slate-900 focus:outline-none"
                        />
                        {pinError !== '' && (
                            <p role="alert" className="mt-1.5 text-xs font-semibold text-red-700">
                                {pinError}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setIsPinModalOpen(false)}
                            className="border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="border border-slate-900 bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-800">
                            Unlock
                        </button>
                    </div>
                </form>
            }
        />
    ) : null

    const lockConfirmModal = isLockConfirmOpen ? (
        <Modal
            close={() => setIsLockConfirmOpen(false)}
            title="Lock Volunteer Mode"
            content={
                <div className="flex flex-col gap-4 text-slate-900">
                    <p className="text-sm text-slate-700">
                        Are you sure you want to lock editing and return this device to View-Only mode?
                    </p>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setIsLockConfirmOpen(false)}
                            className="border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={confirmLock}
                            className="border border-slate-900 bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-800">
                            Lock
                        </button>
                    </div>
                </div>
            }
        />
    ) : null

    const isOrganizer = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('organizer')

    async function handleOrganizerReimportClick() {
        if (!window.confirm('Reset this event and re-import startlist.csv? This clears all check-in progress and changes for every connected laptop.')) {
            return
        }
        await Promise.all([
            dropAllSlots(),
            dropAllParticipants(),
            dropAllChanges(),
        ])
        console.log('rxdb: cleared collections; re-importing startlist.csv')
        await readStartListCsv()
    }

    function handleNavPageClick(page: string) {
        setManagerSelectedId('')
        setAppPage(page)
    }

    function pageContent() {
        if (!isUnlocked) {
            return (
                <FullGrid
                    clockTime={currentMinuteTime}
                    waveOffsetMinutes={waveOffsetMinutes}
                    readOnly={true}
                    onRequestUnlock={openPinModal}
                />
            )
        }
        switch (appPage) {
            case 'grid':
                return (
                    <FullGrid
                        clockTime={currentMinuteTime}
                        waveOffsetMinutes={waveOffsetMinutes}
                        onOpenInManager={(pid) => {
                            setManagerSelectedId(pid)
                            setAppPage('manager')
                        }}
                    />
                )
            case 'manager':
                return (
                    <Manager
                        clockTime={currentMinuteTime}
                        waveOffsetMinutes={waveOffsetMinutes}
                        selectedParticipantId={managerSelectedId}
                        setSelectedParticipantId={setManagerSelectedId}
                    />
                )
            case 'call-up':
                return <CallUp clockWave={clockWaveTime} />
            case 'epunch':
                return <EpunchVerify clockWave={clockWaveTime} />
            case 'download':
                return <Download />
            case 'changes':
                return <Changes />
            default:
                return (
                    <FullGrid
                        clockTime={currentMinuteTime}
                        waveOffsetMinutes={waveOffsetMinutes}
                        onOpenInManager={(pid) => {
                            setManagerSelectedId(pid)
                            setAppPage('manager')
                        }}
                    />
                )
        }
    }

    function pageName() {
        if (!isUnlocked) {
            return "Full Grid"
        }
        switch (appPage) {
            case 'grid':
                return "Full Grid"
            case 'manager':
                return "Start Manager"
            case 'call-up':
                return "Call Up"
            case 'epunch':
                return "Epunch Check"
            case 'download':
                return "Download"
            case 'change':
            case 'changes':
                return "Change Log"
            default:
                return ""
        }
    }

    const syncBadge = syncStatus === 'synced' ? (
        <span
            title="Synced with the Waves server"
            className="flex items-center gap-1.5 border border-emerald-600 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
            <span className="h-2 w-2 bg-emerald-600" />
            Synced
        </span>
    ) : syncStatus === 'offline' ? (
        <span
            title="Cannot reach the Waves sync server. Changes are saved on this laptop and will sync when reconnected."
            className="flex items-center gap-1.5 border border-amber-600 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
            <span className="h-2 w-2 bg-amber-600" />
            Offline (saved locally)
        </span>
    ) : (
        <span
            title="Connecting to the Waves sync server..."
            className="flex items-center gap-1.5 border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            <span className="h-2 w-2 bg-sky-600" />
            Syncing…
        </span>
    )

    if (staleEvent) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white p-6 text-slate-900">
                <div className="flex max-w-md flex-col gap-4 border-2 border-amber-600 bg-amber-50 p-6 text-slate-900 shadow-lg">
                    <h1 className="text-2xl font-bold text-slate-900">New event loaded</h1>
                    <p>
                        This tab is still open from a previous event. Reload the page to switch to the current event's start list.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="self-start border border-amber-700 bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700">
                        Reload for new event
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col bg-white text-slate-900">
            <header className="body-font sticky top-0 z-30 w-full border-b border-slate-300 bg-white text-slate-800">
                {waveOffsetModal}
                {clockOffsetModal}
                {pinModal}
                {lockConfirmModal}

                <div className="container mx-auto flex items-center justify-between px-3 py-1.5 md:px-4">
                    {/* Brand + Active Page (on sm+) */}
                    <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-900">
                            <SvgIconWithText icon="waves-logo" text="Waves" />
                        </div>
                        <div className="hidden sm:flex items-center gap-2 pl-2 text-base md:text-lg">
                            <span className="font-semibold text-slate-700">{pageName()}</span>
                        </div>
                    </div>

                    {/* Wave Time & Offset Pill */}
                    <div className="flex items-center gap-1.5 text-sm sm:text-base">
                        <span className="font-black tabular-nums text-slate-900">{displayWaveTime()}</span>
                        <button
                            type="button"
                            className="border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            onClick={handleOffsetEditClick}
                            title="Adjust wave offset">
                            (+{activeWaveOffsetMinutes})
                        </button>
                    </div>

                    {/* Desktop Navigation + Sync + Clock */}
                    <div className="hidden md:flex items-center gap-2">
                        {isUnlocked ? (
                            <nav className="flex items-center border border-slate-300 bg-slate-100 p-0.5">
                                {STATIONS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => handleNavPageClick(tab.id)}
                                        className={`px-3 py-1 text-xs font-semibold transition ${
                                            appPage === tab.id
                                                ? 'bg-slate-900 text-white'
                                                : 'text-slate-700 hover:bg-white hover:text-slate-900'
                                        }`}>
                                        {tab.label}
                                    </button>
                                ))}
                                {isOrganizer && (
                                    <button
                                        type="button"
                                        onClick={() => void handleOrganizerReimportClick()}
                                        className="border-l border-slate-300 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50">
                                        Re-import start list
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleLockClick}
                                    title="Return to View-Only mode"
                                    className="border-l border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-white hover:text-slate-900">
                                    Lock
                                </button>
                            </nav>
                        ) : (
                            <button
                                type="button"
                                onClick={openPinModal}
                                className="border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800">
                                Volunteer Login
                            </button>
                        )}
                        {syncBadge}
                        <HeaderClock
                            clockOffsetHours={clockOffsetHours}
                            clockOffsetMinutes={clockOffsetMinutes}
                            clockOffsetSeconds={clockOffsetSeconds}
                            onClick={handleClockEditClick}
                        />
                    </div>

                    {/* Mobile Navigation Controls (Clock + Menu Toggle) */}
                    <div className="flex items-center gap-1.5 md:hidden">
                        <HeaderClock
                            clockOffsetHours={clockOffsetHours}
                            clockOffsetMinutes={clockOffsetMinutes}
                            clockOffsetSeconds={clockOffsetSeconds}
                            onClick={handleClockEditClick}
                        />
                        {isUnlocked ? (
                            <button
                                type="button"
                                onClick={() => setIsMobileMenuOpen((open) => !open)}
                                aria-label="Toggle navigation menu"
                                className="border border-slate-300 bg-slate-100 p-1.5 text-slate-800 hover:bg-slate-200">
                                <SvgIcon icon={isMobileMenuOpen ? "x" : "hamburger"} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={openPinModal}
                                className="border border-slate-900 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800">
                                Volunteer Login
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Drawer Dropdown */}
                {isUnlocked && isMobileMenuOpen && (
                    <div className="border-t border-slate-200 bg-white shadow-lg md:hidden">
                        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                Stations
                            </span>
                            {syncBadge}
                        </div>
                        <nav className="flex flex-col divide-y divide-slate-100">
                            {STATIONS.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => {
                                        handleNavPageClick(tab.id)
                                        setIsMobileMenuOpen(false)
                                    }}
                                    className={`flex items-center justify-between px-4 py-3 text-left text-sm font-semibold transition ${
                                        appPage === tab.id
                                            ? 'bg-slate-900 text-white'
                                            : 'bg-white text-slate-800 hover:bg-slate-50'
                                    }`}>
                                    <span>{tab.label}</span>
                                    {appPage === tab.id && (
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                                            Active
                                        </span>
                                    )}
                                </button>
                            ))}
                            {isOrganizer && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMobileMenuOpen(false)
                                        void handleOrganizerReimportClick()
                                    }}
                                    className="border-t border-slate-200 px-4 py-3 text-left text-sm font-semibold text-amber-800 hover:bg-amber-50">
                                    Re-import start list
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleLockClick}
                                className="border-t border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50">
                                Lock (return to View-Only mode)
                            </button>
                        </nav>
                    </div>
                )}
            </header>

            <main className="w-full flex-1 px-2 pt-2 md:px-4">
                {pageContent()}
            </main>
        </div>
    )
}
