import { useEffect, useRef, useState } from "react"
import { ManagerActionButton } from "./ManagerActionButton"
import { getUniqueTimesFromSlots } from "./grid/StartGrid"
import { useLiveQuery } from "@tanstack/react-db"
import { slotsTanCollection } from "@/database"

interface Properties {
    clockWave: string
    userWaveTime: string
    setUserWaveTime: (wave: string) => void
    nextWaveTime: string
    setNextWaveTime: (wave: string) => void
}

export function WaveSelection({ clockWave, userWaveTime, setUserWaveTime, nextWaveTime, setNextWaveTime }: Properties) {
    const [waveNotice, setWaveNotice] = useState('')

    useEffect(() => {
        if (waveNotice === '') {
            return
        }
        const timer = setTimeout(() => setWaveNotice(''), 3000)
        return () => clearTimeout(timer)
    }, [waveNotice])

    const { data: allSlots } = useLiveQuery((q) =>
        q.from({ slot: slotsTanCollection })
    )
    const waveTimes = getUniqueTimesFromSlots(allSlots)
    const waveKey = waveTimes.join(',')

    const prevClockWaveRef = useRef(clockWave)

    // INITIAL SELECTION & AUTO-ADVANCE WITH CLOCK
    useEffect(() => {
        if (waveTimes.length === 0) {
            return
        }
        if (userWaveTime === '') {
            prevClockWaveRef.current = clockWave
            setUserWaveTime(waveTimes.includes(clockWave) ? clockWave : waveTimes[0]!)
            return
        }
        if (prevClockWaveRef.current !== clockWave) {
            prevClockWaveRef.current = clockWave
            if (waveTimes.includes(clockWave)) {
                setWaveNotice('')
                setUserWaveTime(clockWave)
            }
        }
    }, [userWaveTime, clockWave, waveKey])

    // NEXT WAVE based on USER WAVE
    useEffect(() => {
        setNextWaveTime(getNextWave() ?? '')
    }, [userWaveTime, waveKey])

    function getNextWave(): string | undefined {
        const currentIndex = waveTimes.indexOf(userWaveTime)
        if (currentIndex === -1) {
            return
        }
        return waveTimes[currentIndex + 1]
    }

    function getPrevWave(): string | undefined {
        const currentIndex = waveTimes.indexOf(userWaveTime)
        if (currentIndex <= 0) {
            return
        }
        return waveTimes[currentIndex - 1]
    }

    function handleGoToCurrentWaveClick() {
        setWaveNotice('')
        if (waveTimes.includes(clockWave)) {
            setUserWaveTime(clockWave)
        } else {
            setUserWaveTime(waveTimes[0] ?? '')
        }
    }

    function handleNextWaveClick() {
        const next = getNextWave()
        if (next === undefined) {
            setWaveNotice("No future waves")
        } else {
            setWaveNotice('')
            setUserWaveTime(next)
        }
    }

    function handlePrevWaveClick() {
        const prev = getPrevWave()
        if (prev === undefined) {
            setWaveNotice("No previous waves")
        } else {
            setWaveNotice('')
            setUserWaveTime(prev)
        }
    }

    const userWaveFormat =
        clockWave === userWaveTime
            ? 'text-emerald-700'
            : userWaveTime > clockWave
              ? 'text-sky-700'
              : 'text-red-700'

    return (
        <div className="container mx-auto flex flex-wrap items-center gap-2 border border-slate-300 bg-slate-50 px-3 py-1.5 text-slate-900">
            <ManagerActionButton
                text=""
                icon="left"
                color="mauve"
                action={handlePrevWaveClick}
                buttonStyle="outline"
            />
            <div className="flex flex-row gap-2">
                <ManagerActionButton
                    text={nextWaveTime === '' ? 'Next' : `Next (${nextWaveTime})`}
                    icon="right"
                    color="sky"
                    action={handleNextWaveClick}
                    buttonStyle={clockWave !== '' && clockWave === nextWaveTime ? "solid" : "outline"}
                />
                <ManagerActionButton
                    text={clockWave === '' ? 'Now' : `Now (${clockWave})`}
                    icon="signal"
                    color="emerald"
                    action={handleGoToCurrentWaveClick}
                    buttonStyle={clockWave !== userWaveTime ? "solid" : "outline"}
                />
            </div>
            <label className="ml-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <span>Selected Wave:</span>
                <select
                    aria-label="Select wave time"
                    value={userWaveTime}
                    onChange={(e) => {
                        setWaveNotice('')
                        setUserWaveTime(e.target.value)
                    }}
                    className={`cursor-pointer rounded-none border border-slate-300 bg-white px-2.5 py-1 text-lg font-bold tabular-nums focus:border-slate-900 focus:outline-none ${userWaveFormat}`}>
                    {waveTimes.map((wt) => (
                        <option key={wt} value={wt} className="bg-white text-base text-slate-900">
                            {wt}{wt === clockWave ? ' (Now)' : ''}
                        </option>
                    ))}
                </select>
            </label>
            {waveNotice !== '' && (
                <div
                    role="status"
                    className="flex items-center gap-2 border border-amber-600 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-950">
                    <span>{waveNotice}</span>
                    <button
                        type="button"
                        onClick={() => setWaveNotice('')}
                        aria-label="Dismiss notice"
                        className="px-1 text-amber-800 hover:bg-amber-100 hover:text-amber-950">
                        ×
                    </button>
                </div>
            )}
        </div>
    )
}
