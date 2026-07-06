import { dropAllChanges, dropAllParticipants, dropAllSlots, slotsTanCollection } from "@/database"
import { useLiveQuery } from "@tanstack/react-db"
import { useState, useEffect } from "react"
import { getUniqueTimesFromSlots } from "./grid/StartGrid"
import { SvgIcon } from "./SvgIcon"
import { Modal } from "./Modal"
import { WaveOffsetEditor } from "./WaveOffsetEditor"
import { ClockOffsetEditor } from "./ClockOffsetEditor"
import { readStartListCsv } from "@/dataImport"
import { FullGrid } from "@/pages/FullGrid"
import { Manager } from "@/pages/Manager"
import { CallUp } from "@/pages/CallUp"
import { EpunchVerify } from "@/pages/EpunchVerify"


type TimeContext = {
    clockWave: string
}

export function HeaderWithWaveTime() {
    
    const [clockOffsetHours, setClockOffsetHours] = useState(0)
    const [clockOffsetMinutes, setClockOffsetMinutes] = useState(0)
    const [clockOffsetSeconds, setClockOffsetSeconds] = useState(0)
    const [clockTime, setClockTime] = useState('')
    const [waveOffsetMinutes, setWaveOffsetMinutes] = useState(8)
    const [clockWaveTime, setClockWaveTime] = useState('')

    const [isWaveOffsetModalOpen, setWaveOffsetModalOpen] = useState(false)
    const [isClockOffsetModalOpen, setClockOffsetModalOpen] = useState(false)

    const [appPage, setAppPage] = useState('grid')
    
    const {data: allSlots} = useLiveQuery((q) =>
        q.from({slot: slotsTanCollection})
    )
    
    const waveTimes = getUniqueTimesFromSlots(allSlots)
    
    // CLOCK TIME
    // Adapted from https://stackoverflow.com/questions/70734401/creating-clock-in-react
    useEffect(() => {
        setTimeout(() => {
            const nowEpoch = new Date().getTime()
            const nowEpochOffset = nowEpoch + clockOffsetSeconds*1000 + clockOffsetMinutes*60*1000 + clockOffsetHours*60*60*1000
            const nowDate = new Date(nowEpochOffset)
            
            const hour = nowDate.getHours().toString().padStart(2, "0")
            const minute = nowDate.getMinutes().toString().padStart(2, "0")
            const second = nowDate.getSeconds().toString().padStart(2, "0")
            const nowTimeLocalString = `${hour}:${minute}:${second}`
            setClockTime(nowTimeLocalString)
        },1000)
    }, [clockTime, clockOffsetHours, clockOffsetMinutes, clockOffsetSeconds])

    // CLOCK BASED CURRENT WAVE TIME
    useEffect(() => {
        const nowEpoch = new Date().getTime()
        const nowEpochOffset = nowEpoch + clockOffsetSeconds*1000 + clockOffsetMinutes*60*1000 + clockOffsetHours*60*60*1000

        const waveDate = new Date(nowEpochOffset + waveOffsetMinutes*60*1000)
        const waveHour = waveDate.getHours().toString().padStart(2, "0")
        const clockMinutePlusWaveOffset = waveDate.getMinutes()
        
        // Actual Wave minute is always equal to or less than the Clock Minute Plus Wave Offset.
        // ex: Waves 8 minutes ahead, new wave every 2 minutes
        //     At 10:00 the current wave is 10:08. 
        //     At 10:01 the current wave is 10:08, not 10:09.
        // So if we don't find a wave at this exact minute, subtract a minute and see if there's one there.
        // Do this until we get to actual clock time, or stop if we try to go past minute :00 
        // **stopping at actual clock time is wrong** doesn't handle the 0 offset case properly.
        // That means **this breaks when offset is 0 and next wave is more than 2 minute gap.**
        // That means **this breaks if starts are on odd minutes rather than even minutes**
        for (let i = 0; (i <= waveOffsetMinutes+1); i++) {
            if (clockMinutePlusWaveOffset - i < 0) {break}
            const tryMinute = (clockMinutePlusWaveOffset - i).toString().padStart(2, "0")
            const waveTimeLocalString = `${waveHour}:${tryMinute}`
            if (waveTimes.includes(waveTimeLocalString)) {
                setClockWaveTime(waveTimeLocalString)
                return;
            }
        }
        setClockWaveTime('')
    }, [clockTime, waveTimes, waveOffsetMinutes])

    function displayWaveTime() {
        if (clockWaveTime !== '') {
            return <span>{clockWaveTime}</span>
        } else {
            return <span className="italic">No Wave</span>
        }
    }

    function handleOffsetEditClick() {
        setWaveOffsetModalOpen((prev) => !prev)
    }

    const waveOffsetModal = isWaveOffsetModalOpen ?
        <Modal 
            close={()=>{handleOffsetEditClick()}} 
            title="Wave Offset"
            content={<WaveOffsetEditor 
                waveOffsetMinutes={waveOffsetMinutes}
                handleWaveOffsetPlus={()=>setWaveOffsetMinutes((prev) => {return prev + 1})}
                handleWaveOffsetMinus={()=>setWaveOffsetMinutes((prev) => {return prev > 0 ? prev - 1 : 0})} />
            }
        /> : <></>
    
    function handleClockEditClick() {
        setClockOffsetModalOpen((prev) => !prev)
    }

    const clockOffsetModal = isClockOffsetModalOpen ? 
        <Modal 
            close={()=>handleClockEditClick()}
            title="Clock Time"
            content={<ClockOffsetEditor
                clockTime={clockTime}
                clockOffsetHours={clockOffsetHours}
                clockOffsetMinutes={clockOffsetMinutes}
                clockOffsetSeconds={clockOffsetSeconds}
                handleHoursPlus={()=>setClockOffsetHours((prev)=>prev+1)}
                handleHoursMinus={()=>setClockOffsetHours((prev)=>prev-1)}
                handleMinutesPlus={()=>setClockOffsetMinutes((prev)=>prev+1)}
                handleMinutesMinus={()=>setClockOffsetMinutes((prev)=>prev-1)}
                handleSecondsPlus={()=>setClockOffsetSeconds((prev)=>prev+1)}
                handleSecondsMinus={()=>setClockOffsetSeconds((prev)=>prev-1)}
                />
            }
        /> : <></>
    
    async function handleUWLoadClick() {
        const p1 = await dropAllSlots()
        const p2 = await dropAllParticipants()
        const p3 = await dropAllChanges()

        Promise.all([p1, p2, p3])
        .then(() => {
            console.log('rxdb: re-created collections')
            readStartListCsv()
        })
    }

    function handleNavClick(page:string) {
        setAppPage(page)
    }

    function pageContent() {
        switch (appPage) {
            case 'grid':
                return <FullGrid />
            case 'manager':
                return <Manager />
            case 'call-up':
                return <CallUp clockWave={clockWaveTime}/>
            case 'epunch':
                return <EpunchVerify clockWave={clockWaveTime} />
            default:
                return <FullGrid />
        }
    }

    return <div>
        <header className="text-gray-400 bg-gray-900 body-font">
            <div className="container mx-auto flex flex-wrap p-5 flex-col md:flex-row items-center">
                <a className="flex title-font font-medium items-center text-white mb-4 md:mb-0">
                    <SvgIcon icon="waves-logo" />
                    <span className="ml-3 text-xl">Waves</span>
                </a>
                <div className='title-font text-xl px-2'>
                    <span className="font-black text-white">{displayWaveTime()}&nbsp;</span>
                    <span onClick={handleOffsetEditClick}>({waveOffsetMinutes} min ahead)</span>
                    <span onClick={handleClockEditClick} className='text-base px-2'>Clock Time: {clockTime}</span>
                </div>
                {waveOffsetModal}
                {clockOffsetModal}
            <button 
                className="ml-auto inline-flex items-center bg-gray-800 border-0 ml-2 py-1 px-3 focus:outline-none hover:bg-gray-700 rounded text-base mt-4 md:mt-0"
                onClick={handleUWLoadClick}>
                Load UW
            </button>
            <nav className="md:ml-auto flex flex-wrap items-center text-base justify-center">
                <button className="mr-5 hover:text-white" onClick={()=>handleNavClick('call-up')}>Call-up</button>
                <button className="mr-5 hover:text-white" onClick={()=>handleNavClick('epunch')}>Epunch Check</button>
                <button className="mr-5 hover:text-white" onClick={()=>handleNavClick('manager')}>Start Manager</button>
                <button className="mr-5 hover:text-white" onClick={()=>handleNavClick('grid')}>Full Grid</button>
            </nav>
            </div>
        </header>
        
        <div className="mx-auto">
            {pageContent()}
        </div>
    </div>
}