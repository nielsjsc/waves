import type { ParticipantState } from "@/api/participants"
import { SvgIcon } from "./SvgIcon"

interface Properties {
    state: ParticipantState|"available",
}

export function ParticipantStateIcon({state}: Properties) {
    switch ( state ) {
        case "waiting":
            return <div className="text-purple-600"><SvgIcon icon="clock"/></div>
        case "present":
            return <div className="text-sky-600"><SvgIcon icon="pin"/></div>
        case "validated":
            return <div className="text-green-600"><SvgIcon icon="check-badge"/></div>
        case "noShow":
            return <div className="text-red-600"><SvgIcon icon="triangle-bang"/></div>
        case "notAttending":
            return <div className="text-mauve-500"><SvgIcon icon="x"/></div>
        case "needsAssignment":
            return <div className="text-orange-600"><SvgIcon icon="arrow-box"/></div>
        case "available":
            return <div className="text-orange-600"><SvgIcon icon="tag"/></div>
        default:
            return <></>
    }
}