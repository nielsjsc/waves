import type { ParticipantState } from "@/api/participants";
import { ParticipantStateIcon } from "./ParticipantStateIcon";


interface Properties {
    state: ParticipantState|"available",
}

export function SlotStateTag({state}: Properties) {
    switch ( state ) {
        case "waiting":
            return <div className="flex flex-row items-center px-1 rounded-sm bg-purple-300"><ParticipantStateIcon state={state}/></div>
        case "present":
            return <div className="flex flex-row items-center px-1 rounded-sm bg-sky-300"><ParticipantStateIcon state={state}/></div>
        case "validated":
            return <div className="flex flex-row items-center px-1 rounded-sm bg-green-300"><ParticipantStateIcon state={state}/></div>
        case "noShow":
            return <div className="flex flex-row items-center px-1 rounded-sm bg-red-300"><ParticipantStateIcon state={state}/></div>
        case "notAttending":
            return <div className="flex flex-row items-center px-1 rounded-sm bg-mauve-300"><ParticipantStateIcon state={state}/></div>
        case "needsAssignment":
            return <div className="flex flex-row items-center px-1 rounded-sm bg-orange-300"><ParticipantStateIcon state={state}/></div>
        case "available":
            return <div className="flex flex-row items-center px-1 rounded-sm bg-orange-300"><ParticipantStateIcon state={state}/></div>
        default:
            return <></>
}}
