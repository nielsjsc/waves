import { StartGrid } from "@/components/grid/StartGrid"
import { participantsTanCollection, slotsTanCollection } from "@/database"
import { populateSlotData } from "@/utils/populateSlotData"
import { useLiveQuery } from "@tanstack/react-db"
import { WaveSelection } from "@/components/WaveSelection"
import { useState } from "react"
import { Head } from "@/components/Head"

interface Properties {
    clockWave: string
}

export function EpunchVerify({ clockWave }: Properties) {
    const [userWaveTime, setUserWaveTime] = useState('')
    const [nextWaveTime, setNextWaveTime] = useState('')
    const [mobileStationTab, setMobileStationTab] = useState<'current' | 'next'>('current')

    const { data: allParticipants } = useLiveQuery((q) =>
        q.from({ participant: participantsTanCollection })
    )
    const { data: allSlots } = useLiveQuery((q) =>
        q.from({ slot: slotsTanCollection })
    )

    const slotsThisWaveAndNext = populateSlotData(
        allSlots.filter((x) => x.time === userWaveTime || x.time === nextWaveTime),
        allParticipants
    )

    return (
        <div className="flex flex-col gap-1">
            <Head title="Tent 1: E-punch check" />
            <WaveSelection
                clockWave={clockWave}
                userWaveTime={userWaveTime}
                setUserWaveTime={(w) => {
                    setUserWaveTime(w)
                    setMobileStationTab('current')
                }}
                nextWaveTime={nextWaveTime}
                setNextWaveTime={setNextWaveTime}
            />

            {/* Mobile Wave Toggle (Current Wave vs Next Wave) */}
            <div className="flex border border-slate-300 bg-slate-100 p-0.5 md:hidden">
                <button
                    type="button"
                    onClick={() => setMobileStationTab('current')}
                    className={`flex-1 py-1 text-xs font-bold transition ${
                        mobileStationTab === 'current'
                            ? 'border border-slate-900 bg-slate-900 text-white'
                            : 'border border-transparent bg-transparent text-slate-700 hover:text-slate-900'
                    }`}>
                    Current wave {userWaveTime ? `(${userWaveTime})` : ''}
                </button>
                <button
                    type="button"
                    onClick={() => setMobileStationTab('next')}
                    className={`flex-1 py-1 text-xs font-bold transition ${
                        mobileStationTab === 'next'
                            ? 'border border-slate-900 bg-slate-900 text-white'
                            : 'border border-transparent bg-transparent text-slate-700 hover:text-slate-900'
                    }`}>
                    Next wave {nextWaveTime ? `(${nextWaveTime})` : ''}
                </button>
            </div>

            <StartGrid
                data={slotsThisWaveAndNext}
                columns="time"
                selectedParticipantHydrated={undefined}
                toStateButtons={['validated', 'wrongEpunch']}
                variant="station"
                mobileStationTab={mobileStationTab}
                columnLabels={['Checking now', 'Up next']}
                currentWave={clockWave}
            />
        </div>
    )
}
