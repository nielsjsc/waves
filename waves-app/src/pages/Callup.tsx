import { getUniqueTimesFromSlots, StartGrid } from "@/components/grid/StartGrid"
import { ManagerActionButton } from "@/components/ManagerActionButton"
import { participantsTanCollection, slotsTanCollection } from "@/database"
import { populateSlotData } from "@/utils/populateSlotData"
import { useLiveQuery } from "@tanstack/react-db"
import { useEffect, useState } from "react"

export function CallUp() {

    const WAVE_GAP_MINUTES = 2 // Only 1 or 2 work, needs more math for other numbers.
    
    const [clockOffsetHours, setClockOffsetHours] = useState(-7)
    const [clockOffsetMinutes, setClockOffsetMinutes] = useState(0)
    const [clockOffsetSeconds, setClockOffsetSeconds] = useState(0)
    const [clockTime, setClockTime] = useState('')
    const [waveOffsetMinutes, setWaveOffsetMinutes] = useState(8)
    const [clockWaveTime, setClockWaveTime] = useState('')
    const [userWaveTime, setUserWaveTime] = useState('')
    const [nextWaveTime, setNextWaveTime] = useState('')
    

    // https://stackoverflow.com/questions/70734401/creating-clock-in-react
    useEffect(() => {
        setInterval(() => {
            const nowEpoch = new Date().getTime()
            const nowEpochOffset = nowEpoch + clockOffsetSeconds*1000 + clockOffsetMinutes*60*1000 + clockOffsetHours*60*60*1000
            const nowDate = new Date(nowEpochOffset)
            
            const hour = nowDate.getHours().toString().padStart(2, "0")
            const minute = nowDate.getMinutes().toString().padStart(2, "0")
            const second = nowDate.getSeconds().toString().padStart(2, "0")
            const nowTimeLocalString = `${hour}:${minute}:${second}`
            setClockTime(nowTimeLocalString)

            const waveDate = new Date(nowEpochOffset + waveOffsetMinutes*60*1000)
            const waveHour = waveDate.getHours().toString().padStart(2, "0")
            const waveActualMinute = waveDate.getMinutes()
            const waveCorrectedMinute = (waveActualMinute % WAVE_GAP_MINUTES === 1) ? waveActualMinute - 1 : waveActualMinute
            const waveMinute = waveCorrectedMinute.toString().padStart(2, "0")
            const waveTimeLocalString = `${waveHour}:${waveMinute}`
            setClockWaveTime(waveTimeLocalString)

        },1000)
    }, [])

    // set next wave when userWaveTime changes
    useEffect(() => {
        const next = getNextWave()
        if (next !== undefined) {
            setNextWaveTime(next)
        }
    }, [userWaveTime])

    const {data: allParticipants} = useLiveQuery((q) =>
        q.from({participant: participantsTanCollection})
    )
    const {data: allSlots} = useLiveQuery((q) =>
        q.from({slot: slotsTanCollection})
    )

    const slotsThisWaveAndNext = populateSlotData(allSlots.filter(x => (x.time === userWaveTime || x.time === nextWaveTime)), allParticipants)

    const waveTimes = getUniqueTimesFromSlots(allSlots)

    function getNextWave():string|undefined {
        if (userWaveTime === '') {
            return
        }
        const currentIndex = waveTimes.findIndex((x) => x === userWaveTime)
        if (currentIndex+1 > waveTimes.length) {
            // no more waves
            return
        }
        return waveTimes[currentIndex+1]
    }

    function getPrevWave():string|undefined {
                if (userWaveTime === '') {
            return
        }
        const currentIndex = waveTimes.findIndex((x) => x === userWaveTime)
        if (currentIndex-1 < 0) {
            // no more waves
            return
        }
        return waveTimes[currentIndex-1]
    }

    function handleGoToCurrentWaveClick() {
        setUserWaveTime(clockWaveTime)
    }
    function handleNextWaveClick() {
        const next = getNextWave()
        if (next === undefined) {
            alert("no future waves");
        } else {
            setUserWaveTime(next)
        }
    }
    function handlePrevWaveClick() {
        const prev = getPrevWave()
        if (prev === undefined) {
            alert("no previous waves")
        } else {
            setUserWaveTime(prev)
        }
    }

    const userWaveFormat = (clockWaveTime === userWaveTime) ? 'text-emerald-500' :
        (userWaveTime > clockWaveTime) ? 'text-sky-500' : 'text-red-500'


    return <div>
        <p>Clock Time: {clockTime}</p>
        <p>Wave Time: {clockWaveTime} ({waveOffsetMinutes} min ahead)</p>
        <p>Selected Wave: <span className={userWaveFormat}>{userWaveTime}</span> Next Wave: {nextWaveTime}</p>
        <ManagerActionButton
            text="Previous"
            icon="left"
            color="sky"
            action={handlePrevWaveClick}
            buttonStyle="outline" />
        <ManagerActionButton
            text="Current Wave"
            icon="arrow-box-down"
            color="sky"
            action={handleGoToCurrentWaveClick}
            buttonStyle="solid" />
        <ManagerActionButton
            text="Next Wave"
            icon="right"
            color="sky"
            action={handleNextWaveClick}
            buttonStyle="outline" />
        <StartGrid 
            data={slotsThisWaveAndNext} 
            columns={"time"} 
            selectedParticipantHydrated={undefined}
            toStateButtons={["present", "noShow"]}
            />
        </div>
}