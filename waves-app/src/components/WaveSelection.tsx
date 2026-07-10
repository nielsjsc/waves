import { useEffect } from "react";
import { ManagerActionButton } from "./ManagerActionButton";
import { getUniqueTimesFromSlots } from "./grid/StartGrid";
import { useLiveQuery } from "@tanstack/react-db";
import { slotsTanCollection } from "@/database";


interface Properties {
    clockWave: string
    userWaveTime: string
    setUserWaveTime: Function
    nextWaveTime: string
    setNextWaveTime: Function
}

export function WaveSelection({clockWave, userWaveTime, setUserWaveTime, nextWaveTime, setNextWaveTime}:Properties) {

    const {data: allSlots} = useLiveQuery((q) =>
        q.from({slot: slotsTanCollection})
    )
    const waveTimes = getUniqueTimesFromSlots(allSlots)

    // NEXT WAVE based on USER WAVE
    useEffect(() => {
        const next = getNextWave()
        if (next !== undefined) {
            setNextWaveTime(next)
        }
    }, [userWaveTime])
    

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
        if (waveTimes.includes(clockWave)) {
            setUserWaveTime(clockWave)
        } else {
            setUserWaveTime(waveTimes[0] ?? '')
        }
        
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

    const userWaveFormat = (clockWave === userWaveTime) ? 'text-emerald-500' :
    (userWaveTime > clockWave) ? 'text-sky-500' : 'text-red-500'

    return(
    <div className="container mx-auto flex flex-wrap px-5 items-center gap-2">
        <ManagerActionButton
                text=""
                icon="left"
                color="mauve"
                action={handlePrevWaveClick}
                buttonStyle="outline" />
        <p>Selected Wave: <span className={`text-xl font-bold ${userWaveFormat}`}>{userWaveTime}</span></p>
        <div className="flex flex-row gap-2">
            <ManagerActionButton
                text={`Next (${nextWaveTime})`}
                icon="right"
                color="sky"
                action={handleNextWaveClick}
                buttonStyle={clockWave === nextWaveTime ? "solid" : "outline"} />
            <ManagerActionButton
                text={`Now (${clockWave})`}
                icon="signal"
                color="emerald"
                action={handleGoToCurrentWaveClick}
                buttonStyle={clockWave !== userWaveTime ? "solid" : "outline"} />
        </div>
    </div>
    )
}
