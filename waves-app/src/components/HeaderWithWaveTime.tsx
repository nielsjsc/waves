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
import { Changes } from "@/pages/Changes"
import { SvgIconWithText } from "./SvgIconWithText"

const STORAGE_PAGE_KEY = 'waves.appPage'
const STORAGE_CLOCK_OFFSET_KEY = `waves.clockOffset.${EVENT_ID}`
const STORAGE_WAVE_OFFSET_KEY = `waves.waveOffset.${EVENT_ID}`

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

export function HeaderWithWaveTime() {
    const initialClockOffset = readSavedClockOffset()
    const [clockOffsetHours, setClockOffsetHours] = useState(initialClockOffset.hours)
    const [clockOffsetMinutes, setClockOffsetMinutes] = useState(initialClockOffset.minutes)
    const [clockOffsetSeconds, setClockOffsetSeconds] = useState(initialClockOffset.seconds)
    const [currentMinuteTime, setCurrentMinuteTime] = useState('')
    const [waveOffsetMinutes, setWaveOffsetMinutes] = useState(readSavedWaveOffset)
    const [clockWaveTime, setClockWaveTime] = useState('')
    const [managerSelectedId, setManagerSelectedId] = useState('')
    const [isWaveOffsetModalOpen, setWaveOffsetModalOpen] = useState(false)
    const [isClockOffsetModalOpen, setClockOffsetModalOpen] = useState(false)
    const [staleEvent, setStaleEvent] = useState(() => isStaleEvent())
    const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => getSyncStatus())

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

    // CLOCK BASED CURRENT WAVE TIME & MINUTE
    useEffect(() => {
        function updateWaveAndMinute() {
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

            const waveDate = new Date(nowEpochOffset + waveOffsetMinutes * 60 * 1000)
            const targetMinutes = waveDate.getHours() * 60 + waveDate.getMinutes()
            const lookbackMinutes = Math.max(waveOffsetMinutes + 1, 2)

            let matched = ""
            for (const wt of waveTimes) {
                const wm = parseHHMMToMinutes(wt)
                if (wm === undefined) continue
                if (wm <= targetMinutes && targetMinutes - wm <= lookbackMinutes) {
                    matched = wt
                }
            }
            setClockWaveTime((prev) => (prev === matched ? prev : matched))
        }

        updateWaveAndMinute()
        const timer = setInterval(updateWaveAndMinute, 1000)
        return () => clearInterval(timer)
    }, [waveTimes, waveOffsetMinutes, clockOffsetHours, clockOffsetMinutes, clockOffsetSeconds])

    function displayWaveTime() {
        if (clockWaveTime !== '') {
            return <span>{clockWaveTime}</span>
        } else {
            return <span className="italic text-slate-500">No Wave</span>
        }
    }

    function handleOffsetEditClick() {
        setWaveOffsetModalOpen((prev) => !prev)
    }

    const waveOffsetModal = isWaveOffsetModalOpen ? (
        <Modal
            close={() => { handleOffsetEditClick() }}
            title="Wave Offset"
            content={
                <WaveOffsetEditor
                    waveOffsetMinutes={waveOffsetMinutes}
                    handleWaveOffsetPlus={() => setWaveOffsetMinutes((prev) => prev + 1)}
                    handleWaveOffsetMinus={() => setWaveOffsetMinutes((prev) => (prev > 0 ? prev - 1 : 0))}
                />
            }
        />
    ) : null

    function handleClockEditClick() {
        setClockOffsetModalOpen((prev) => !prev)
    }

    const clockOffsetModal = isClockOffsetModalOpen ? (
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
        setAppPage(page)
    }

    function pageContent() {
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
        switch (appPage) {
            case 'grid':
                return "Full Grid"
            case 'manager':
                return "Start Manager"
            case 'call-up':
                return "Call Up"
            case 'epunch':
                return "Epunch Check"
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
        <div className="bg-white text-slate-900">
            <header className="body-font fixed z-30 min-w-full max-w-full border-b border-slate-300 bg-white text-slate-800">
                {waveOffsetModal}
                {clockOffsetModal}

                <div className="container mx-auto flex flex-row flex-wrap items-center px-4 py-1.5">
                    <div className="font-bold text-slate-900">
                        <SvgIconWithText icon="waves-logo" text="Waves" />
                    </div>
                    <div className="title-font flex flex-row items-center gap-2 px-3 text-lg">
                        <span className="font-semibold text-slate-700">{pageName()}</span>
                        <span className="font-black tabular-nums text-slate-900">{displayWaveTime()}</span>
                        <span
                            className="cursor-pointer border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            onClick={handleOffsetEditClick}>
                            (+{waveOffsetMinutes})
                        </span>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <nav className="flex flex-wrap items-center border border-slate-300 bg-slate-100 p-0.5">
                            {[
                                { id: 'call-up', label: 'Call-up' },
                                { id: 'epunch', label: 'Epunch Check' },
                                { id: 'manager', label: 'Start Manager' },
                                { id: 'grid', label: 'Full Grid' },
                                { id: 'changes', label: 'Change Log' },
                            ].map((tab) => (
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
                        </nav>
                        {syncBadge}
                        <HeaderClock
                            clockOffsetHours={clockOffsetHours}
                            clockOffsetMinutes={clockOffsetMinutes}
                            clockOffsetSeconds={clockOffsetSeconds}
                            onClick={handleClockEditClick}
                        />
                    </div>
                </div>
            </header>

            <div className="relative mx-auto min-w-full max-w-full md:px-4">
                <div className="absolute inset-x-0 top-12 md:px-4">
                    {pageContent()}
                </div>
            </div>
        </div>
    )
}
