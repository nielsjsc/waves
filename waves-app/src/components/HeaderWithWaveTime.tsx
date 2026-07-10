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
import { Changes } from "@/pages/Changes"
import { SvgIconWithText } from "./SvgIconWithText"


export function HeaderWithWaveTime() {
    
    const [clockOffsetHours, setClockOffsetHours] = useState(0)
    const [clockOffsetMinutes, setClockOffsetMinutes] = useState(0)
    const [clockOffsetSeconds, setClockOffsetSeconds] = useState(0)
    const [clockTime, setClockTime] = useState('')
    const [waveOffsetMinutes, setWaveOffsetMinutes] = useState(8)
    const [clockWaveTime, setClockWaveTime] = useState('')

    const [isWaveOffsetModalOpen, setWaveOffsetModalOpen] = useState(false)
    const [isClockOffsetModalOpen, setClockOffsetModalOpen] = useState(false)
    const [isNavOpen, setNavOpen] = useState(false)

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

    function handleNavPageClick(page:string) {
        setNavOpen(false)
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
            case 'changes':
                return <Changes />
            default:
                return <FullGrid />
        }
    }

    function pageName() {
        switch(appPage) {
            case 'grid':
                return "Full Grid"
            case 'manager':
                return "Start Manager"
            case 'call-up':
                return "Call Up"
            case 'epunch':
                return "Epunch Check"
            case 'change':
                return "Change Log"
            default:
                return ""
        }
    }

    function handleNavMenuClick() {
        setNavOpen(!isNavOpen)
    }

    const navMenu = isNavOpen ? <div className="absolute flex flex-col z-20 p-1 gap-1 top-6 py-2 right-0 min-w-40 bg-pink-900">
            <button className="rounded-md text-white hover:bg-pink-700 hover:text-pink-200" onClick={()=>handleNavPageClick('call-up')}>Call-up</button>
            <button className="rounded-md text-white hover:bg-pink-700 hover:text-pink-200" onClick={()=>handleNavPageClick('epunch')}>Epunch Check</button>
            <button className="rounded-md text-white hover:bg-pink-700 hover:text-pink-200" onClick={()=>handleNavPageClick('manager')}>Start Manager</button>
            <button className="rounded-md text-white hover:bg-pink-700 hover:text-pink-200" onClick={()=>handleNavPageClick('grid')}>Full Grid</button>
            <button className="rounded-md text-white hover:bg-pink-700 hover:text-pink-200" onClick={()=>handleNavPageClick('changes')}>Change Log</button>
            <button className="rounded-md text-white hover:bg-pink-700 hover:text-pink-200" onClick={handleUWLoadClick}>[temp] Load UW</button>
    </div> : <></>

    const navButtonStyle = isNavOpen ? "bg-pink-900 text-pink-200" : ""
    const navButton = <nav className={`flex flex-wrap items-center text-base justify-center relative p-1 ${navButtonStyle}`}>
        <button onClick={handleNavMenuClick}><SvgIcon icon="hamburger" /></button>
        {navMenu}
    </nav>

    return <div className="">
        <header className="text-gray-400 bg-gray-900 body-font fixed min-w-full max-w-full z-10">
            {waveOffsetModal}
            {clockOffsetModal}

            <div className="container mx-auto flex flex-wrap p-4 flex-row items-center">
                <SvgIconWithText 
                    icon="waves-logo"
                    text="Waves" />
                <div className='title-font text-xl px-2 flex flex-row gap-2'>
                    <span>{pageName()}</span>
                    <span className="font-black text-white">{displayWaveTime()}</span>
                    <span onClick={handleOffsetEditClick}>(+{waveOffsetMinutes})</span>
                </div>
                <div className="ml-auto flex flex-row items-center">
                    {navButton}
                    <span className='px-2' onClick={handleClockEditClick}>{clockTime}</span>
                </div>
            </div>
        </header>
        
        <div className="relative min-w-full max-w-full mx-auto md:px-8 ">
            <div className="absolute top-20">
            {pageContent()}
            </div>
        </div>
    </div>
}