import { useEffect } from "react";
import { ManagerActionButton } from "./ManagerActionButton";
import { getUniqueTimesFromSlots } from "./grid/StartGrid";
import { useLiveQuery } from "@tanstack/react-db";
import { slotsTanCollection } from "@/database";


interface Properties {
    clockWave: string
    userWaveTime: string
    setUserWaveTime: (wave: string) => void
    nextWaveTime: string
    setNextWaveTime: (wave: string) => void
}

export function WaveSelection({clockWave, userWaveTime, setUserWaveTime, nextWaveTime, setNextWaveTime}:Properties) {

    const {data: allSlots} = useLiveQuery((q) =>
        q.from({slot: slotsTanCollection})
    )
    const waveTimes = getUniqueTimesFromSlots(allSlots)
    // waveTimes is a new array on every render, so effects depend on this string instead.
    const waveKey = waveTimes.join(',')

    // INITIAL SELECTION
    // Start on the clock's wave if it exists, otherwise the first wave, so the
    // page isn't empty until someone presses "Now". Waits for slots to load.
    useEffect(() => {
        if (userWaveTime !== '' || waveTimes.length === 0) {
            return
        }
        setUserWaveTime(waveTimes.includes(clockWave) ? clockWave : waveTimes[0]!)
    }, [userWaveTime, clockWave, waveKey])

    // NEXT WAVE based on USER WAVE
    // Always set it (blank on the last wave) so a stale value never lingers.
    useEffect(() => {
        setNextWaveTime(getNextWave() ?? '')
    }, [userWaveTime, waveKey])


    function getNextWave():string|undefined {
        const currentIndex = waveTimes.indexOf(userWaveTime)
        if (currentIndex === -1) {
            return
        }
        // past the end of the array this is undefined, i.e. no more waves
        return waveTimes[currentIndex+1]
    }

    function getPrevWave():string|undefined {
        const currentIndex = waveTimes.indexOf(userWaveTime)
        if (currentIndex <= 0) {
            // not found, or already the first wave
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
                text={nextWaveTime === '' ? 'Next' : `Next (${nextWaveTime})`}
                icon="right"
                color="sky"
                action={handleNextWaveClick}
                buttonStyle={clockWave !== '' && clockWave === nextWaveTime ? "solid" : "outline"} />
            <ManagerActionButton
                text={clockWave === '' ? 'Now' : `Now (${clockWave})`}
                icon="signal"
                color="emerald"
                action={handleGoToCurrentWaveClick}
                buttonStyle={clockWave !== userWaveTime ? "solid" : "outline"} />
        </div>
    </div>
    )
}