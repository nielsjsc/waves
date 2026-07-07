import type { MouseEventHandler } from "react"
import { ManagerActionButton } from "./ManagerActionButton"

interface Properties {
    clockTime: string
    clockOffsetHours: number
    clockOffsetMinutes: number
    clockOffsetSeconds: number
    handleHoursPlus: MouseEventHandler
    handleHoursMinus: MouseEventHandler
    handleMinutesPlus: MouseEventHandler
    handleMinutesMinus: MouseEventHandler
    handleSecondsPlus: MouseEventHandler
    handleSecondsMinus: MouseEventHandler
}

export function ClockOffsetEditor({clockTime,
                                    clockOffsetHours,
                                    clockOffsetMinutes,
                                    clockOffsetSeconds,
                                    handleHoursPlus,
                                    handleHoursMinus,
                                    handleMinutesPlus,
                                    handleMinutesMinus,
                                    handleSecondsPlus,
                                    handleSecondsMinus}:Properties) {

    const hoursOffset = clockOffsetHours >= 0 ? `+${clockOffsetHours}` : clockOffsetHours.toString()
    const minutesOffset = clockOffsetMinutes >= 0 ? `+${clockOffsetMinutes}` : clockOffsetMinutes.toString()
    const secondsOffset = clockOffsetSeconds >= 0 ? `+${clockOffsetSeconds}` : clockOffsetSeconds.toString()

    return (
    <div className="flex flex-col gap-2">
        <p className="text-lg">The clock time is <span className="font-extrabold">{clockTime}</span></p>
        <p>Adjust this time to roughly match the official event time.</p>
        <div className="flex flex-row gap-4 items-center">
            <p>Hours: </p>
            <ManagerActionButton 
                text={""} 
                action={handleHoursPlus} 
                icon={"plus"} 
                color={"sky"} 
                buttonStyle={"solid"} />
            <ManagerActionButton 
                text={""} 
                action={handleHoursMinus} 
                icon={"minus"} 
                color={"red"} 
                buttonStyle={"solid"} />
            <p>({hoursOffset} from computer time)</p>
        </div>
        <div className="flex flex-row gap-4 items-center">
            <p>Minutes: </p>
            <ManagerActionButton 
                text={""} 
                action={handleMinutesPlus} 
                icon={"plus"} 
                color={"sky"} 
                buttonStyle={"solid"} />
            <ManagerActionButton 
                text={""} 
                action={handleMinutesMinus} 
                icon={"minus"} 
                color={"red"} 
                buttonStyle={"solid"} />
            <p>({minutesOffset} from computer time)</p>
        </div>
        <div className="flex flex-row gap-4 items-center">
            <p>Seconds: </p>
            <ManagerActionButton 
                text={""} 
                action={handleSecondsPlus} 
                icon={"plus"} 
                color={"sky"} 
                buttonStyle={"solid"} />
            <ManagerActionButton 
                text={""} 
                action={handleSecondsMinus} 
                icon={"minus"} 
                color={"red"} 
                buttonStyle={"solid"} />
            <p>({secondsOffset} from computer time)</p>
        </div>
    </div>
)}