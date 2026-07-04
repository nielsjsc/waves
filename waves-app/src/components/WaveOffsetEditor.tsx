import type { MouseEventHandler } from "react"
import { ManagerActionButton } from "./ManagerActionButton"

interface Properties {
    waveOffsetMinutes: number
    handleWaveOffsetPlus: MouseEventHandler
    handleWaveOffsetMinus: MouseEventHandler
}

export function WaveOffsetEditor({waveOffsetMinutes, handleWaveOffsetPlus, handleWaveOffsetMinus}:Properties) {
    return (
    <div className="flex flex-col gap-2">
        <p className="text-lg">Current wave is <span className="font-extrabold">{waveOffsetMinutes} minutes</span> ahead of clock time.</p>
        <div className="flex flex-row gap-4">
        <ManagerActionButton 
            text={"increase offset"} 
            action={handleWaveOffsetPlus} 
            icon={"plus"} 
            color={"sky"} 
            buttonStyle={"solid"} />
        <ManagerActionButton 
            text={"decrease offset"} 
            action={handleWaveOffsetMinus} 
            icon={"minus"} 
            color={"red"} 
            buttonStyle={"solid"} />
        </div>
    </div>
)}