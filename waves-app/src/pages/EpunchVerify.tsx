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
export function EpunchVerify({clockWave}:Properties) {
    const [userWaveTime, setUserWaveTime] = useState('')
    const [nextWaveTime, setNextWaveTime] = useState('')

    const {data: allParticipants} = useLiveQuery((q) =>
        q.from({participant: participantsTanCollection})
    )
    const {data: allSlots} = useLiveQuery((q) =>
        q.from({slot: slotsTanCollection})
    )

    const slotsThisWaveAndNext = populateSlotData(allSlots.filter(x => (x.time === userWaveTime || x.time === nextWaveTime)), allParticipants)

    return <div className="flex flex-col gap-1">
        <Head title='Tent 1: E-punch check' />
        <WaveSelection
            clockWave={clockWave}
            userWaveTime={userWaveTime}
            setUserWaveTime={setUserWaveTime}
            nextWaveTime={nextWaveTime}
            setNextWaveTime={setNextWaveTime} />
        <StartGrid 
            data={slotsThisWaveAndNext} 
            columns={"time"}
            selectedParticipantHydrated={undefined}
            toStateButtons={["validated", "wrongEpunch"]}
            variant="station"
            columnLabels={["Checking now", "Up next"]}
            currentWave={clockWave}
            className="max-h-[calc(100vh_-_5.5rem)]"
            />
        </div>
}