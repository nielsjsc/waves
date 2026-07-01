import type { ParticipantState } from "@/api/participants";
import { ParticipantStateIcon } from "./ParticipantStateIcon";
import { ParticipantStateStyles } from "@/utils/styleHelpers";


interface Properties {
    state: ParticipantState|"available",
}

export function SlotStateTag({state}: Properties) {
    return <div 
        className={`flex flex-row items-center px-1 rounded-sm ${ParticipantStateStyles.get(state)!.bgLight}`}>
            <ParticipantStateIcon state={state}/>
        </div>
}
